const orderRepository = require("../repositories/orderRepository");
const axios = require("axios");
const { EVENTS, EXCHANGES, QUEUES } = require("../config/constants");

const PRODUCT_CATALOG_SERVICE_URI =
   process.env.PRODUCT_CATALOG_SERVICE_URI || "http://localhost:5000";

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

      // Bulk get products from product-catalog service to validate and calculate total
      const productIds = items.map((item) => item.productId).join(",");
      const response = await axios.get(
         `${PRODUCT_CATALOG_SERVICE_URI}/api/product-catalog/bulk/get?ids=${productIds}`
      );
      const products = response.data;

      if (!products || products.length !== items.length) {
         throw new Error("Some products not found");
      }

      const productMap = Object.fromEntries(products.map((p) => [p._id, p]));

      let totalAmount = 0;
      for (const item of items) {
         const product = productMap[item.productId];
         if (!product) throw new Error(`Product ${item.productId} not found`);
         totalAmount += product.price * item.quantity;
      }

      const order = await orderRepository.createWithOutbox(
         {
            userId,
            items,
            totalAmount,
            status: "Processing",
         },
         {
            aggregateType: "Order",
            eventType: EVENTS.ORDER_PROCESSING,
            payload: JSON.stringify({
               userId,
               items,
               totalAmount,
               status: "Processing",
            }),
         }
      );
      return order;
   }

   async getOrdersByUser(userId, pagination = {}) {
      if (!userId) throw new Error("User ID is required");
      const { page = 1, limit = 20 } = pagination;
      return await orderRepository.findByUserId(userId, { page, limit });
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
      return await orderRepository.updateStatusWithOutbox(orderId, status, {
         aggregateType: "Order",
         eventType: "orders." + status.toLowerCase(),
         payload: JSON.stringify({
            orderId,
            status,
         }),
      });
   }
}

module.exports = new OrderService();
