const { Sequelize } = require("sequelize");

class Database {
   constructor() {
      const postgresURI = process.env.POSTGRES_URI || "";

      const options = {
         dialect: "postgres",
         logging: false,
         pool: { max: 45, min: 5, idle: 10000, acquire: 30000 },
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
   async migrations() {
      if (!this.connection) {
         throw new Error("Database connection is not established");
      }
      try {
         await this.connection.sync({ alter: true });
         await this.connection.query(`
               ALTER TABLE "Products"
               ADD CONSTRAINT stock_non_negative CHECK (stock >= 0)
               `);
      } catch (err) {
         if (!err.message.includes("already exists")) {
            throw err;
         }
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
