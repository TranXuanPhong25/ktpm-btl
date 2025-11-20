const RabbitMQConnection = require("../messaging/rabbitmq");
const orderRepository = require("../repositories/orderRepository");

// Event types
const EVENTS = {
   ORDER_CREATED: "order.created",
   ORDER_FAILED: "order.failed",
   ORDER_PLACED: "order.placed",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_FAILED: "inventory.failed",
   PAYMENT_SUCCEEDED: "payment.succeeded",
   PAYMENT_FAILED: "payment.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
   INVENTORY: "inventory_exchange",
   PAYMENT: "payment_exchange",
};

const QUEUES = {
   // Queue for Order Saga to receive responses from Inventory Service
   INVENTORY_TO_ORDER: "inventory.to.order.queue",
   // Queue for Order Saga to receive responses from Payment Service
   PAYMENT_TO_ORDER: "payment.to.order.queue",
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
         await this.rabbitMQ.assertExchange(EXCHANGES.PAYMENT);

         // Setup dedicated queue for Inventory Service responses
         await this.rabbitMQ.assertQueue(QUEUES.INVENTORY_TO_ORDER);
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY_TO_ORDER,
            EXCHANGES.INVENTORY,
            EVENTS.INVENTORY_RESERVED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY_TO_ORDER,
            EXCHANGES.INVENTORY,
            EVENTS.INVENTORY_FAILED
         );

         // Setup dedicated queue for Payment Service responses
         await this.rabbitMQ.assertQueue(QUEUES.PAYMENT_TO_ORDER);
         await this.rabbitMQ.bindQueue(
            QUEUES.PAYMENT_TO_ORDER,
            EXCHANGES.PAYMENT,
            EVENTS.PAYMENT_SUCCEEDED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.PAYMENT_TO_ORDER,
            EXCHANGES.PAYMENT,
            EVENTS.PAYMENT_FAILED
         );

         // Start listening to events
         await this.startListening();

         this.isInitialized = true;
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

      await this.rabbitMQ.publish(EXCHANGES.ORDER, EVENTS.ORDER_CREATED, event);
   }

   async publishOrderPlaced(order) {
      if (!this.isInitialized) {
         throw new Error("Order Saga not initialized");
      }

      const event = {
         eventType: EVENTS.ORDER_PLACED,
         orderId: order._id.toString(),
         userId: order.userId,
         items: order.items,
         totalAmount: order.totalAmount,
         timestamp: new Date().toISOString(),
      };

      await this.rabbitMQ.publish(EXCHANGES.ORDER, EVENTS.ORDER_PLACED, event);
   }
   async publishOrderFailed(order) {
      if (!this.isInitialized) {
         throw new Error("Order Saga not initialized");
      }

      const event = {
         eventType: EVENTS.ORDER_FAILED,
         orderId: order._id.toString(),
         userId: order.userId,
         items: order.items,
         totalAmount: order.totalAmount,
         reason: order.reason,
         timestamp: new Date().toISOString(),
      };

      await this.rabbitMQ.publish(EXCHANGES.ORDER, EVENTS.ORDER_FAILED, event);
   }

   /**
    * Start listening to inventory and payment events
    */
   async startListening() {
      // Listen to Inventory Service responses
      await this.rabbitMQ.consume(QUEUES.INVENTORY_TO_ORDER, async (event) => {
         console.log(
            `📥 [Order Saga] Received from Inventory: ${event.eventType}`
         );
         try {
            if (event.eventType === EVENTS.INVENTORY_RESERVED) {
               await this.handleInventoryReserved(event);
            } else if (event.eventType === EVENTS.INVENTORY_FAILED) {
               await this.handleInventoryFailed(event);
            }
         } catch (error) {
            console.error("Error handling inventory event:", error.message);
            throw error;
         }
      });

      // Listen to Payment Service responses
      await this.rabbitMQ.consume(QUEUES.PAYMENT_TO_ORDER, async (event) => {
         console.log(
            `📥 [Order Saga] Received from Payment: ${event.eventType}`
         );
         try {
            if (event.eventType === EVENTS.PAYMENT_SUCCEEDED) {
               await this.handlePaymentSucceeded(event);
            } else if (event.eventType === EVENTS.PAYMENT_FAILED) {
               await this.handlePaymentFailed(event);
            }
         } catch (error) {
            console.error("Error handling payment event:", error.message);
            throw error;
         }
      });
   }

   /**
    * Handle successful inventory reservation
    */
   async handleInventoryReserved(event) {
      const { orderId } = event;

      // Update order status to 'Processing'
      await orderRepository.updateStatus(orderId, "Processing");
   }

   /**
    * Handle inventory reservation failure - compensating transaction
    */
   async handleInventoryFailed(event) {
      const { orderId, reason } = event;

      // Compensating transaction: Mark order as Failed
      await orderRepository.updateStatus(orderId, "Failed");
   }

   /**
    * Handle payment succeeded - Complete order
    */
   async handlePaymentSucceeded(event) {
      const { orderId, paymentId } = event;

      // Update order status to 'Completed'
      await orderRepository.updateStatus(orderId, "Completed");
   }

   /**
    * Handle payment failed - Compensate by marking order as failed
    * Inventory will be restored by product service
    */
   async handlePaymentFailed(event) {
      const { orderId, reason } = event;

      // Compensating transaction: Mark order as Failed
      await orderRepository.updateStatus(orderId, "Failed");
      const order = await orderRepository.findById(orderId);
      await this.publishOrderFailed(order);
   }

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderSaga();
