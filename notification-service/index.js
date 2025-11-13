const express = require("express");
const dotenv = require("dotenv");
const notificationRoutes = require("./routes/notification");
const orderEventHandler = require("./events/orderEventHandler");

dotenv.config();

const app = express();
app.use(express.json());

// routes
app.use("/api/notification", notificationRoutes);

const PORT = process.env.PORT || 5005;
const rabbitMQUri =
   process.env.RABBITMQ_URI || "amqp://admin:admin123@localhost:5672";

// Helper function to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize event handler and start server
(async () => {
   try {
      // Wait for RabbitMQ to be fully ready
      console.log("Waiting for RabbitMQ to be ready...");
      await wait(5000);

      await orderEventHandler.initialize(rabbitMQUri);

      const server = app.listen(PORT, () =>
         console.log(`Notification Service running on port ${PORT}`)
      );
      server.on("error", (error) => {
         console.error("Failed to start server:", error.message);
         process.exit(1);
      });
   } catch (error) {
      console.error("Failed to start Notification Service:", error.message);
      process.exit(1);
   }
})();

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Notification Service...");
   await orderEventHandler.close();
   process.exit(0);
});
