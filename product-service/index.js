const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const productRoutes = require("./routes/product");

const PORT = process.env.PORT || 5001;

const app = express();
dotenv.config();

app.use(express.json());

// Routes
app.use("/api/products", productRoutes);
const mongoURI =
  process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-products";
mongoose
  .connect(mongoURI, {
    maxPoolSize: 200, // Tăng từ default 5 → 100
    minPoolSize: 20, // Min connections luôn active
    maxIdleTimeMS: 30000, // Keep connections alive 30s
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ Product Service is Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Product service is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("🚫 Error connecting to MongoDB -> Product Service", err);
  });
