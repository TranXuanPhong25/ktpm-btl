const { Op } = require("sequelize");

class CleanupWorker {
   constructor(config) {
      this.serviceName = config.serviceName || "generic";
      this.OutboxModel = config.OutboxModel;
      this.cleanupInterval = config.cleanupInterval || 12 * 60 * 60 * 1000; // 12 hours default
      this.retentionHours = config.retentionHours || 24; // Keep processed events for 24 hours
      this.isRunning = false;
      this.timer = null;
   }

   async start() {
      if (this.isRunning) {
         console.log(`[${this.serviceName}] Cleanup worker is already running`);
         return;
      }

      this.isRunning = true;
      console.log(
         `[${this.serviceName}] Cleanup worker started (runs every ${this.cleanupInterval / 1000 / 60 / 60} hours)`
      );

      // Run immediately on start
      await this.cleanup();

      // Schedule cleanup to run at midnight (00:00)
      this.scheduleNextCleanup();
   }

   scheduleNextCleanup() {
      // Calculate milliseconds until next midnight
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow - now;

      console.log(
         `[${this.serviceName}] Next cleanup scheduled at midnight (in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`
      );

      this.timer = setTimeout(async () => {
         await this.cleanup();
         // After running at midnight, schedule for next midnight (12 hours later)
         this.timer = setInterval(async () => {
            await this.cleanup();
         }, this.cleanupInterval);
      }, msUntilMidnight);
   }

   async cleanup() {
      try {
         const cutoffDate = new Date(
            Date.now() - this.retentionHours * 60 * 60 * 1000
         );

         console.log(
            `[${this.serviceName}] Starting cleanup of old outbox records...`
         );

         // Delete PROCESSED events older than retention period
         const processedDeleted = await this.OutboxModel.destroy({
            where: {
               status: "PROCESSED",
               processedAt: {
                  [Op.lt]: cutoffDate,
               },
            },
         });

         // Delete FAILED events that are expired
         const failedDeleted = await this.OutboxModel.destroy({
            where: {
               status: "FAILED",
               expireAt: {
                  [Op.lt]: new Date(),
               },
            },
         });

         // Delete old records based on expireAt (for any status)
         const expiredDeleted = await this.OutboxModel.destroy({
            where: {
               expireAt: {
                  [Op.lt]: new Date(),
               },
            },
         });

         console.log(
            `[${this.serviceName}] Cleanup completed: ${processedDeleted} processed, ${failedDeleted} failed, ${expiredDeleted} expired records deleted`
         );

         // Log current statistics
         const stats = await this.getStatistics();
         console.log(
            `[${this.serviceName}] Current outbox stats - Pending: ${stats.pending}, Processed: ${stats.processed}, Failed: ${stats.failed}`
         );
      } catch (error) {
         console.error(
            `[${this.serviceName}] Error during cleanup:`,
            error.message
         );
      }
   }

   async getStatistics() {
      const [pending, processed, failed] = await Promise.all([
         this.OutboxModel.count({ where: { status: "PENDING" } }),
         this.OutboxModel.count({ where: { status: "PROCESSED" } }),
         this.OutboxModel.count({ where: { status: "FAILED" } }),
      ]);

      return { pending, processed, failed };
   }

   async stop() {
      if (!this.isRunning) {
         return;
      }

      if (this.timer) {
         clearTimeout(this.timer);
         clearInterval(this.timer);
         this.timer = null;
      }
      this.isRunning = false;
      console.log(`[${this.serviceName}] Cleanup worker stopped`);
   }
}

module.exports = CleanupWorker;
