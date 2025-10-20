const Cart = require("../models/cart");

class CartRepository {
   /**
    * Find cart by user ID
    * @param {string} userId - User ID
    * @returns {Promise<Object|null>} Cart or null
    */
   async findByUserId(userId) {
      try {
         return await Cart.findOne({ userId });
      } catch (err) {
         throw new Error(
            `Failed to get cart for user ${userId}: ${err.message}`
         );
      }
   }

   /**
    * Create a new cart
    * @param {string} userId - User ID
    * @param {Array} items - Cart items
    * @returns {Promise<Object>} Created cart
    */
   async create(userId, items = []) {
      try {
         const cart = new Cart({ userId, items });
         return await cart.save();
      } catch (err) {
         throw new Error(
            `Failed to create cart for user ${userId}: ${err.message}`
         );
      }
   }

   /**
    * Update cart
    * @param {string} userId - User ID
    * @param {Object} cartData - Cart data to update
    * @returns {Promise<Object|null>} Updated cart
    */
   async update(userId, cartData) {
      try {
         return await Cart.findOneAndUpdate({ userId }, cartData, {
            new: true,
         });
      } catch (err) {
         throw new Error(
            `Failed to update cart for user ${userId}: ${err.message}`
         );
      }
   }

   /**
    * Save cart
    * @param {Object} cart - Cart object
    * @returns {Promise<Object>} Saved cart
    */
   async save(cart) {
      try {
         return await cart.save();
      } catch (err) {
         throw new Error(`Failed to save cart: ${err.message}`);
      }
   }

   /**
    * Delete cart by user ID
    * @param {string} userId - User ID
    * @returns {Promise<Object|null>} Deleted cart
    */
   async delete(userId) {
      try {
         return await Cart.findOneAndDelete({ userId });
      } catch (err) {
         throw new Error(
            `Failed to delete cart for user ${userId}: ${err.message}`
         );
      }
   }

   /**
    * Clear all items from cart
    * @param {string} userId - User ID
    * @returns {Promise<Object|null>} Updated cart with empty items
    */
   async clearItems(userId) {
      try {
         return await Cart.findOneAndUpdate(
            { userId },
            { items: [] },
            { new: true }
         );
      } catch (err) {
         throw new Error(
            `Failed to clear cart for user ${userId}: ${err.message}`
         );
      }
   }

   /**
    * Get or create cart for user
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Cart object
    */
   async getOrCreate(userId) {
      try {
         let cart = await this.findByUserId(userId);
         if (!cart) {
            cart = await this.create(userId, []);
         }
         return cart;
      } catch (err) {
         throw new Error(
            `Failed to get or create cart for user ${userId}: ${err.message}`
         );
      }
   }
}

module.exports = new CartRepository();
