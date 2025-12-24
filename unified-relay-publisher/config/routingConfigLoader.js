const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

/**
 * Loads and validates routing configuration from YAML file
 */
class RoutingConfigLoader {
   constructor(configPath) {
      this.configPath = configPath || path.join(__dirname, "routing.yml");
      this.config = null;
   }

   /**
    * Load routing configuration from YAML file
    */
   load() {
      try {
         const fileContents = fs.readFileSync(this.configPath, "utf8");
         this.config = yaml.load(fileContents);

         // Validate configuration
         this.validate();

         console.log(`Routing configuration loaded from ${this.configPath}`);
         console.log(
            `  - ${this.config.routing_keys?.length || 0} routing rules defined`
         );
         console.log(
            `  - ${this.config.default_sinks?.length || 0} default sinks defined`
         );
         console.log(
            `  - Redis stream max length: ${this.config.redis_stream_maxlen || "not set"}`
         );
         return this.config;
      } catch (error) {
         console.error("Failed to load routing configuration:", error.message);
         throw new Error(
            `Failed to load routing configuration: ${error.message}`
         );
      }
   }

   /**
    * Validate routing configuration structure
    */
   validate() {
      if (!this.config) {
         throw new Error("Configuration not loaded");
      }

      // Validate routing_keys array exists
      if (!Array.isArray(this.config.routing_keys)) {
         throw new Error(
            "Invalid configuration: 'routing_keys' must be an array"
         );
      }

      // Validate each routing rule
      this.config.routing_keys.forEach((rule, index) => {
         if (!rule.event_type || typeof rule.event_type !== "string") {
            throw new Error(
               `Invalid routing rule at index ${index}: 'event_type' is required and must be a string`
            );
         }

         if (!Array.isArray(rule.sinks) || rule.sinks.length === 0) {
            throw new Error(
               `Invalid routing rule at index ${index}: 'sinks' must be a non-empty array`
            );
         }

         // Validate each sink
         rule.sinks.forEach((sink, sinkIndex) => {
            this.validateSink(sink, index, sinkIndex);
         });
      });

      // Validate default_sinks if present
      if (this.config.default_sinks) {
         if (!Array.isArray(this.config.default_sinks)) {
            throw new Error("'default_sinks' must be an array");
         }
         this.config.default_sinks.forEach((sink, index) => {
            this.validateSink(sink, "default", index);
         });
      }
   }

   /**
    * Validate individual sink configuration
    */
   validateSink(sink, ruleIndex, sinkIndex) {
      if (!sink.type || typeof sink.type !== "string") {
         throw new Error(
            `Invalid sink at rule ${ruleIndex}, sink ${sinkIndex}: 'type' is required and must be a string`
         );
      }

      const validTypes = ["rabbitmq", "redis_stream"];
      if (!validTypes.includes(sink.type)) {
         throw new Error(
            `Invalid sink type '${sink.type}' at rule ${ruleIndex}, sink ${sinkIndex}. Valid types: ${validTypes.join(", ")}`
         );
      }

      // Validate RabbitMQ-specific fields
      if (sink.type === "rabbitmq") {
         if (!sink.exchange || typeof sink.exchange !== "string") {
            throw new Error(
               `RabbitMQ sink at rule ${ruleIndex}, sink ${sinkIndex}: 'exchange' is required`
            );
         }
         if (!sink.routing_key || typeof sink.routing_key !== "string") {
            throw new Error(
               `RabbitMQ sink at rule ${ruleIndex}, sink ${sinkIndex}: 'routing_key' is required`
            );
         }
      }

      // Validate Redis Stream-specific fields
      if (sink.type === "redis_stream") {
         if (!sink.stream_key || typeof sink.stream_key !== "string") {
            throw new Error(
               `Redis Stream sink at rule ${ruleIndex}, sink ${sinkIndex}: 'stream_key' is required`
            );
         }
      }
   }

   /**
    * Get sinks for a specific event type
    */
   getSinksForEvent(eventType) {
      if (!this.config) {
         throw new Error("Configuration not loaded. Call load() first.");
      }

      // Find matching routing rule
      const rule = this.config.routing_keys.find(
         (r) => r.event_type === eventType
      );

      if (rule) {
         return rule.sinks;
      }

      // Return default sinks if no match found
      return this.config.default_sinks || [];
   }

   /**
    * Get all unique exchanges needed for RabbitMQ
    */
   getAllExchanges() {
      if (!this.config) {
         return [];
      }

      const exchanges = new Set();

      // Collect from routing rules
      this.config.routing_keys?.forEach((rule) => {
         rule.sinks
            .filter((s) => s.type === "rabbitmq")
            .forEach((s) => exchanges.add(s.exchange));
      });

      // Collect from default sinks
      this.config.default_sinks
         ?.filter((s) => s.type === "rabbitmq")
         .forEach((s) => exchanges.add(s.exchange));

      return Array.from(exchanges);
   }

   /**
    * Get all unique stream keys needed for Redis Streams
    */
   getAllStreamKeys() {
      if (!this.config) {
         return [];
      }

      const streamKeys = new Set();

      // Collect from routing rules
      this.config.routing_keys?.forEach((rule) => {
         rule.sinks
            .filter((s) => s.type === "redis_stream")
            .forEach((s) => streamKeys.add(s.stream_key));
      });

      // Collect from default sinks
      this.config.default_sinks
         ?.filter((s) => s.type === "redis_stream")
         .forEach((s) => streamKeys.add(s.stream_key));

      return Array.from(streamKeys);
   }

   /**
    * Get Redis Stream max length setting
    */
   getRedisStreamMaxLen() {
      if (!this.config) {
         throw new Error("Configuration not loaded. Call load() first.");
      }
      return Number.isInteger(this.config.redis_stream_maxlen)
         ? this.config.redis_stream_maxlen
         : null;
   }

   /**
    * Reload configuration from disk
    */
   reload() {
      console.log("Reloading routing configuration...");
      return this.load();
   }
}

module.exports = RoutingConfigLoader;
