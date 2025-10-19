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

    const products = [];

    const responses = await Promise.all(
      items.map((item) =>
        axios.get(`${PRODUCT_SERVICE_URI}/api/products/${item.productId}`)
      )
    );

    // Check if products are available
    for (let i = 0; i < responses.length; i++) {
      const product = responses[i].data;

      if (!product) {
        return res.status(404).json({
          msg: `Product ${items[i].productId} not found`,
        });
      }

      if (product.stock < items[i].quantity) {
        return res.status(400).json({
          msg: `Product ${product.name} is out of stock`,
        });
      }

      products.push(product);
    }

    const totalAmount = products.reduce(
      (sum, p, i) => sum + p.price * items[i].quantity,
      0
    );

    // Create new order
    const order = new Order({
      userId,
      items,
      totalAmount,
    });

    await order.save();

    // Deduct product stock
    try {
      await Promise.all(
        items.map(async (item) => {
          await axios.put(
            `${PRODUCT_SERVICE_URI}/api/products/${item.productId}/deduction`,
            {
              quantity: item.quantity,
            }
          );
        })
      );
    } catch (deductError) {
      // Rollback: Delete the order if stock deduction fails
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
    res
      .status(500)
      .send(`Failed to get all orders for user ${userId}: ${err.message}`);
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
    res
      .status(500)
      .send(`Failed to update status for order ${orderId}: ${err.message}`);
  }
});

module.exports = router;
