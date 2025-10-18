const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const orderRoutes = require("./routes/order");

const PORT = process.env.PORT || 5003;

dotenv.config();
const app = express();

app.use(express.json());

// routes
app.use("/api/orders", orderRoutes);

mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 100, // Tăng từ default 5 → 100
    minPoolSize: 20, // Min connections luôn active
    maxIdleTimeMS: 30000, // Keep connections alive 30s
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("✅ Order Service is Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("🚫 Failed to connect to MongoDB -> Order Service", err);
  });
