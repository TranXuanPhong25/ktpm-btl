const { Sequelize } = require("sequelize");

class Database {
   constructor() {
      const postgresURI = process.env.POSTGRES_URI || "";

      const options = {
         dialect: "postgres",
         logging: false,
         pool: { max: 200, min: 20, idle: 30000, acquire: 60000 },
         dialectOptions: { connectTimeout: 45000 },
      };

      try {
         this.connection = new Sequelize(postgresURI, options);
      } catch (err) {
         console.error("Failed to initialize Sequelize instance:", err.message);
         process.exit(1);
      }
   }

   async connect() {
      try {
         await this.connection.authenticate();
         console.log("Product Service is Connected to PostgreSQL");
      } catch (err) {
         console.error(
            "Error connecting to PostgreSQL -> Product Service: ",
            err.message
         );
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
