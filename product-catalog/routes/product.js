const express = require("express");
const productService = require("../services/productService");
const productCacheService = require("../services/productCacheService");

const router = express.Router();

// Create Product
router.post("/", async (req, res) => {
   try {
      const requiredFields = [
         "name",
         "description",
         "category",
         "price",
         "stock",
      ];
      for (const field of requiredFields) {
         if (!req.body[field]) {
            throw new Error(`${field} is required`);
         }
      }
      const newProduct = await productService.createProduct(req.body);
      return res.status(201).json(newProduct);
   } catch (err) {
      if (err.message.includes("required") || err.message.includes("must be")) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Get All Products with pagination
router.get("/", async (req, res) => {
   try {
      const filters = {};
      if (req.query.category) {
         filters.category = req.query.category;
      }
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
      const result = await productService.getAllProducts(filters, {
         page,
         limit,
      });
      return res.json(result);
   } catch (err) {
      res.status(500).json({ msg: err.message });
   }
});

// Get Product by ID
router.get("/:id", async (req, res) => {
   try {
      const productId = req.params.id;
      if (!productId) {
         throw new Error("Product ID is required");
      }

      const product = await productCacheService.getProductById(productId);
      return res.json(product);
   } catch (err) {
      if (err.message === "Product not found") {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Bulk get products by IDs
router.get("/bulk/get", async (req, res) => {
   const idsParam = req.query.ids;
   const productIds = idsParam ? idsParam.split(",") : [];

   try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
         return res
            .status(400)
            .json({ msg: "Query param 'ids' must be a non-empty list" });
      }

      const products = await productService.getProductsByIds(productIds);
      return res.json(products);
   } catch (err) {
      res.status(500).json({ msg: err.message });
   }
});

// Update Product
router.put("/:id", async (req, res) => {
   try {
      const updatedProduct = await productService.updateProduct(
         req.params.id,
         req.body
      );
      return res.json(updatedProduct);
   } catch (err) {
      if (err.message === "Product not found") {
         return res.status(404).json({ msg: err.message });
      }
      if (
         err.message.includes("must be") ||
         err.message.includes("cannot be")
      ) {
         return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

// Delete Product
router.delete("/:id", async (req, res) => {
   try {
      await productService.deleteProduct(req.params.id);
      return res.json({ msg: "Product deleted" });
   } catch (err) {
      if (err.message === "Product not found") {
         return res.status(404).json({ msg: err.message });
      }
      res.status(500).json({ msg: err.message });
   }
});

module.exports = router;
