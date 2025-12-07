const InventoryReadModel = require("../models/inventory.read");
class InventoryRepository {
   async findByProductIds(productIds) {
      try {
         return await InventoryReadModel.find({
            productId: { $in: productIds },
         }).lean();
      } catch (err) {
         throw new Error(
            `Failed to get inventory for products with IDs ${productIds.join(", ")}: ${err.message}`
         );
      }
   }
}

module.exports = new InventoryRepository();
