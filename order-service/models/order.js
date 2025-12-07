const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
   productId: { type: String, required: true },
   quantity: { type: Number, required: true },
   name: { type: String, required: true },
   category: { type: String, required: true },
});

const orderSchema = new mongoose.Schema(
   {
      userId: { type: String, required: true, index: true },
      items: [orderItemSchema],
      totalAmount: { type: Number, required: true },
      status: { type: String, default: "Processing" },
      createdAt: { type: Date, default: Date.now },
   },
   { strict: false }
);

// Compound index for userId + createdAt for efficient pagination
orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
