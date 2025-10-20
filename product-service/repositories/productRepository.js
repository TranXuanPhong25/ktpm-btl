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
         return await Product.findByIdAndUpdate(id, updateData, { new: true });
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
    * Deduct stock from product
    * @param {string} id - Product ID
    * @param {number} quantity - Quantity to deduct
    * @returns {Promise<Object|null>} Updated product or null
    */
   async deductStock(id, quantity) {
      try {
         const product = await this.findById(id);
         if (!product) {
            return null;
         }
         if (product.stock < quantity) {
            throw new Error("Insufficient stock");
         }
         return await Product.findByIdAndUpdate(
            id,
            { $inc: { stock: -quantity } },
            { new: true }
         );
      } catch (err) {
         throw new Error(
            `Failed to deduct stock of product ${id}: ${err.message}`
         );
      }
   }

   /**
    * Deduct stock from multiple products
    * @param {Array<{ id: string, quantity: number }>} updates - List of productId and quantity to deduct
    * @returns {Promise<Array<Object>>} List of updated products
    */
   async bulkDeductStock(updates) {
      if (!Array.isArray(updates) || updates.length === 0) {
         throw new Error("updates must be a non-empty array");
      }

      // Start a MongoDB session for transaction
      const session = await Product.startSession();
      session.startTransaction();

      try {
         // Prepare bulk operations: only decrement stock if current stock >= requested quantity
         const operations = updates.map(({ id, quantity }) => ({
            updateOne: {
               filter: { _id: id, stock: { $gte: quantity } },
               update: { $inc: { stock: -quantity } },
            },
         }));

         // Execute bulk operations within the transaction
         const result = await Product.bulkWrite(operations, { session });

         // If any update failed (insufficient stock or product not found), throw to rollback
         if (result.modifiedCount !== updates.length) {
            throw new Error(
               "Some products have insufficient stock or not found"
            );
         }

         // Commit the transaction
         await session.commitTransaction();
         session.endSession();

         // Return updated products
         const ids = updates.map((u) => u.id);
         return await Product.find({ _id: { $in: ids } });
      } catch (err) {
         // Abort transaction on error
         await session.abortTransaction();
         session.endSession();
         throw new Error(`Failed to deduct stock in bulk: ${err.message}`);
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

   /**
    * Check if product has sufficient stock
    * @param {string} id - Product ID
    * @param {number} quantity - Required quantity
    * @returns {Promise<boolean>} True if sufficient stock
    */
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
