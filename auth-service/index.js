const express = require("express");
const dotenv = require("dotenv");
const authRouter = require("./routes/auth");

dotenv.config();
const PORT = process.env.PORT || 5006;
const app = express();

// middleware
app.use(express.json());

// routes
app.use("/api/auth", authRouter);

const server = app.listen(PORT, () =>
   console.log(`Auth Service running on port ${PORT}`)
);

server.on("error", (error) => {
   console.error("Failed to start server:", error.message);
   process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
   console.log("\nShutting down Auth Service...");
   process.exit(0);
});
