/**
 * Database Adapter Interface
 * Defines the contract that all database adapters must implement
 */
class DatabaseAdapter {
   /**
    * Connect to the database
    * @param {string} uri - Database connection URI
    */
   async connect(uri) {
      throw new Error("connect() must be implemented by adapter");
   }

   /**
    * Disconnect from the database
    */
   async disconnect() {
      throw new Error("disconnect() must be implemented by adapter");
   }

   /**
    * Find pending events from outbox
    * @param {number} batchSize - Maximum number of events to retrieve
    * @returns {Array} Array of pending events
    */
   async findPendingEvents(batchSize) {
      throw new Error("findPendingEvents() must be implemented by adapter");
   }

   /**
    * Mark an event as processed
    * @param {*} eventId - Event identifier
    */
   async markAsProcessed(eventId) {
      throw new Error("markAsProcessed() must be implemented by adapter");
   }

   /**
    * Mark an event as failed
    * @param {*} eventId - Event identifier
    * @param {string} error - Error message
    */
   async markAsFailed(eventId, error) {
      throw new Error("markAsFailed() must be implemented by adapter");
   }

   /**
    * Increment retry count for an event
    * @param {*} eventId - Event identifier
    */
   async incrementRetryCount(eventId) {
      throw new Error("incrementRetryCount() must be implemented by adapter");
   }

   /**
    * Run cleanup of old/expired events (optional, Postgres only)
    * @param {number} retentionHours - Hours to retain processed events
    */
   async cleanup(retentionHours) {
      // Optional: MongoDB uses TTL index, doesn't need manual cleanup
      console.log("Cleanup not implemented for this adapter");
   }

   /**
    * Get database statistics
    * @returns {Object} Statistics object
    */
   async getStats() {
      throw new Error("getStats() must be implemented by adapter");
   }

   /**
    * Get connection status
    * @returns {boolean} Connection status
    */
   isConnected() {
      throw new Error("isConnected() must be implemented by adapter");
   }
}

module.exports = DatabaseAdapter;
