const Payment = require("../models/payment");

class PaymentRepository {
   /**
    * Create a new payment
    * @param {Object} paymentData - Payment data
    * @returns {Promise<Object>} Created payment
    */
   async create(paymentData) {
      try {
         const payment = new Payment(paymentData);
         return await payment.save();
      } catch (err) {
         throw new Error(`Failed to create payment: ${err.message}`);
      }
   }

   /**
    * Find payment by ID
    * @param {string} paymentId - Payment ID
    * @returns {Promise<Object|null>} Payment or null
    */
   async findById(paymentId) {
      try {
         return await Payment.findById(paymentId);
      } catch (err) {
         throw new Error(`Failed to get payment ${paymentId}: ${err.message}`);
      }
   }

   /**
    * Find all payments for an order
    * @param {string} orderId - Order ID
    * @returns {Promise<Array>} List of payments
    */
   async findByOrderId(orderId) {
      try {
         return await Payment.find({ orderId });
      } catch (err) {
         throw new Error(
            `Failed to get payments for order ${orderId}: ${err.message}`
         );
      }
   }

   /**
    * Find all payments
    * @returns {Promise<Array>} List of all payments
    */
   async findAll() {
      try {
         return await Payment.find();
      } catch (err) {
         throw new Error(`Failed to get all payments: ${err.message}`);
      }
   }

   /**
    * Update payment status
    * @param {string} paymentId - Payment ID
    * @param {string} status - New status
    * @returns {Promise<Object|null>} Updated payment
    */
   async updateStatus(paymentId, status) {
      try {
         return await Payment.findByIdAndUpdate(
            paymentId,
            { status },
            { new: true }
         );
      } catch (err) {
         throw new Error(`Failed to update payment status: ${err.message}`);
      }
   }

   /**
    * Update payment
    * @param {string} paymentId - Payment ID
    * @param {Object} updateData - Data to update
    * @returns {Promise<Object|null>} Updated payment
    */
   async update(paymentId, updateData) {
      try {
         return await Payment.findByIdAndUpdate(paymentId, updateData, {
            new: true,
         });
      } catch (err) {
         throw new Error(`Failed to update payment: ${err.message}`);
      }
   }

   /**
    * Delete payment
    * @param {string} paymentId - Payment ID
    * @returns {Promise<Object|null>} Deleted payment
    */
   async delete(paymentId) {
      try {
         return await Payment.findByIdAndDelete(paymentId);
      } catch (err) {
         throw new Error(`Failed to delete payment: ${err.message}`);
      }
   }

   /**
    * Find payments by status
    * @param {string} status - Payment status
    * @returns {Promise<Array>} List of payments
    */
   async findByStatus(status) {
      try {
         return await Payment.find({ status });
      } catch (err) {
         throw new Error(`Failed to get payments by status: ${err.message}`);
      }
   }

   /**
    * Find payments by payment method
    * @param {string} paymentMethod - Payment method
    * @returns {Promise<Array>} List of payments
    */
   async findByPaymentMethod(paymentMethod) {
      try {
         return await Payment.find({ paymentMethod });
      } catch (err) {
         throw new Error(`Failed to get payments by method: ${err.message}`);
      }
   }

   /**
    * Get total amount paid for an order
    * @param {string} orderId - Order ID
    * @returns {Promise<number>} Total amount
    */
   async getTotalAmountByOrder(orderId) {
      try {
         const payments = await Payment.find({ orderId, status: "succeeded" });
         return payments.reduce((total, payment) => total + payment.amount, 0);
      } catch (err) {
         throw new Error(`Failed to calculate total amount: ${err.message}`);
      }
   }
}

module.exports = new PaymentRepository();
