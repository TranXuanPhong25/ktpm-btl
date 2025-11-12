// routes/payment.js
const express = require("express");
const paymentService = require("../services/paymentService");
const router = express.Router();

// Process a payment
router.post("/:orderId", async (req, res) => {
   const { orderId } = req.params;
   const { amount, paymentMethodId } = req.body;

   try {
      const result = await paymentService.processPayment(
         orderId,
         amount,
         paymentMethodId
      );
      res.status(201).json(result.payment);
   } catch (err) {
      if (err.message.includes("required") || err.message.includes("must be")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get payment by ID
router.get("/:paymentId", async (req, res) => {
   const { paymentId } = req.params;

   try {
      const payment = await paymentService.getPaymentById(paymentId);
      res.json(payment);
   } catch (err) {
      if (err.message === "Payment not found") {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get payments for an order
router.get("/order/:orderId", async (req, res) => {
   const { orderId } = req.params;

   try {
      const payments = await paymentService.getPaymentsByOrder(orderId);
      res.json(payments);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

router.post("/order/:orderId", async (req, res) => {
   const { orderId } = req.params;
   const { amount, userId } = req.body;
   try {
      const payments = await paymentService.processPaymentForOrder(
         orderId,
         amount,
         userId
      );
      res.json(payments);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get all payments with optional filters
router.get("/", async (req, res) => {
   try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.paymentMethod)
         filters.paymentMethod = req.query.paymentMethod;

      const payments = await paymentService.getAllPayments(filters);
      res.json(payments);
   } catch (err) {
      res.status(500).json({ msg: err.message });
   }
});

// Update payment status
router.patch("/:paymentId/status", async (req, res) => {
   const { paymentId } = req.params;
   const { status } = req.body;

   try {
      const payment = await paymentService.updatePaymentStatus(
         paymentId,
         status
      );
      res.json(payment);
   } catch (err) {
      if (err.message === "Payment not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (err.message.includes("required") || err.message.includes("Invalid")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Refund a payment
router.post("/:paymentId/refund", async (req, res) => {
   const { paymentId } = req.params;
   const { amount } = req.body;

   try {
      const payment = await paymentService.refundPayment(paymentId, amount);
      res.json(payment);
   } catch (err) {
      if (err.message === "Payment not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (
         err.message.includes("Can only refund") ||
         err.message.includes("cannot exceed")
      ) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get payment summary for an order
router.get("/order/:orderId/summary", async (req, res) => {
   const { orderId } = req.params;

   try {
      const summary = await paymentService.getOrderPaymentSummary(orderId);
      res.json(summary);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Verify payment with Stripe
router.get("/:paymentId/verify", async (req, res) => {
   const { paymentId } = req.params;

   try {
      const verification = await paymentService.verifyPayment(paymentId);
      res.json(verification);
   } catch (err) {
      if (err.message === "Payment not found") {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

module.exports = router;
