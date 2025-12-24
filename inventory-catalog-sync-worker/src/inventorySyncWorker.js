const mongoose = require("mongoose");
const InventoryReadModel = require("./inventoryReadModel");
const RabbitMQConnection = require("./rabbitmq");
const { EXCHANGES, QUEUES, EVENTS } = require("./constants");

class InventorySyncWorker {
   constructor() {
      this.rabbitMQ = new RabbitMQConnection();
      this.isRunning = false;
      this.syncInterval = null;
      this.pendingUpdates = new Map(); // Map<productId, {stock, timestamp}>
      this.pendingMessages = []; // Array to store unacknowledged messages
      this.batchSyncIntervalMs = 5000; // Batch sync every 5 seconds
      this.maxBatchSize = 100; // Max messages to process before acknowledgment
   }

   async initialize(rabbitMQUri, mongoUri) {
      try {
         await mongoose.connect(mongoUri);

         await this.rabbitMQ.connect(rabbitMQUri);

         // Setup exchange and queue with DLQ support
         await this.rabbitMQ.assertExchange(EXCHANGES.INVENTORY);
         await this.rabbitMQ.assertQueueWithDLQ(
            QUEUES.INVENTORY_TO_CATALOG_SYNC,
            3
         ); // Max 3 retries

         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY_TO_CATALOG_SYNC,
            EXCHANGES.INVENTORY,
            EVENTS.INVENTORY_STOCK_UPDATED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY_TO_CATALOG_SYNC,
            EXCHANGES.INVENTORY,
            EVENTS.INVENTORY_RESERVED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY_TO_CATALOG_SYNC,
            EXCHANGES.INVENTORY,
            EVENTS.INVENTORY_RESTORED
         );
         this.start();
      } catch (error) {
         console.error("Error initializing inventory sync worker:", error);
         throw error;
      }
   }

   start() {
      if (this.isRunning) {
         console.log("Inventory sync worker is already running");
         return;
      }

      this.isRunning = true;

      // Start consuming events from RabbitMQ
      this.consumeEvents();

      // Start periodic batch sync
      this.loop();
   }
   async loop() {
      await this.syncPendingUpdates();

      // Monitor DLQ every 10 sync cycles (50 seconds)
      if (Math.floor(Date.now() / 1000) % 50 === 0) {
         await this.monitorDLQ();
      }
      setTimeout(() => this.loop(), this.batchSyncIntervalMs);
   }
   async consumeEvents() {
      try {
         await this.rabbitMQ.consume(
            QUEUES.INVENTORY_TO_CATALOG_SYNC,
            async (event, msg) => {
               const acceptedEventTypes = [
                  EVENTS.INVENTORY_STOCK_UPDATED,
                  EVENTS.INVENTORY_RESERVED,
                  EVENTS.INVENTORY_RESTORED,
               ];

               if (!acceptedEventTypes.includes(event.eventType)) {
                  console.log(`Ignoring event type: ${event.eventType}`);
                  return;
               }
               try {
                  this.pendingMessages.push(msg);

                  await this.processMessage(event, msg);

                  if (this.pendingMessages.length >= this.maxBatchSize) {
                     await this.batchAcknowledgeMessages();
                  }
               } catch (error) {
                  console.error(
                     `❌ Error processing message ${msg.fields.deliveryTag}:`,
                     error
                  );

                  // Remove from pending messages since we'll handle it immediately
                  const msgIndex = this.pendingMessages.findIndex(
                     (m) => m.fields.deliveryTag === msg.fields.deliveryTag
                  );
                  if (msgIndex > -1) {
                     this.pendingMessages.splice(msgIndex, 1);
                  }

                  // Use enhanced nack with retry logic
                  this.rabbitMQ.nackWithRetry(msg, 3);
               }
            },
            { autoAck: false } // Disable auto-acknowledge
         );
      } catch (error) {
         console.error("Error setting up RabbitMQ consumer:", error);
         throw error;
      }
   }

   async processMessage(event, msg) {
      const { payload, timestamp } = event;

      // Coalesce updates: keep only the latest update for each product
      for (const product of payload) {
         const { id, stock } = product;
         const pendingUpdate = this.pendingUpdates.get(id);

         if (pendingUpdate && pendingUpdate.timestamp > timestamp) {
            continue;
         }
         this.pendingUpdates.set(id, {
            stock,
            timestamp: timestamp || new Date(),
         });
      }
   }

   // Determine if an error is retriable or should go straight to DLQ
   isRetriableError(error) {
      const errorMessage = error.message ? error.message.toLowerCase() : "";

      // Non-retriable errors (data validation, business logic errors)
      const nonRetriablePatterns = [
         "invalid product format",
         "missing product id",
         "invalid stock value",
         "invalid event format",
         "validation error",
         "duplicate key error",
      ];

      for (const pattern of nonRetriablePatterns) {
         if (errorMessage.includes(pattern)) {
            return false;
         }
      }

      // Retriable errors (network, temporary database issues)
      const retriablePatterns = [
         "connection",
         "timeout",
         "network",
         "temporary failure",
         "service unavailable",
         "econnreset",
         "enotfound",
      ];

      for (const pattern of retriablePatterns) {
         if (errorMessage.includes(pattern)) {
            return true;
         }
      }

      // Default to retriable for unknown errors
      return true;
   }

   async batchAcknowledgeMessages() {
      if (this.pendingMessages.length === 0) {
         return;
      }

      try {
         // Get the last message in the batch for batch acknowledgment
         const lastMessage =
            this.pendingMessages[this.pendingMessages.length - 1];

         this.rabbitMQ.batchAck(lastMessage);

         console.log(
            `Batch acknowledged ${this.pendingMessages.length} messages`
         );
      } catch (error) {
         console.error("Error batch acknowledging messages:", error);
         // In case of error, try to nack all messages
         for (const msg of this.pendingMessages) {
            this.rabbitMQ.nack(msg, false, true); // requeue=true
         }
      } finally {
         this.pendingMessages = [];
      }
   }

   async syncPendingUpdates() {
      if (this.pendingUpdates.size === 0) {
         // Still acknowledge any pending messages even if no updates
         if (this.pendingMessages.length > 0) {
            await this.batchAcknowledgeMessages();
         }
         return;
      }

      // TODO: is that never have any stock updates after deletion?
      const deleted = Array.from(this.pendingUpdates.entries())
         .filter(
            ([_, data]) =>
               data.stock === null || data.stock === undefined || data.stock < 0
         )
         .map(([productId, _]) => productId);
      const updates = Array.from(this.pendingUpdates.entries())
         .filter(
            ([_, data]) =>
               data.stock !== undefined &&
               data.stock !== null &&
               data.stock >= 0 &&
               !deleted.includes(data.productId)
         )
         .map(([productId, data]) => ({
            productId,
            stock: data.stock,
            lastSyncedAt: data.timestamp,
         }));
      if (deleted.length > 0) {
         console.log(
            `[Catalog Sync] Removing ${deleted.length} products from read model`
         );
      }
      if (deleted.length > 0) {
         try {
            await InventoryReadModel.deleteMany({
               productId: { $in: deleted },
            });
         } catch (error) {
            console.error("Error deleting products from read model:", error);
         }
      }
      try {
         // Bulk write to inventory read model
         const bulkOps = updates.map((update) => ({
            updateOne: {
               filter: { productId: update.productId },
               update: {
                  $set: {
                     stock: update.stock,
                     lastSyncedAt: update.lastSyncedAt,
                  },
               },
               upsert: true,
            },
         }));

         await InventoryReadModel.bulkWrite(bulkOps);

         console.log(
            `[Catalog Sync] Successfully synced ${updates.length} products to read model`
         );

         // Clear pending updates
         this.pendingUpdates.clear();

         // Batch acknowledge all pending messages after successful sync
         if (this.pendingMessages.length > 0) {
            await this.batchAcknowledgeMessages();
         }
      } catch (error) {
         console.error("Error syncing pending updates:", error);

         // Handle different types of sync errors
         const isRetriableError = this.isRetriableError(error);

         if (isRetriableError) {
            for (const msg of this.pendingMessages) {
               this.rabbitMQ.nackWithRetry(msg, 3);
            }
         } else {
            for (const msg of this.pendingMessages) {
               this.rabbitMQ.nack(msg, false, false); // Don't requeue, send to DLQ
            }
         }

         this.pendingMessages = [];
      }
   }

   // Monitor Dead Letter Queue for failed messages
   async monitorDLQ() {
      const dlqName = `${QUEUES.INVENTORY_TO_CATALOG_SYNC}.dlq`;

      try {
         const queueInfo = await this.rabbitMQ.getChannel().checkQueue(dlqName);
         if (queueInfo.messageCount > 0) {
            console.warn(
               `DLQ Alert: ${queueInfo.messageCount} messages in Dead Letter Queue: ${dlqName}`
            );
         }
      } catch (error) {
         // DLQ might not exist yet, that's okay
         if (!error.message.includes("NOT_FOUND")) {
            console.error("Error checking DLQ:", error.message);
         }
      }
   }

   async stop() {
      console.log("Stopping inventory sync worker...");
      this.isRunning = false;

      if (this.syncInterval) {
         clearInterval(this.syncInterval);
         this.syncInterval = null;
      }

      // Sync any remaining pending updates
      await this.syncPendingUpdates();

      // Acknowledge any remaining messages before shutdown
      if (this.pendingMessages.length > 0) {
         await this.batchAcknowledgeMessages();
      }

      // Final DLQ monitoring before shutdown
      await this.monitorDLQ();

      if (this.rabbitMQ) {
         await this.rabbitMQ.close();
      }

      if (mongoose.connection.readyState === 1) {
         await mongoose.connection.close();
      }

      console.log("Inventory sync worker stopped");
   }
}

module.exports = InventorySyncWorker;
