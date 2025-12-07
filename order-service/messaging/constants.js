// Event types
const EVENTS = {
   ORDER_PROCESSING: "order.processing",
   ORDER_CREATED: "order.created",
   ORDER_FAILED: "order.failed",
   ORDER_PLACED: "order.placed",
   INVENTORY_RESERVED: "inventory.reserved",
   INVENTORY_FAILED: "inventory.failed",
   PAYMENT_SUCCEEDED: "payment.succeeded",
   PAYMENT_FAILED: "payment.failed",
};

// Exchange and queue names
const EXCHANGES = {
   ORDER: "order_exchange",
   INVENTORY: "inventory_exchange",
   PAYMENT: "payment_exchange",
};

const QUEUES = {
   // Queue for Order Saga to receive responses from Inventory Service
   INVENTORY_TO_ORDER: "inventory.to.order.queue",
   // Queue for Order Saga to receive responses from Payment Service
   PAYMENT_TO_ORDER: "payment.to.order.queue",
};

module.exports = {
   EVENTS,
   EXCHANGES,
   QUEUES,
};
