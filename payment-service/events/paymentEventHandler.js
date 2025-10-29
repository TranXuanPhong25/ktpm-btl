const RabbitMQConnection = require("../messaging/rabbitmq");
const paymentService = require("../services/paymentService");

// Event types
const EVENTS = {
   INVENTORY_RESERVED: "inventory.reserved",
   PAYMENT_SUCCEEDED: "payment.succeeded",
   PAYMENT_FAILED: "payment.failed",
};

// Exchange and queue names
const EXCHANGES = {
   INVENTORY: "inventory_exchange",
   PAYMENT: "payment_exchange",
};

const QUEUES = {
   PAYMENT_PROCESSING: "payment_processing_queue",
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
         await this.rabbitMQ.assertExchange(EXCHANGES.INVENTORY);
         await this.rabbitMQ.assertExchange(EXCHANGES.PAYMENT);

         // Setup queue for listening to inventory events
         await this.rabbitMQ.assertQueue(QUEUES.PAYMENT_PROCESSING);
         await this.rabbitMQ.bindQueue(
            QUEUES.PAYMENT_PROCESSING,
            EXCHANGES.INVENTORY,
            EVENTS.INVENTORY_RESERVED
         );

         // Start listening
         await this.startListening();

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

   async startListening() {
      await this.rabbitMQ.consume(QUEUES.PAYMENT_PROCESSING, async (event) => {
         console.log(`📥 Payment service received event: ${event.eventType}`);

         try {
            if (event.eventType === EVENTS.INVENTORY_RESERVED) {
               await this.handleInventoryReserved(event);
            }
         } catch (error) {
            console.error("Error handling event:", error.message);
            throw error;
         }
      });
   }

   /**
    * Handle inventory reserved event - Process payment
    */
   async handleInventoryReserved(event) {
      const { orderId, userId, totalAmount, items } = event;

      console.log(`💳 Processing payment for order: ${orderId}`);

      try {
         // Simulate payment processing
         // In production, this would integrate with real payment gateway
         const paymentResult = await paymentService.processPaymentForOrder(
            orderId,
            totalAmount,
            userId
         );

         // Payment succeeded - publish event
         await this.publishPaymentSucceeded(
            orderId,
            userId,
            totalAmount,
            paymentResult
         );

         console.log(`✓ Payment succeeded for order: ${orderId}`);
      } catch (error) {
         // Payment failed - publish event with items for compensation
         await this.publishPaymentFailed(orderId, userId, error.message, items);

         console.log(
            `✗ Payment failed for order: ${orderId}. Reason: ${error.message}`
         );
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
