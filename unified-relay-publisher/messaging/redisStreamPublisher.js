const Redis = require("ioredis");

/**
 * Redis Streams connection and publishing client
 */
class RedisStreamPublisher {
   constructor() {
      this.client = null;
      this.isConnected = false;
      this.uri = null;
   }

   /**
    * Connect to Redis
    */
   async connect(uri) {
      try {
         this.uri = uri;

         // Create Redis client with connection options
         this.client = new Redis(uri, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
               const delay = Math.min(times * 100, 2000);
               return delay;
            },
            reconnectOnError(err) {
               console.error("Redis reconnect on error:", err.message);
               return true;
            },
            lazyConnect: false, // Connect immediately
         });

         // Handle connection events
         this.client.on("connect", () => {
            console.log("✓ Redis Streams connected successfully");
            this.isConnected = true;
         });

         this.client.on("ready", () => {
            this.isConnected = true;
         });

         this.client.on("error", (err) => {
            console.error("Redis connection error:", err.message);
            this.isConnected = false;
         });

         this.client.on("close", () => {
            console.log("Redis connection closed");
            this.isConnected = false;
         });

         this.client.on("reconnecting", () => {
            console.log("Reconnecting to Redis...");
            this.isConnected = false;
         });

         // Wait for connection to be ready
         await this.client.ping();

         return this.client;
      } catch (error) {
         console.error("Failed to connect to Redis:", error.message);
         throw error;
      }
   }

   /**
    * Publish a message to Redis Stream using XADD
    * @param {string} streamKey - The stream key name
    * @param {object} message - The message payload
    * @param {object} options - Optional settings (maxlen, etc.)
    */
   async publish(streamKey, message, options = {}) {
      if (!this.client) {
         throw new Error("Redis client not initialized. Call connect() first.");
      }

      if (!this.isConnected) {
         throw new Error("Redis not connected");
      }

      try {
         // Convert message object to flat key-value pairs for Redis Streams
         const messageData = this.flattenMessage(message);

         // Build XADD command arguments
         const args = [streamKey];

         // Add MAXLEN option if specified (to limit stream size)
         if (options.maxlen) {
            args.push("MAXLEN", "~", options.maxlen);
         }

         // Use '*' to let Redis generate the ID (timestamp-based)
         args.push("*");

         // Add all key-value pairs
         Object.entries(messageData).forEach(([key, value]) => {
            args.push(key, value);
         });

         // Execute XADD command
         const messageId = await this.client.xadd(...args);

         return messageId;
      } catch (error) {
         console.error(
            `Failed to publish to Redis Stream ${streamKey}:`,
            error.message
         );
         throw error;
      }
   }

   /**
    * Flatten nested message object into key-value pairs
    * Redis Streams require flat structure
    */
   flattenMessage(message) {
      const flattened = {};

      // Store complex objects as JSON strings
      Object.entries(message).forEach(([key, value]) => {
         if (typeof value === "object" && value !== null) {
            flattened[key] = JSON.stringify(value);
         } else {
            flattened[key] = String(value);
         }
      });

      return flattened;
   }

   /**
    * Check if stream exists
    */
   async streamExists(streamKey) {
      try {
         const result = await this.client.exists(streamKey);
         return result === 1;
      } catch (error) {
         console.error(`Error checking stream ${streamKey}:`, error.message);
         return false;
      }
   }

   /**
    * Get stream info
    */
   async getStreamInfo(streamKey) {
      try {
         const info = await this.client.xinfo("STREAM", streamKey);
         return info;
      } catch (error) {
         // Stream doesn't exist yet
         return null;
      }
   }

   /**
    * Close Redis connection
    */
   async close() {
      try {
         if (this.client) {
            await this.client.quit();
         }
         this.isConnected = false;
         console.log("✓ Redis connection closed");
      } catch (error) {
         console.error("Error closing Redis connection:", error.message);
      }
   }

   /**
    * Get connection status
    */
   getStatus() {
      return {
         connected: this.isConnected,
         uri: this.uri ? this.uri.replace(/:[^:@]+@/, ":***@") : null, // Hide password
      };
   }
}

module.exports = new RedisStreamPublisher();
