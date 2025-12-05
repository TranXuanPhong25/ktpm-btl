const RabbitMQConnection = require("../messaging/rabbitmq");
const productService = require("../services/productService");
const outboxService = require("../services/outboxService");

const EVENTS = {
   ORDER_CREATED: "order.created",
   ORDER_PROCESSING: "order.processing",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_RESTORED: "inventory.restored",
   INVENTORY_FAILED: "inventory.failed",
   ORDER_FAILED: "order.failed",
};

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

         await this.rabbitMQ.assertExchange(EXCHANGES.ORDER);
         await this.rabbitMQ.assertExchange(EXCHANGES.INVENTORY);

         await this.rabbitMQ.assertQueue(QUEUES.ORDER_TO_INVENTORY);
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_INVENTORY,
            EXCHANGES.ORDER,
            EVENTS.ORDER_CREATED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_INVENTORY,
            EXCHANGES.ORDER,
            EVENTS.ORDER_PROCESSING
         );

         await this.rabbitMQ.assertQueue(
            QUEUES.ORDER_TO_INVENTORY_COMPENSATION
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_INVENTORY_COMPENSATION,
            EXCHANGES.ORDER,
            EVENTS.ORDER_FAILED
         );

         await this.startListening();

         this.isInitialized = true;
         console.log(
            "Product Service Order Event Handler initialized successfully"
         );
      } catch (error) {
         console.error("Failed to initialize Event Handler:", error.message);
         throw error;
      }
   }

   async startListening() {
      await this.rabbitMQ.consume(QUEUES.ORDER_TO_INVENTORY, async (event) => {
         console.log(
            `📥 [Inventory] Received from Order Service: ${event.eventType}`
         );

         try {
            if (event.eventType === EVENTS.ORDER_CREATED) {
               console.log(
                  `Received Order Created event for order: ${event.payload.orderId}`
               );
            }
            if (event.eventType === EVENTS.ORDER_PROCESSING) {
               await this.handleOrderProcessing(event);
            }
         } catch (error) {
            console.error("Error handling order created event:", error.message);
            throw error;
         }
      });

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
         },
         true
      );
   }

   async handleOrderProcessing(event) {
      const { aggregateId, payload } = event;
      const { items, userId } = payload;
      console.log(event);
      console.log(
         `🔄 Processing inventory reservation for order: ${aggregateId}`
      );

      const existingEvent = await outboxService.findOutboxEntry({
         aggregateId: aggregateId,
         eventType: [EVENTS.INVENTORY_RESERVED, EVENTS.INVENTORY_FAILED],
      });

      if (existingEvent) {
         console.log(
            `⚠️ Order ${aggregateId} already processed (${existingEvent.eventType}), skipping`
         );
         return;
      }
      try {
         const updates = items.map((item) => ({
            id: item.productId,
            quantity: item.quantity,
         }));
         const outboxData = {
            aggregateId,
            aggregateType: "Inventory",
            eventType: EVENTS.INVENTORY_RESERVED,
            payload: { userId },
            status: "PENDING",
         };
         await productService.bulkDeductStockWithOutbox(updates, outboxData);
      } catch (error) {
         await outboxService.createOutboxEntry({
            aggregateId: aggregateId,
            aggregateType: "Inventory",
            eventType: EVENTS.INVENTORY_FAILED,
            payload: {
               userId,
               reason: error.message,
               timestamp: new Date().toISOString(),
            },
            status: "PENDING",
         });
         console.log(
            `✗ Inventory reservation failed for order: ${aggregateId}. Reason: ${error.message}`
         );
      }
   }
   async handleOrderFailed(event) {
      const { aggregateId, payload } = event;
      const { items } = payload;
      console.log(
         `🔄 Processing inventory restoration for order: ${aggregateId}`
      );

      const existingRestoration = await outboxService.findOutboxEntry({
         aggregateId: aggregateId,
         eventType: EVENTS.INVENTORY_RESTORED,
      });

      if (existingRestoration) {
         console.log(
            `⚠️ Inventory already restored for order: ${aggregateId}, skipping`
         );
         return;
      }

      try {
         const restoredProducts = [];
         for (const item of items) {
            const updatedProduct = await productService.addStock(
               item.productId,
               item.quantity
            );
            restoredProducts.push(updatedProduct);
         }

         await outboxService.createOutboxEntry({
            aggregateId,
            aggregateType: "Inventory",
            eventType: EVENTS.INVENTORY_RESTORED,
            payload: { restoredProducts },
            status: "PENDING",
         });
      } catch (error) {
         console.error(
            `✗ Inventory restoration failed for order: ${aggregateId}. Reason: ${error.message}`
         );
      }
   }
   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderEventHandler();
