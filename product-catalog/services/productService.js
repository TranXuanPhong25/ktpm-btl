const productRepository = require("../repositories/productRepository");
const outboxRepository = require("../repositories/outboxRepository");
const mongoose = require("mongoose");
const productCacheService = require("./productCacheService");
const inventoryRepository = require("../repositories/inventoryRepository");
class ProductService {
   /**
    * Create a new product with validation
    * @param {Object} productData - Product data
    * @returns {Promise<Object>} Created product
    */
   async createProduct(productData) {
      const { _id, name, description, category, price, stock } = productData;

      // Validation
      if (price === undefined || price <= 0) {
         throw new Error("Price must be greater than 0");
      }
      if (stock === undefined || stock < 0) {
         throw new Error("Stock cannot be negative");
      }
      // Create product through repository with transaction
      const createData = {
         name,
         description,
         category,
         price,
      };

      // Support custom _id if provided
      if (_id) {
         createData._id = _id;
      }

      // Start transaction session
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
         const product = await productRepository.create(createData, session);

         // Create outbox event
         await outboxRepository.create(
            {
               aggregateId: product._id.toString(),
               aggregateType: "Product",
               eventType: "product.created",
               payload: {
                  id: product._id.toString(),
                  name: product.name,
                  description: product.description,
                  category: product.category,
                  price: product.price,
                  stock: stock,
               },
               status: "PENDING",
            },
            session
         );

         await session.commitTransaction();
         return product;
      } catch (error) {
         await session.abortTransaction();
         throw error;
      } finally {
         session.endSession();
      }
   }

   async getAllProducts(filters = {}, pagable = {}) {
      const { page = 1, limit = 20 } = pagable;
      // if (filters.category) {
      //    return await productRepository.findByCategory(filters.category, {
      //       page,
      //       limit,
      //    });
      // }

      const { data, pagination } = await productRepository.findAll({
         page,
         limit,
      });
      const productIds = data.map((p) => p.id);
      const inventories =
         await inventoryRepository.findByProductIds(productIds);
      const inventoriesMap = new Map(
         inventories.map((inv) => [inv.productId.toString(), inv])
      );

      return {
         pagination,
         data: data.map((product) => {
            const inventory = inventoriesMap.get(product.id.toString());
            return {
               name: product.name,
               description: product.description,
               category: product.category,
               price: product.price,
               _id: product._id,
               createdAt: product.createdAt,
               inventory: {
                  stock: inventory ? inventory.stock : undefined,
               },
            };
         }),
      };
   }

   async getProductsByIds(productIds, needInventory = true) {
      if (!Array.isArray(productIds) || productIds.length === 0) {
         throw new Error(
            "Product IDs are required and must be a non-empty array"
         );
      }
      const products = await productRepository.findManyByIds(productIds);
      if (!needInventory) {
         return products;
      }
      const foundIds = products.map((p) => p.id);
      const inventories = await inventoryRepository.findByProductIds(foundIds);
      const inventoriesMap = new Map(
         inventories.map((inv) => [inv.productId.toString(), inv.stock])
      );
      return products.map((product) => {
         const inventory = inventoriesMap.get(product._id.toString());
         return {
            ...product.toObject(),
            inventory: {
               stock: inventory,
            },
         };
      });
   }

   async updateProduct(productId, updateData) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const { name, description, category, price } = updateData;

      const requiredFields = ["name", "description", "category", "price"];
      for (const field of requiredFields) {
         if (updateData[field] === undefined) {
            throw new Error(`${field} is required`);
         }
      }

      // Validation
      if (price !== undefined && price <= 0) {
         throw new Error("Price must be greater than 0");
      }

      // Check if product exists
      const existingProduct = await productRepository.findById(productId);
      if (!existingProduct) {
         throw new Error("Product not found");
      }

      // Update product
      const updatedProduct = await productRepository.update(productId, {
         name,
         description,
         category,
         price,
      });
      // Invalidate cache in background
      productCacheService.invalidateProduct(productId).catch((err) => {
         console.error(
            `Failed to invalidate cache for product ${productId}:`,
            err.message
         );
      });
      return updatedProduct;
   }

   /**
    * Delete a product
    * @param {string} productId - Product ID to delete
    * @param {number} stock - Stock quantity (optional, defaults to 0)
    * @returns {Promise<Object>} Deleted product
    */
   async deleteProduct(productId) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      // Start transaction session
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
         const product = await productRepository.delete(productId, session);
         if (!product) {
            throw new Error("Product not found");
         }

         // Create outbox event
         await outboxRepository.create(
            {
               aggregateId: product._id.toString(),
               aggregateType: "Product",
               eventType: "product.deleted",
               payload: {
                  id: product._id.toString(),
               },
               status: "PENDING",
            },
            session
         );

         await session.commitTransaction();
         // Invalidate cache in background
         productCacheService.invalidateProduct(productId).catch((err) => {
            console.error(
               `Failed to invalidate cache for product ${productId}:`,
               err.message
            );
         });
         return product;
      } catch (error) {
         await session.abortTransaction();
         throw error;
      } finally {
         session.endSession();
      }
   }

   /**
    * Get products by category
    * @param {string} category - Product category
    * @returns {Promise<Array>} List of products
    */
   async getProductsByCategory(category) {
      if (!category) {
         throw new Error("Category is required");
      }

      return await productRepository.findByCategory(category);
   }
}

module.exports = new ProductService();
