const jwt = require("jsonwebtoken");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "../protos/user.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
   keepCase: true,
   longs: String,
   enums: String,
   defaults: true,
   oneofs: true,
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user;

const USER_SERVICE_GRPC_URI =
   process.env.USER_SERVICE_GRPC_URI || "localhost:50051";

class AuthService {
   constructor() {
      this.client = new userProto.UserService(
         USER_SERVICE_GRPC_URI,
         grpc.credentials.createInsecure()
      );
   }

   /**
    * Register a new user
    * @param {string} name - User name
    * @param {string} email - User email
    * @param {string} password - User password
    * @returns {Promise<Object>} User and token
    */
   async register(name, email, password) {
      return new Promise((resolve, reject) => {
         this.client.register({ name, email, password }, (err, response) => {
            if (err) {
               console.error("gRPC Error:", err);
               return reject(new Error("User service unavailable"));
            }

            if (response.error) {
               return reject(new Error(response.error));
            }

            const token = this.generateToken(response.user.id);
            resolve({ user: response.user, token });
         });
      });
   }

   /**
    * Login user
    * @param {string} email - User email
    * @param {string} password - User password
    * @returns {Promise<Object>} User and token
    */
   async login(email, password) {
      return new Promise((resolve, reject) => {
         this.client.login({ email, password }, (err, response) => {
            if (err) {
               console.error("gRPC Error:", err);
               return reject(new Error("User service unavailable"));
            }

            if (response.error) {
               return reject(new Error(response.error));
            }

            const token = this.generateToken(response.user.id);
            resolve({ user: response.user, token });
         });
      });
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
