require("dotenv").config();
const database = require("./config/database");
const rabbitmq = require("./messaging/rabbitmq");
const OutboxPublisher = require("./services/outboxPublisher");
const CleanupWorker = require("./workers/cleanupWorker");
const defineOutboxModel = require("./models/outbox");

// Environment variables with defaults
const SERVICE_NAME = process.env.SERVICE_NAME || "generic";
const POSTGRES_URI =
   process.env.POSTGRES_URI || "postgresql://localhost:5432/ecommerce";
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://localhost:5672";
const EXCHANGE_NAME = process.env.EXCHANGE_NAME || "default_exchange";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 500;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const CLEANUP_INTERVAL_HOURS =
   parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 12;
const RETENTION_HOURS = parseInt(process.env.RETENTION_HOURS) || 24;

let publisher = null;
let cleanupWorker = null;

async function start() {
   try {
      console.log(`Starting Relay Publisher for [${SERVICE_NAME}]...`);

      // Connect to PostgreSQL
      const sequelize = await database.connect(POSTGRES_URI);

      // Define Outbox model
      const Outbox = defineOutboxModel(sequelize);

      // Sync model (ensure table exists)
      await Outbox.sync();
      console.log("Outbox table synchronized");

      // Connect to RabbitMQ
      await rabbitmq.connect(RABBITMQ_URI);
      await rabbitmq.assertExchange(EXCHANGE_NAME, "topic");

      // Initialize and start publisher
      publisher = new OutboxPublisher({
         serviceName: SERVICE_NAME,
         exchangeName: EXCHANGE_NAME,
         pollInterval: POLL_INTERVAL_MS,
         batchSize: BATCH_SIZE,
         OutboxModel: Outbox,
      });

      await publisher.start();

      // Initialize and start cleanup worker
      cleanupWorker = new CleanupWorker({
         serviceName: SERVICE_NAME,
         OutboxModel: Outbox,
         cleanupInterval: CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000,
         retentionHours: RETENTION_HOURS,
      });

      await cleanupWorker.start();

      console.log(`Relay Publisher [${SERVICE_NAME}] is running`);
      console.log(`   - Exchange: ${EXCHANGE_NAME}`);
      console.log(`   - Poll interval: ${POLL_INTERVAL_MS}ms`);
      console.log(`   - Batch size: ${BATCH_SIZE}`);
      console.log(`   - Cleanup interval: ${CLEANUP_INTERVAL_HOURS} hours`);
      console.log(`   - Retention: ${RETENTION_HOURS} hours`);
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

      if (cleanupWorker) {
         await cleanupWorker.stop();
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
