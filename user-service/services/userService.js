const userRepository = require("../repositories/userRepository");
const argon2 = require("argon2");

class UserService {
   /**
    * Register a new user
    * @param {string} name - User name
    * @param {string} email - User email
    * @param {string} password - User password
    * @returns {Promise<Object>} User and token
    */
   async register(name, email, password) {
      // Validation
      if (!name || !email || !password) {
         throw new Error("Name, email, and password are required");
      }

      if (!this.isValidEmail(email)) {
         throw new Error("Invalid email format");
      }

      if (password.length < 6) {
         throw new Error("Password must be at least 6 characters long");
      }

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
         throw new Error("User already exists");
      }

      // Create user (password will be hashed by model pre-save hook)
      const user = await userRepository.create({ name, email, password });

      return {
         id: user._id,
         name: user.name,
         email: user.email,
      };
   }

   /**
    * Login user
    * @param {string} email - User email
    * @param {string} password - User password
    * @returns {Promise<Object>} User and token
    */
   async login(email, password) {
      // Validation
      if (!email || !password) {
         throw new Error("Email and password are required");
      }

      // Find user by email
      const user = await userRepository.findByEmail(email);
      if (!user) {
         throw new Error("Invalid credentials");
      }

      // Verify password
      const isMatch = await argon2.verify(user.password, password);
      if (!isMatch) {
         throw new Error("Invalid credentials");
      }

      return {
         id: user._id,
         name: user.name,
         email: user.email,
      };
   }

   /**
    * Get user by ID
    * @param {string} userId - User ID
    * @returns {Promise<Object>} User
    */
   async getUserById(userId) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      const user = await userRepository.findById(userId);
      if (!user) {
         throw new Error("User not found");
      }

      return {
         id: user._id,
         name: user.name,
         email: user.email,
      };
   }

   /**
    * Get all users
    * @returns {Promise<Array>} List of users
    */
   async getAllUsers() {
      const users = await userRepository.findAll();
      return users.map((user) => ({
         id: user._id,
         name: user.name,
         email: user.email,
      }));
   }

   /**
    * Update user profile
    * @param {string} userId - User ID
    * @param {Object} updateData - Data to update (name, email)
    * @returns {Promise<Object>} Updated user
    */
   async updateProfile(userId, updateData) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      const user = await userRepository.findById(userId);
      if (!user) {
         throw new Error("User not found");
      }

      // Validate email if being updated
      if (updateData.email && updateData.email !== user.email) {
         if (!this.isValidEmail(updateData.email)) {
            throw new Error("Invalid email format");
         }

         const emailExists = await userRepository.emailExists(updateData.email);
         if (emailExists) {
            throw new Error("Email already in use");
         }
      }

      // Don't allow password updates through this method
      const { password, ...safeUpdateData } = updateData;

      const updatedUser = await userRepository.update(userId, safeUpdateData);

      return {
         id: updatedUser._id,
         name: updatedUser.name,
         email: updatedUser.email,
      };
   }

   /**
    * Change user password
    * @param {string} userId - User ID
    * @param {string} currentPassword - Current password
    * @param {string} newPassword - New password
    * @returns {Promise<Object>} Success message
    */
   async changePassword(userId, currentPassword, newPassword) {
      if (!userId) {
         throw new Error("User ID is required");
      }
      if (!currentPassword || !newPassword) {
         throw new Error("Current password and new password are required");
      }

      if (newPassword.length < 6) {
         throw new Error("New password must be at least 6 characters long");
      }

      // Get user with password
      const user = await userRepository.findById(userId);
      if (!user) {
         throw new Error("User not found");
      }

      // Verify current password
      const isMatch = await argon2.verify(user.password, currentPassword);
      if (!isMatch) {
         throw new Error("Current password is incorrect");
      }

      // Update password (will be hashed by model)
      await userRepository.updatePassword(userId, newPassword);

      return { message: "Password changed successfully" };
   }

   /**
    * Delete user
    * @param {string} userId - User ID
    * @returns {Promise<Object>} Success message
    */
   async deleteUser(userId) {
      if (!userId) {
         throw new Error("User ID is required");
      }

      const user = await userRepository.delete(userId);
      if (!user) {
         throw new Error("User not found");
      }

      return { message: "User deleted successfully" };
   }

   /**
    * Validate email format
    * @param {string} email - Email to validate
    * @returns {boolean} True if valid
    */
   isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
   }

   /**
    * Get user by email
    * @param {string} email - User email
    * @returns {Promise<Object>} User
    */
   async getUserByEmail(email) {
      if (!email) {
         throw new Error("Email is required");
      }

      const user = await userRepository.findByEmail(email);
      if (!user) {
         throw new Error("User not found");
      }

      return {
         id: user._id,
         name: user.name,
         email: user.email,
      };
   }
}

module.exports = new UserService();
