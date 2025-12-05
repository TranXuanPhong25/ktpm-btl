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
    * Find all products with pagination
    * @param {Object} options - Pagination options
    * @param {number} options.page - Page number (1-based)
    * @param {number} options.limit - Items per page
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async findAll({ page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const [products, total] = await Promise.all([
            Product.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
            Product.countDocuments(),
         ]);
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
         const { name, description, category, price } = updateData;
         const validData = { name, description, category, price };
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
    * Find products by category with pagination
    * @param {string} category - Product category
    * @param {Object} options - Pagination options
    * @param {number} options.page - Page number (1-based)
    * @param {number} options.limit - Items per page
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async findByCategory(category, { page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const query = { category };
         const [products, total] = await Promise.all([
            Product.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Product.countDocuments(query),
         ]);
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
         throw new Error(`Failed to get products by category: ${err.message}`);
      }
   }
}

module.exports = new ProductRepository();
