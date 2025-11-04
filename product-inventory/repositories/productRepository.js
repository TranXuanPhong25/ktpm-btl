const { Op } = require("sequelize");
const Product = require("../models/product");
const database = require("../config/database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized for Repository!");
}

class ProductRepository {
   async findAll() {
      try {
         return await Product.findAll();
      } catch (err) {
         throw new Error(`Failed to get all products: ${err.message}`);
      }
   }

   async findById(id) {
      try {
         return await Product.findByPk(id);
      } catch (err) {
         throw new Error(`Failed to get product ${id}: ${err.message}`);
      }
   }

   async findManyByIds(productIds) {
      try {
         return await Product.findAll({
            where: {
               id: { [Op.in]: productIds },
            },
         });
      } catch (err) {
         throw new Error(`Failed to get products: ${err.message}`);
      }
   }

   async update(id, updateData) {
      try {
         const [affectedRows] = await Product.update(updateData, {
            where: { id: id },
         });

         if (affectedRows > 0) {
            return await this.findById(id);
         }
         return null;
      } catch (err) {
         throw new Error(`Failed to update product ${id}: ${err.message}`);
      }
   }

   async delete(id) {
      try {
         const product = await this.findById(id);
         if (!product) {
            return null;
         }
         await Product.destroy({ where: { id: id } });
         return product;
      } catch (err) {
         throw new Error(`Failed to delete product ${id}: ${err.message}`);
      }
   }

   async deductStock(id, quantity) {
      try {
         const [affectedRowsArray] = await Product.increment(
            { stock: -quantity },
            {
               where: {
                  id: id,
                  stock: { [Op.gte]: quantity },
               },
               returning: true,
            }
         );

         const updatedProducts = affectedRowsArray[0];

         if (!updatedProducts || updatedProducts.length === 0) {
            const product = await this.findById(id);
            if (!product) {
               throw new Error("Product not found");
            }
            throw new Error(
               `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
            );
         }

         return updatedProducts[0];
      } catch (err) {
         throw new Error(err.message);
      }
   }

   async bulkDeductStock(updates) {
      if (!Array.isArray(updates) || updates.length === 0) {
         throw new Error("updates must be a non-empty array");
      }

      const transaction = await sequelize.transaction();

      try {
         const aggregatedUpdates = updates.reduce((acc, { id, quantity }) => {
            acc[id] = (acc[id] || 0) + Number(quantity);
            return acc;
         }, {});
         const uniqueUpdates = Object.entries(aggregatedUpdates).map(
            ([id, quantity]) => ({ id, quantity })
         );
         const ids = uniqueUpdates.map((update) => update.id);

         const products = await Product.findAll({
            where: { id: { [Op.in]: ids } },
            transaction: transaction,
            lock: transaction.LOCK.UPDATE,
         });

         const productMap = products.reduce((map, product) => {
            map[product.id.toString()] = product;
            return map;
         }, {});

         for (const { id, quantity } of uniqueUpdates) {
            const product = productMap[id];
            if (!product) {
               throw new Error(`Product with ID ${id} not found`);
            }
            if (product.stock < quantity) {
               throw new Error(
                  `Insufficient stock for product ID: ${id}. Available: ${product.stock}, Requested: ${quantity}`
               );
            }
         }

         await Promise.all(
            uniqueUpdates.map(({ id, quantity }) =>
               Product.increment(
                  { stock: -quantity },
                  { where: { id: id }, transaction: transaction }
               )
            )
         );

         await transaction.commit();

         return await this.findManyByIds(ids);
      } catch (err) {
         await transaction.rollback();
         throw new Error(`Failed to deduct stock in bulk: ${err.message}`);
      }
   }

   async hasStock(id, quantity) {
      try {
         const product = await this.findById(id);
         return product && product.stock >= quantity;
      } catch (err) {
         throw new Error(
            `Failed to check stock for product ${id}: ${err.message}`
         );
      }
   }

   async findLowStock(threshold) {
      try {
         return await Product.findAll({
            where: {
               stock: { [Op.lte]: threshold },
            },
         });
      } catch (err) {
         throw new Error(`Failed to get low stock products: ${err.message}`);
      }
   }

   async addStock(id, quantity) {
      try {
         const [affectedRowsArray] = await Product.increment(
            { stock: quantity },
            {
               where: { id: id },
               returning: true,
            }
         );

         const updatedProducts = affectedRowsArray[0];

         if (!updatedProducts || updatedProducts.length === 0) {
            throw new Error("Product not found");
         }

         return updatedProducts[0];
      } catch (err) {
         throw new Error(err.message);
      }
   }
}

module.exports = new ProductRepository();
