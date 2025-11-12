const RabbitMQConnection = require("../messaging/rabbitmq");

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
    * Publish payment succeeded event
    */
   async publishPaymentSucceeded(orderId, userId, amount, paymentResult) {
      const event = {
         eventType: EVENTS.PAYMENT_SUCCEEDED,
         orderId,
         userId,
         amount,
         paymentId: paymentResult._id || paymentResult.payment?._id,
         timestamp: new Date().toISOString(),
      };

      console.log(`📤 Publishing PaymentSucceeded event for order: ${orderId}`);

      await this.rabbitMQ.publish(
         EXCHANGES.PAYMENT,
         EVENTS.PAYMENT_SUCCEEDED,
         event
      );
   }

   /**
    * Publish payment failed event
    */
   async publishPaymentFailed(orderId, userId, reason, items) {
      const event = {
         eventType: EVENTS.PAYMENT_FAILED,
         orderId,
         userId,
         reason,
         items, // Include items for inventory compensation
         timestamp: new Date().toISOString(),
      };

      console.log(`📤 Publishing PaymentFailed event for order: ${orderId}`);

      await this.rabbitMQ.publish(
         EXCHANGES.PAYMENT,
         EVENTS.PAYMENT_FAILED,
         event
      );
   }

   async close() {
      if (this.rabbitMQ) {
         await this.rabbitMQ.close();
      }
   }
}

module.exports = new PaymentEventHandler();
