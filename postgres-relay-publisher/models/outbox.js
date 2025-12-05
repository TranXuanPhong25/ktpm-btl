const { DataTypes } = require("sequelize");

/**
 * Outbox pattern model for PostgreSQL
 * Used for reliable event publishing via polling
 */
function defineOutboxModel(sequelize) {
   const Outbox = sequelize.define(
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
            defaultValue: () => new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours TTL
         },
      },
      {
         timestamps: true,
         tableName: "Outboxes",
         indexes: [
            {
               fields: ["aggregateId"],
            },
            {
               fields: ["status"],
            },
            {
               fields: ["status", "createdAt"],
            },
            {
               fields: ["expireAt"],
            },
         ],
      }
   );

   return Outbox;
}

module.exports = defineOutboxModel;
