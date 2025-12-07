const RabbitMQConnection = require("../messaging/rabbitmq");
const orderRepository = require("../repositories/orderRepository");
const Outbox = require("../models/outbox");
const { EVENTS, EXCHANGES, QUEUES } = require("../messaging/constants");
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
    * Publish OrderCreated event via outbox pattern
    */
   async publishOrderCreated(order) {
      if (!this.isInitialized) {
         throw new Error("Order Saga not initialized");
      }

      const orderId = order._id.toString();

      // Check if event already exists in outbox (idempotency)
      const existingEvent = await Outbox.findOne({
         aggregateId: orderId,
         eventType: EVENTS.ORDER_CREATED,
      });

      if (existingEvent) {
         console.log(
            `⚠️ OrderCreated event already exists for order: ${orderId}, skipping`
         );
         return;
      }

      const event = {
         orderId,
         userId: order.userId,
         items: order.items,
         totalAmount: order.totalAmount,
         timestamp: new Date().toISOString(),
      };

      // Write to outbox instead of direct publish
      await Outbox.create({
         aggregateId: orderId,
         aggregateType: "Order",
         eventType: EVENTS.ORDER_CREATED,
         payload: JSON.stringify(event),
      });
   }

   async publishOrderPlaced(order) {
      if (!this.isInitialized) {
         throw new Error("Order Saga not initialized");
      }

      const orderId = order._id.toString();

      // Check if event already exists in outbox (idempotency)
      const existingEvent = await Outbox.findOne({
         aggregateId: orderId,
         eventType: EVENTS.ORDER_PLACED,
      });

      if (existingEvent) {
         console.log(
            `⚠️ OrderPlaced event already exists for order: ${orderId}, skipping`
         );
         return;
      }

      const event = {
         orderId,
         userId: order.userId,
         items: order.items,
         totalAmount: order.totalAmount,
         timestamp: new Date().toISOString(),
      };

      // Write to outbox instead of direct publish
      await Outbox.create({
         aggregateId: orderId,
         aggregateType: "Order",
         eventType: EVENTS.ORDER_PLACED,
         payload: JSON.stringify(event),
      });
   }
   async publishOrderFailed(order, session) {
      if (!this.isInitialized) {
         throw new Error("Order Saga not initialized");
      }

      const orderId = order._id.toString();

      // Check if event already exists in outbox (idempotency)
      const existingEvent = await Outbox.findOne({
         aggregateId: orderId,
         eventType: EVENTS.ORDER_FAILED,
      });

      if (existingEvent) {
         console.log(
            `⚠️ OrderFailed event already exists for order: ${orderId}, skipping`
         );
         return;
      }

      const event = {
         orderId,
         userId: order.userId,
         items: order.items,
         totalAmount: order.totalAmount,
         reason: order.reason,
         timestamp: new Date().toISOString(),
      };

      // Write to outbox instead of direct publish
      await Outbox.create(
         {
            aggregateId: orderId,
            aggregateType: "Order",
            eventType: EVENTS.ORDER_FAILED,
            payload: JSON.stringify(event),
         },
         session
      );
   }

   async startListening() {
      await this.rabbitMQ.consume(QUEUES.INVENTORY_TO_ORDER, async (event) => {
         try {
            switch (event.eventType) {
               case EVENTS.INVENTORY_RESERVED:
                  await this.handleInventoryReserved(event);
                  break;
               case EVENTS.INVENTORY_FAILED:
                  await this.handleInventoryFailed(event);
                  break;
               default:
                  break;
            }
         } catch (error) {
            console.error("Error handling inventory event:", error.message);
            throw error;
         }
      });

      await this.rabbitMQ.consume(QUEUES.PAYMENT_TO_ORDER, async (event) => {
         try {
            switch (event.eventType) {
               case EVENTS.PAYMENT_SUCCEEDED:
                  await this.handlePaymentSucceeded(event);
                  break;
               case EVENTS.PAYMENT_FAILED:
                  await this.handlePaymentFailed(event);
                  break;
               default:
                  break;
            }
         } catch (error) {
            console.error("Error handling payment event:", error.message);
            throw error;
         }
      });
   }

   async handleInventoryReserved(event) {
      const { aggregateId: orderId } = event;
      let order;
      try {
         order = await orderRepository.findById(orderId);
      } catch (err) {
         console.error(`Failed to fetch order ${orderId}:`, err.message);
         return;
      }

      const currentStatus =
         order && order.status ? String(order.status).toLowerCase() : null;
      if (currentStatus === "placed") {
         // Order already placed (payment succeeded first), keep as Placed
         console.log(
            `📦 Inventory reserved for order ${orderId}, status already 'Placed' - no change needed`
         );
         return;
      }

      if (currentStatus === "processing") {
         // Order is processing (reservation succeeded first), update to Created
         await orderRepository.updateStatusWithOutbox(orderId, "Created", {
            aggregateType: "Order",
            eventType: EVENTS.ORDER_CREATED,
            payload: {
               orderId,
               userId: order.userId,
               items: order.items,
               totalAmount: order.totalAmount,
               status: "Created",
               timestamp: new Date().toISOString(),
            },
         });
         console.log(
            `📦 Inventory reserved for order ${orderId}, status was 'Processing' -> 'Created'`
         );
         return;
      }
   }

   async handleInventoryFailed(event) {
      const { aggregateId: orderId } = event;
      const { reason } = event.payload;
      let order;
      try {
         order = await orderRepository.findById(orderId);
      } catch (err) {
         console.error(`Failed to fetch order ${orderId}:`, err.message);
         return;
      }

      const currentStatus =
         order && order.status ? String(order.status).toLowerCase() : null;
      if (currentStatus === "placed") {
         // Refund event
         await orderRepository.updateStatusWithOutbox(orderId, "Failed", {
            aggregateType: "Order",
            eventType: EVENTS.ORDER_FAILED,
            payload: {
               orderId,
               userId: order.userId,
               items: order.items,
               totalAmount: order.totalAmount,
               status: "FAILED",
               reason:
                  "Inventory reservation failed after payment - refund issued",
               timestamp: new Date().toISOString(),
            },
         });
         console.log(
            `↩️ Inventory reservation failed for already 'Placed' order ${orderId} - order marked as 'Failed' for refund`
         );
         return;
      }
      await orderRepository.updateStatus(orderId, "Failed", reason);
   }

   /**
    * Handle payment succeeded - Complete order
    */
   async handlePaymentSucceeded(event) {
      const { orderId, paymentId } = event.payload;

      // Ensure order is in a state that can be moved to Placed.
      // Only update when order status is 'Pending' or 'Created' (case-insensitive).
      let order;
      try {
         order = await orderRepository.findById(orderId);
      } catch (err) {
         console.error(`Failed to fetch order ${orderId}:`, err.message);
      }
      const currentStatus =
         order && order.status ? String(order.status).toLowerCase() : null;

      if (currentStatus === "pending" || currentStatus === "created") {
         // Update order status to 'Placed' with outbox event
         await orderRepository.updateStatusWithOutbox(orderId, "Placed", {
            aggregateType: "Order",
            eventType: EVENTS.ORDER_PLACED,
            payload: {
               orderId,
               paymentId,
               status: "Placed",
               timestamp: new Date().toISOString(),
            },
         });
         return;
      }

      // If order is not in 'created'/'pending' state, publish ORDER_FAILED so payment service can refund
      const reason = `Order status is '${order ? order.status : "unknown"}', cannot transition to Placed`;
      await orderRepository.updateStatusWithOutbox(orderId, "Failed", {
         aggregateType: "Order",
         eventType: EVENTS.ORDER_FAILED,
         payload: {
            orderId,
            paymentId,
            userId: order ? order.userId : null,
            items: order ? order.items : [],
            totalAmount: order ? order.totalAmount : 0,
            status: "FAILED",
            reason,
            timestamp: new Date().toISOString(),
         },
      });
      console.log(
         `📤 ORDER_FAILED event written to outbox for order ${orderId} (paymentId ${paymentId}) – reason: ${reason}`
      );
   }

   /**
    * Handle payment failed - Compensate by marking order as failed
    * Inventory will be restored by product service
    */
   async handlePaymentFailed(event) {
      const { orderId, reason } = event.payload;
      try {
         await orderRepository.updateStatusWithOutbox(orderId, "Failed", {
            aggregateType: "Order",
            eventType: EVENTS.ORDER_FAILED,
            payload: {
               orderId,
               status: "FAILED",
               reason,
               timestamp: new Date().toISOString(),
            },
         });
      } catch (error) {
         console.error("Error handling payment failed event:", error.message);
         throw error;
      }
   }

   async close() {
      await this.rabbitMQ.close();
   }
}

module.exports = new OrderSaga();
