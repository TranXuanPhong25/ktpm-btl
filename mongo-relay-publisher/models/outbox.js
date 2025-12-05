const mongoose = require("mongoose");

const outboxSchema = new mongoose.Schema({
   aggregateId: { type: String, required: true },
   aggregateType: { type: String, required: true },
   eventType: { type: String, required: true },
   payload: { type: String, required: true },
   status: {
      type: String,
      enum: ["PENDING", "PROCESSED", "FAILED"],
      default: "PENDING",
   },
   retryCount: {
      type: Number,
      default: 0,
   },
   maxRetries: {
      type: Number,
      default: 5,
   },
   processedAt: {
      type: Date,
   },
   createdAt: {
      type: Date,
      default: Date.now,
   },
   expireAt: {
      type: Date,
      default: () => new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
   },
});

outboxSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
outboxSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Outbox", outboxSchema);
