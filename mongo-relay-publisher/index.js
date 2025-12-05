require("dotenv").config();
const database = require("./config/database");
const rabbitmq = require("./messaging/rabbitmq");
const OutboxPublisher = require("./services/outboxPublisher");

// Environment variables with defaults
const SERVICE_NAME = process.env.SERVICE_NAME || "generic";
const MONGO_URI =
   process.env.MONGO_URI || "mongodb://localhost:27017/ecommerce";
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://localhost:5672";
const EXCHANGE_NAME = process.env.EXCHANGE_NAME || "default_exchange";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 500;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;

let publisher = null;

async function start() {
   try {
      console.log(`Starting Relay Publisher for [${SERVICE_NAME}]...`);

      // Connect to MongoDB
      await database.connect(MONGO_URI);

      // Connect to RabbitMQ
      await rabbitmq.connect(RABBITMQ_URI);
      await rabbitmq.assertExchange(EXCHANGE_NAME, "topic");

      // Initialize and start publisher
      publisher = new OutboxPublisher({
         serviceName: SERVICE_NAME,
         exchangeName: EXCHANGE_NAME,
         pollInterval: POLL_INTERVAL_MS,
         batchSize: BATCH_SIZE,
      });

      await publisher.start();

      console.log(`Relay Publisher [${SERVICE_NAME}] is running`);
      console.log(`   - Exchange: ${EXCHANGE_NAME}`);
      console.log(`   - Poll interval: ${POLL_INTERVAL_MS}ms`);
      console.log(`   - Batch size: ${BATCH_SIZE}`);
   } catch (error) {
      console.error(
         `Failed to start Relay Publisher [${SERVICE_NAME}]:`,
         error
      );
      process.exit(1);
   }
}

async function shutdown() {
   console.log(`\nShutting down Relay Publisher [${SERVICE_NAME}]...`);

   try {
      if (publisher) {
         await publisher.stop();
      }

      await rabbitmq.close();
      await database.disconnect();

      console.log("Shutdown complete");
      process.exit(0);
   } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
   }
}

// Handle shutdown signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Handle uncaught errors
process.on("uncaughtException", (error) => {
   console.error("Uncaught exception:", error);
   shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
   console.error("Unhandled rejection at:", promise, "reason:", reason);
   shutdown();
});

// Start the service
start();
