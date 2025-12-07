const orderRepository = require("../repositories/orderRepository");
const axios = require("axios");
const { EVENTS } = require("../messaging/constants");

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
         if (product.inventory && product.inventory.stock < item.quantity) {
            throw new Error(`Insufficient stock for product ${item.productId}`);
         }
         totalAmount += product.price * item.quantity;
      }
      const informativeItems = items.map((item) => ({
         productId: item.productId,
         quantity: productMap[item.productId].quantity,
         name: productMap[item.productId].name,
         price: productMap[item.productId].price,
      }));
      const order = await orderRepository.createWithOutbox(
         {
            userId,
            items: informativeItems,
            totalAmount,
            status: "PROCESSING",
         },
         {
            aggregateType: "Order",
            eventType: EVENTS.ORDER_PROCESSING,
            payload: JSON.stringify({
               userId,
               items: informativeItems,
               totalAmount,
               status: "PENDING",
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
         eventType: "order." + status.toLowerCase(),
         payload: JSON.stringify({
            orderId,
            status,
         }),
         status: "PENDING",
      });
   }
}

module.exports = new OrderService();
