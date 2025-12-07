const EVENTS = {
   PRODUCT_CREATED: "product.created",
   PRODUCT_DELETED: "product.deleted",
   STOCK_UPDATED: "stock.updated",

   ORDER_CREATED: "order.created",
   ORDER_PROCESSING: "order.processing",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_RESTORED: "inventory.restored",
   INVENTORY_FAILED: "inventory.failed",
   ORDER_FAILED: "order.failed",
};
const EXCHANGES = {
   PRODUCT: "product_exchange",
   ORDER: "order_exchange",
   INVENTORY: "inventory_exchange",
};

const QUEUES = {
   // Dedicated queue for receiving Order Created events from Order Service
   ORDER_TO_INVENTORY: "order.to.inventory.queue",
   // Dedicated queue for receiving Order Failed events for compensation
   ORDER_TO_INVENTORY_COMPENSATION: "order.to.inventory.compensation.queue",

   PRODUCT_TO_INVENTORY: "product.to.inventory.queue",
};

module.exports = { EVENTS, EXCHANGES, QUEUES };
