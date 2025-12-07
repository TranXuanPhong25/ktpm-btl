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

         this.connection = await mongoose.connect(mongoURI);
         console.log("User Service is Connected to MongoDB");
         return this.connection;
      } catch (err) {
         console.error(
            "Error connecting to MongoDB -> User Service: ",
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
