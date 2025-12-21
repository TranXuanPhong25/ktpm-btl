const mongoose = require("mongoose");

class Database {
   constructor() {
      this.connection = null;
   }

   async connect(mongoURI) {
      try {
         if (this.connection) {
            console.log("✅ Using existing MongoDB connection");
            return this.connection;
         }

         const options = {
            maxPoolSize: 300,
            minPoolSize: 20,
            maxIdleTimeMS: 30000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            readPreference: "primary",
         };

         this.connection = await mongoose.connect(mongoURI, options);
         console.log("✅ Order Service is Connected to MongoDB");
         return this.connection;
      } catch (err) {
         console.error(
            "🚫 Error connecting to MongoDB -> Order Service: ",
            err.message
         );
         throw err;
      }
   }

   async disconnect() {
      if (this.connection) {
         await mongoose.disconnect();
         this.connection = null;
         console.log("✅ Disconnected from MongoDB");
      }
   }

   getConnection() {
      return this.connection;
   }
}

module.exports = new Database();
