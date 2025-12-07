const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const database = require("./models/database");
const productRoutes = require("./routes/product");
const PORT = process.env.PORT || 5007;
const OrderEventHandler = require("./events/orderEventHandler");
const ProductEventHandler = require("./events/productEventHandler");
const Product = require("./models/product");
const app = express();

app.use(express.json());

const rabbitMQUri =
   process.env.RABBITMQ_URI || "amqp://admin:admin123@localhost:5672";

app.use("/api/product-inventory", productRoutes);

database
   .connect()
   .then(async () => {
      await database.migrations();
      // console.log(Product.getTableName());
      console.log("Database models synchronized");

      await OrderEventHandler.initialize(rabbitMQUri);
      await ProductEventHandler.initialize(rabbitMQUri);

      app.listen(PORT, () => {
         console.log(`Product Inventory is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start Product Inventory:", err.message);
      process.exit(1);
   });

process.on("SIGINT", async () => {
   console.log("\nShutting down Product Inventory...");

   await OrderEventHandler.close();
   await ProductEventHandler.close();
   await database.disconnect();
   process.exit(0);
});
