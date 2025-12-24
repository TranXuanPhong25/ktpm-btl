const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const orderRoutes = require("./routes/order");
const orderSaga = require("./saga/orderSaga");

const PORT = process.env.PORT || 5003;

dotenv.config();
const app = express();

app.use(express.json());

// routes
app.use("/api/orders", orderRoutes);

app.get("/health", (req, res) => {
   res.status(200).send("OK");
});
// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-orders";

const rabbitMQUri =
   process.env.RABBITMQ_URI || "amqp://admin:admin123@localhost:5672";

// Helper function to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

database
   .connect(mongoURI)
   .then(async () => {
      // Wait for RabbitMQ to be fully ready
      console.log("Waiting for RabbitMQ to be ready...");
      await wait(5000);

      // Initialize Order Saga
      await orderSaga.initialize(rabbitMQUri);

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
   await orderSaga.close();
   await database.disconnect();
   process.exit(0);
});
