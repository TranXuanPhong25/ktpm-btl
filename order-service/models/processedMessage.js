const mongoose = require("mongoose");

const processedMessageSchema = new mongoose.Schema({
   messageId: { type: String, required: true, unique: true },
   eventType: { type: String, required: true },
   aggregateId: { type: String, required: true },
   processedAt: {
      type: Date,
      default: Date.now,
   },
   expireAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
   },
});

// TTL index for automatic cleanup
processedMessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
// Index for efficient querying
processedMessageSchema.index({ eventType: 1, aggregateId: 1 });

module.exports = mongoose.model("ProcessedMessage", processedMessageSchema);
