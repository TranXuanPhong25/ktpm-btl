const express = require("express");
const Product = require("../models/product");

const router = express.Router();

// Create Product
router.post("/", async (req, res) => {
  const { name, description, price, category, stock } = req.body;
  try {
    const newProduct = new Product({
      name,
      description,
      price,
      category,
      stock,
    });
    await newProduct.save();
    return res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).send(`Failed to create product: ${err.message}`);
  }
});

// Get All Products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    return res.json(products);
  } catch (err) {
    res.status(500).send(`Failed to get all products: ${err.message}`);
  }
});

// Get Product by ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: "Product not found" });
    return res.json(product);
  } catch (err) {
    res
      .status(500)
      .send(`Failed to get product ${req.params.id}: ${err.message}`);
  }
});

// Update Product
router.put("/:id", async (req, res) => {
  const { name, description, price, category, stock } = req.body;
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        category,
        stock,
      },
      { new: true }
    );

    if (!updatedProduct)
      return res.status(404).json({ msg: "Product not found" });
    return res.json(updatedProduct);
  } catch (err) {
    res
      .status(500)
      .send(`Failed to update product ${req.params.id}: ${err.message}`);
  }
});

// Delete Product
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ msg: "Product not found" });
    return res.json({ msg: "Product deleted" });
  } catch (err) {
    res
      .status(500)
      .send(`Failed to delete product ${req.params.id}: ${err.message}`);
  }
});

// Deduct stock of product
router.put("/:id/deduction", async (req, res) => {
  const { quantity } = req.body;
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: "Product not found" });
    if (product.stock < quantity)
      return res.status(400).json({ msg: "Insufficient stock" });
    // t....
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { stock: -quantity } },
      { new: true }
    );

    return res.json(updatedProduct);
  } catch (err) {
    res
      .status(500)
      .send(
        `Failed to deduct stock of product ${req.params.id}: ${err.message}`
      );
  }
});

module.exports = router;
