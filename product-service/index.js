const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const productRoutes = require("./routes/product");

const PORT = process.env.PORT || 5001;

const app = express();
dotenv.config();

app.use(express.json());

// Routes
app.use("/api/products", productRoutes);

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-products";

database
   .connect(mongoURI)
   .then(() => {
      app.listen(PORT, () => {
         console.log(`Product service is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Product Service:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Product Service...");
   await database.disconnect();
   process.exit(0);
});
