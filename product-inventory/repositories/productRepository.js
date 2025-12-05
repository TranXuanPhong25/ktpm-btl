const { Op } = require("sequelize");
const Product = require("../models/product");
const database = require("../config/database");
const outboxRepository = require("./outboxRepository");

const sequelize = database.getConnection();

if (!sequelize) {
   throw new Error("Sequelize connection not initialized for Repository!");
}

class ProductRepository {
   async create(productData) {
      try {
         console.log("Creating product:", typeof productData.id);
         return await Product.create(productData);
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
         return await Product.findAll({
            where: {
               id: { [Op.in]: productIds },
            },
            lock: withLock ? transaction.LOCK.UPDATE : undefined,
            transaction: transaction,
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

   async bulkDeductStockInTransaction(updates, transaction) {
      await Promise.all(
         updates.map(({ id, quantity }) =>
            Product.increment(
               { stock: -quantity },
               { where: { id: id }, transaction: transaction },
               { new: true }
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
