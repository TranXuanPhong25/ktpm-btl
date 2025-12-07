const rabbitmqPublisher = require("../messaging/rabbitmqPublisher");
const redisStreamPublisher = require("../messaging/redisStreamPublisher");

/**
 * Multi-Sink Outbox Publisher
 * Polls database for pending events and routes them to configured sinks based on YAML routing rules
 */
class OutboxPublisher {
   constructor(config) {
      this.serviceName = config.serviceName || "unified-relay";
      this.databaseAdapter = config.databaseAdapter;
      this.routingConfig = config.routingConfig;
      this.pollInterval = config.pollInterval || 500;
      this.batchSize = config.batchSize || 100;
      this.isRunning = false;
      this.pollTimer = null;

      // Track which publishers are available
      this.publishers = {
         rabbitmq: rabbitmqPublisher,
         redis_stream: redisStreamPublisher,
      };

      // Statistics
      this.stats = {
         totalProcessed: 0,
         totalFailed: 0,
         sinksPublished: {
            rabbitmq: 0,
            redis_stream: 0,
         },
         sinksFailed: {
            rabbitmq: 0,
            redis_stream: 0,
         },
      };
   }

   /**
    * Start the publisher
    */
   async start() {
      if (this.isRunning) {
         console.log(`⚠️  [${this.serviceName}] Publisher is already running`);
         return;
      }

      // Process immediately on start
      await this.processPendingEvents();

      this.pollTimer = setInterval(() => {
         this.processPendingEvents();
      }, this.pollInterval);
   }

   /**
    * Process pending events from database
    */
   async processPendingEvents() {
      if (!this.databaseAdapter.isConnected()) {
         console.log(
            `⚠️  [${this.serviceName}] Database not connected, skipping poll`
         );
         return;
      }

      try {
         const pendingEvents = await this.databaseAdapter.findPendingEvents(
            this.batchSize
         );

         if (pendingEvents.length === 0) {
            return;
         }

         // Process each event
         for (const event of pendingEvents) {
            await this.publishEvent(event);
         }

         console.log(
            `✅ [${this.serviceName}] Processed ${pendingEvents.length} events`
         );
      } catch (error) {
         console.error(
            `❌ [${this.serviceName}] Error processing pending events:`,
            error.message
         );
      }
   }

   /**
    * Publish a single event to all configured sinks
    */
   async publishEvent(event) {
      try {
         // Parse payload
         const payload = JSON.parse(event.payload);

         // Get sinks for this event type from routing config
         const sinks = this.routingConfig.getSinksForEvent(event.eventType);

         if (sinks.length === 0) {
            console.log(
               `⚠️  [${this.serviceName}] No sinks configured for event type: ${event.eventType}`
            );
            // Mark as processed even if no sinks (to avoid infinite retry)
            await this.databaseAdapter.markAsProcessed(event.id);
            return;
         }

         // Build message
         const message = {
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            payload: payload,
            timestamp: new Date().toISOString(),
         };

         // Publish to all sinks
         const publishResults = await Promise.allSettled(
            sinks.map((sink) => this.publishToSink(sink, message, event))
         );

         // Check if all sinks succeeded
         const allSucceeded = publishResults.every(
            (result) => result.status === "fulfilled" && result.value === true
         );

         if (allSucceeded) {
            // Mark event as processed
            await this.databaseAdapter.markAsProcessed(event.id);
            this.stats.totalProcessed++;
         } else {
            // At least one sink failed - increment retry
            await this.databaseAdapter.incrementRetryCount(event.id);
            this.stats.totalFailed++;

            // Log which sinks failed
            const failures = publishResults
               .map((result, index) => {
                  if (result.status === "rejected") {
                     return `${sinks[index].type}: ${result.reason}`;
                  }
                  return null;
               })
               .filter(Boolean);

            console.error(
               `❌ [${this.serviceName}] Partial failure for event ${event.id}: ${failures.join(", ")}`
            );
         }
      } catch (error) {
         console.error(
            `❌ [${this.serviceName}] Failed to publish event ${event.id}:`,
            error.message
         );

         // Increment retry count
         await this.databaseAdapter.incrementRetryCount(event.id);
         this.stats.totalFailed++;
      }
   }

   /**
    * Publish to a specific sink
    */
   async publishToSink(sink, message, event) {
      try {
         switch (sink.type) {
            case "rabbitmq":
               return await this.publishToRabbitMQ(sink, message, event);

            case "redis_stream":
               return await this.publishToRedisStream(sink, message, event);

            default:
               throw new Error(`Unsupported sink type: ${sink.type}`);
         }
      } catch (error) {
         console.error(
            `Failed to publish to ${sink.type} sink:`,
            error.message
         );
         throw error;
      }
   }

   /**
    * Publish to RabbitMQ
    */
   async publishToRabbitMQ(sink, message, event) {
      if (!this.publishers.rabbitmq.isConnected) {
         throw new Error("RabbitMQ not connected");
      }

      await this.publishers.rabbitmq.publish(
         sink.exchange,
         sink.routing_key,
         message
      );

      this.stats.sinksPublished.rabbitmq++;
      return true;
   }

   /**
    * Publish to Redis Stream
    */
   async publishToRedisStream(sink, message, event) {
      if (!this.publishers.redis_stream.isConnected) {
         throw new Error("Redis Streams not connected");
      }

      await this.publishers.redis_stream.publish(
         sink.stream_key,
         message,
         { maxlen: this.routingConfig.getRedisStreamMaxLen() } // Limit stream size
      );

      this.stats.sinksPublished.redis_stream++;
      return true;
   }

   /**
    * Stop the publisher
    */
   async stop() {
      if (this.pollTimer) {
         clearInterval(this.pollTimer);
         this.pollTimer = null;
      }
      this.isRunning = false;
      console.log(`[${this.serviceName}] Outbox publisher stopped`);
   }

   /**
    * Get publisher statistics
    */
   getStats() {
      return {
         serviceName: this.serviceName,
         isRunning: this.isRunning,
         pollInterval: this.pollInterval,
         batchSize: this.batchSize,
         ...this.stats,
      };
   }
}

module.exports = OutboxPublisher;
