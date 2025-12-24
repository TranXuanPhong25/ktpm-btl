const mongoose = require("mongoose");
const DatabaseAdapter = require("./databaseAdapter");

/**
 * MongoDB Database Adapter using Mongoose ODM
 */
class MongoAdapter extends DatabaseAdapter {
   constructor() {
      super();
      this.connection = null;
      this.Outbox = null;
      this.connected = false;
   }

   /**
    * Connect to MongoDB database
    */
   async connect(uri) {
      try {
         this.connection = await mongoose.connect(uri, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
         });

         // Define Outbox model
         this.defineOutboxModel();

         this.connected = true;
         console.log("✓ MongoDB connected successfully");
      } catch (error) {
         console.error("Failed to connect to MongoDB:", error.message);
         throw error;
      }
   }

   /**
    * Define Outbox model for Mongoose
    */
   defineOutboxModel() {
      const outboxSchema = new mongoose.Schema({
         aggregateId: { type: String, required: true },
         aggregateType: { type: String, required: true },
         eventType: { type: String, required: true },
         payload: { type: String, required: true },
         status: {
            type: String,
            enum: ["PENDING", "PROCESSED", "FAILED"],
            default: "PENDING",
         },
         retryCount: {
            type: Number,
            default: 0,
         },
         maxRetries: {
            type: Number,
            default: 5,
         },
         processedAt: {
            type: Date,
         },
         createdAt: {
            type: Date,
            default: Date.now,
         },
         expireAt: {
            type: Date,
            default: () => new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
         },
      });

      // Create indexes
      outboxSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
      outboxSchema.index({ status: 1, createdAt: 1 });
      outboxSchema.index({ aggregateId: 1, eventType: 1 });
      // Check if model already exists (to avoid OverwriteModelError)
      this.Outbox =
         mongoose.models.Outbox || mongoose.model("Outbox", outboxSchema);
   }

   /**
    * Find pending events from outbox
    */
   async findPendingEvents(batchSize = 100) {
      try {
         const events = await this.Outbox.find({
            status: "PENDING",
            $or: [
               { retryCount: { $exists: false } },
               {
                  $expr: {
                     $lt: [
                        { $ifNull: ["$retryCount", 0] },
                        { $ifNull: ["$maxRetries", 5] },
                     ],
                  },
               },
            ],
         })
            .select(
               "aggregateId aggregateType eventType payload status retryCount maxRetries createdAt"
            )
            .lean()
            .sort({ createdAt: 1 })
            .limit(batchSize);

         return events.map((event) => ({
            id: event._id.toString(),
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
   async markAsProcessed(eventIds) {
      try {
         await this.Outbox.updateMany(
            { _id: { $in: eventIds } },
            {
               status: "PROCESSED",
               processedAt: new Date(),
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
         await this.Outbox.findByIdAndUpdate(eventId, {
            status: "FAILED",
            processedAt: new Date(),
         });
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
         const event = await this.Outbox.findById(eventId);
         if (event) {
            const newRetryCount = event.retryCount + 1;
            await this.Outbox.findByIdAndUpdate(eventId, {
               retryCount: newRetryCount,
               status: newRetryCount >= event.maxRetries ? "FAILED" : "PENDING",
            });
         }
      } catch (error) {
         console.error("Error incrementing retry count:", error.message);
         throw error;
      }
   }

   /**
    * Cleanup - MongoDB uses TTL index, so this is a no-op
    */
   async cleanup(retentionHours = 24) {
      console.log(
         "MongoDB cleanup handled automatically by TTL index on expireAt field"
      );
      return {
         message: "MongoDB uses TTL index for automatic cleanup",
      };
   }

   /**
    * Get database statistics
    */
   async getStats() {
      try {
         const pending = await this.Outbox.countDocuments({
            status: "PENDING",
         });
         const processed = await this.Outbox.countDocuments({
            status: "PROCESSED",
         });
         const failed = await this.Outbox.countDocuments({
            status: "FAILED",
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
      return this.connected && mongoose.connection.readyState === 1;
   }

   /**
    * Disconnect from database
    */
   async disconnect() {
      try {
         if (this.connection) {
            await mongoose.connection.close();
         }
         this.connected = false;
         console.log("✓ MongoDB disconnected");
      } catch (error) {
         console.error("Error disconnecting from MongoDB:", error.message);
      }
   }
}

module.exports = MongoAdapter;
