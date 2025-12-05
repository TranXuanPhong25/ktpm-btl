const Outbox = require("../models/outbox");
const rabbitmq = require("../messaging/rabbitmq");

class OutboxPublisher {
   constructor(config) {
      this.serviceName = config.serviceName || "generic";
      this.exchangeName = config.exchangeName;
      this.pollInterval = config.pollInterval || 500;
      this.batchSize = config.batchSize || 100;
      this.isRunning = false;
      this.pollTimer = null;
   }

   async start() {
      if (this.isRunning) {
         console.log(
            `⚠️  [${this.serviceName}] Outbox publisher is already running`
         );
         return;
      }

      this.isRunning = true;
      console.log(
         `✅ [${this.serviceName}] Outbox publisher started (polling every ${this.pollInterval}ms)`
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
            `⚠️  [${this.serviceName}] RabbitMQ not connected, skipping poll`
         );
         return;
      }

      try {
         // Find pending events, oldest first (with retry limit)
         const pendingEvents = await Outbox.find({
            status: "PENDING",
            $or: [
               { retryCount: { $exists: false } },
               {
                  $expr: {
                     $lt: [
                        { $ifNull: ["$retryCount", 0] },
                        { $ifNull: ["$maxRetries", 5] },
                     ],
                  },
               },
            ],
         })
            .sort({ createdAt: 1 })
            .limit(this.batchSize);

         if (pendingEvents.length === 0) {
            return;
         }

         console.log(
            `📤 [${this.serviceName}] Processing ${pendingEvents.length} pending events...`
         );

         for (const event of pendingEvents) {
            await this.publishEvent(event);
         }

         console.log(
            `✅ [${this.serviceName}] Processed ${pendingEvents.length} events`
         );
      } catch (error) {
         console.error(
            `❌ [${this.serviceName}] Error processing pending events:`,
            error
         );
      }
   }

   async publishEvent(event) {
      try {
         // Parse payload
         const payload = JSON.parse(event.payload);

         // Determine routing key from event type
         const routingKey = event.eventType.toLowerCase();

         // Publish to RabbitMQ
         const message = {
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            payload: payload,
            timestamp: new Date().toISOString(),
         };

         await rabbitmq.publish(this.exchangeName, routingKey, message);

         // Mark as processed
         await Outbox.findByIdAndUpdate(event._id, {
            status: "PROCESSED",
            processedAt: new Date(),
         });

         console.log(
            `✓ [${this.serviceName}] Published event ${event._id} (${event.eventType})`
         );
      } catch (error) {
         console.error(
            `❌ [${this.serviceName}] Failed to publish event ${event._id}:`,
            error
         );

         // Increment retry count
         await Outbox.findByIdAndUpdate(event._id, {
            $inc: { retryCount: 1 },
            status:
               event.retryCount + 1 >= event.maxRetries ? "FAILED" : "PENDING",
         });
      }
   }

   async stop() {
      if (this.pollTimer) {
         clearInterval(this.pollTimer);
         this.pollTimer = null;
      }
      this.isRunning = false;
      console.log(`[${this.serviceName}] Outbox publisher stopped`);
   }

   getStats() {
      return {
         serviceName: this.serviceName,
         isRunning: this.isRunning,
         pollInterval: this.pollInterval,
         batchSize: this.batchSize,
      };
   }
}

module.exports = OutboxPublisher;
