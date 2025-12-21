const mongoose = require("mongoose");
const Product = require("./models/product");

const products = [
   {
      _id: "6942b9f72c9e681849ce5f47",
      name: "Gaming Laptop Pro",
      description: "High-performance gaming laptop with RTX 4080",
      category: "Electronics",
   },
   {
      _id: "6942b9f72c9e681849ce5f48",
      name: "Wireless Mouse Ultra",
      description: "Ergonomic wireless mouse with precision tracking",
      category: "Accessories",
   },
   {
      _id: "6942b9f72c9e681849ce5f49",
      name: "Mechanical Keyboard RGB",
      description: "Premium mechanical keyboard with RGB lighting",
      category: "Accessories",
   },
   {
      _id: "6942b9f72c9e681849ce5f4a",
      name: "4K Monitor 27 inch",
      description: "Ultra HD 4K monitor with HDR support",
      category: "Electronics",
   },
   {
      _id: "6942b9f72c9e681849ce5f4b",
      name: "USB-C Hub Pro",
      description: "Multi-port USB-C hub with HDMI and Ethernet",
      category: "Accessories",
   },
];

const mongoURI =
   process.env.MONGO_URI || "mongodb://localhost:27018/ecommerce-products";

async function seedProducts() {
   try {
      await mongoose.connect(mongoURI);
      console.log("Connected to MongoDB");

      // Clear existing products with these IDs
      await Product.deleteMany({
         _id: { $in: products.map((p) => p._id) },
      });
      console.log("Cleared existing products");

      // Insert new products
      await Product.insertMany(products);
      console.log("Products seeded successfully:");
      products.forEach((p) => {
         console.log(`  - ${p._id}: ${p.name}`);
      });

      await mongoose.disconnect();
      console.log("Disconnected from MongoDB");
      process.exit(0);
   } catch (error) {
      console.error("Error seeding products:", error);
      process.exit(1);
   }
}

seedProducts();
