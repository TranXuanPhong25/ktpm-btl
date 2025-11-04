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

// Verify token - support both GET (for nginx auth_request) and POST
router.get("/verify-token", async (req, res) => {
   try {
      let token;

      // Check Authorization header
      if (req.headers.authorization) {
         const authHeader = req.headers.authorization;
         if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
         }
      }

      if (!token) {
         return res.status(401).json({ error: "Token is required" });
      }

      const decoded = authService.verifyToken(token);
      res.status(200).json({ valid: true, userId: decoded.userId });
   } catch (error) {
      res.status(401).json({ valid: false, error: error.message });
   }
});

// Verify token - POST version
router.post("/verify-token", async (req, res) => {
   try {
      // Support both body.token and Authorization header
      let token = req.body.token;

      // If no token in body, check Authorization header
      if (!token && req.headers.authorization) {
         const authHeader = req.headers.authorization;
         if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
         }
      }

      if (!token) {
         return res.status(401).json({ error: "Token is required" });
      }

      const decoded = authService.verifyToken(token);
      res.status(200).json({ valid: true, userId: decoded.userId });
   } catch (error) {
      res.status(401).json({ valid: false, error: error.message });
   }
});

module.exports = router;
