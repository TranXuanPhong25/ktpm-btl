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
      const maxRetries = 5;
      const baseDelay = 50; // ms
      if (!orderId) {
         console.error("Inventory Reserved event missing orderId");
         return;
      }
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
         try {
            const updatedOrder =
               await orderRepository.updateStatusIfCurrentStatusIs(
                  orderId,
                  "PROCESSING", // Expected current status
                  "CREATED", // New status
                  {
                     aggregateType: "Order",
                     eventType: EVENTS.ORDER_CREATED,
                     payload: {
                        orderId,
                        status: "CREATED",
                        // Note: userId, items, totalAmount will be filled by repository from the DB document
                     },
                  }
               );

            if (updatedOrder || updatedOrder.skipped) {
               return;
            }
            // If update failed, it means status was NOT 'Processing' (or order missing)
            // We fetch just for logging purposes to understand what happened
            const currentOrder = await orderRepository.findById(orderId);
            const currentStatus = currentOrder?.status?.toUpperCase();

            if (currentStatus === "PLACED") {
               console.log(
                  `📦 Inventory reserved for order ${orderId}, but status is already 'Placed' - ignoring (Race condition handled)`
               );
            } else {
               console.warn(
                  `⚠️ Inventory reserved for order ${orderId}, but status is '${currentStatus}' (expected 'Processing') - ignoring`
               );
            }
            return;
         } catch (err) {
            // Check if this is a write conflict error that can be retried
            const isWriteConflict =
               err.message.includes("Write conflict") ||
               err.message.includes("WriteConflict");

            if (isWriteConflict && attempt < maxRetries) {
               // Exponential backoff with jitter
               const delay =
                  baseDelay * Math.pow(2, attempt) + Math.random() * 50;
               console.warn(
                  `Write conflict for order ${orderId}, message ${err.message}, retrying (${attempt + 1}/${maxRetries}) after ${delay.toFixed(0)}ms`
               );
               await new Promise((resolve) => setTimeout(resolve, delay));
               continue;
            }

            // Non-retryable error or max retries exceeded
            console.error(
               `Failed to handle inventory reserved for order ${orderId}:`,
               err.message
            );

            if (isWriteConflict && attempt === maxRetries) {
               console.error(
                  `Max retries (${maxRetries}) exceeded for order ${orderId} due to write conflicts`
               );
            }

            // Re-throw to trigger message requeue
            throw err;
         }
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
      if (currentStatus === "PLACED") {
         // Refund event
         await orderRepository.updateStatusWithOutbox(orderId, "FAILED", {
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

      const maxRetries = 5;
      const baseDelay = 50;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
         try {
            // 1. Try transition from 'Created' -> 'Placed'
            let updatedOrder =
               await orderRepository.updateStatusIfCurrentStatusIs(
                  orderId,
                  "CREATED",
                  "PLACED",
                  {
                     aggregateType: "Order",
                     eventType: EVENTS.ORDER_PLACED,
                     payload: {
                        orderId,
                        paymentId,
                        status: "PLACED",
                     },
                  }
               );

            if (updatedOrder) {
               if (!updatedOrder.skipped) {
                  console.log(
                     `💰 Payment succeeded for order ${orderId}, status 'CREATED' -> 'PLACED'`
                  );
               }
               return;
            }

            // 2. If failed, try transition from 'Processing' -> 'Placed' (Race condition: Payment faster than Inventory)
            // Note: In a strict Saga, we might want to wait for Inventory, but here we allow completing if Payment is done.
            // However, usually we want Inventory Reserved FIRST.
            // If we allow Processing -> Placed, we assume Inventory will eventually succeed.
            // Let's stick to the logic: If it's Processing, we can also move to Placed (assuming Inventory is implicitly OK or will be checked).
            // Actually, if Payment succeeds but Inventory hasn't returned yet, we should probably wait?
            // But the original code allowed "pending" (Processing) or "created" to move to Placed.
            // Let's support 'Processing' -> 'Placed' as well for robustness against message ordering.

            updatedOrder = await orderRepository.updateStatusIfCurrentStatusIs(
               orderId,
               "PROCESSING",
               "PLACED",
               {
                  aggregateType: "Order",
                  eventType: EVENTS.ORDER_PLACED,
                  payload: {
                     orderId,
                     paymentId,
                     status: "PLACED",
                  },
               }
            );

            if (updatedOrder) {
               if (!updatedOrder.skipped) {
                  console.log(
                     `💰 Payment succeeded for order ${orderId}, status 'PROCESSING' -> 'PLACED' (Inventory might be lagging)`
                  );
               }
               return;
            }

            // 3. If both failed, check current status to decide if we need to fail/refund
            const currentOrder = await orderRepository.findById(orderId);
            const currentStatus = currentOrder?.status;

            if (currentStatus === "PLACED") {
               console.log(
                  `💰 Payment succeeded for order ${orderId}, but already 'PLACED' - ignoring`
               );
               return;
            }

            // If order is not in a valid state to be placed, we must fail it (and refund)
            const reason = `Order status is '${currentStatus}', cannot transition to Placed`;
            await orderRepository.updateStatusWithOutbox(orderId, "FAILED", {
               aggregateType: "Order",
               eventType: EVENTS.ORDER_FAILED,
               payload: {
                  orderId,
                  paymentId,
                  userId: currentOrder ? currentOrder.userId : null,
                  items: currentOrder ? currentOrder.items : [],
                  totalAmount: currentOrder ? currentOrder.totalAmount : 0,
                  status: "FAILED",
                  reason,
                  timestamp: new Date().toISOString(),
               },
            });
            console.log(
               `📤 ORDER_FAILED event written to outbox for order ${orderId} (paymentId ${paymentId}) – reason: ${reason}`
            );
            return;
         } catch (err) {
            const isWriteConflict =
               err.message.includes("Write conflict") ||
               err.message.includes("WriteConflict");

            if (isWriteConflict && attempt < maxRetries) {
               const delay =
                  baseDelay * Math.pow(2, attempt) + Math.random() * 50;
               console.warn(
                  `⚠️ Write conflict for payment succeeded ${orderId}, retrying (${attempt + 1}/${maxRetries}) after ${delay.toFixed(0)}ms`
               );
               await new Promise((resolve) => setTimeout(resolve, delay));
               continue;
            }

            console.error(
               `Failed to handle payment succeeded for order ${orderId}:`,
               err.message
            );

            if (isWriteConflict && attempt === maxRetries) {
               console.error(
                  `❌ Max retries (${maxRetries}) exceeded for payment succeeded ${orderId}`
               );
            }
            throw err;
         }
      }
   }

   /**
    * Handle payment failed - Compensate by marking order as failed
    * Inventory will be restored by product service
    */
   async handlePaymentFailed(event) {
      const { orderId, reason } = event.payload;
      try {
         await orderRepository.updateStatusWithOutbox(orderId, "FAILED", {
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
