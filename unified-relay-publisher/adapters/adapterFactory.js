const PostgresAdapter = require("./postgresAdapter");
const MongoAdapter = require("./mongoAdapter");

/**
 * Factory for creating database adapters based on DATABASE_TYPE
 */
class AdapterFactory {
   /**
    * Create a database adapter based on type
    * @param {string} type - Database type: 'postgres' or 'mongo'
    * @returns {DatabaseAdapter} Database adapter instance
    */
   static createAdapter(type) {
      const dbType = (type || "").toLowerCase();

      switch (dbType) {
         case "postgres":
         case "postgresql":
            console.log("Creating PostgreSQL adapter");
            return new PostgresAdapter();

         case "mongo":
         case "mongodb":
            console.log("Creating MongoDB adapter");
            return new MongoAdapter();

         default:
            throw new Error(
               `Unsupported database type: ${type}. Supported types: postgres, mongo`
            );
      }
   }

   /**
    * Get supported database types
    */
   static getSupportedTypes() {
      return ["postgres", "postgresql", "mongo", "mongodb"];
   }
}

module.exports = AdapterFactory;
