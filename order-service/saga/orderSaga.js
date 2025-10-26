const RabbitMQConnection = require("../messaging/rabbitmq");
const orderRepository = require("../repositories/orderRepository");

// Event types
const EVENTS = {
   ORDER_CREATED: "order.created",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_FAILED: "inventory.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
   INVENTORY: "inventory_exchange",
};

const QUEUES = {
   ORDER_SAGA: "order_saga_queue",
};

class OrderSaga {
   constructor() {
      this.rabbitMQ = new RabbitMQConnection();
      this.isInitialized = false;
   }

   async initialize(rabbitMQUri) {
      try {
         await this.rabbitMQ.connect(rabbitMQUri);

         // Setup exchanges
         await this.rabbitMQ.assertExchange(EXCHANGES.ORDER);
         await this.rabbitMQ.assertExchange(EXCHANGES.INVENTORY);

         // Setup queue for saga to listen to inventory events
         await this.rabbitMQ.assertQueue(QUEUES.ORDER_SAGA);
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_SAGA,
            EXCHANGES.INVENTORY,
            "inventory.*"
         );

         // Start listening to inventory events
         await this.startListening();

         this.isInitialized = true;
         console.log("✓ Order Saga initialized successfully");
      } catch (error) {
         console.error("Failed to initialize Order Saga:", error.message);
         throw error;
      }
   }

   /**
    * Publish OrderCreated event to trigger saga
    */
   async publishOrderCreated(order) {
      if (!this.isInitialized) {
         throw new Error("Order Saga not initialized");
      }

      const event = {
         eventType: EVENTS.ORDER_CREATED,
         orderId: order._id.toString(),
         userId: order.userId,
         items: order.items,
         totalAmount: order.totalAmount,
         timestamp: new Date().toISOString(),
      };

      console.log(`📤 Publishing OrderCreated event for order: ${order._id}`);

      await this.rabbitMQ.publish(EXCHANGES.ORDER, EVENTS.ORDER_CREATED, event);
   }

   /**
    * Start listening to inventory events
    */
   async startListening() {
      await this.rabbitMQ.consume(QUEUES.ORDER_SAGA, async (event) => {
         console.log(`📥 Received event: ${event.eventType}`);

         try {
            if (event.eventType === EVENTS.INVENTORY_RESERVED) {
               await this.handleInventoryReserved(event);
            } else if (event.eventType === EVENTS.INVENTORY_FAILED) {
               await this.handleInventoryFailed(event);
            }
         } catch (error) {
            console.error("Error handling event:", error.message);
            throw error;
         }
      });
   }

   /**
    * Handle successful inventory reservation
    */
   async handleInventoryReserved(event) {
      const { orderId } = event;

      console.log(`✓ Inventory reserved successfully for order: ${orderId}`);

      // Update order status to 'Processing'
      await orderRepository.updateStatus(orderId, "Processing");

      console.log(`✓ Order ${orderId} status updated to Processing`);
   }

   /**
    * Handle inventory reservation failure - compensating transaction
    */
   async handleInventoryFailed(event) {
      const { orderId, reason } = event;

      console.log(
         `✗ Inventory reservation failed for order: ${orderId}. Reason: ${reason}`
      );

      // Compensating transaction: Mark order as Failed
      await orderRepository.updateStatus(orderId, "Failed");

      console.log(
         `✓ Compensating transaction: Order ${orderId} marked as Failed`
      );
   }

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderSaga();
