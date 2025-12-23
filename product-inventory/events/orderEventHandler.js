const RabbitMQConnection = require("../messaging/rabbitmq");
const productService = require("../services/productService");
const outboxService = require("../services/outboxService");
const { EXCHANGES, QUEUES, EVENTS } = require("../messaging/constants");
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
         // await this.rabbitMQ.bindQueue(
         //    QUEUES.ORDER_TO_INVENTORY,
         //    EXCHANGES.ORDER,
         //    EVENTS.ORDER_CREATED
         // );
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
         try {
            if (event.eventType === EVENTS.ORDER_CREATED) {
               console.log(
                  `Received Order Created event for order: ${event.payload.orderId}`
               );
            } else if (event.eventType === EVENTS.ORDER_PROCESSING) {
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
         false
      );
   }

   async handleOrderProcessing(event) {
      const { aggregateId, payload } = event;
      const { items, userId } = payload;

      const existingEvent = await outboxService.findOutboxEntry({
         aggregateId: aggregateId,
         eventType: [EVENTS.INVENTORY_RESERVED, EVENTS.INVENTORY_FAILED],
      });

      if (existingEvent) {
         console.log(
            `[INVENTORY] Order ${aggregateId} already processed (${existingEvent.eventType}), skipping`
         );
         return;
      }
      try {
         const updates = items.map((item) => ({
            id: item.productId,
            quantity: -item.quantity,
         }));
         await productService.bulkUpdateStockWithOutbox(updates, aggregateId);
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
         const updates = items.map((item) => ({
            id: item.productId,
            quantity: Math.abs(item.quantity), // ensure positive quantity for restoration
            name: item.name,
         }));
         await productService.bulkUpdateStockWithOutbox(updates, aggregateId);
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
