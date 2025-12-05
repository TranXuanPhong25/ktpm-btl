const { Sequelize } = require("sequelize");

class Database {
   constructor() {
      this.connection = null;
   }

   async connect(postgresURI) {
      try {
         if (this.connection) {
            console.log("Using existing PostgreSQL connection");
            return this.connection;
         }

         const options = {
            dialect: "postgres",
            logging: false,
            pool: {
               max: 50,
               min: 10,
               idle: 30000,
               acquire: 60000,
            },
            dialectOptions: {
               connectTimeout: 45000,
            },
         };

         this.connection = new Sequelize(postgresURI, options);
         await this.connection.authenticate();
         console.log("Relay Publisher connected to PostgreSQL");
         return this.connection;
      } catch (err) {
         console.error("Error connecting to PostgreSQL:", err.message);
         throw err;
      }
   }

   async disconnect() {
      if (this.connection) {
         await this.connection.close();
         this.connection = null;
         console.log("Disconnected from PostgreSQL");
      }
   }

   getConnection() {
      return this.connection;
   }
}

module.exports = new Database();
