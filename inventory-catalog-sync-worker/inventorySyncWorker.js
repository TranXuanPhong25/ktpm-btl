const Redis = require("ioredis");
const mongoose = require("mongoose");
const InventoryReadModel = require("./inventoryReadModel");

class InventorySyncWorker {
   constructor() {
      this.redis = null;
      this.streamKey = "inventory:stock_updates";
      this.consumerGroup = "catalog-sync-group";
      this.consumerName = `catalog-sync-${process.pid}`;
      this.isRunning = false;
      this.syncInterval = null;
      this.pendingUpdates = new Map(); // Map<productId, {stock, timestamp}>
      this.batchSyncIntervalMs = 5000; // Batch sync every 5 seconds
   }

   async initialize(redisUri, mongoUri) {
      try {
         // Connect to MongoDB
         await mongoose.connect(mongoUri);
         console.log("✓ MongoDB connected for inventory sync worker");

         // Connect to Redis
         this.redis = new Redis(redisUri);
         await this.redis.ping();
         console.log("✓ Redis connected for inventory sync worker");

         try {
            await this.redis.xgroup(
               "CREATE",
               this.streamKey,
               this.consumerGroup,
               "0",
               "MKSTREAM"
            );
            console.log(`✓ Consumer group '${this.consumerGroup}' created`);
         } catch (error) {
            if (!error.message.includes("BUSYGROUP")) {
               throw error;
            }
         }

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

      // Start consuming events from Redis Stream
      this.consumeEvents();

      // Start periodic batch sync
      this.syncInterval = setInterval(() => {
         this.syncPendingUpdates();
      }, this.batchSyncIntervalMs);
   }

   async consumeEvents() {
      while (this.isRunning) {
         try {
            // Read messages from stream (blocking for 1 second)
            const results = await this.redis.xreadgroup(
               "GROUP",
               this.consumerGroup,
               this.consumerName,
               "COUNT",
               10,
               "BLOCK",
               1000,
               "STREAMS",
               this.streamKey,
               ">"
            );
            if (results && results.length > 0) {
               const [_streamName, messages] = results[0];
               for (const [messageId, fields] of messages) {
                  await this.processMessage(messageId, fields);
               }
            }
         } catch (error) {
            if (this.isRunning) {
               console.error(
                  "Error consuming events from Redis Stream:",
                  error
               );
               // Wait a bit before retrying
               await new Promise((resolve) => setTimeout(resolve, 1000));
            }
         }
      }
   }

   async processMessage(messageId, fields) {
      try {
         // Convert Redis Stream fields array to object
         const event = {};
         for (let i = 0; i < fields.length; i += 2) {
            event[fields[i]] = fields[i + 1];
         }

         // Parse payload
         const payload = JSON.parse(event.payload || "[]");
         if (payload && Array.isArray(payload)) {
            // Coalesce updates: keep only the latest update for each product
            for (const product of payload) {
               const { id, stock } = product;
               this.pendingUpdates.set(id, {
                  stock,
                  timestamp: new Date(),
               });
            }

            console.log(
               `📥 [Catalog Sync] Queued ${payload.length} product updates for coalescing`
            );
         }

         // Acknowledge the message
         await this.redis.xack(this.streamKey, this.consumerGroup, messageId);
      } catch (error) {
         console.error(`Error processing message ${messageId}:`, error);
      }
   }

   async syncPendingUpdates() {
      if (this.pendingUpdates.size === 0) {
         return;
      }
      const updates = Array.from(this.pendingUpdates.entries())
         .filter(
            ([_, data]) =>
               data.stock !== undefined &&
               data.stock !== null &&
               data.stock >= 0
         )
         .map(([productId, data]) => ({
            productId,
            stock: data.stock,
            lastSyncedAt: data.timestamp,
         }));
      // TODO: is that never have any stock updates after deletion?
      const deleted = Array.from(this.pendingUpdates.entries())
         .filter(
            ([_, data]) =>
               data.stock === null || data.stock === undefined || data.stock < 0
         )
         .map(([productId, _]) => productId);

      if (deleted.length > 0) {
         console.log(
            `🔄 [Catalog Sync] Removing ${deleted.length} products from read model`
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
      console.log(
         `🔄 [Catalog Sync] Syncing ${updates.length} product stock updates`
      );

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
            `✅ [Catalog Sync] Successfully synced ${updates.length} products to read model`
         );

         // Clear pending updates
         this.pendingUpdates.clear();
      } catch (error) {
         console.error("Error syncing pending updates:", error);
         // Keep pending updates for retry
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

      if (this.redis) {
         await this.redis.quit();
         this.redis = null;
      }

      if (mongoose.connection.readyState === 1) {
         await mongoose.connection.close();
      }

      console.log("✓ Inventory sync worker stopped");
   }
}

module.exports = InventorySyncWorker;
