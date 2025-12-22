const Redis = require("ioredis");

// Redis configuration with connection pooling and proper timeouts
const redis = new Redis(
   process.env.REDIS_DATABASE_URI || "redis://localhost:6379",
   {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 2000, // 2 seconds connect timeout
      commandTimeout: 1000, // 1 second command timeout
      enableOfflineQueue: false, // Don't queue commands when disconnected
      enableAutoPipelining: true, // Automatic batching for better performance
      maxLoadingRetryTime: 5000,
      retryStrategy(times) {
         if (times > 3) {
            console.error("Redis connection failed after 3 retries");
            return null; // Stop retrying
         }
         const delay = Math.min(times * 50, 2000);
         return delay;
      },
      reconnectOnError(err) {
         const targetErrors = ["READONLY", "ECONNREFUSED"];
         if (
            targetErrors.some((targetError) =>
               err.message.includes(targetError)
            )
         ) {
            return true; // Reconnect
         }
         return false;
      },
      lazyConnect: false, // Connect immediately to fail fast if Redis is unavailable
   }
);

redis.on("connect", () => {
   console.log("✓ Redis connected");
});

redis.on("error", (err) => {
   console.error("Redis connection error:", err.message);
});

redis.on("ready", () => {
   console.log("✓ Redis ready to accept commands");
});

module.exports = redis;
