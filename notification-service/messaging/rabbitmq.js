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
         this.isConnected = true;

         console.log("RabbitMQ connected successfully");

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

   async assertQueue(queueName) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }
      await this.channel.assertQueue(queueName, { durable: true });
      return queueName;
   }

   async bindQueue(queueName, exchangeName, routingKey) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }
      await this.channel.bindQueue(queueName, exchangeName, routingKey);
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

   async consume(queueName, onMessage) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      await this.channel.consume(
         queueName,
         async (msg) => {
            if (msg) {
               try {
                  const content = JSON.parse(msg.content.toString());
                  await onMessage(content, msg);
                  this.channel.ack(msg);
               } catch (error) {
                  console.error("Error processing message:", error);
                  // Reject and don't requeue if there's a processing error
                  this.channel.nack(msg, false, false);
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

   getChannel() {
      return this.channel;
   }

   isReady() {
      return this.isConnected && this.channel !== null;
   }
}

module.exports = RabbitMQConnection;
