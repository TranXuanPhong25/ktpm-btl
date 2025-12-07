const { DataTypes } = require("sequelize");
const database = require("./database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized!");
}

/**
 * Outbox pattern model for inventory events
 * Used for reliable event publishing via CDC or polling
 */
const Outbox = sequelize.define(
   "Outbox",
   {
      id: {
         type: DataTypes.INTEGER,
         primaryKey: true,
         autoIncrement: true,
      },
      aggregateId: {
         type: DataTypes.STRING(24),
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
         type: DataTypes.TEXT, // JSON string
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
         defaultValue: 3,
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

module.exports = Outbox;
