const express = require("express");
const authService = require("../services/authService");

const router = express.Router();

// Register a new user
router.post("/register", async (req, res) => {
   try {
      const { name, email, password } = req.body;
      const result = await authService.register(name, email, password);
      res.status(201).json(result);
   } catch (error) {
      if (
         error.message === "User already exists" ||
         error.message.includes("Invalid") ||
         error.message.includes("required")
      ) {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
   }
});

// Login a user
router.post("/login", async (req, res) => {
   try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
   } catch (error) {
      if (
         error.message === "Invalid credentials" ||
         error.message.includes("required")
      ) {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
   }
});

// Verify token
router.post("/verify-token", async (req, res) => {
   try {
      const { token } = req.body;
      if (!token) {
         return res.status(400).json({ error: "Token is required" });
      }
      const decoded = authService.verifyToken(token);
      res.json({ valid: true, userId: decoded.userId });
   } catch (error) {
      res.status(401).json({ valid: false, error: error.message });
   }
});

module.exports = router;
