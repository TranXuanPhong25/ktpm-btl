const redis = require("../config/redis");
const productRepository = require("../repositories/productRepository");

const DEFAULT_EXPIRATION = 60 * 5; // 5 minutes
const CACHE_TIMEOUT = 500; // 500ms max for cache operations

class ProductCacheService {
   /**
    * Get product by ID using cache-aside strategy with timeout protection
    * @param {string} productId - Product ID
    * @returns {Promise<Object>} Product
    */
   async getProductById(productId) {
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const key = `product:${productId}`;

      // Try to get from cache with timeout
      const cachedProduct = await this._getFromCache(key);

      if (cachedProduct) {
         return cachedProduct;
      }

      const product = await productRepository.findById(productId);

      if (!product) {
         throw new Error("Product not found");
      }

      // Set cache in background (fire-and-forget)
      this._setCache(key, product).catch((err) => {
         console.error(`Background cache set failed for ${key}:`, err.message);
      });

      return product;
   }

   /**
    * Get from cache with timeout protection
    * @private
    */
   async _getFromCache(key) {
      try {
         const result = await Promise.race([
            redis.get(key),
            new Promise((_, reject) =>
               setTimeout(
                  () => reject(new Error("Cache timeout")),
                  CACHE_TIMEOUT
               )
            ),
         ]);

         if (result) {
            try {
               return JSON.parse(result);
            } catch (parseError) {
               console.error(`Failed to parse cached data for ${key}`);
               // Delete corrupted cache
               redis.del(key).catch(() => {});
               return null;
            }
         }
         return null;
      } catch (err) {
         if (err.message === "Cache timeout") {
            console.warn(`⏱️ Cache GET timeout for ${key}`);
         } else {
            console.error(`Redis GET error for ${key}:`, err.message);
         }
         return null; // Fail gracefully, read from DB
      }
   }

   /**
    * Set cache with timeout protection (non-blocking)
    * @private
    */
   async _setCache(key, value) {
      try {
         await Promise.race([
            redis.setex(key, DEFAULT_EXPIRATION, JSON.stringify(value)),
            new Promise((_, reject) =>
               setTimeout(
                  () => reject(new Error("Cache timeout")),
                  CACHE_TIMEOUT
               )
            ),
         ]);
      } catch (err) {
         if (err.message === "Cache timeout") {
            console.warn(`⏱️ Cache SET timeout for ${key}`);
         } else {
            console.error(`Redis SET error for ${key}:`, err.message);
         }
         // Don't throw - cache failures shouldn't break the application
      }
   }

   /**
    * Invalidate product cache
    * @param {string} productId - Product ID
    */
   async invalidateProduct(productId) {
      const key = `product:${productId}`;
      try {
         await Promise.race([
            redis.del(key),
            new Promise((_, reject) =>
               setTimeout(
                  () => reject(new Error("Cache timeout")),
                  CACHE_TIMEOUT
               )
            ),
         ]);
      } catch (err) {
         console.error(`Failed to invalidate cache for ${key}:`, err.message);
      }
   }

   /**
    * Get multiple products with cache support
    * @param {Array<string>} productIds - Array of product IDs
    * @returns {Promise<Array<Object>>} Products
    */
   async getProductsByIds(productIds) {
      if (!Array.isArray(productIds) || productIds.length === 0) {
         return [];
      }

      // Try to get all from cache first
      const keys = productIds.map((id) => `product:${id}`);
      let cachedProducts = [];

      try {
         const cached = await Promise.race([
            redis.mget(keys),
            new Promise((_, reject) =>
               setTimeout(
                  () => reject(new Error("Cache timeout")),
                  CACHE_TIMEOUT
               )
            ),
         ]);

         cachedProducts = cached.map((item, index) => {
            if (item) {
               try {
                  return {
                     id: productIds[index],
                     data: JSON.parse(item),
                     cached: true,
                  };
               } catch (e) {
                  return { id: productIds[index], data: null, cached: false };
               }
            }
            return { id: productIds[index], data: null, cached: false };
         });
      } catch (err) {
         console.warn("Cache MGET failed, falling back to DB:", err.message);
         cachedProducts = productIds.map((id) => ({
            id,
            data: null,
            cached: false,
         }));
      }

      // Get missing products from DB
      const missingIds = cachedProducts
         .filter((item) => !item.cached)
         .map((item) => item.id);

      let dbProducts = [];
      if (missingIds.length > 0) {
         dbProducts = await productRepository.findByIds(missingIds);

         // Cache the fetched products in background
         dbProducts.forEach((product) => {
            const key = `product:${product._id}`;
            this._setCache(key, product).catch(() => {});
         });
      }

      // Merge cached and DB results
      const productMap = new Map(dbProducts.map((p) => [p._id.toString(), p]));

      return cachedProducts
         .map((item) => {
            if (item.cached && item.data) {
               return item.data;
            }
            return productMap.get(item.id);
         })
         .filter(Boolean);
   }

   /**
    * Check Redis connection health
    */
   async healthCheck() {
      try {
         const result = await Promise.race([
            redis.ping(),
            new Promise((_, reject) =>
               setTimeout(() => reject(new Error("Health check timeout")), 1000)
            ),
         ]);
         return result === "PONG";
      } catch (err) {
         console.error("Redis health check failed:", err.message);
         return false;
      }
   }
}

module.exports = new ProductCacheService();
