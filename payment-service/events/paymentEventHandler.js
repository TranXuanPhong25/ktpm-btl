const RabbitMQConnection = require("../messaging/rabbitmq");
const Outbox = require("../models/outbox");
const outboxRepository = require("../repositories/outboxRepository");

// Event types
const EVENTS = {
   PAYMENT_SUCCEEDED: "payment.succeeded",
   PAYMENT_FAILED: "payment.failed",
};

// Exchange and queue names
const EXCHANGES = {
   PAYMENT: "payment_exchange",
};

class PaymentEventHandler {
   constructor() {
      this.rabbitMQ = new RabbitMQConnection();
      this.isInitialized = false;
   }

   async initialize(rabbitMQUri) {
      try {
         await this.rabbitMQ.connect(rabbitMQUri);

         // Setup exchanges
         await this.rabbitMQ.assertExchange(EXCHANGES.PAYMENT);

         // Start listening

         this.isInitialized = true;
         console.log("✓ Payment Event Handler initialized successfully");
      } catch (error) {
         console.error(
            "Failed to initialize Payment Event Handler:",
            error.message
         );
         throw error;
      }
   }

   /**
    * Publish payment succeeded event via outbox
    */
   async publishPaymentSucceeded(orderId, userId, amount, paymentResult) {
      const payload = {
         orderId,
         userId,
         amount,
         paymentId: paymentResult._id || paymentResult.payment?._id,
         timestamp: new Date().toISOString(),
      };

      console.log(
         `📤 Writing PaymentSucceeded event to outbox for order: ${orderId}`
      );

      try {
         await outboxRepository.createOutboxEntry({
            aggregateId: orderId,
            aggregateType: "Payment",
            eventType: EVENTS.PAYMENT_SUCCEEDED,
            payload,
         });
      } catch (err) {
         // Handle duplicate key error (idempotency)
         if (err.code === 11000) {
            console.log(
               `⚠️ PaymentSucceeded event already exists for order: ${orderId}, skipping`
            );
            return;
         }
         throw err;
      }
   }

   /**
    * Publish payment failed event via outbox
    */
   async publishPaymentFailed(orderId, userId, reason, items) {
      const event = {
         orderId,
         userId,
         reason,
         items, // Include items for inventory compensation
         timestamp: new Date().toISOString(),
      };

      console.log(
         `📤 Writing PaymentFailed event to outbox for order: ${orderId}`
      );

      try {
         await Outbox.create({
            aggregateId: orderId,
            aggregateType: "Payment",
            eventType: EVENTS.PAYMENT_FAILED,
            payload: JSON.stringify(event),
         });
      } catch (err) {
         // Handle duplicate key error (idempotency)
         if (err.code === 11000) {
            console.log(
               `⚠️ PaymentFailed event already exists for order: ${orderId}, skipping`
            );
            return;
         }
         throw err;
      }
   }

   async close() {
      if (this.rabbitMQ) {
         await this.rabbitMQ.close();
      }
   }
}

module.exports = new PaymentEventHandler();
