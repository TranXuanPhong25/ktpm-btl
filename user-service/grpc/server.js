const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const userRepository = require("../repositories/userRepository");
const argon2 = require("argon2");
// Load proto file
const PROTO_PATH = path.join(__dirname, "../protos/user.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
   keepCase: true,
   longs: String,
   enums: String,
   defaults: true,
   oneofs: true,
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

function isValidEmail(email) {
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * gRPC Service Handlers
 */
const grpcHandlers = {
   /**
    * Register new user
    */
   async register(call, callback) {
      try {
         const { name, email, password } = call.request;

         // Validation
         if (!name || !email || !password) {
            return callback(null, {
               user: null,
               error: "Name, email, and password are required",
            });
         }

         if (!isValidEmail(email)) {
            return callback(null, {
               user: null,
               error: "Invalid email format",
            });
         }

         if (password.length < 6) {
            return callback(null, {
               user: null,
               error: "Password must be at least 6 characters long",
            });
         }

         // Check if user exists
         const exists = await userRepository.emailExists(email);
         if (exists) {
            return callback(null, {
               user: null,
               error: "User already exists",
            });
         }

         // Create new user
         const user = await userRepository.create({ name, email, password });

         callback(null, {
            user: {
               id: user._id.toString(),
               name: user.name,
               email: user.email,
            },
            error: "",
         });
      } catch (err) {
         callback(null, {
            user: null,
            error: err.message || "Internal server error",
         });
      }
   },

   /**
    * Login user
    */
   async login(call, callback) {
      try {
         const { email, password } = call.request;

         // Validation
         if (!email || !password) {
            return callback(null, {
               user: null,
               error: "Email and password are required",
            });
         }

         // Find user
         const user = await userRepository.findByEmail(email);
         if (!user) {
            return callback(null, {
               user: null,
               error: "Invalid credentials",
            });
         }

         // Check password
         const isMatch = await argon2.verify(user.password, password);
         if (!isMatch) {
            return callback(null, {
               user: null,
               error: "Invalid credentials",
            });
         }

         // Success
         callback(null, {
            user: {
               id: user._id.toString(),
               name: user.name,
               email: user.email,
            },
            error: "",
         });
      } catch (err) {
         callback(null, {
            user: null,
            error: err.message || "Internal server error",
         });
      }
   },
};

/**
 * Start gRPC Server
 */
function startGrpcServer(port = 50051) {
   const server = new grpc.Server();
   server.addService(userProto.UserService.service, grpcHandlers);

   server.bindAsync(
      `0.0.0.0:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
         if (err) {
            console.error("Failed to start gRPC server:", err);
            return;
         }
         console.log(`User Service gRPC running on port ${boundPort}`);
      }
   );

   return server;
}

module.exports = startGrpcServer;
