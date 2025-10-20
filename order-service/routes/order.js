const express = require("express");
const Order = require("../models/order");
const axios = require("axios");

const router = express.Router();

const PRODUCT_SERVICE_URI =
   process.env.PRODUCT_SERVICE_URI || "http://localhost:5001";

// Place a new order
router.post("/:userId", async (req, res) => {
   const { userId } = req.params;
   const { items } = req.body;

   try {
      if (!items || items.length === 0) {
         return res
            .status(400)
            .json({ msg: "Order must contain at least one item" });
      }

      for (const item of items) {
         if (!item.productId || !item.quantity || item.quantity <= 0) {
            return res.status(400).json({ msg: "Invalid item format" });
         }
      }

      // Bulk get products
      const productIds = items.map((item) => item.productId).join(",");
      const response = await axios.get(
         `${PRODUCT_SERVICE_URI}/api/products/bulk/get?ids=${productIds}`
      );
      const products = response.data;

      if (!products || products.length !== items.length) {
         return res.status(404).json({ msg: "Some products not found" });
      }

      // Convert products array to map for O(1) lookup
      const productMap = Object.fromEntries(products.map(p => [p._id, p]));

      // Check stock and calculate totalAmount in the same loop
      let totalAmount = 0;
      for (const item of items) {
         const product = productMap[item.productId];
         if (!product) {
            return res
               .status(404)
               .json({ msg: `Product ${item.productId} not found` });
         }
         if (product.stock < item.quantity) {
            return res
               .status(400)
               .json({ msg: `Product ${product.name} is out of stock` });
         }
         totalAmount += product.price * item.quantity;
      }

      // Create new order
      const order = new Order({ userId, items, totalAmount });
      await order.save();

      // Deduct stock using bulk deduct
      try {
         await axios.post(
            `${PRODUCT_SERVICE_URI}/api/products/bulk/deduction`,
            {
               updates: items.map((item) => ({
                  id: item.productId,
                  quantity: item.quantity,
               })),
            }
         );
      } catch (deductError) {
         // Rollback order
         await Order.findByIdAndDelete(order._id);
         return res.status(500).json({
            msg: "Failed to deduct stock, order cancelled",
            error: deductError.message,
         });
      }

      res.status(201).json(order);
   } catch (err) {
      res.status(500).send(`Failed to place a new order: ${err.message}`);
   }
});

// Get all orders for a user
router.get("/:userId", async (req, res) => {
   const { userId } = req.params;
   try {
      const orders = await Order.find({ userId });
      res.json(orders);
   } catch (err) {
      res.status(500).send(
         `Failed to get all orders for user ${userId}: ${err.message}`
      );
   }
});

// Get order by ID
router.get("/:userId/:orderId", async (req, res) => {
   const { userId, orderId } = req.params;
   try {
      const order = await Order.findOne({ userId, _id: orderId });
      if (!order) return res.status(404).json({ msg: "Order not found" });
      res.json(order);
   } catch (err) {
      res.status(500).send(`Failed to get order ${orderId}: ${err.message}`);
   }
});

// Update order status
router.put("/:orderId/status", async (req, res) => {
   const { orderId } = req.params;
   const { status } = req.body;

   try {
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ msg: "Order not found" });

      order.status = status;
      await order.save();

      res.json(order);
   } catch (err) {
      res.status(500).send(
         `Failed to update status for order ${orderId}: ${err.message}`
      );
   }
});

module.exports = router;
