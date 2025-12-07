const mongoose = require("mongoose");

class Database {
   constructor() {
      this.connection = null;
   }

   async connect(mongoURI) {
      try {
         this.connection = await mongoose.connect(mongoURI);
         console.log("Payment Service is Connected to MongoDB");
         return this.connection;
      } catch (err) {
         console.error(
            "Error connecting to MongoDB -> Payment Service: ",
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
}

module.exports = new Database();
