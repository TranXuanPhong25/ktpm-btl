const RabbitMQConnection = require("../messaging/rabbitmq");
const productService = require("../services/productService");

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
   INVENTORY: "inventory_queue",
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

         // Setup queue for listening to order events
         await this.rabbitMQ.assertQueue(QUEUES.INVENTORY);
         await this.rabbitMQ.bindQueue(
            QUEUES.INVENTORY,
            EXCHANGES.ORDER,
            EVENTS.ORDER_CREATED
         );

         // Start listening to order events
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
      await this.rabbitMQ.consume(QUEUES.INVENTORY, async (event) => {
         console.log(`📥 Received event: ${event.eventType}`);

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

      await this.rabbitMQ.publish(
         EXCHANGES.INVENTORY,
         EVENTS.INVENTORY_RESERVED,
         event
      );

      console.log(`📤 Published InventoryReserved event for order: ${orderId}`);
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

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderEventHandler();
