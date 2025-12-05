const outboxRepository = require("../repositories/outboxRepository");
const productRepository = require("../repositories/productRepository");
const outboxService = require("./outboxService");
const transaction = require("../repositories/transaction");

class ProductService {
   /**
    * Create a new product
    * @param {Object} productData - Product data (id, stock)
    * @returns {Promise<Object>} Created product
    */
   async createProduct(productData) {
      const { id, stock } = productData;

      // Validation
      if (!id) {
         throw new Error("Product ID is required");
      }

      if (stock === undefined || stock < 0) {
         throw new Error("Stock must be 0 or greater");
      }

      // Create product
      const product = await productRepository.create({
         id,
         stock,
      });

      return product;
   }

   /**
    * Get all products with pagination
    * @param {Object} pagination - Pagination options (page, limit)
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async getAllProducts(pagination = {}) {
      const { page = 1, limit = 20 } = pagination;
      return await productRepository.findAll({ page, limit });
   }

   /**
    * Get product by ID
    * @param {string} productId - Product ID
    * @returns {Promise<Object>} Product
    */
   async getProductById(productId) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const product = await productRepository.findById(productId);
      if (!product) {
         throw new Error("Product not found");
      }

      return product;
   }

   /**
    * Get multiple products by their IDs
    * @param {Array<string>} productIds - List of product IDs
    * @returns {Promise<Array<Object>>} List of found products
    */
   async getProductsByIds(productIds) {
      if (!Array.isArray(productIds) || productIds.length === 0) {
         throw new Error(
            "Product IDs are required and must be a non-empty array"
         );
      }

      const products = await productRepository.findManyByIds(productIds);

      if (!products || products.length === 0) {
         throw new Error("No products found");
      }

      return products;
   }

   /**
    * Update product with validation
    * @param {string} productId - Product ID
    * @param {Object} updateData - Data to update
    * @returns {Promise<Object>} Updated product
    */
   async updateProduct(productId, updateData) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const { stock } = updateData;

      // Validation
      if (stock !== undefined && stock < 0) {
         throw new Error("Stock cannot be negative");
      }

      // Check if product exists
      const existingProduct = await productRepository.findById(productId);
      if (!existingProduct) {
         throw new Error("Product not found");
      }

      // Update product
      const updatedProduct = await productRepository.update(productId, {
         stock,
      });

      return updatedProduct;
   }

   /**
    * Delete product
    * @param {string} productId - Product ID
    * @returns {Promise<Object>} Deleted product
    */
   async deleteProduct(productId) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const product = await productRepository.delete(productId);
      if (!product) {
         throw new Error("Product not found");
      }

      return product;
   }

   /**
    * Deduct stock from product with business logic
    * @param {string} productId - Product ID
    * @param {number} quantity - Quantity to deduct
    * @returns {Promise<Object>} Updated product
    */
   async deductStock(productId, quantity) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      if (!quantity || quantity <= 0) {
         throw new Error("Quantity must be greater than 0");
      }

      const updatedProduct = await productRepository.deductStock(
         productId,
         quantity
      );

      return updatedProduct;
   }

   async bulkDeductStockWithOutbox(updates, outboxData) {
      if (!Array.isArray(updates) || updates.length === 0) {
         throw new Error("updates must be a non-empty array");
      }

      if (!outboxData || !outboxData.eventType || !outboxData.payload) {
         throw new Error("outboxData must contain eventType and payload");
      }

      for (const { id, quantity } of updates) {
         if (!id) throw new Error("Product ID is required in updates");
         if (!quantity || quantity <= 0) {
            throw new Error(
               `Invalid quantity for product ${id}. Must be greater than 0`
            );
         }
      }

      return await transaction.execute(async (tx) => {
         // Aggregate updates by product ID
         const aggregatedUpdates = updates.reduce((acc, { id, quantity }) => {
            acc[id] = (acc[id] || 0) + Number(quantity);
            return acc;
         }, {});
         const uniqueUpdates = Object.entries(aggregatedUpdates).map(
            ([id, quantity]) => ({ id, quantity })
         );
         const ids = uniqueUpdates.map((update) => update.id);

         // Lock and fetch products
         const withLock = true;
         const products = await productRepository.findManyByIds(
            ids,
            withLock,
            tx
         );

         // Build product map
         const productMap = products.reduce((map, product) => {
            map[product.id.toString()] = product;
            return map;
         }, {});
         let updateProducts = [];
         // Validate stock availability
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
            updateProducts.push({
               id,
               stock: product.stock - quantity,
            });
         }

         // Deduct stock
         await productRepository.bulkDeductStockInTransaction(
            uniqueUpdates,
            tx
         );
         // Create outbox entry
         outboxData.payload = JSON.stringify({
            ...outboxData.payload,
            products: updateProducts,
         });
         const outboxEntry = await outboxService.createOutboxEntry(
            outboxData,
            tx
         );

         const updatedProducts = await productRepository.findManyByIds(ids);
         return { products: updatedProducts, outbox: outboxEntry };
      });
   }

   /**
    * Add stock to product
    * @param {string} productId - Product ID
    * @param {number} quantity - Quantity to add
    * @returns {Promise<Object>} Updated product
    */
   async addStock(productId, quantity) {
      if (!productId) {
         throw new Error("Product ID is required");
      }
      if (!quantity || quantity <= 0) {
         throw new Error("Quantity must be greater than 0");
      }

      return await productRepository.addStock(productId, quantity);
   }

   /**
    * Check product availability
    * @param {string} productId - Product ID
    * @param {number} quantity - Required quantity
    * @returns {Promise<Object>} Availability info
    */
   async checkAvailability(productId, quantity) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const product = await productRepository.findById(productId);
      if (!product) {
         throw new Error("Product not found");
      }

      return {
         productId: product.id,
         requestedQuantity: quantity,
         availableStock: product.stock,
         isAvailable: product.stock >= quantity,
      };
   }
}

module.exports = new ProductService();
