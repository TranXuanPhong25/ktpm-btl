const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const database = require("./config/database");
const productRoutes = require("./routes/product");

const PORT = process.env.PORT || 5007;

const app = express();

app.use(express.json());

// Routes
app.use("/api/products", productRoutes);

const sequelize = database.getConnection();

database
   .connect()
   .then(async () => {
      await sequelize.sync({ alter: true });
      console.log("🔄 Database models synchronized");

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
   console.log("\nShutting down Product Inventory...");
   await database.disconnect();
   process.exit(0);
});
