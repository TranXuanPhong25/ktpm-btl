const productRepository = require("../repositories/productRepository");

class ProductService {
   /**
    * Create a new product with validation
    * @param {Object} productData - Product data
    * @returns {Promise<Object>} Created product
    */
   async createProduct(productData) {
      const { name, description, category } = productData;

      // Validation
      if (!name || !description || !category) {
         throw new Error(
            "Missing required fields: name, description, category"
         );
      }

      // Create product through repository
      return await productRepository.create({
         name,
         description,
         category,
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

      const { name, description, category } = updateData;

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
