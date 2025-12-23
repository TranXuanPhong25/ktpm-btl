const { DataTypes } = require("sequelize");
const database = require("./database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized!");
}

/**
 * Model to track processed messages for idempotency
 */
const ProcessedMessage = sequelize.define(
   "ProcessedMessage",
   {
      id: {
         type: DataTypes.INTEGER,
         primaryKey: true,
         autoIncrement: true,
      },
      messageId: {
         type: DataTypes.STRING(255),
         allowNull: false,
         unique: true, // Idempotency key
      },
      eventType: {
         type: DataTypes.STRING(100),
         allowNull: false,
      },
      aggregateId: {
         type: DataTypes.STRING(255),
         allowNull: false,
      },
      processedAt: {
         type: DataTypes.DATE,
         defaultValue: DataTypes.NOW,
         allowNull: false,
      },
      expireAt: {
         type: DataTypes.DATE,
         allowNull: true,
         defaultValue: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
      },
   },
   {
      timestamps: false,
      indexes: [
         {
            fields: ["messageId"],
            unique: true,
         },
         {
            fields: ["eventType", "aggregateId"],
         },
         {
            fields: ["expireAt"],
         },
      ],
   }
);

module.exports = ProcessedMessage;
