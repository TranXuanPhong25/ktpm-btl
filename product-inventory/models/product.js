const { DataTypes } = require("sequelize");
const database = require("../config/database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized!");
}

const Product = sequelize.define("Product", {
   id: {
      type: DataTypes.CHAR(24), // hex 24 ký tự
      primaryKey: true,
      allowNull: false,
   },
   price: {
      type: DataTypes.DECIMAL(10, 2),
   },
   stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
         min: {
            args: [0],
            msg: "Stock cannot be negative",
         },
      },
   },
});

module.exports = Product;
