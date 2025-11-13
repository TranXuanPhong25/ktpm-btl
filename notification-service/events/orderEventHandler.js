const RabbitMQConnection = require("../messaging/rabbitmq");
const sendEmail = require("../services/emailService");

// Event types
const EVENTS = {
   ORDER_SUCCESSFUL: "order.successful",
   ORDER_FAILED: "order.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
};

const QUEUES = {
   NOTIFICATION: "notification_queue",
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

         // Setup queue for listening to inventory events
         await this.rabbitMQ.assertQueue(QUEUES.NOTIFICATION);
         await this.rabbitMQ.bindQueue(
            QUEUES.NOTIFICATION,
            EXCHANGES.ORDER,
            "order.*"
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
      await this.rabbitMQ.consume(QUEUES.NOTIFICATION, async (event) => {
         console.log(`📥 Received event: ${event.eventType}`);

         try {
            if (event.eventType === EVENTS.ORDER_SUCCESSFUL) {
               await this.handleOrderSuccessful(event);
            } else if (event.eventType === EVENTS.ORDER_FAILED) {
               await this.handleOrderFailed(event);
            }
         } catch (error) {
            console.error("Error handling event:", error.message);
            throw error;
         }
      });
   }

   async handleOrderSuccessful(event) {
      const { orderId, userId, items } = event;

      console.log(`✓ Sending order success notification for order: ${orderId}`);

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
         // Don't throw - notification failure shouldn't break the saga
      }
   }

   async handleOrderFailed(event) {
      const { orderId, userId, reason } = event;

      console.log(`✗ Sending order failure notification for order: ${orderId}`);

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

         console.log(`✓ Order failure notification sent for order: ${orderId}`);
      } catch (error) {
         console.error(
            `Failed to send failure notification for order ${orderId}:`,
            error.message
         );
         // Don't throw - notification failure shouldn't break the saga
      }
   }

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderEventHandler();
