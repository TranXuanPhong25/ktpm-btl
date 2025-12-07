const amqp = require("amqplib");

/**
 * RabbitMQ connection and publishing client
 */
class RabbitMQPublisher {
   constructor() {
      this.connection = null;
      this.channel = null;
      this.isConnected = false;
      this.uri = null;
   }

   /**
    * Connect to RabbitMQ
    */
   async connect(uri) {
      try {
         this.uri = uri;
         this.connection = await amqp.connect(uri);
         this.channel = await this.connection.createChannel();
         this.isConnected = true;

         console.log("✓ RabbitMQ connected successfully");

         // Handle connection errors
         this.connection.on("error", (err) => {
            console.error("RabbitMQ connection error:", err.message);
            this.isConnected = false;
         });

         // Handle connection close and reconnect
         this.connection.on("close", () => {
            console.log("RabbitMQ connection closed. Reconnecting...");
            this.isConnected = false;
            setTimeout(() => this.connect(this.uri), 5000);
         });

         return this.channel;
      } catch (error) {
         console.error("Failed to connect to RabbitMQ:", error.message);
         throw error;
      }
   }

   /**
    * Assert (create if not exists) an exchange
    */
   async assertExchange(exchangeName, exchangeType = "topic") {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }
      await this.channel.assertExchange(exchangeName, exchangeType, {
         durable: true,
      });
      console.log(`  ✓ Exchange '${exchangeName}' asserted`);
   }

   /**
    * Publish a message to RabbitMQ exchange
    */
   async publish(exchangeName, routingKey, message) {
      if (!this.channel) {
         throw new Error("Channel not initialized. Call connect() first.");
      }

      if (!this.isConnected) {
         throw new Error("RabbitMQ not connected");
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const success = this.channel.publish(
         exchangeName,
         routingKey,
         messageBuffer,
         {
            persistent: true,
            contentType: "application/json",
            timestamp: Date.now(),
         }
      );

      if (!success) {
         throw new Error("Failed to publish message to RabbitMQ");
      }

      return true;
   }

   /**
    * Close RabbitMQ connection
    */
   async close() {
      try {
         if (this.channel) {
            await this.channel.close();
         }
         if (this.connection) {
            await this.connection.close();
         }
         this.isConnected = false;
         console.log("✓ RabbitMQ connection closed");
      } catch (error) {
         console.error("Error closing RabbitMQ connection:", error.message);
      }
   }

   /**
    * Get connection status
    */
   getStatus() {
      return {
         connected: this.isConnected,
         uri: this.uri ? this.uri.replace(/:[^:@]+@/, ":***@") : null, // Hide password
      };
   }
}

module.exports = new RabbitMQPublisher();
