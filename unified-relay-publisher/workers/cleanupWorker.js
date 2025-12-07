/**
 * Cleanup Worker for periodic cleanup of old outbox records
 * Note: Only needed for PostgreSQL. MongoDB uses TTL index for automatic cleanup.
 */
class CleanupWorker {
   constructor(config) {
      this.serviceName = config.serviceName || "unified-relay";
      this.databaseAdapter = config.databaseAdapter;
      this.cleanupInterval = config.cleanupInterval || 12 * 60 * 60 * 1000; // 12 hours
      this.retentionHours = config.retentionHours || 24;
      this.isRunning = false;
      this.timer = null;
   }

   /**
    * Start the cleanup worker
    */
   async start() {
      if (this.isRunning) {
         console.log(`[${this.serviceName}] Cleanup worker is already running`);
         return;
      }

      this.isRunning = true;

      await this.cleanup();

      this.scheduleNextCleanup();
   }

   /**
    * Schedule next cleanup at midnight
    */
   scheduleNextCleanup() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow - now;

      this.timer = setTimeout(async () => {
         await this.cleanup();
         // After midnight, schedule for next interval
         this.timer = setInterval(async () => {
            await this.cleanup();
         }, this.cleanupInterval);
      }, msUntilMidnight);
   }

   /**
    * Run cleanup
    */
   async cleanup() {
      try {
         await this.databaseAdapter.cleanup(this.retentionHours);
         // Log current statistics
         const stats = await this.databaseAdapter.getStats();
         console.log(
            `[${this.serviceName}] Current stats - Pending: ${stats.pending}, Processed: ${stats.processed}, Failed: ${stats.failed}`
         );
      } catch (error) {
         console.error(`[${this.serviceName}] Cleanup error:`, error.message);
      }
   }

   async stop() {
      if (this.timer) {
         clearTimeout(this.timer);
         clearInterval(this.timer);
         this.timer = null;
      }
      this.isRunning = false;
   }
}

module.exports = CleanupWorker;
