const Product = require("../models/product");

class ProductRepository {
   async create(productData, session = null) {
      try {
         const newProduct = new Product(productData);
         if (session) {
            return await newProduct.save({ session });
         }
         return await newProduct.save();
      } catch (err) {
         throw new Error(`Failed to create product: ${err.message}`);
      }
   }

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

   async findById(id) {
      try {
         return await Product.findById(id);
      } catch (err) {
         throw new Error(`Failed to get product ${id}: ${err.message}`);
      }
   }

   async findManyByIds(productIds) {
      try {
         return await Product.find({ _id: { $in: productIds } });
      } catch (err) {
         throw new Error(`Failed to get products: ${err.message}`);
      }
   }

   async update(id, updateData) {
      try {
         const { name, description, category, price } = updateData;
         const validData = { name, description, category, price };
         return await Product.findByIdAndUpdate(id, validData, { new: true });
      } catch (err) {
         throw new Error(`Failed to update product ${id}: ${err.message}`);
      }
   }

   async delete(id, session = null) {
      try {
         if (session) {
            return await Product.findByIdAndDelete(id).session(session);
         }
         return await Product.findByIdAndDelete(id);
      } catch (err) {
         throw new Error(`Failed to delete product ${id}: ${err.message}`);
      }
   }

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
