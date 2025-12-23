const amqp = require("amqplib");
const ProcessedMessage = require("../models/processedMessage");

class RabbitMQConnection {
   constructor() {
      this.connection = null;
      this.channel = null;
   }

   async connect(uri) {
      try {
         this.connection = await amqp.connect(uri);
         this.channel = await this.connection.createChannel();
         console.log("✓ RabbitMQ connected (Payment Service)");

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

   async publish(exchange, routingKey, event) {
      this.channel.publish(
         exchange,
         routingKey,
         Buffer.from(JSON.stringify(event)),
         { persistent: true }
      );
   }

   async consume(queue, handler) {
      await this.channel.consume(
         queue,
         async (msg) => {
            if (msg) {
               try {
                  const event = JSON.parse(msg.content.toString());
                  const messageId = msg.properties.messageId || 
                     `${event.aggregateId}-${event.eventType}-${msg.properties.timestamp}`;
                  
                  // Check if message already processed (idempotency)
                  const alreadyProcessed = await ProcessedMessage.findOne({ messageId });
                  if (alreadyProcessed) {
                     console.log(`⚠️ Message ${messageId} already processed, skipping`);
                     this.channel.ack(msg);
                     return;
                  }

                  // Process the message
                  await handler(event);
                  
                  // Mark message as processed
                  try {
                     await ProcessedMessage.create({
                        messageId,
                        eventType: event.eventType,
                        aggregateId: event.aggregateId,
                     });
                  } catch (err) {
                     // Handle duplicate key error (race condition)
                     if (err.code === 11000) {
                        console.log(`⚠️ Message ${messageId} was processed concurrently, skipping`);
                     } else {
                        throw err;
                     }
                  }
                  
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
