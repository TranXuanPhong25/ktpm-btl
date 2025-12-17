const amqp = require("amqplib");

class RabbitMQConnection {
   constructor() {
      this.connection = null;
      this.channel = null;
      this.isConnected = false;
   }

   async connect(uri) {
      try {
         this.connection = await amqp.connect(uri);
         this.channel = await this.connection.createChannel();

         // Set prefetch count to 100 messages without global flag
         await this.channel.prefetch(100, false);

         this.isConnected = true;

         // Handle connection errors
         this.connection.on("error", (err) => {
            console.error("RabbitMQ connection error:", err);
            this.isConnected = false;
         });

         this.connection.on("close", () => {
            console.log("RabbitMQ connection closed");
            this.isConnected = false;
         });

         return this.channel;
      } catch (error) {
         console.error("Failed to connect to RabbitMQ:", error.message);
         throw error;
      }
   }

   async assertExchange(exchangeName, exchangeType = "topic") {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }
      await this.channel.assertExchange(exchangeName, exchangeType, {
         durable: true,
      });
   }

   async assertQueue(queueName, options = {}) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      const defaultOptions = { durable: true };
      const queueOptions = { ...defaultOptions, ...options };

      await this.channel.assertQueue(queueName, queueOptions);
      return queueName;
   }

   async assertDLQ(mainQueueName) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      const dlxName = `${mainQueueName}.dlx`;
      const dlqName = `${mainQueueName}.dlq`;

      // Assert Dead Letter Exchange
      await this.channel.assertExchange(dlxName, "direct", { durable: true });

      // Assert Dead Letter Queue
      await this.channel.assertQueue(dlqName, {
         durable: true,
         arguments: {
            // Optional: Set TTL for DLQ messages (24 hours)
            "x-message-ttl": 24 * 60 * 60 * 1000,
         },
      });

      await this.channel.bindQueue(dlqName, dlxName, mainQueueName);

      return { dlxName, dlqName };
   }

   async bindQueue(queueName, exchangeName, routingKey) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }
      await this.channel.bindQueue(queueName, exchangeName, routingKey);
   }

   async assertQueueWithDLQ(queueName, maxRetries = 3) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      // Setup DLQ first
      const { dlxName } = await this.assertDLQ(queueName);

      // Assert main queue with DLQ configuration
      await this.channel.assertQueue(queueName, {
         durable: true,
         arguments: {
            "x-dead-letter-exchange": dlxName,
            "x-dead-letter-routing-key": queueName,
            "x-max-retries": maxRetries,
         },
      });

      return queueName;
   }

   async publish(exchangeName, routingKey, message) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      return this.channel.publish(exchangeName, routingKey, messageBuffer, {
         persistent: true,
         contentType: "application/json",
         timestamp: Date.now(),
      });
   }

   async consume(queueName, onMessage, options = {}) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      const { autoAck = false, requeueOnError = false } = options;

      await this.channel.consume(
         queueName,
         async (msg) => {
            if (msg) {
               try {
                  const content = JSON.parse(msg.content.toString());
                  await onMessage(content, msg);

                  // Only auto-ack if enabled
                  if (autoAck) {
                     this.channel.ack(msg);
                  }
               } catch (error) {
                  console.error("Error processing message:", error);
                  // Reject and don't requeue if there's a processing error
                  this.channel.nack(msg, false, requeueOnError);
               }
            }
         },
         { noAck: false }
      );
   }

   async close() {
      try {
         if (this.channel) {
            await this.channel.close();
         }
         if (this.connection) {
            await this.connection.close();
         }
         this.isConnected = false;
         console.log("RabbitMQ connection closed gracefully");
      } catch (error) {
         console.error("Error closing RabbitMQ connection:", error.message);
      }
   }

   // Manual acknowledgment methods
   ack(msg) {
      if (this.channel && msg) {
         this.channel.ack(msg);
      }
   }

   nack(msg, allUpTo = false, requeue = false) {
      if (this.channel && msg) {
         this.channel.nack(msg, allUpTo, requeue);
      }
   }

   // Enhanced nack with retry logic
   nackWithRetry(msg, maxRetries = 3) {
      if (!this.channel || !msg) return;

      // Get current retry count from message headers
      const retryCount =
         (msg.properties.headers && msg.properties.headers["x-retry-count"]) ||
         0;

      if (retryCount >= maxRetries) {
         // Max retries reached, send to DLQ (don't requeue)
         console.log(
            `Message ${msg.fields.deliveryTag} exceeded max retries (${maxRetries}), sending to DLQ`
         );
         this.channel.nack(msg, false, false);
      } else {
         // Increment retry count and requeue
         console.log(
            `Message ${msg.fields.deliveryTag} retry ${retryCount + 1}/${maxRetries}`
         );
         this.channel.nack(msg, false, true);
      }
   }

   // Batch acknowledge all messages up to and including this one
   batchAck(msg) {
      if (this.channel && msg) {
         this.channel.ack(msg, true); // allUpTo = true
      }
   }

   // Republish message with incremented retry count
   async republishWithRetry(msg, queueName, maxRetries = 3) {
      if (!this.channel || !msg) return false;

      const retryCount =
         (msg.properties.headers && msg.properties.headers["x-retry-count"]) ||
         0;

      if (retryCount >= maxRetries) {
         console.log(
            `Message exceeded max retries (${maxRetries}), sending to DLQ`
         );
         this.channel.nack(msg, false, false); // Send to DLQ
         return false;
      }

      // Republish with incremented retry count
      const newHeaders = {
         ...msg.properties.headers,
         "x-retry-count": retryCount + 1,
         "x-original-queue": queueName,
      };

      await this.channel.sendToQueue(queueName, msg.content, {
         ...msg.properties,
         headers: newHeaders,
      });

      // Ack original message
      this.channel.ack(msg);
      console.log(`Message republished with retry count: ${retryCount + 1}`);
      return true;
   }

   getChannel() {
      return this.channel;
   }

   isReady() {
      return this.isConnected && this.channel !== null;
   }
}

module.exports = RabbitMQConnection;
