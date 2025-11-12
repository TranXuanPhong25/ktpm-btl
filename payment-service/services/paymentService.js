const paymentEventHandler = require("../events/paymentEventHandler");
const paymentRepository = require("../repositories/paymentRepository");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

class PaymentService {
   /**
    * Process a payment
    * @param {string} orderId - Order ID
    * @param {number} amount - Payment amount
    * @param {string} paymentMethodId - Stripe payment method ID
    * @returns {Promise<Object>} Created payment
    */
   async processPayment(orderId, amount, paymentMethodId) {
      // Validation
      if (!orderId) {
         throw new Error("Order ID is required");
      }
      if (!amount || amount <= 0) {
         throw new Error("Amount must be greater than 0");
      }
      if (!paymentMethodId) {
         throw new Error("Payment method ID is required");
      }

      try {
         // Create a charge using Stripe
         const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: "inr",
            payment_method: paymentMethodId,
            confirm: true,
            automatic_payment_methods: {
               enabled: true,
               allow_redirects: "never",
            },
         });

         // Save payment to database
         const payment = await paymentRepository.create({
            orderId,
            amount,
            status: paymentIntent.status,
            paymentMethod: "stripe",
            stripePaymentIntentId: paymentIntent.id,
         });

         return {
            payment,
            stripePaymentIntent: paymentIntent,
         };
      } catch (err) {
         // Log payment failure
         await paymentRepository.create({
            orderId,
            amount,
            status: "failed",
            paymentMethod: "stripe",
            errorMessage: err.message,
         });

         throw new Error(`Payment processing failed: ${err.message}`);
      }
   }

   /**
    * Get payment by ID
    * @param {string} paymentId - Payment ID
    * @returns {Promise<Object>} Payment
    */
   async getPaymentById(paymentId) {
      if (!paymentId) {
         throw new Error("Payment ID is required");
      }

      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
         throw new Error("Payment not found");
      }

      return payment;
   }

   /**
    * Get payments for an order
    * @param {string} orderId - Order ID
    * @returns {Promise<Array>} List of payments
    */
   async getPaymentsByOrder(orderId) {
      if (!orderId) {
         throw new Error("Order ID is required");
      }

      return await paymentRepository.findByOrderId(orderId);
   }

   /**
    * Get all payments
    * @param {Object} filters - Optional filters (status, paymentMethod)
    * @returns {Promise<Array>} List of payments
    */
   async getAllPayments(filters = {}) {
      if (filters.status) {
         return await paymentRepository.findByStatus(filters.status);
      }
      if (filters.paymentMethod) {
         return await paymentRepository.findByPaymentMethod(
            filters.paymentMethod
         );
      }
      return await paymentRepository.findAll();
   }

   /**
    * Update payment status
    * @param {string} paymentId - Payment ID
    * @param {string} status - New status
    * @returns {Promise<Object>} Updated payment
    */
   async updatePaymentStatus(paymentId, status) {
      if (!paymentId) {
         throw new Error("Payment ID is required");
      }
      if (!status) {
         throw new Error("Status is required");
      }

      const validStatuses = [
         "pending",
         "succeeded",
         "failed",
         "canceled",
         "refunded",
      ];
      if (!validStatuses.includes(status)) {
         throw new Error(
            `Invalid status. Must be one of: ${validStatuses.join(", ")}`
         );
      }

      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
         throw new Error("Payment not found");
      }

      return await paymentRepository.updateStatus(paymentId, status);
   }

   /**
    * Refund a payment
    * @param {string} paymentId - Payment ID
    * @param {number} amount - Refund amount (optional, defaults to full amount)
    * @returns {Promise<Object>} Updated payment
    */
   async refundPayment(paymentId, amount = null) {
      if (!paymentId) {
         throw new Error("Payment ID is required");
      }

      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
         throw new Error("Payment not found");
      }

      if (payment.status !== "succeeded") {
         throw new Error("Can only refund succeeded payments");
      }

      const refundAmount = amount || payment.amount;

      if (refundAmount > payment.amount) {
         throw new Error("Refund amount cannot exceed payment amount");
      }

      try {
         // Process refund via Stripe if payment has stripePaymentIntentId
         if (payment.stripePaymentIntentId) {
            await stripe.refunds.create({
               payment_intent: payment.stripePaymentIntentId,
               amount: Math.round(refundAmount * 100), // Convert to cents
            });
         }

         // Update payment status
         return await paymentRepository.updateStatus(paymentId, "refunded");
      } catch (err) {
         throw new Error(`Refund failed: ${err.message}`);
      }
   }

   /**
    * Get payment summary for an order
    * @param {string} orderId - Order ID
    * @returns {Promise<Object>} Payment summary
    */
   async getOrderPaymentSummary(orderId) {
      if (!orderId) {
         throw new Error("Order ID is required");
      }

      const payments = await paymentRepository.findByOrderId(orderId);

      const summary = {
         orderId,
         totalPayments: payments.length,
         totalAmount: 0,
         succeededAmount: 0,
         failedAmount: 0,
         refundedAmount: 0,
         status: "unpaid",
         payments: payments,
      };

      payments.forEach((payment) => {
         summary.totalAmount += payment.amount;

         if (payment.status === "succeeded") {
            summary.succeededAmount += payment.amount;
         } else if (payment.status === "failed") {
            summary.failedAmount += payment.amount;
         } else if (payment.status === "refunded") {
            summary.refundedAmount += payment.amount;
         }
      });

      // Determine overall payment status
      if (summary.succeededAmount > 0) {
         summary.status = "paid";
      }
      if (summary.refundedAmount > 0) {
         summary.status = "refunded";
      }

      return summary;
   }

   /**
    * Verify payment with Stripe
    * @param {string} paymentId - Payment ID
    * @returns {Promise<Object>} Verification result
    */
   async verifyPayment(paymentId) {
      if (!paymentId) {
         throw new Error("Payment ID is required");
      }

      const payment = await paymentRepository.findById(paymentId);
      if (!payment) {
         throw new Error("Payment not found");
      }

      if (!payment.stripePaymentIntentId) {
         return {
            verified: false,
            message: "No Stripe payment intent ID found",
         };
      }

      try {
         const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.stripePaymentIntentId
         );

         // Update payment status if different
         if (paymentIntent.status !== payment.status) {
            await paymentRepository.updateStatus(
               paymentId,
               paymentIntent.status
            );
         }

         return {
            verified: true,
            stripeStatus: paymentIntent.status,
            localStatus: payment.status,
            synced: paymentIntent.status === payment.status,
         };
      } catch (err) {
         throw new Error(`Verification failed: ${err.message}`);
      }
   }

   /**
    * Process payment for an order (simplified for saga pattern)
    * @param {string} orderId - Order ID
    * @param {number} amount - Payment amount
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Created payment
    */
   async processPaymentForOrder(orderId, amount, userId) {
      if (!orderId) {
         throw new Error("Order ID is required");
      }
      if (!amount || amount <= 0) {
         throw new Error("Amount must be greater than 0");
      }

      try {
         // Simulate payment processing
         // In production, this would call actual payment gateway
         const simulateSuccess = Math.random() > 0.8; // 90% success rate

         if (!simulateSuccess) {
            throw new Error("Payment gateway declined the transaction");
         }

         // Create payment record
         const payment = await paymentRepository.create({
            orderId,
            amount,
            status: "succeeded",
            paymentMethod: "simulated",
            metadata: {
               userId,
               processedAt: new Date().toISOString(),
            },
         });
         await paymentEventHandler.publishPaymentSucceeded(
            orderId,
            userId,
            amount,
            payment
         );
         return payment;
      } catch (err) {
         // Log payment failure

         await paymentRepository.create({
            orderId,
            amount,
            status: "failed",
            paymentMethod: "simulated",
            errorMessage: err.message,
            metadata: {
               userId,
               failedAt: new Date().toISOString(),
            },
         });
         await paymentEventHandler.publishPaymentFailed(
            orderId,
            userId,
            err.message,
            []
         );

         throw new Error(`Payment processing failed: ${err.message}`);
      }
   }
}

module.exports = new PaymentService();
