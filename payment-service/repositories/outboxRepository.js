const Outbox = require("../models/outbox");

class OutboxRepository {
   async createOutboxEntry(outboxData, session = null) {
      try {
         outboxData.payload = JSON.stringify(outboxData.payload);
         const outbox = new Outbox(outboxData);

         if (session) {
            return await outbox.save({ session });
         }

         return await outbox.save();
      } catch (error) {
         console.error("Error creating outbox entry:", error);
         throw new Error(`Failed to create outbox entry: ${error.message}`);
      }
   }
}

module.exports = new OutboxRepository();
