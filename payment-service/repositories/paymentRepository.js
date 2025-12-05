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
    * Find all payments with pagination
    * @param {Object} options - Pagination options
    * @param {number} options.page - Page number (1-based)
    * @param {number} options.limit - Items per page
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async findAll({ page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const [payments, total] = await Promise.all([
            Payment.find().skip(skip).limit(limit).sort({ paymentDate: -1 }),
            Payment.countDocuments(),
         ]);
         return {
            data: payments,
            pagination: {
               page,
               limit,
               total,
               totalPages: Math.ceil(total / limit),
            },
         };
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
    * Find payments by status with pagination
    * @param {string} status - Payment status
    * @param {Object} options - Pagination options
    * @param {number} options.page - Page number (1-based)
    * @param {number} options.limit - Items per page
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async findByStatus(status, { page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const query = { status };
         const [payments, total] = await Promise.all([
            Payment.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Payment.countDocuments(query),
         ]);
         return {
            data: payments,
            pagination: {
               page,
               limit,
               total,
               totalPages: Math.ceil(total / limit),
            },
         };
      } catch (err) {
         throw new Error(`Failed to get payments by status: ${err.message}`);
      }
   }

   /**
    * Find payments by payment method with pagination
    * @param {string} paymentMethod - Payment method
    * @param {Object} options - Pagination options
    * @param {number} options.page - Page number (1-based)
    * @param {number} options.limit - Items per page
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async findByPaymentMethod(paymentMethod, { page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const query = { paymentMethod };
         const [payments, total] = await Promise.all([
            Payment.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Payment.countDocuments(query),
         ]);
         return {
            data: payments,
            pagination: {
               page,
               limit,
               total,
               totalPages: Math.ceil(total / limit),
            },
         };
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
