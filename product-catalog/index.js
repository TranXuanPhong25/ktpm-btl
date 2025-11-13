const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const productRoutes = require("./routes/product");

const PORT = process.env.PORT || 5001;

const app = express();
dotenv.config();

app.use(express.json());

// Routes
app.use("/api/product-catalog", productRoutes);

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-products";

// Helper function to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

database
   .connect(mongoURI)
   .then(async () => {
      // Wait for RabbitMQ to be fully ready
      console.log("Waiting for RabbitMQ to be ready...");
      await wait(5000);

      // Initialize Order Event Handler

      app.listen(PORT, () => {
         console.log(`Product Catalog is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Product Catalog:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Product Catalog...");
   await database.disconnect();
   process.exit(0);
});
