const database = require("../config/database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized for Transaction!");
}

class Transaction {
   async start() {
      return await sequelize.transaction();
   }

   async commit(transaction) {
      if (!transaction) {
         throw new Error("Transaction is required for commit");
      }
      await transaction.commit();
   }

   async rollback(transaction) {
      if (!transaction) {
         throw new Error("Transaction is required for rollback");
      }
      await transaction.rollback();
   }

   async execute(callback) {
      const transaction = await this.start();
      try {
         const result = await callback(transaction);
         await this.commit(transaction);
         return result;
      } catch (error) {
         await this.rollback(transaction);
         throw error;
      }
   }
}

module.exports = new Transaction();
