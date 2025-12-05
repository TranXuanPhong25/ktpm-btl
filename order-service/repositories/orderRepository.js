const Order = require("../models/order");

const Outbox = require("../models/outbox");
const mongoose = require("mongoose");

class OrderRepository {
   async create(orderData) {
      try {
         const order = new Order(orderData);
         return await order.save();
      } catch (err) {
         throw new Error(`Failed to create order: ${err.message}`);
      }
   }

   async createWithOutbox(orderData, outboxData) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
         const order = new Order(orderData);
         await order.save({ session });

         // Check if event already exists in outbox (idempotency)
         const existingEvent = await Outbox.findOne({
            aggregateId: order._id.toString(),
            eventType: outboxData.eventType,
         }).session(session);

         if (existingEvent) {
            console.log(
               `⚠️ Event ${outboxData.eventType} already exists for order: ${order._id}, skipping outbox`
            );
            await session.commitTransaction();
            return order;
         }

         const outbox = new Outbox({
            ...outboxData,
            aggregateId: order._id.toString(),
         });
         await outbox.save({ session });
         await session.commitTransaction();
         return order;
      } catch (err) {
         await session.abortTransaction();
         throw new Error(`Failed to create order with outbox: ${err.message}`);
      } finally {
         session.endSession();
      }
   }

   async findByUserId(userId, { page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const query = { userId };
         const [orders, total] = await Promise.all([
            Order.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Order.countDocuments(query),
         ]);
         return {
            data: orders,
            pagination: {
               page,
               limit,
               total,
               totalPages: Math.ceil(total / limit),
            },
         };
      } catch (err) {
         throw new Error(
            `Failed to get orders for user ${userId}: ${err.message}`
         );
      }
   }

   async findById(orderId) {
      try {
         return await Order.findById(orderId);
      } catch (err) {
         throw new Error(`Failed to get order ${orderId}: ${err.message}`);
      }
   }

   async findByUserIdAndId(userId, orderId) {
      try {
         return await Order.findOne({ userId, _id: orderId });
      } catch (err) {
         throw new Error(
            `Failed to get order ${orderId} for user ${userId}: ${err.message}`
         );
      }
   }

   async updateStatus(orderId, status, reason) {
      try {
         return await Order.findByIdAndUpdate(
            orderId,
            { status, reason },
            { new: true }
         );
      } catch (err) {
         throw new Error(`Failed to update order status: ${err.message}`);
      }
   }
   async updateStatusWithOutbox(orderId, status, outboxData) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
         // Check if event already exists in outbox (idempotency)
         const existingEvent = await Outbox.findOne({
            aggregateId: String(orderId),
            eventType: outboxData.eventType,
         }).session(session);

         if (existingEvent) {
            console.log(
               `⚠️ Event ${outboxData.eventType} already exists for order: ${orderId}, skipping`
            );
            await session.abortTransaction();
            return;
         }

         const order = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true, session }
         );
         const outboxPayload = {
            ...outboxData.payload,
            userId: order.userId,
            items: order.items,
            totalAmount: order.totalAmount,
            status: status,
            timestamp: new Date().toISOString(),
         };
         const outbox = new Outbox({
            ...outboxData,
            payload: JSON.stringify(outboxPayload),
            aggregateId: String(orderId),
         });
         await outbox.save({ session });
         await session.commitTransaction();
      } catch (err) {
         await session.abortTransaction();
         throw new Error(`Failed to update order with outbox: ${err.message}`);
      } finally {
         session.endSession();
      }
   }
   async delete(orderId) {
      try {
         return await Order.findByIdAndDelete(orderId);
      } catch (err) {
         throw new Error(`Failed to delete order: ${err.message}`);
      }
   }
}

module.exports = new OrderRepository();
