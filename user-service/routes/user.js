const express = require("express");
const userService = require("../services/userService");

const router = express.Router();

// Register a new user
router.post("/register", async (req, res) => {
   try {
      const { name, email, password } = req.body;
      const result = await userService.register(name, email, password);
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
      const result = await userService.login(email, password);
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

// Get user by ID
router.get("/:userId", async (req, res) => {
   try {
      const user = await userService.getUserById(req.params.userId);
      res.json(user);
   } catch (error) {
      if (error.message === "User not found") {
         return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
   }
});

// Get all users
router.get("/", async (req, res) => {
   try {
      const users = await userService.getAllUsers();
      res.json(users);
   } catch (error) {
      res.status(500).json({ error: error.message });
   }
});

// Update user profile
router.put("/:userId", async (req, res) => {
   try {
      const user = await userService.updateProfile(req.params.userId, req.body);
      res.json(user);
   } catch (error) {
      if (error.message === "User not found") {
         return res.status(404).json({ error: error.message });
      }
      if (
         error.message.includes("Invalid") ||
         error.message.includes("already in use")
      ) {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
   }
});

// Change password
router.post("/:userId/change-password", async (req, res) => {
   try {
      const { currentPassword, newPassword } = req.body;
      const result = await userService.changePassword(
         req.params.userId,
         currentPassword,
         newPassword
      );
      res.json(result);
   } catch (error) {
      if (error.message === "User not found") {
         return res.status(404).json({ error: error.message });
      }
      if (
         error.message.includes("required") ||
         error.message.includes("incorrect") ||
         error.message.includes("must be")
      ) {
         return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
   }
});

// Delete user
router.delete("/:userId", async (req, res) => {
   try {
      const result = await userService.deleteUser(req.params.userId);
      res.json(result);
   } catch (error) {
      if (error.message === "User not found") {
         return res.status(404).json({ error: error.message });
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
      const decoded = userService.verifyToken(token);
      res.json({ valid: true, userId: decoded.userId });
   } catch (error) {
      res.status(401).json({ valid: false, error: error.message });
   }
});

module.exports = router;
