require("dotenv").config();
const path = require("path");
const AdapterFactory = require("./adapters/adapterFactory");
const RoutingConfigLoader = require("./config/routingConfigLoader");
const rabbitmqPublisher = require("./messaging/rabbitmqPublisher");
const redisStreamPublisher = require("./messaging/redisStreamPublisher");
const OutboxPublisher = require("./services/outboxPublisher");
const CleanupWorker = require("./workers/cleanupWorker");

// Environment variables with defaults
const SERVICE_NAME = process.env.SERVICE_NAME || "unified-relay";
const DATABASE_TYPE = process.env.DATABASE_TYPE || "mongo"; // 'postgres' or 'mongo'
const DATABASE_URI =
   process.env.DATABASE_URI ||
   process.env.POSTGRES_URI ||
   process.env.MONGO_URI ||
   "mongodb://localhost:27017/ecommerce";
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://localhost:5672";
const REDIS_URI = process.env.REDIS_URI || "redis://localhost:6379";
const ROUTING_CONFIG_PATH =
   process.env.ROUTING_CONFIG_PATH ||
   path.join(__dirname, "config/routing.yml");
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 500;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const CLEANUP_INTERVAL_HOURS =
   parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 12;
const RETENTION_HOURS = parseInt(process.env.RETENTION_HOURS) || 24;

let databaseAdapter = null;
let routingConfig = null;
let publisher = null;
let cleanupWorker = null;

async function main() {
   try {
      routingConfig = new RoutingConfigLoader(ROUTING_CONFIG_PATH);
      routingConfig.load();

      databaseAdapter = AdapterFactory.createAdapter(DATABASE_TYPE);
      await databaseAdapter.connect(DATABASE_URI);

      await rabbitmqPublisher.connect(RABBITMQ_URI);

      // Assert all required exchanges
      const exchanges = routingConfig.getAllExchanges();
      for (const exchange of exchanges) {
         await rabbitmqPublisher.assertExchange(exchange, "topic");
      }

      await redisStreamPublisher.connect(REDIS_URI);

      // Log stream keys that will be used
      const streamKeys = routingConfig.getAllStreamKeys();
      if (streamKeys.length > 0) {
         console.log(`  Stream keys configured: ${streamKeys.join(", ")}`);
      }

      publisher = new OutboxPublisher({
         serviceName: SERVICE_NAME,
         databaseAdapter: databaseAdapter,
         routingConfig: routingConfig,
         pollInterval: POLL_INTERVAL_MS,
         batchSize: BATCH_SIZE,
      });

      await publisher.start();

      const isSQLDB = DATABASE_TYPE.toLowerCase().includes("postgres");
      if (isSQLDB) {
         cleanupWorker = new CleanupWorker({
            serviceName: SERVICE_NAME,
            databaseAdapter: databaseAdapter,
            cleanupInterval: CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000,
            retentionHours: RETENTION_HOURS,
         });

         await cleanupWorker.start();
      }

      // Display summary
      console.log(`      - Database: ${DATABASE_TYPE}`);
      console.log(`      - Poll interval: ${POLL_INTERVAL_MS}ms`);
      console.log(`      - Batch size: ${BATCH_SIZE}`);
      if (isSQLDB) {
         console.log(`      - Cleanup interval: ${CLEANUP_INTERVAL_HOURS}h`);
         console.log(`      - Retention: ${RETENTION_HOURS}h`);
      }
   } catch (error) {
      console.error(
         `\nFailed to start Unified Relay Publisher [${SERVICE_NAME}]:`,
         error
      );
      process.exit(1);
   }
}

async function shutdown() {
   try {
      if (publisher) {
         await publisher.stop();
      }

      if (cleanupWorker) {
         await cleanupWorker.stop();
      }

      await rabbitmqPublisher.close();
      await redisStreamPublisher.close();

      if (databaseAdapter) {
         await databaseAdapter.disconnect();
      }

      process.exit(0);
   } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
   }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

process.on("uncaughtException", (error) => {
   console.error("Uncaught exception:", error);
   shutdown();
});

process.on("unhandledRejection", (reason, promise) => {
   console.error("Unhandled rejection at:", promise, "reason:", reason);
   shutdown();
});

main();
