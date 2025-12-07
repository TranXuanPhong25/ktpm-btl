const express = require("express");
const dotenv = require("dotenv");
const orderEventHandler = require("./events/orderEventHandler");
const wait = require("./utils/wait");
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5005;
const rabbitMQUri =
   process.env.RABBITMQ_URI || "amqp://admin:admin123@localhost:5672";

// Helper function to wait

// Initialize event handler and start server
(async () => {
   try {
      // Wait for RabbitMQ to be fully ready
      console.log("Waiting for RabbitMQ to be ready...");
      await wait(5000);

      await orderEventHandler.initialize(rabbitMQUri);
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
