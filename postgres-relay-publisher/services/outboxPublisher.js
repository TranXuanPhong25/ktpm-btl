const rabbitmq = require("../messaging/rabbitmq");
const { Op } = require("sequelize");

class OutboxPublisher {
   constructor(config) {
      this.serviceName = config.serviceName || "generic";
      this.exchangeName = config.exchangeName;
      this.pollInterval = config.pollInterval || 500;
      this.batchSize = config.batchSize || 100;
      this.isRunning = false;
      this.pollTimer = null;
      this.Outbox = config.OutboxModel;
   }

   async start() {
      if (this.isRunning) {
         console.log(
            `[${this.serviceName}] Outbox publisher is already running`
         );
         return;
      }

      this.isRunning = true;
      console.log(
         `[${this.serviceName}] Outbox publisher started (polling every ${this.pollInterval}ms)`
      );

      // Process immediately on start
      await this.processPendingEvents();

      // Then schedule regular polling
      this.pollTimer = setInterval(() => {
         this.processPendingEvents();
      }, this.pollInterval);
   }

   async processPendingEvents() {
      if (!rabbitmq.isConnected) {
         console.log(
            `[${this.serviceName}] RabbitMQ not connected, skipping poll`
         );
         return;
      }

      try {
         // Find pending events, oldest first (with retry limit)
         const pendingEvents = await this.Outbox.findAll({
            where: {
               status: "PENDING",
               [Op.or]: [
                  { retryCount: null },
                  {
                     retryCount: {
                        [Op.lt]: this.Outbox.sequelize.col("maxRetries"),
                     },
                  },
               ],
            },
            order: [["createdAt", "ASC"]],
            limit: this.batchSize,
         });

         if (pendingEvents.length === 0) {
            return;
         }

         console.log(
            `[${this.serviceName}] Processing ${pendingEvents.length} pending events...`
         );

         for (const event of pendingEvents) {
            await this.publishEvent(event);
         }

         console.log(
            `[${this.serviceName}] Processed ${pendingEvents.length} events`
         );
      } catch (error) {
         console.error(
            `[${this.serviceName}] Error processing pending events:`,
            error.message
         );
      }
   }

   async publishEvent(event) {
      try {
         const payload = JSON.parse(event.payload);

         // Publish to RabbitMQ
         await rabbitmq.publish(this.exchangeName, event.eventType, {
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            payload,
            timestamp: event.createdAt,
         });

         // Mark as processed
         await event.update({
            status: "PROCESSED",
            processedAt: new Date(),
         });

         console.log(
            `[${this.serviceName}] Published event ${event.eventType} for ${event.aggregateId}`
         );
      } catch (error) {
         console.error(
            `[${this.serviceName}] Failed to publish event ${event.id}:`,
            error.message
         );

         // Increment retry count
         const retryCount = (event.retryCount || 0) + 1;
         const maxRetries = event.maxRetries || 5;

         if (retryCount >= maxRetries) {
            // Mark as failed after max retries
            await event.update({
               status: "FAILED",
               retryCount,
            });
            console.error(
               `[${this.serviceName}] Event ${event.id} marked as FAILED after ${retryCount} attempts`
            );
         } else {
            // Increment retry count
            await event.update({
               retryCount,
            });
         }
      }
   }

   async stop() {
      if (!this.isRunning) {
         return;
      }

      if (this.pollTimer) {
         clearInterval(this.pollTimer);
         this.pollTimer = null;
      }
      this.isRunning = false;
      console.log(`[${this.serviceName}] Outbox publisher stopped`);
   }
}

module.exports = OutboxPublisher;
