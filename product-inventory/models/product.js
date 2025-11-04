const { DataTypes } = require("sequelize");
const database = require("../config/database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized!");
}

const Product = sequelize.define("Product", {
   price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
   },
   stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
         min: {
            args: [0],
            msg: "Stock cannot be negative",
         },
      },
   },
});

module.exports = Product;
