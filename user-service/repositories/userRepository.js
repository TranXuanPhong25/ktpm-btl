const User = require("../models/user");

class UserRepository {
   /**
    * Create a new user
    * @param {Object} userData - User data (name, email, password)
    * @returns {Promise<Object>} Created user
    */
   async create(userData) {
      try {
         const user = new User(userData);
         return await user.save();
      } catch (err) {
         throw new Error(`Failed to create user: ${err.message}`);
      }
   }

   /**
    * Find user by email
    * @param {string} email - User email
    * @returns {Promise<Object|null>} User or null
    */
   async findByEmail(email) {
      try {
         return await User.findOne({ email });
      } catch (err) {
         throw new Error(`Failed to find user by email: ${err.message}`);
      }
   }

   /**
    * Find user by ID
    * @param {string} userId - User ID
    * @returns {Promise<Object|null>} User or null
    */
   async findById(userId) {
      try {
         return await User.findById(userId);
      } catch (err) {
         throw new Error(`Failed to find user by ID: ${err.message}`);
      }
   }

   /**
    * Find all users with pagination
    * @param {Object} options - Pagination options
    * @param {number} options.page - Page number (1-based)
    * @param {number} options.limit - Items per page
    * @returns {Promise<Object>} Paginated result with data and metadata
    */
   async findAll({ page = 1, limit = 20 } = {}) {
      try {
         const skip = (page - 1) * limit;
         const [users, total] = await Promise.all([
            User.find()
               .select("-password")
               .skip(skip)
               .limit(limit)
               .sort({ createdAt: -1 }),
            User.countDocuments(),
         ]);
         return {
            data: users,
            pagination: {
               page,
               limit,
               total,
               totalPages: Math.ceil(total / limit),
            },
         };
      } catch (err) {
         throw new Error(`Failed to get all users: ${err.message}`);
      }
   }

   /**
    * Update user
    * @param {string} userId - User ID
    * @param {Object} updateData - Data to update
    * @returns {Promise<Object|null>} Updated user
    */
   async update(userId, updateData) {
      try {
         return await User.findByIdAndUpdate(userId, updateData, {
            new: true,
         }).select("-password");
      } catch (err) {
         throw new Error(`Failed to update user: ${err.message}`);
      }
   }

   /**
    * Delete user
    * @param {string} userId - User ID
    * @returns {Promise<Object|null>} Deleted user
    */
   async delete(userId) {
      try {
         return await User.findByIdAndDelete(userId);
      } catch (err) {
         throw new Error(`Failed to delete user: ${err.message}`);
      }
   }

   /**
    * Check if email exists
    * @param {string} email - User email
    * @returns {Promise<boolean>} True if exists
    */
   async emailExists(email) {
      try {
         const user = await User.findOne({ email });
         return !!user;
      } catch (err) {
         throw new Error(`Failed to check email existence: ${err.message}`);
      }
   }

   /**
    * Update user password
    * @param {string} userId - User ID
    * @param {string} newPassword - New password (will be hashed by model)
    * @returns {Promise<Object|null>} Updated user
    */
   async updatePassword(userId, newPassword) {
      try {
         const user = await User.findById(userId);
         if (!user) {
            return null;
         }
         user.password = newPassword;
         await user.save(); // Triggers pre-save hook to hash password
         return user;
      } catch (err) {
         throw new Error(`Failed to update password: ${err.message}`);
      }
   }
}

module.exports = new UserRepository();
