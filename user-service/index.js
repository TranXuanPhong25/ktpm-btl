const express = require("express");
const dotenv = require("dotenv");
const database = require("./config/database");
const userRoutes = require("./routes/user");

const PORT = process.env.PORT || 5000;

dotenv.config();
const app = express();

// middleware
app.use(express.json());

// routes
app.use("/api/users", userRoutes);

// Database connection and server start
const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-users";

database
   .connect(mongoURI)
   .then(() => {
      app.listen(PORT, () => {
         console.log(`User Service is running on port ${PORT}`);
      });
   })
   .catch((err) => {
      console.error("Failed to start User Service:", err.message);
      process.exit(1);
   });

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down User Service...");
   await database.disconnect();
   process.exit(0);
});
