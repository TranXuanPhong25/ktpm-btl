const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const cartRoutes = require("./routes/cart");
const cartEventHandler = require("./events/cartEventHandler");

const PORT = process.env.PORT || 5002;

dotenv.config();
const app = express();

app.use(express.json());

// routes
app.use("/api/cart", cartRoutes);

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-cart";

const rabbitMQUri = process.env.RABBITMQ_URI || "amqp://localhost:5672";

database
   .connect(mongoURI)
   .then(async () => {
      // Initialize cart event handler to listen for order events
      await cartEventHandler.initialize(rabbitMQUri);

      app.listen(PORT, () => {
         console.log(`Shopping Cart Service is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Shopping Cart Service:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Shopping Cart Service...");
   await cartEventHandler.close();
   await database.disconnect();
   process.exit(0);
});
