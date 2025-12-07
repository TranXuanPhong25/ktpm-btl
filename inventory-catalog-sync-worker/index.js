const dotenv = require("dotenv");
const InventorySyncWorker = require("./inventorySyncWorker");

dotenv.config();

const redisUri = process.env.REDIS_URI || "redis://localhost:6379";
const mongoUri =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce-products";

async function main() {
   try {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Initialize worker
      const worker = new InventorySyncWorker();
      await worker.initialize(redisUri, mongoUri);

      console.log("✓ Inventory Catalog Sync Worker is running");

      // Graceful shutdown
      process.on("SIGINT", async () => {
         console.log("\nShutting down Inventory Catalog Sync Worker...");
         await worker.stop();
         process.exit(0);
      });

      process.on("SIGTERM", async () => {
         console.log("\nShutting down Inventory Catalog Sync Worker...");
         await worker.stop();
         process.exit(0);
      });
   } catch (error) {
      console.error("Failed to start Inventory Catalog Sync Worker:", error);
      process.exit(1);
   }
}

main();
