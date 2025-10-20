const productRepository = require("../repositories/productRepository");

class ProductService {
   /**
    * Create a new product with validation
    * @param {Object} productData - Product data
    * @returns {Promise<Object>} Created product
    */
   async createProduct(productData) {
      const { name, description, price, category, stock } = productData;

      // Validation
      if (!name || !description || !price || !category) {
         throw new Error(
            "Missing required fields: name, description, price, category"
         );
      }

      if (price <= 0) {
         throw new Error("Price must be greater than 0");
      }

      if (stock && stock < 0) {
         throw new Error("Stock cannot be negative");
      }

      // Create product through repository
      return await productRepository.create({
         name,
         description,
         price,
         category,
         stock: stock || 0,
      });
   }

   /**
    * Get all products
    * @param {Object} filters - Optional filters
    * @returns {Promise<Array>} List of products
    */
   async getAllProducts(filters = {}) {
      if (filters.category) {
         return await productRepository.findByCategory(filters.category);
      }
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
    * Update product with validation
    * @param {string} productId - Product ID
    * @param {Object} updateData - Data to update
    * @returns {Promise<Object>} Updated product
    */
   async updateProduct(productId, updateData) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const { name, description, price, category, stock } = updateData;

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
         name,
         description,
         price,
         category,
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

      // Check if product exists and has sufficient stock
      const hasEnoughStock = await productRepository.hasStock(
         productId,
         quantity
      );
      if (!hasEnoughStock) {
         const product = await productRepository.findById(productId);
         if (!product) {
            throw new Error("Product not found");
         }
         throw new Error(
            `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
         );
      }

      // Deduct stock
      return await productRepository.deductStock(productId, quantity);
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

      const product = await productRepository.findById(productId);
      if (!product) {
         throw new Error("Product not found");
      }

      return await productRepository.update(productId, {
         stock: product.stock + quantity,
      });
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
         productId: product._id,
         name: product.name,
         requestedQuantity: quantity,
         availableStock: product.stock,
         isAvailable: product.stock >= quantity,
      };
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

   /**
    * Get low stock products
    * @param {number} threshold - Stock threshold (default: 10)
    * @returns {Promise<Array>} List of low stock products
    */
   async getLowStockProducts(threshold = 10) {
      const allProducts = await productRepository.findAll();
      return allProducts.filter((product) => product.stock <= threshold);
   }
}

module.exports = new ProductService();
