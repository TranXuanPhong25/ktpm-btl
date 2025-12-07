const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
   orderId: { type: String, required: true },
   amount: { type: Number, required: true },
   status: { type: String, required: true },
   paymentMethod: { type: String, required: true },
   paymentDate: { type: Date, default: Date.now },
   stripePaymentIntentId: { type: String },
   errorMessage: { type: String },
});

paymentSchema.index({ orderId: 1 });
paymentSchema.index({ orderId: 1, paymentDate: -1 });
paymentSchema.index({ orderId: 1, status: 1, paymentDate: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
