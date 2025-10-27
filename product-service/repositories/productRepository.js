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

      try {
         // Aggregate quantities for duplicate product IDs
         const aggregatedUpdates = updates.reduce((acc, { id, quantity }) => {
            if (!acc[id]) {
               acc[id] = 0;
            }
            acc[id] += Number(quantity);
            return acc;
         }, {});

         // Convert aggregated map to array of unique products
         const uniqueUpdates = Object.entries(aggregatedUpdates).map(
            ([id, quantity]) => ({
               id,
               quantity,
            })
         );

         // Get unique product IDs
         const ids = uniqueUpdates.map((update) => update.id);
         const products = await Product.find({ _id: { $in: ids } });

         // Create a map for easy lookup
         const productMap = products.reduce((map, product) => {
            map[product._id.toString()] = product;
            return map;
         }, {});

         // Check if all products exist and have sufficient stock
         for (const { id, quantity } of uniqueUpdates) {
            const product = productMap[id];
            if (!product) {
               throw new Error(`Product with ID ${id} not found`);
            }
            if (product.stock < quantity) {
               throw new Error(
                  `Insufficient stock for product ${product.name} (ID: ${id}). Available: ${product.stock}, Requested: ${quantity}`
               );
            }
         }

         // Prepare bulk operations with aggregated quantities
         const operations = uniqueUpdates.map(({ id, quantity }) => ({
            updateOne: {
               filter: { _id: id },
               update: { $inc: { stock: -quantity } },
            },
         }));

         // Execute bulk operations
         await Product.bulkWrite(operations);

         // Return updated products
         return await Product.find({ _id: { $in: ids } });
      } catch (err) {
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
