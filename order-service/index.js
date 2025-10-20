const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const orderRoutes = require("./routes/order");

const PORT = process.env.PORT || 5003;

dotenv.config();
const app = express();

app.use(express.json());

// routes
app.use("/api/orders", orderRoutes);

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-orders";

database
   .connect(mongoURI)
   .then(() => {
      app.listen(PORT, () => {
         console.log(`Order Service is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Order Service:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Order Service...");
   await database.disconnect();
   process.exit(0);
});
