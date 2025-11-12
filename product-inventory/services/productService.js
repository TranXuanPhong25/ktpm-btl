const productRepository = require("../repositories/productRepository");

class ProductService {
   /**
    * Create a new product
    * @param {Object} productData - Product data (id, price, stock)
    * @returns {Promise<Object>} Created product
    */
   async createProduct(productData) {
      const { id, price, stock } = productData;

      // Validation
      if (!id) {
         throw new Error("Product ID is required");
      }

      if (!price || price <= 0) {
         throw new Error("Price must be greater than 0");
      }

      if (stock === undefined || stock < 0) {
         throw new Error("Stock must be 0 or greater");
      }

      // Create product
      const product = await productRepository.create({
         id,
         price,
         stock,
      });

      return product;
   }

   /**
    * Get all products
    * @param {Object} filters - Optional filters
    * @returns {Promise<Array>} List of products
    */
   async getAllProducts() {
      return await productRepository.findAll();
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

      const { price, stock } = updateData;

      // Validation
      if (price !== undefined && price <= 0) {
         throw new Error("Price must be greater than 0");
      }

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
         price,
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

   /**
    * Deduct stock from multiple products in bulk with business logic
    * @param {Array<{ id: string, quantity: number }>} updates - List of productId and quantity
    * @returns {Promise<Array<Object>>} List of updated products
    */
   // ProductService.js - bulkDeductStock (BẢN SỬA)
   async bulkDeductStock(updates) {
      if (!Array.isArray(updates) || updates.length === 0) {
         throw new Error("updates must be a non-empty array");
      }

      for (const { id, quantity } of updates) {
         if (!id) throw new Error("Product ID is required in updates");
         if (!quantity || quantity <= 0) {
            throw new Error(
               `Invalid quantity for product ${id}. Must be greater than 0`
            );
         }
      }

      return await productRepository.bulkDeductStock(updates);
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

   /**
    * Get low stock products
    * @param {number} threshold - Stock threshold (default: 10)
    * @returns {Promise<Array>} List of low stock products
    */
   async getLowStockProducts(threshold = 10) {
      return await productRepository.findLowStock(threshold);
   }
}

module.exports = new ProductService();
