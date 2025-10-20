const express = require("express");
const cartService = require("../services/cartService");

const router = express.Router();

// Add Item to Cart
router.post("/:userId/items", async (req, res) => {
   const { userId } = req.params;
   const { productId, quantity } = req.body;

   try {
      const cart = await cartService.addItem(userId, productId, quantity);
      res.status(201).json(cart);
   } catch (err) {
      if (err.message === "Product not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (err.message.includes("required") || err.message.includes("must be")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get User Cart
router.get("/:userId", async (req, res) => {
   const { userId } = req.params;
   try {
      const cart = await cartService.getCart(userId);
      res.json(cart);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Remove Item from Cart
router.delete("/:userId/items/:productId", async (req, res) => {
   const { userId, productId } = req.params;
   try {
      const cart = await cartService.removeItem(userId, productId);
      res.json(cart);
   } catch (err) {
      if (err.message === "Cart not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Update Item Quantity
router.put("/:userId/items/:productId", async (req, res) => {
   const { userId, productId } = req.params;
   const { quantity } = req.body;

   try {
      const cart = await cartService.updateItemQuantity(
         userId,
         productId,
         quantity
      );
      res.json(cart);
   } catch (err) {
      if (
         err.message === "Cart not found" ||
         err.message === "Product not found in cart"
      ) {
         return res.status(404).json({ msg: err.message });
      }
      if (err.message.includes("required") || err.message.includes("must be")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Clear cart for user
router.delete("/:userId", async (req, res) => {
   const { userId } = req.params;
   try {
      const cart = await cartService.clearCart(userId);
      res.json(cart);
   } catch (err) {
      if (err.message === "Cart not found") {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Delete one or multiple items from cart
router.delete("/:userId/items", async (req, res) => {
   const { userId } = req.params;
   const { productIds } = req.query;

   try {
      if (!productIds) {
         return res
            .status(400)
            .json({ msg: "productIds query parameter is required" });
      }

      let productIdArray;
      if (Array.isArray(productIds)) {
         productIdArray = productIds;
      } else {
         try {
            productIdArray = JSON.parse(productIds);
         } catch {
            productIdArray = productIds.split(",").map((id) => id.trim());
         }
      }

      const cart = await cartService.removeItems(userId, productIdArray);
      res.json(cart);
   } catch (err) {
      if (err.message === "Cart not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (err.message.includes("required") || err.message.includes("must be")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get cart summary
router.get("/:userId/summary", async (req, res) => {
   const { userId } = req.params;
   try {
      const summary = await cartService.getCartSummary(userId);
      res.json(summary);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Validate cart items
router.get("/:userId/validate", async (req, res) => {
   const { userId } = req.params;
   try {
      const validation = await cartService.validateCart(userId);
      res.json(validation);
   } catch (err) {
      if (err.message.includes("required")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

module.exports = router;
