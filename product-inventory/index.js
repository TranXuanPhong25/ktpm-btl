const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const database = require("./config/database");
const productRoutes = require("./routes/product");
const PORT = process.env.PORT || 5007;
const OrderEventHandler = require("./events/orderEventHandler");
const app = express();

app.use(express.json());

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-products";

const rabbitMQUri =
   process.env.RABBITMQ_URI || "amqp://admin:admin123@localhost:5672";

// Helper function to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Routes
app.use("/api/product-inventory", productRoutes);

const sequelize = database.getConnection();
database
   .connect()
   .then(async () => {
      await sequelize.sync({ alter: true });
      console.log("🔄 Database models synchronized");
      await OrderEventHandler.initialize(rabbitMQUri);

      app.listen(PORT, () => {
         console.log(`Product Inventory is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Product Inventory:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   await OrderEventHandler.close();

   console.log("\nShutting down Product Inventory...");
   await database.disconnect();
   process.exit(0);
});
