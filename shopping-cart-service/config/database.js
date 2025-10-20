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
            useNewUrlParser: true,
            useUnifiedTopology: true,
         };

         this.connection = await mongoose.connect(mongoURI, options);
         console.log("✅ Shopping Cart Service is Connected to MongoDB");
         return this.connection;
      } catch (err) {
         console.error(
            "🚫 Error connecting to MongoDB -> Shopping Cart Service: ",
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
