const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
   name: { type: String, required: true },
   price: { type: Number, required: true },
   description: { type: String, required: true },
   category: { type: String, required: true },
   stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
   },
});

module.exports = mongoose.model("Product", productSchema);
