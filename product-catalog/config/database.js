const mongoose = require("mongoose");

class Database {
   constructor() {
      this.connection = null;
   }

   async connect(mongoURI) {
      try {
         if (this.connection) {
            console.log("Using existing MongoDB connection");
            return this.connection;
         }

         const options = {
            maxPoolSize: 200, // Tăng từ default 5 → 100
            minPoolSize: 20, // Min connections luôn active
            maxIdleTimeMS: 30000, // Keep connections alive 30s
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
         };

         this.connection = await mongoose.connect(mongoURI, options);
         console.log("Product Service is Connected to MongoDB");
         return this.connection;
      } catch (err) {
         console.error(
            "Error connecting to MongoDB -> Product Service: ",
            err.message
         );
         throw err;
      }
   }

   async disconnect() {
      if (this.connection) {
         await mongoose.disconnect();
         this.connection = null;
         console.log("Disconnected from MongoDB");
      }
   }

   getConnection() {
      return this.connection;
   }
}

module.exports = new Database();
