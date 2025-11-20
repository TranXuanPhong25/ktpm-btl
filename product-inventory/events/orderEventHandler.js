const RabbitMQConnection = require("../messaging/rabbitmq");
const productService = require("../services/productService");

// Event types
const EVENTS = {
   ORDER_CREATED: "order.created",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_FAILED: "inventory.failed",
   ORDER_FAILED: "order.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
   INVENTORY: "inventory_exchange",
};

const QUEUES = {
   // Dedicated queue for receiving Order Created events from Order Service
   ORDER_TO_INVENTORY: "order.to.inventory.queue",
   // Dedicated queue for receiving Order Failed events for compensation
   ORDER_TO_INVENTORY_COMPENSATION: "order.to.inventory.compensation.queue",
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

         // Setup dedicated queue for receiving Order Created events from Order Service
         await this.rabbitMQ.assertQueue(QUEUES.ORDER_TO_INVENTORY);
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_INVENTORY,
            EXCHANGES.ORDER,
            EVENTS.ORDER_CREATED
         );

         // Setup dedicated queue for receiving Order Failed events (for compensation)
         await this.rabbitMQ.assertQueue(
            QUEUES.ORDER_TO_INVENTORY_COMPENSATION
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_INVENTORY_COMPENSATION,
            EXCHANGES.ORDER,
            EVENTS.ORDER_FAILED
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
      // Listen to Order Created events from Order Service
      await this.rabbitMQ.consume(QUEUES.ORDER_TO_INVENTORY, async (event) => {
         console.log(
            `📥 [Inventory] Received from Order Service: ${event.eventType}`
         );

         try {
            if (event.eventType === EVENTS.ORDER_CREATED) {
               await this.handleOrderCreated(event);
            }
         } catch (error) {
            console.error("Error handling order created event:", error.message);
            throw error;
         }
      });

      // Listen to Order Failed events for compensation
      await this.rabbitMQ.consume(
         QUEUES.ORDER_TO_INVENTORY_COMPENSATION,
         async (event) => {
            console.log(
               `📥 [Inventory] Received compensation request: ${event.eventType}`
            );

            try {
               if (event.eventType === EVENTS.ORDER_FAILED) {
                  await this.handleOrderFailed(event);
               }
            } catch (error) {
               console.error(
                  "Error handling compensation event:",
                  error.message
               );
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
   async handleOrderFailed(event) {
      const { orderId, items, userId } = event;

      console.log(`🔄 Processing inventory reservation for order: ${orderId}`);

      try {
         // Attempt to deduct stock for all items
         const updates = items.map((item) => ({
            id: item.productId,
            quantity: item.quantity,
         }));
         console.log(updates);
         for (const update of updates) {
            await productService.addStock(update.id, update.quantity);
            console.log(
               `✓ Restored ${update.quantity} units of product ${update.id}`
            );
         }
         console.log(`✓ Inventory restoration completed for order: ${orderId}`);
      } catch (error) {
         console.error(
            `✗ Inventory restoration failed for order: ${orderId}. Reason: ${error.message}`
         );
         // Log but don't throw - compensation failure should be monitored but not crash the service
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
    * @deprecated
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
