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

         console.log("✓ RabbitMQ connected successfully");

         this.connection.on("error", (err) => {
            console.error("RabbitMQ connection error:", err);
            this.isConnected = false;
         });

         this.connection.on("close", () => {
            console.log("RabbitMQ connection closed. Reconnecting...");
            this.isConnected = false;
            setTimeout(() => this.connect(uri), 5000);
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
         console.error("Error closing RabbitMQ connection:", error);
      }
   }

   getChannel() {
      return this.channel;
   }
}

module.exports = new RabbitMQConnection();
