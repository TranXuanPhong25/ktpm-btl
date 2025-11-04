const Product = require("../models/product");

class ProductRepository {
   /**
    * Create a new product
    * @param {Object} productData - Product data
    * @returns {Promise<Object>} Created product
    */
   async create(productData) {
      try {
         const newProduct = new Product(productData);
         return await newProduct.save();
      } catch (err) {
         throw new Error(`Failed to create product: ${err.message}`);
      }
   }

   /**
    * Find all products
    * @returns {Promise<Array>} List of products
    */
   async findAll() {
      try {
         return await Product.find();
      } catch (err) {
         throw new Error(`Failed to get all products: ${err.message}`);
      }
   }

   /**
    * Find product by ID
    * @param {string} id - Product ID
    * @returns {Promise<Object|null>} Product or null
    */
   async findById(id) {
      try {
         return await Product.findById(id);
      } catch (err) {
         throw new Error(`Failed to get product ${id}: ${err.message}`);
      }
   }

   /**
    * Find multiple products by their IDs
    * @param {Array<string>} productIds - List of product IDs
    * @returns {Promise<Array<Object>>} List of found products
    */
   async findManyByIds(productIds) {
      try {
         return await Product.find({ _id: { $in: productIds } });
      } catch (err) {
         throw new Error(`Failed to get products: ${err.message}`);
      }
   }

   /**
    * Update product by ID
    * @param {string} id - Product ID
    * @param {Object} updateData - Data to update
    * @returns {Promise<Object|null>} Updated product or null
    */
   async update(id, updateData) {
      try {
         const { name, description, category } = updateData;
         const validData = { name, description, category };
         return await Product.findByIdAndUpdate(id, validData, { new: true });
      } catch (err) {
         throw new Error(`Failed to update product ${id}: ${err.message}`);
      }
   }

   /**
    * Delete product by ID
    * @param {string} id - Product ID
    * @returns {Promise<Object|null>} Deleted product or null
    */
   async delete(id) {
      try {
         return await Product.findByIdAndDelete(id);
      } catch (err) {
         throw new Error(`Failed to delete product ${id}: ${err.message}`);
      }
   }

   /**
    * Find products by category
    * @param {string} category - Product category
    * @returns {Promise<Array>} List of products
    */
   async findByCategory(category) {
      try {
         return await Product.find({ category });
      } catch (err) {
         throw new Error(`Failed to get products by category: ${err.message}`);
      }
   }
}

module.exports = new ProductRepository();
