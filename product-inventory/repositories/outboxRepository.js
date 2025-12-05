const database = require("../config/database");
const Outbox = require("../models/outbox");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized for Repository!");
}

class OutboxRepository {
   async create(outboxData, transaction = null) {
      try {
         return await Outbox.create(
            {
               aggregateId: outboxData.aggregateId,
               aggregateType: outboxData.aggregateType,
               eventType: outboxData.eventType,
               payload: JSON.stringify(outboxData.payload),
               status: outboxData.status || "PENDING",
            },
            transaction ? { transaction } : {}
         );
      } catch (err) {
         throw new Error(`Failed to create outbox entry: ${err.message}`);
      }
   }

   async findOne(whereClause) {
      try {
         return await Outbox.findOne({ where: whereClause });
      } catch (err) {
         throw new Error(`Failed to find outbox entry: ${err.message}`);
      }
   }

   async findAll(whereClause) {
      try {
         return await Outbox.findAll({ where: whereClause });
      } catch (err) {
         throw new Error(`Failed to find outbox entries: ${err.message}`);
      }
   }

   async updateStatus(id, status, transaction = null) {
      try {
         await Outbox.update(
            { status },
            {
               where: { id },
               ...(transaction ? { transaction } : {}),
            }
         );
      } catch (err) {
         throw new Error(`Failed to update outbox status: ${err.message}`);
      }
   }

   async delete(id, transaction = null) {
      try {
         await Outbox.destroy({
            where: { id },
            ...(transaction ? { transaction } : {}),
         });
      } catch (err) {
         throw new Error(`Failed to delete outbox entry: ${err.message}`);
      }
   }
}

module.exports = new OutboxRepository();
