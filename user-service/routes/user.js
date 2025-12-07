const express = require("express");
const userService = require("../services/userService");

const router = express.Router();

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

// Get all users with pagination
router.get("/", async (req, res) => {
   try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
      const result = await userService.getAllUsers({ page, limit });
      res.json(result);
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

module.exports = router;
