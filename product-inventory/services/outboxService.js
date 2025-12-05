const outboxRepository = require("../repositories/outboxRepository");

class OutboxService {
   async createOutboxEntry(outboxData, transaction = null) {
      if (!outboxData.aggregateId) {
         throw new Error("aggregateId is required");
      }
      if (!outboxData.aggregateType) {
         throw new Error("aggregateType is required");
      }
      if (!outboxData.eventType) {
         throw new Error("eventType is required");
      }
      if (!outboxData.payload) {
         throw new Error("payload is required");
      }

      return await outboxRepository.create(outboxData, transaction);
   }

   async findOutboxEntry(whereClause) {
      return await outboxRepository.findOne(whereClause);
   }

   async findOutboxEntries(whereClause) {
      return await outboxRepository.findAll(whereClause);
   }

   async updateOutboxStatus(id, status, transaction = null) {
      if (!["PENDING", "PROCESSED", "FAILED"].includes(status)) {
         throw new Error(`Invalid status: ${status}`);
      }
      return await outboxRepository.updateStatus(id, status, transaction);
   }

   async deleteOutboxEntry(id, transaction = null) {
      return await outboxRepository.delete(id, transaction);
   }
}

module.exports = new OutboxService();
