const Order = require("../models/order");

class OrderRepository {
   async create(orderData) {
      try {
         const order = new Order(orderData);
         return await order.save();
      } catch (err) {
         throw new Error(`Failed to create order: ${err.message}`);
      }
   }

   async findByUserId(userId) {
      try {
         return await Order.find({ userId });
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

   async updateStatus(orderId, status) {
      try {
         return await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true }
         );
      } catch (err) {
         throw new Error(`Failed to update order status: ${err.message}`);
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
