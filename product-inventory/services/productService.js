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

      await transaction.execute(async (tx) => {
         // Create outbox event
         const product = await productRepository.create({ id, stock }, tx);
         await outboxService.createOutboxEntry(
            {
               aggregateId: product.id.toString(),
               aggregateType: "Product",
               eventType: "stock.updated",
               payload: [{ id: product.id, stock: product.stock }],
            },
            tx
         );
      });
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
    * Delete product
    * @param {string} productId - Product ID
    * @returns {Promise<Object>} Deleted product
    */
   async deleteProduct(productId) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      await transaction.execute(async (tx) => {
         const product = await productRepository.delete(productId, tx);
         if (!product) {
            throw new Error("Product not found");
         }
         await outboxService.createOutboxEntry(
            {
               aggregateId: product.id.toString(),
               aggregateType: "Product",
               eventType: "stock.updated",
               payload: [{ id: product.id, stock: -1 }],
            },
            tx
         );
      });
   }
   /**
    * Bulk update stock for multiple products with outbox entry
    * @param {Array<{id: string, quantity: number, name: string}>} updates - List of product stock updates
    * @param {string|null} orderId - Associated order ID for inventory operations (optional)
    * @returns {Promise<Object>} Result with updated products
    */
   async bulkUpdateStockWithOutbox(updates, orderId = null) {
      if (!Array.isArray(updates) || updates.length === 0) {
         throw new Error("updates must be a non-empty array");
      }

      for (const { id, quantity, name } of updates) {
         if (!id) throw new Error("Product ID is required in updates");
         if (!orderId && (!quantity || quantity <= 0)) {
            throw new Error(
               `Invalid quantity for product ${name}. Must be greater than 0`
            );
         }
      }
      return await transaction.execute(async (tx) => {
         const ids = updates.map((update) => update.id);

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

         for (const { id, quantity } of updates) {
            const product = productMap[id];
            if (!product) {
               throw new Error(`Product with ID ${id} not found`);
            }

            // Only validate negative stock for deduct operations
            if (orderId && quantity < 0 && product.stock < Math.abs(quantity)) {
               throw new Error(
                  `Insufficient stock for product ID: ${id}. Available: ${product.stock}, Requested: ${Math.abs(quantity)}`
               );
            }

            const newStock = orderId ? product.stock + quantity : quantity;

            updateProducts.push({
               id,
               stock: newStock,
            });
         }

         // Update stock (add or deduct)
         const updatedProducts =
            await productRepository.bulkUpdateStockInTransaction(updates, tx);
         let eventType = "stock.updated";
         let aggregateId = ids.join(",");
         if (orderId) {
            eventType =
               updates[0].quantity < 0
                  ? "inventory.reserved"
                  : "inventory.restored";
            aggregateId = orderId;
         }
         const stockUpdateOutbox = {
            aggregateId: aggregateId,
            aggregateType: "Inventory",
            eventType,
            payload: updateProducts,
         };
         await outboxService.createOutboxEntry(stockUpdateOutbox, tx);

         return { products: updatedProducts };
      });
   }
}

module.exports = new ProductService();
