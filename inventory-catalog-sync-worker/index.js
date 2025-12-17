const dotenv = require("dotenv");
const InventorySyncWorker = require("./src/inventorySyncWorker");

dotenv.config();

const rabbitMQUri =
   process.env["RABBITMQ_URI"] || "amqp://admin:admin123@rabbitmq:5672";
const mongoUri =
   process.env["MONGO_URI"] || "mongodb://localhost:27017/ecommerce-products";

async function main() {
   try {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const worker = new InventorySyncWorker();
      await worker.initialize(rabbitMQUri, mongoUri);

      process.on("SIGINT", async () => {
         await worker.stop();
         process.exit(0);
      });

      process.on("SIGTERM", async () => {
         await worker.stop();
         process.exit(0);
      });
   } catch (error) {
      console.error("Failed to start Inventory Catalog Sync Worker:", error);
      process.exit(1);
   }
}

main();
