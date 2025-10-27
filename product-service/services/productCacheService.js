const redis = require("../config/redis");
const productRepository = require("../repositories/productRepository");

const DEFAULT_EXPIRATION = 60 * 5;

class ProductCacheService {
   /**
    * Get product by ID using cache-aside strategy
    * @param {string} productId - Product ID
    * @returns {Promise<Object>} Product
    */
   async getProductById(productId) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const key = `Product:${productId}`;
      let cachedProduct;

      try {
         cachedProduct = await redis.get(key);
      } catch (err) {
         console.error(`Redis 'get' error for key ${key}:`, err.message);
      }

      if (cachedProduct) {
         console.log(`📦 Cache hit for ${key}`);
         try {
            return JSON.parse(cachedProduct);
         } catch (parseError) {
            console.error(
               `Failed to parse cached data for ${key}:`,
               parseError.message
            );
         }
      }

      console.log(`💾 Cache miss for ${key} → read from DB`);
      const product = await productRepository.findById(productId);

      if (!product) {
         throw new Error("Product not found");
      }

      try {
         await redis.set(
            key,
            JSON.stringify(product),
            "EX",
            DEFAULT_EXPIRATION
         );
      } catch (err) {
         console.error(`Redis 'set' error for key ${key}:`, err.message);
      }

      return product;
   }
}

module.exports = new ProductCacheService();
