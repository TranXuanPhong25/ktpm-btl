const mongoose = require("mongoose");

const inventoryReadModelSchema = new mongoose.Schema({
   productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
   },
   stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
   },
   lastSyncedAt: {
      type: Date,
      default: Date.now,
      index: true,
   },
});

const InventoryReadModel = mongoose.model(
   "InventoryReadModel",
   inventoryReadModelSchema
);

module.exports = InventoryReadModel;
