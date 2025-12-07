const { Sequelize, DataTypes, Op } = require("sequelize");
const DatabaseAdapter = require("./databaseAdapter");

/**
 * PostgreSQL Database Adapter using Sequelize ORM
 */
class PostgresAdapter extends DatabaseAdapter {
   constructor() {
      super();
      this.sequelize = null;
      this.Outbox = null;
      this.connected = false;
   }

   /**
    * Connect to PostgreSQL database
    */
   async connect(uri) {
      try {
         this.sequelize = new Sequelize(uri, {
            logging: false,
            pool: {
               max: 5,
               min: 0,
               acquire: 30000,
               idle: 10000,
            },
         });

         // Test connection
         await this.sequelize.authenticate();

         // Define Outbox model
         this.defineOutboxModel();

         // Sync model (ensure table exists)
         await this.Outbox.sync();

         this.connected = true;
         console.log("✓ PostgreSQL connected successfully");
      } catch (error) {
         console.error("Failed to connect to PostgreSQL:", error.message);
         throw error;
      }
   }

   /**
    * Define Outbox model for Sequelize
    */
   defineOutboxModel() {
      this.Outbox = this.sequelize.define(
         "Outbox",
         {
            id: {
               type: DataTypes.INTEGER,
               primaryKey: true,
               autoIncrement: true,
            },
            aggregateId: {
               type: DataTypes.STRING(50),
               allowNull: false,
            },
            aggregateType: {
               type: DataTypes.STRING(50),
               allowNull: false,
            },
            eventType: {
               type: DataTypes.STRING(100),
               allowNull: false,
            },
            payload: {
               type: DataTypes.TEXT,
               allowNull: false,
            },
            status: {
               type: DataTypes.ENUM("PENDING", "PROCESSED", "FAILED"),
               defaultValue: "PENDING",
               allowNull: false,
            },
            retryCount: {
               type: DataTypes.INTEGER,
               defaultValue: 0,
               allowNull: false,
            },
            maxRetries: {
               type: DataTypes.INTEGER,
               defaultValue: 5,
               allowNull: false,
            },
            processedAt: {
               type: DataTypes.DATE,
               allowNull: true,
            },
            expireAt: {
               type: DataTypes.DATE,
               allowNull: true,
               defaultValue: () => new Date(Date.now() + 12 * 60 * 60 * 1000),
            },
         },
         {
            timestamps: true,
            tableName: "Outboxes",
            indexes: [
               { fields: ["aggregateId"] },
               { fields: ["status"] },
               { fields: ["status", "createdAt"] },
               { fields: ["expireAt"] },
            ],
         }
      );
   }

   /**
    * Find pending events from outbox
    */
   async findPendingEvents(batchSize = 100) {
      try {
         const events = await this.Outbox.findAll({
            where: {
               status: "PENDING",
               [Op.or]: [
                  { retryCount: null },
                  {
                     retryCount: {
                        [Op.lt]: this.sequelize.col("maxRetries"),
                     },
                  },
               ],
            },
            order: [["createdAt", "ASC"]],
            limit: batchSize,
         });

         return events.map((event) => ({
            id: event.id,
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            eventType: event.eventType,
            payload: event.payload,
            status: event.status,
            retryCount: event.retryCount,
            maxRetries: event.maxRetries,
            createdAt: event.createdAt,
         }));
      } catch (error) {
         console.error("Error finding pending events:", error.message);
         throw error;
      }
   }

   /**
    * Mark event as processed
    */
   async markAsProcessed(eventId) {
      try {
         await this.Outbox.update(
            {
               status: "PROCESSED",
               processedAt: new Date(),
            },
            {
               where: { id: eventId },
            }
         );
      } catch (error) {
         console.error("Error marking event as processed:", error.message);
         throw error;
      }
   }

   /**
    * Mark event as failed
    */
   async markAsFailed(eventId, errorMessage) {
      try {
         await this.Outbox.update(
            {
               status: "FAILED",
               processedAt: new Date(),
            },
            {
               where: { id: eventId },
            }
         );
      } catch (error) {
         console.error("Error marking event as failed:", error.message);
         throw error;
      }
   }

   /**
    * Increment retry count
    */
   async incrementRetryCount(eventId) {
      try {
         const event = await this.Outbox.findByPk(eventId);
         if (event) {
            const newRetryCount = event.retryCount + 1;
            await this.Outbox.update(
               {
                  retryCount: newRetryCount,
                  status:
                     newRetryCount >= event.maxRetries ? "FAILED" : "PENDING",
               },
               {
                  where: { id: eventId },
               }
            );
         }
      } catch (error) {
         console.error("Error incrementing retry count:", error.message);
         throw error;
      }
   }

   /**
    * Cleanup old/expired events
    */
   async cleanup(retentionHours = 24) {
      try {
         const cutoffDate = new Date(
            Date.now() - retentionHours * 60 * 60 * 1000
         );

         // Delete PROCESSED events older than retention period
         const processedDeleted = await this.Outbox.destroy({
            where: {
               status: "PROCESSED",
               processedAt: {
                  [Op.lt]: cutoffDate,
               },
            },
         });

         // Delete FAILED events that are expired
         const failedDeleted = await this.Outbox.destroy({
            where: {
               status: "FAILED",
               expireAt: {
                  [Op.lt]: new Date(),
               },
            },
         });

         // Delete old records based on expireAt
         const expiredDeleted = await this.Outbox.destroy({
            where: {
               expireAt: {
                  [Op.lt]: new Date(),
               },
            },
         });

         console.log(
            `Cleanup: ${processedDeleted} processed, ${failedDeleted} failed, ${expiredDeleted} expired records deleted`
         );

         return {
            processedDeleted,
            failedDeleted,
            expiredDeleted,
         };
      } catch (error) {
         console.error("Error during cleanup:", error.message);
         throw error;
      }
   }

   /**
    * Get database statistics
    */
   async getStats() {
      try {
         const pending = await this.Outbox.count({
            where: { status: "PENDING" },
         });
         const processed = await this.Outbox.count({
            where: { status: "PROCESSED" },
         });
         const failed = await this.Outbox.count({
            where: { status: "FAILED" },
         });

         return {
            pending,
            processed,
            failed,
            total: pending + processed + failed,
         };
      } catch (error) {
         console.error("Error getting stats:", error.message);
         return { pending: 0, processed: 0, failed: 0, total: 0 };
      }
   }

   /**
    * Check connection status
    */
   isConnected() {
      return this.connected;
   }

   /**
    * Disconnect from database
    */
   async disconnect() {
      try {
         if (this.sequelize) {
            await this.sequelize.close();
         }
         this.connected = false;
         console.log("✓ PostgreSQL disconnected");
      } catch (error) {
         console.error("Error disconnecting from PostgreSQL:", error.message);
      }
   }
}

module.exports = PostgresAdapter;
