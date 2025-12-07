const express = require("express");
const orderService = require("../services/orderService");

const router = express.Router();

// Place a new order
router.post("/:userId", async (req, res) => {
   const { userId } = req.params;
   const { items } = req.body;
   const uniqueItems = new Set(items.map((item) => item.productId));
   if (uniqueItems.size !== items.length) {
      return res
         .status(400)
         .json({ msg: "Duplicate product IDs in order items" });
   }
   try {
      const order = await orderService.placeOrder(userId, items);
      res.status(201).json(order);
   } catch (err) {
      if (
         err.message.includes("required") ||
         err.message.includes("Invalid") ||
         err.message.includes("must contain")
      ) {
         return res.status(400).json({ msg: err.message });
      }
      if (
         err.message.includes("not found") ||
         err.message.includes("Insufficient stock")
      ) {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get all orders for a user with pagination
router.get("/:userId", async (req, res) => {
   const { userId } = req.params;
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
      const result = await orderService.getOrdersByUser(userId, {
         page,
         limit,
      });
      res.json(result);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get order by ID
router.get("/:userId/:orderId", async (req, res) => {
   const { userId, orderId } = req.params;
   try {
      const order = await orderService.getOrderById(userId, orderId);
      res.json(order);
   } catch (err) {
      if (err.message === "Order not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Update order status
router.put("/:orderId/status", async (req, res) => {
   const { orderId } = req.params;
   const { status } = req.body;

   try {
      const order = await orderService.updateOrderStatus(orderId, status);
      res.json(order);
   } catch (err) {
      if (err.message === "Order not found") {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

module.exports = router;
