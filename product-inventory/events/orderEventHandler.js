const RabbitMQConnection = require("../messaging/rabbitmq");
const productService = require("../services/productService");

// Event types
const EVENTS = {
   ORDER_CREATED: "order.created",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_FAILED: "inventory.failed",
   PAYMENT_FAILED: "payment.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
   INVENTORY: "inventory_exchange",
   PAYMENT: "payment_exchange",
};

const QUEUES = {
   INVENTORY: "inventory_queue",
   INVENTORY_COMPENSATION: "inventory_compensation_queue",
};

class OrderEventHandler {
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

         // Setup queue for listening to order events
         await this.rabbitMQ.assertQueue(QUEUES.INVENTORY);
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY,
            EXCHANGES.ORDER,
            EVENTS.ORDER_CREATED
         );

         // Setup queue for listening to payment failed events (for compensation)
         await this.rabbitMQ.assertQueue(QUEUES.INVENTORY_COMPENSATION);
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY_COMPENSATION,
            EXCHANGES.PAYMENT,
            EVENTS.PAYMENT_FAILED
         );

         // Start listening to events
         await this.startListening();

         this.isInitialized = true;
         console.log(
            "✓ Product Service Order Event Handler initialized successfully"
         );
      } catch (error) {
         console.error(
            "Failed to initialize Order Event Handler:",
            error.message
         );
         throw error;
      }
   }

   async startListening() {
      // Listen to order created events
      await this.rabbitMQ.consume(QUEUES.INVENTORY, async (event) => {
         console.log(`📥 Inventory queue received event: ${event.eventType}`);

         try {
            if (event.eventType === EVENTS.ORDER_CREATED) {
               await this.handleOrderCreated(event);
            }
         } catch (error) {
            console.error("Error handling event:", error.message);
            throw error;
         }
      });

      // Listen to payment failed events for compensation
      await this.rabbitMQ.consume(
         QUEUES.INVENTORY_COMPENSATION,
         async (event) => {
            console.log(
               `📥 Compensation queue received event: ${event.eventType}`
            );

            try {
               if (event.eventType === EVENTS.PAYMENT_FAILED) {
                  await this.handlePaymentFailed(event);
               }
            } catch (error) {
               console.error(
                  "Error handling compensation event:",
                  error.message
               );
               throw error;
            }
         }
      );
   }

   /**
    * Handle OrderCreated event - Reserve inventory (deduct stock)
    */
   async handleOrderCreated(event) {
      const { orderId, items, userId } = event;

      console.log(`🔄 Processing inventory reservation for order: ${orderId}`);

      try {
         // Attempt to deduct stock for all items
         const updates = items.map((item) => ({
            id: item.productId,
            quantity: item.quantity,
         }));

         await productService.bulkDeductStock(updates);

         // Success - publish InventoryReserved event
         await this.publishInventoryReserved(orderId, userId, items);

         console.log(`✓ Inventory reserved successfully for order: ${orderId}`);
      } catch (error) {
         // Failure - publish InventoryFailed event
         await this.publishInventoryFailed(orderId, userId, error.message);

         console.log(
            `✗ Inventory reservation failed for order: ${orderId}. Reason: ${error.message}`
         );
      }
   }

   /**
    * Publish InventoryReserved event
    */
   async publishInventoryReserved(orderId, userId, items) {
      const event = {
         eventType: EVENTS.INVENTORY_RESERVED,
         orderId,
         userId,
         items,
         timestamp: new Date().toISOString(),
      };

      // Calculate total amount for payment processing
      const totalAmount = await this.calculateTotalAmount(items);
      event.totalAmount = totalAmount;

      await this.rabbitMQ.publish(
         EXCHANGES.INVENTORY,
         EVENTS.INVENTORY_RESERVED,
         event
      );

      console.log(`📤 Published InventoryReserved event for order: ${orderId}`);
   }

   /**
    * Calculate total amount from items
    */
   async calculateTotalAmount(items) {
      let total = 0;
      for (const item of items) {
         const product = await productService.getProductById(item.productId);
         total += product.price * item.quantity;
      }
      return total;
   }

   /**
    * Publish InventoryFailed event
    */
   async publishInventoryFailed(orderId, userId, reason) {
      const event = {
         eventType: EVENTS.INVENTORY_FAILED,
         orderId,
         userId,
         reason,
         timestamp: new Date().toISOString(),
      };

      await this.rabbitMQ.publish(
         EXCHANGES.INVENTORY,
         EVENTS.INVENTORY_FAILED,
         event
      );

      console.log(`📤 Published InventoryFailed event for order: ${orderId}`);
   }

   /**
    * Handle PaymentFailed event - Compensate by restoring inventory
    */
   async handlePaymentFailed(event) {
      const { orderId } = event;

      console.log(
         `🔄 Compensating inventory for order: ${orderId} due to payment failure`
      );

      // We need to get the order items to restore inventory
      // For now, we'll need to retrieve this from the event or store it
      // In a production system, you might store order-inventory mappings

      // Since we don't have items in payment.failed event, we'll add them
      // The payment service should include items in the event
      if (event.items && Array.isArray(event.items)) {
         try {
            // Restore stock for all items
            for (const item of event.items) {
               await productService.addStock(item.productId, item.quantity);
               console.log(
                  `✓ Restored ${item.quantity} units of product ${item.productId}`
               );
            }

            console.log(
               `✓ Inventory compensation completed for order: ${orderId}`
            );
         } catch (error) {
            console.error(
               `✗ Failed to compensate inventory for order: ${orderId}. Error: ${error.message}`
            );
            // Log but don't throw - compensation failure should be monitored but not crash the service
         }
      } else {
         console.warn(
            `⚠️  Cannot compensate inventory for order ${orderId}: items not provided in event`
         );
      }
   }

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderEventHandler();
