const jwt = require("jsonwebtoken");
const UserService = require("./userService");

class AuthService {
   /**
    * Register a new user
    * @param {string} name - User name
    * @param {string} email - User email
    * @param {string} password - User password
    * @returns {Promise<Object>} User and token
    */

   async register(name, email, password) {
      try {
         const user = await UserService.createUser({ name, email, password });
         const token = this.generateToken(user.id);
         return { user, token };
      } catch (err) {
         throw new Error(
            err.response?.data?.error || "User service unavailable"
         );
      }
   }

   /**
    * Login user
    * @param {string} email - User email
    * @param {string} password - User password
    * @returns {Promise<Object>} User and token
    */
   async login(email, password) {
      try {
         const { data: user } = await UserService.checkCredentials(
            email,
            password
         );
         const token = this.generateToken(user.id);
         return { user, token };
      } catch (err) {
         throw new Error(
            err.response?.data?.error || "User service unavailable"
         );
      }
   }

   /**
    * Verify JWT token
    * @param {string} token - JWT token
    * @returns {Promise<Object>} Decoded token
    */
   verifyToken(token) {
      try {
         const jwtSecret = process.env.JWT_SECRET || "default_secret";
         return jwt.verify(token, jwtSecret);
      } catch (err) {
         throw new Error("Invalid or expired token");
      }
   }

   /**
    * Generate JWT token
    * @param {string} userId - User ID
    * @returns {string} JWT token
    */
   generateToken(userId) {
      const jwtSecret = process.env.JWT_SECRET || "default_secret";
      return jwt.sign({ userId }, jwtSecret, { expiresIn: "1h" });
   }
}

module.exports = new AuthService();
