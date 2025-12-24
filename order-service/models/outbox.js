const mongoose = require("mongoose");

const outboxSchema = new mongoose.Schema({
   aggregateId: { type: String, required: true },
   aggregateType: { type: String, required: true },
   eventType: { type: String, required: true },
   // payload must be JSON string for Debezium EventRouter
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

// TTL index - MongoDB will automatically delete documents when expireAt is reached
outboxSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
// Index for efficient querying of pending events
outboxSchema.index({ status: 1, createdAt: 1 });
outboxSchema.index({ aggregateId: 1, eventType: 1 });
module.exports = mongoose.model("Outbox", outboxSchema);
