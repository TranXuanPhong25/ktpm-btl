const cartRepository = require("../repositories/cartRepository");
const axios = require("axios");

const PRODUCT_SERVICE_URI =
   process.env.PRODUCT_SERVICE_URI || "http://localhost:5001";

class CartService {
   /**
    * Get cart for user (creates if doesn't exist)
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Cart object
    */
   async getCart(userId) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      return await cartRepository.getOrCreate(userId);
   }

   /**
    * Add item to cart
    * @param {string} userId - User ID
    * @param {string} productId - Product ID
    * @param {number} quantity - Quantity to add
    * @returns {Promise<Object>} Updated cart
    */
   async addItem(userId, productId, quantity) {
      if (!userId) {
         throw new Error("User ID is required");
      }
      if (!productId) {
         throw new Error("Product ID is required");
      }
      if (!quantity || quantity <= 0) {
         throw new Error("Quantity must be greater than 0");
      }

      // Verify product exists
      try {
         const productResponse = await axios.get(
            `${PRODUCT_SERVICE_URI}/api/product-catalog/${productId}`
         );
         if (!productResponse.data) {
            throw new Error("Product not found");
         }
      } catch (err) {
         if (err.response && err.response.status === 404) {
            throw new Error("Product not found");
         }
         throw new Error(`Failed to verify product: ${err.message}`);
      }

      // Get or create cart
      let cart = await cartRepository.getOrCreate(userId);

      // Check if item already exists in cart
      const itemIndex = cart.items.findIndex(
         (item) => item.productId === productId
      );

      if (itemIndex > -1) {
         // Update quantity
         cart.items[itemIndex].quantity += quantity;
      } else {
         // Add new item
         cart.items.push({ productId, quantity });
      }

      return await cartRepository.save(cart);
   }

   /**
    * Update item quantity in cart
    * @param {string} userId - User ID
    * @param {string} productId - Product ID
    * @param {number} quantity - New quantity
    * @returns {Promise<Object>} Updated cart
    */
   async updateItemQuantity(userId, productId, quantity) {
      if (!userId) {
         throw new Error("User ID is required");
      }
      if (!productId) {
         throw new Error("Product ID is required");
      }
      if (quantity === undefined || quantity < 0) {
         throw new Error("Quantity must be 0 or greater");
      }

      const cart = await cartRepository.findByUserId(userId);
      if (!cart) {
         throw new Error("Cart not found");
      }

      const itemIndex = cart.items.findIndex(
         (item) => item.productId === productId
      );

      if (itemIndex === -1) {
         throw new Error("Product not found in cart");
      }

      if (quantity === 0) {
         // Remove item if quantity is 0
         cart.items.splice(itemIndex, 1);
      } else {
         cart.items[itemIndex].quantity = quantity;
      }

      return await cartRepository.save(cart);
   }

   /**
    * Remove item from cart
    * @param {string} userId - User ID
    * @param {string} productId - Product ID
    * @returns {Promise<Object>} Updated cart
    */
   async removeItem(userId, productId) {
      if (!userId) {
         throw new Error("User ID is required");
      }
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const cart = await cartRepository.findByUserId(userId);
      if (!cart) {
         throw new Error("Cart not found");
      }

      cart.items = cart.items.filter((item) => item.productId !== productId);

      return await cartRepository.save(cart);
   }

   /**
    * Remove multiple items from cart
    * @param {string} userId - User ID
    * @param {Array<string>} productIds - Array of product IDs
    * @returns {Promise<Object>} Updated cart
    */
   async removeItems(userId, productIds) {
      if (!userId) {
         throw new Error("User ID is required");
      }
      if (!Array.isArray(productIds) || productIds.length === 0) {
         throw new Error("Product IDs must be a non-empty array");
      }

      const cart = await cartRepository.findByUserId(userId);
      if (!cart) {
         throw new Error("Cart not found");
      }

      cart.items = cart.items.filter(
         (item) => !productIds.includes(item.productId)
      );

      return await cartRepository.save(cart);
   }

   /**
    * Clear all items from cart
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Empty cart
    */
   async clearCart(userId) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      const cart = await cartRepository.findByUserId(userId);
      if (!cart) {
         throw new Error("Cart not found");
      }

      return await cartRepository.clearItems(userId);
   }

   /**
    * Get cart total (number of items)
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Cart summary
    */
   async getCartSummary(userId) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      const cart = await cartRepository.getOrCreate(userId);

      const totalItems = cart.items.reduce(
         (sum, item) => sum + item.quantity,
         0
      );
      const uniqueProducts = cart.items.length;

      return {
         userId: cart.userId,
         totalItems,
         uniqueProducts,
         items: cart.items,
      };
   }

   /**
    * Validate cart items against product service
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Validation result
    */
   async validateCart(userId) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      const cart = await cartRepository.getOrCreate(userId);

      if (cart.items.length === 0) {
         return {
            valid: true,
            invalidItems: [],
            message: "Cart is empty",
         };
      }

      const invalidItems = [];

      for (const item of cart.items) {
         try {
            const productResponse = await axios.get(
               `${PRODUCT_SERVICE_URI}/api/products/${item.productId}`
            );
            const product = productResponse.data;

            if (!product || product.stock < item.quantity) {
               invalidItems.push({
                  productId: item.productId,
                  requestedQuantity: item.quantity,
                  availableStock: product ? product.stock : 0,
                  reason: !product ? "Product not found" : "Insufficient stock",
               });
            }
         } catch (err) {
            invalidItems.push({
               productId: item.productId,
               reason: "Failed to verify product",
            });
         }
      }

      return {
         valid: invalidItems.length === 0,
         invalidItems,
         message:
            invalidItems.length === 0
               ? "All items are valid"
               : `${invalidItems.length} item(s) have issues`,
      };
   }
}

module.exports = new CartService();
