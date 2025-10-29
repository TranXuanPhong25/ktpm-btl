const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const paymentRoutes = require("./routes/payment");
const paymentEventHandler = require("./events/paymentEventHandler");

const PORT = process.env.PORT || 5004;

dotenv.config();
const app = express();
app.use(express.json());

// routes
app.use("/api/payments", paymentRoutes);

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-payment";

const rabbitMQUri = process.env.RABBITMQ_URI || "amqp://localhost:5672";

database
   .connect(mongoURI)
   .then(async () => {
      // Initialize payment event handler
      await paymentEventHandler.initialize(rabbitMQUri);

      app.listen(PORT, () => {
         console.log(`Payment Service is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Payment Service:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Payment Service...");
   await paymentEventHandler.close();
   await database.disconnect();
   process.exit(0);
});
