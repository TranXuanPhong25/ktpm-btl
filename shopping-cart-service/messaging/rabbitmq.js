const amqp = require("amqplib");

class RabbitMQConnection {
   constructor() {
      this.connection = null;
      this.channel = null;
   }

   async connect(uri) {
      try {
         this.connection = await amqp.connect(uri);
         this.channel = await this.connection.createChannel();
         console.log("✓ RabbitMQ connected (Shopping Cart Service)");

         this.connection.on("error", (err) => {
            console.error("RabbitMQ connection error:", err.message);
         });

         this.connection.on("close", () => {
            console.log("RabbitMQ connection closed");
         });
      } catch (error) {
         console.error("Failed to connect to RabbitMQ:", error.message);
         throw error;
      }
   }

   async assertExchange(exchange, type = "topic") {
      await this.channel.assertExchange(exchange, type, { durable: true });
   }

   async assertQueue(queue) {
      await this.channel.assertQueue(queue, { durable: true });
   }

   async bindQueue(queue, exchange, routingKey) {
      await this.channel.bindQueue(queue, exchange, routingKey);
   }

   async consume(queue, handler) {
      await this.channel.consume(
         queue,
         async (msg) => {
            if (msg) {
               try {
                  const event = JSON.parse(msg.content.toString());
                  await handler(event);
                  this.channel.ack(msg);
               } catch (error) {
                  console.error("Error processing message:", error.message);
                  this.channel.nack(msg, false, false);
               }
            }
         },
         { noAck: false }
      );
   }

   async close() {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      console.log("RabbitMQ connection closed");
   }
}

module.exports = RabbitMQConnection;
