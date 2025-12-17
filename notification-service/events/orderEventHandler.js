const RabbitMQConnection = require("../messaging/rabbitmq");
const sendEmail = require("../services/emailService");

// Event types
const EVENTS = {
   ORDER_CREATED: "order.created",
   ORDER_PLACED: "order.placed",
   ORDER_FAILED: "order.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
};

const QUEUES = {
   // Dedicated queue for receiving Order events from Order Service
   ORDER_TO_NOTIFICATION: "order.to.notification.queue",
};

class OrderEventHandler {
   constructor() {
      this.rabbitMQ = new RabbitMQConnection();
      this.isInitialized = false;
   }

   async initialize(rabbitMQUri) {
      try {
         await this.rabbitMQ.connect(rabbitMQUri);

         // Setup exchange
         await this.rabbitMQ.assertExchange(EXCHANGES.ORDER);

         // Setup dedicated queue for receiving Order events from Order Service
         await this.rabbitMQ.assertQueue(QUEUES.ORDER_TO_NOTIFICATION);
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_NOTIFICATION,
            EXCHANGES.ORDER,
            EVENTS.ORDER_PLACED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_NOTIFICATION,
            EXCHANGES.ORDER,
            EVENTS.ORDER_CREATED
         );
         await this.rabbitMQ.bindQueue(
            QUEUES.ORDER_TO_NOTIFICATION,
            EXCHANGES.ORDER,
            EVENTS.ORDER_FAILED
         );

         // Start listening to inventory events
         await this.startListening();

         this.isInitialized = true;
         console.log(
            "✓ Notification Service Order Event Handler initialized successfully"
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
      await this.rabbitMQ.consume(
         QUEUES.ORDER_TO_NOTIFICATION,
         async (event) => {
            try {
               if (event.eventType === EVENTS.ORDER_PLACED) {
                  await this.handleOrderPlaced(event);
               } else if (event.eventType === EVENTS.ORDER_FAILED) {
                  await this.handleOrderFailed(event);
               } else if (event.eventType === EVENTS.ORDER_CREATED) {
                  await this.handleOrderCreated(event);
               }
            } catch (error) {
               console.error("Error handling event:", error.message);
               throw error;
            }
         }
      );
   }

   async handleOrderPlaced(event) {
      const { orderId, userId, items } = event.payload;

      try {
         // In a real scenario, you would fetch user email from user service
         // For now, we'll use a placeholder
         const userEmail = "vipboyhoid69@gmail.com";

         const itemList = items
            .map(
               (item) =>
                  `- Product ID: ${item.productId}, Quantity: ${item.quantity}`
            )
            .join("\n");

         const subject = `Order Confirmation - Order #${orderId}`;
         const text = `
            Dear Customer,

            Your order has been successfully placed and confirmed!

            Order ID: ${orderId}
            Items:
            ${itemList}

            Your order is now being processed and will be shipped soon.

            Thank you for your purchase!

            Best regards,
            E-Commerce Team
         `.trim();

         await sendEmail(userEmail, subject, text);

         console.log(`✓ Order success notification sent for order: ${orderId}`);
      } catch (error) {
         console.error(
            `Failed to send notification for order ${orderId}:`,
            error.message
         );
      }
   }

   async handleOrderCreated(event) {
      const { orderId, userId, items } = event.payload;

      try {
         // In a real scenario, you would fetch user email from user service
         // For now, we'll use a placeholder
         const userEmail = "vipboyhoid69@gmail.com";

         const itemList = items
            .map(
               (item) =>
                  `- Product ID: ${item.productId}, Quantity: ${item.quantity}`
            )
            .join("\n");

         const subject = `Order Confirmation - Order #${orderId}`;
         const text = `
            Dear Customer,

            Your order has been successfully created!

            Order ID: ${orderId}
            Items:
            ${itemList}

            Please proceed to checkout to complete your purchase.

            Thank you for shopping with us!

            Best regards,
            E-Commerce Team
         `.trim();

         await sendEmail(userEmail, subject, text);
      } catch (error) {
         console.error(
            `Failed to send notification for order ${orderId}:`,
            error.message
         );
      }
   }
   async handleOrderFailed(event) {
      const { orderId, userId, reason } = event.payload;

      try {
         // In a real scenario, you would fetch user email from user service
         const userEmail = `user_${userId}@example.com`;

         const subject = `Order Failed - Order #${orderId}`;
         const text = `
            Dear Customer,

            We regret to inform you that your order could not be processed.

            Order ID: ${orderId}
            Reason: ${reason}

            Please try again or contact our support team for assistance.

            Best regards,
            E-Commerce Team
         `.trim();

         await sendEmail(userEmail, subject, text);
      } catch (error) {
         console.error(
            `Failed to send failure notification for order ${orderId}:`,
            error.message
         );
      }
   }

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderEventHandler();
