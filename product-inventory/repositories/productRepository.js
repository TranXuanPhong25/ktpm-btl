const { Op } = require("sequelize");
const Product = require("../models/product");
const database = require("../models/database");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized for Repository!");
}

class ProductRepository {
   async create(productData, transaction = null) {
      try {
         return await Product.create(productData, { transaction });
      } catch (err) {
         throw new Error(`Failed to create product: ${err.message}`);
      }
   }

   async findAll({ page = 1, limit = 20 } = {}) {
      try {
         const offset = (page - 1) * limit;
         const { rows: products, count: total } = await Product.findAndCountAll(
            {
               offset,
               limit,
               order: [["createdAt", "DESC"]],
            }
         );
         return {
            data: products,
            pagination: {
               page,
               limit,
               total,
               totalPages: Math.ceil(total / limit),
            },
         };
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

   async findManyByIds(productIds, withLock = false, transaction = null) {
      try {
         const clause = {
            where: {
               id: { [Op.in]: productIds },
            },
         };
         if (withLock) {
            clause.lock = transaction.LOCK.UPDATE;
            clause.transaction = transaction;
         }
         return await Product.findAll(clause);
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

   async bulkUpdateStockInTransaction(updates, transaction) {
      return await Promise.all(
         updates.map(({ id, quantity }) =>
            Product.increment(
               { stock: quantity },
               { where: { id: id }, transaction: transaction, returning: true }
            )
         )
      );
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
}

module.exports = new ProductRepository();
