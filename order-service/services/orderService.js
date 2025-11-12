const orderRepository = require("../repositories/orderRepository");
const axios = require("axios");
const orderSaga = require("../saga/orderSaga");

const PRODUCT_INVENTORY_SERVICE_URI =
   process.env.PRODUCT_INVENTORY_SERVICE_URI || "http://localhost:5001";

class OrderService {
   /**
    * Place a new order with Saga pattern
    * @param {string} userId
    * @param {Array<{productId: string, quantity: number}>} items
    */
   async placeOrder(userId, items) {
      if (!userId) throw new Error("User ID is required");
      if (!Array.isArray(items) || items.length === 0)
         throw new Error("Order must contain at least one item");

      for (const item of items) {
         if (!item.productId || !item.quantity || item.quantity <= 0) {
            throw new Error("Invalid item format");
         }
      }

      // Bulk get products from product service to validate and calculate total
      const productIds = items.map((item) => item.productId).join(",");
      const response = await axios.get(
         `${PRODUCT_INVENTORY_SERVICE_URI}/api/product-inventory/bulk/get?ids=${productIds}`
      );
      const products = response.data;

      if (!products || products.length !== items.length) {
         throw new Error("Some products not found");
      }

      const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

      let totalAmount = 0;
      for (const item of items) {
         const product = productMap[item.productId];
         if (!product) throw new Error(`Product ${item.productId} not found`);
         // Note: Stock validation will be done by inventory service in saga
         totalAmount += product.price * item.quantity;
      }

      // Create order in DB with 'Pending' status
      const order = await orderRepository.create({
         userId,
         items,
         totalAmount,
         status: "Pending",
      });

      // Publish OrderCreated event to start the saga
      // This event will also trigger cart clearing in the cart service
      try {
         await orderSaga.publishOrderCreated(order);
         console.log(`✓ Order ${order._id} created, saga initiated`);
      } catch (err) {
         // If saga fails to start, mark order as failed
         await orderRepository.updateStatus(order._id, "Failed");
         throw new Error(`Failed to initiate saga: ${err.message}`);
      }

      return order;
   }

   async getOrdersByUser(userId) {
      if (!userId) throw new Error("User ID is required");
      return await orderRepository.findByUserId(userId);
   }

   async getOrderById(userId, orderId) {
      if (!userId || !orderId)
         throw new Error("User ID and Order ID are required");
      const order = await orderRepository.findByUserIdAndId(userId, orderId);
      if (!order) throw new Error("Order not found");
      return order;
   }

   async updateOrderStatus(orderId, status) {
      if (!orderId) throw new Error("Order ID is required");
      return await orderRepository.updateStatus(orderId, status);
   }
}

module.exports = new OrderService();
