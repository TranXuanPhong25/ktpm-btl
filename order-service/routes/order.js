const express = require("express");
const orderService = require("../services/orderService");

const router = express.Router();

// Place a new order
router.post("/:userId", async (req, res) => {
   const { userId } = req.params;
   const { items } = req.body;

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

// Get all orders for a user
router.get("/:userId", async (req, res) => {
   const { userId } = req.params;
   try {
      const orders = await orderService.getOrdersByUser(userId);
      res.json(orders);
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
