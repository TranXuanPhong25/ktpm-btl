const RabbitMQConnection = require("../messaging/rabbitmq");
const productService = require("../services/productService");
const { EXCHANGES, QUEUES, EVENTS } = require("../messaging/constants");

class ProductEventHandler {
   constructor() {
      this.rabbitMQ = new RabbitMQConnection();
      this.isInitialized = false;
   }

   async initialize(rabbitMQUri) {
      try {
         await this.rabbitMQ.connect(rabbitMQUri);

         await this.rabbitMQ.assertExchange(EXCHANGES.PRODUCT);

         await this.rabbitMQ.assertQueue(QUEUES.PRODUCT_TO_INVENTORY);
         await this.rabbitMQ.bindQueue(
            QUEUES.PRODUCT_TO_INVENTORY,
            EXCHANGES.PRODUCT,
            EVENTS.PRODUCT_CREATED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.PRODUCT_TO_INVENTORY,
            EXCHANGES.PRODUCT,
            EVENTS.PRODUCT_DELETED
         );

         await this.startListening();

         this.isInitialized = true;
         console.log(
            "Product Service Product Event Handler initialized successfully"
         );
      } catch (error) {
         console.error(
            "Failed to initialize Product Event Handler:",
            error.message
         );
         throw error;
      }
   }

   async startListening() {
      await this.rabbitMQ.consume(
         QUEUES.PRODUCT_TO_INVENTORY,
         async (event) => {
            try {
               if (event.eventType === EVENTS.PRODUCT_CREATED) {
                  await this.handleProductCreated(event);
               } else if (event.eventType === EVENTS.PRODUCT_DELETED) {
                  await this.handleProductDeleted(event);
               }
            } catch (error) {
               console.error("Error handling product event:", error.message);
               throw error;
            }
         }
      );
   }

   async handleProductCreated(event) {
      const { id, stock } = event.payload;
      try {
         await productService.createProduct({
            id,
            stock,
         });

         console.log(`✅ Inventory record created for product: ${id}`);
      } catch (error) {
         console.error("Error handling product created event:", error.message);
         throw error;
      }
   }

   async handleProductDeleted(event) {
      const { payload } = event;

      try {
         await productService.deleteProduct(payload.id);

         console.log(`✅ Inventory record deleted for product: ${payload.id}`);
      } catch (error) {
         console.error("Error handling product deleted event:", error.message);
         throw error;
      }
   }

   async close() {
      if (this.isInitialized) {
         await this.rabbitMQ.close();
      }
   }
}

module.exports = new ProductEventHandler();
