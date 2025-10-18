const express = require("express");
const dotenv = require("dotenv");
const notificationRoutes = require("./routes/notification");

dotenv.config();

const app = express();
app.use(express.json());

// routes
app.use("/api/notification", notificationRoutes);

const PORT = process.env.PORT || 5005;

const server = app.listen(PORT, () =>
  console.log(`Notification Service running on port ${PORT}`)
);

server.on("error", (error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
