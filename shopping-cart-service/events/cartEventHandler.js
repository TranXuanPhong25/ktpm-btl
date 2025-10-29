const RabbitMQConnection = require("../messaging/rabbitmq");
const cartRepository = require("../repositories/cartRepository");

// Event types
const EVENTS = {
   ORDER_CREATED: "order.created",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
};

const QUEUES = {
   CART_CLEAR: "cart_clear_queue",
};

class CartEventHandler {
   constructor() {
      this.rabbitMQ = new RabbitMQConnection();
      this.isInitialized = false;
   }

   async initialize(rabbitMQUri) {
      try {
         await this.rabbitMQ.connect(rabbitMQUri);

         // Setup exchange for order events
         await this.rabbitMQ.assertExchange(EXCHANGES.ORDER);

         // Setup queue for cart service to listen to order events
         await this.rabbitMQ.assertQueue(QUEUES.CART_CLEAR);
         await this.rabbitMQ.bindQueue(
            QUEUES.CART_CLEAR,
            EXCHANGES.ORDER,
            EVENTS.ORDER_CREATED
         );

         // Start listening to order created events
         await this.startListening();

         this.isInitialized = true;
         console.log("✓ Cart Event Handler initialized successfully");
      } catch (error) {
         console.error(
            "Failed to initialize Cart Event Handler:",
            error.message
         );
         throw error;
      }
   }

   /**
    * Start listening to order events
    */
   async startListening() {
      await this.rabbitMQ.consume(QUEUES.CART_CLEAR, async (event) => {
         console.log(`📥 Cart service received event: ${event.eventType}`);

         try {
            if (event.eventType === EVENTS.ORDER_CREATED) {
               await this.handleOrderCreated(event);
            }
         } catch (error) {
            console.error("Error handling event:", error.message);
            throw error;
         }
      });
   }

   /**
    * Handle order created event - clear the user's cart
    */
   async handleOrderCreated(event) {
      const { orderId, userId } = event;

      try {
         console.log(
            `🛒 Clearing cart for user ${userId} after order ${orderId} creation`
         );

         await cartRepository.clearItems(userId);

         console.log(`✓ Cart cleared successfully for user ${userId}`);
      } catch (error) {
         console.error(
            `Failed to clear cart for user ${userId}:`,
            error.message
         );
         // Don't throw error - cart clearing is not critical for order processing
         // The order has already been created successfully
      }
   }

   async close() {
      if (this.rabbitMQ) {
         await this.rabbitMQ.close();
      }
   }
}

module.exports = new CartEventHandler();
