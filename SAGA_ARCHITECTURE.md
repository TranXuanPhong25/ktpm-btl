# Choreography Saga Pattern - Architecture Documentation

## Overview

This document describes the implementation of the **Choreography Saga Pattern** using RabbitMQ for managing distributed transactions across the Order, Product (Inventory), and Notification services.

## Saga Pattern Type: Choreography

In a choreography-based saga, there is no central coordinator. Each service publishes events and subscribes to events from other services. Services react to events independently, creating a chain of reactions.

### Advantages

- **Decoupling**: Services are loosely coupled and don't need to know about each other
- **Scalability**: Easy to add new services to the workflow
- **Resilience**: No single point of failure
- **Autonomy**: Each service manages its own logic

### Disadvantages

- **Complexity**: Event flow can be harder to trace
- **Cyclic dependencies**: Need to be careful about event loops

## Architecture

### Services Involved

1. **Order Service** - Initiates the saga by creating orders
2. **Product Service** - Acts as inventory manager, reserves stock
3. **Notification Service** - Sends notifications based on order status

### Event Flow

```
┌─────────────────┐
│  Order Service  │
│                 │
│  1. Create Order│──────┐
│  2. Publish     │      │
│  OrderCreated   │      │
└─────────────────┘      │
                         │
                         ▼
              ┌──────────────────┐
              │   RabbitMQ       │
              │  order_exchange  │
              └──────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Product Service     │
              │                      │
              │  3. Reserve Inventory│
              │  4. Deduct Stock     │
              │  5. Publish:         │
              │     - InventoryReserved │
              │     OR                  │
              │     - InventoryFailed   │
              └─────────────────────┘
                         │
                         ├──────────────┬─────────────────┐
                         ▼              ▼                 ▼
              ┌──────────────────┐  ┌──────────────────┐
              │ RabbitMQ         │  │ RabbitMQ         │
              │inventory_exchange│  │inventory_exchange│
              └──────────────────┘  └──────────────────┘
                         │                    │
         ┌───────────────┴──────┐            │
         ▼                      ▼            ▼
┌─────────────────┐   ┌──────────────────────┐
│  Order Service  │   │ Notification Service │
│                 │   │                      │
│  6a. Update     │   │  6b. Send Email      │
│  Order Status   │   │  Notification        │
│  to Processing  │   │  - Success or Failed │
│  or Failed      │   │                      │
└─────────────────┘   └──────────────────────┘
```

## Event Types

### 1. OrderCreated Event

**Publisher**: Order Service  
**Subscribers**: Product Service  
**Exchange**: `order_exchange`  
**Routing Key**: `order.created`

**Payload**:

```json
{
   "eventType": "order.created",
   "orderId": "507f1f77bcf86cd799439011",
   "userId": "user123",
   "items": [
      {
         "productId": "product456",
         "quantity": 2
      }
   ],
   "totalAmount": 99.99,
   "timestamp": "2025-10-25T10:30:00.000Z"
}
```

### 2. InventoryReserved Event

**Publisher**: Product Service  
**Subscribers**: Order Service, Notification Service  
**Exchange**: `inventory_exchange`  
**Routing Key**: `inventory.reserved`

**Payload**:

```json
{
   "eventType": "inventory.reserved",
   "orderId": "507f1f77bcf86cd799439011",
   "userId": "user123",
   "items": [
      {
         "productId": "product456",
         "quantity": 2
      }
   ],
   "timestamp": "2025-10-25T10:30:01.000Z"
}
```

### 3. InventoryFailed Event

**Publisher**: Product Service  
**Subscribers**: Order Service, Notification Service  
**Exchange**: `inventory_exchange`  
**Routing Key**: `inventory.failed`

**Payload**:

```json
{
   "eventType": "inventory.failed",
   "orderId": "507f1f77bcf86cd799439011",
   "userId": "user123",
   "reason": "Insufficient stock. Available: 1, Requested: 2",
   "timestamp": "2025-10-25T10:30:01.000Z"
}
```

## Saga Flow

### Happy Path (Success Scenario)

1. **User places order** → Order Service creates order with status "Pending"
2. **Order Service** → Publishes `OrderCreated` event
3. **Product Service** → Receives event, validates and deducts stock
4. **Product Service** → Publishes `InventoryReserved` event
5. **Order Service** → Receives event, updates order status to "Processing"
6. **Notification Service** → Receives event, sends success email to user

### Failure Path (Compensating Transaction)

1. **User places order** → Order Service creates order with status "Pending"
2. **Order Service** → Publishes `OrderCreated` event
3. **Product Service** → Receives event, tries to deduct stock but fails (insufficient inventory)
4. **Product Service** → Publishes `InventoryFailed` event
5. **Order Service** → Receives event, updates order status to "Failed" (compensating action)
6. **Notification Service** → Receives event, sends failure email to user

## RabbitMQ Configuration

### Exchanges

- **order_exchange** (Type: topic, Durable: true)
   - Used for publishing order-related events
- **inventory_exchange** (Type: topic, Durable: true)
   - Used for publishing inventory-related events

### Queues

- **order_saga_queue** (Durable: true)
   - Order Service listens to inventory events
   - Bound to: `inventory_exchange` with pattern `inventory.*`

- **inventory_queue** (Durable: true)
   - Product Service listens to order events
   - Bound to: `order_exchange` with pattern `order.created`

- **notification_queue** (Durable: true)
   - Notification Service listens to inventory events
   - Bound to: `inventory_exchange` with pattern `inventory.*`

## Implementation Details

### Shared Messaging Library

Location: `shared/messaging/rabbitmq.js`

Provides:

- Connection management
- Exchange and queue assertion
- Publishing messages
- Consuming messages with automatic acknowledgment
- Error handling and graceful shutdown

### Order Service Saga

Location: `order-service/saga/orderSaga.js`

Responsibilities:

- Initialize RabbitMQ connection
- Publish `OrderCreated` events
- Listen for `InventoryReserved` and `InventoryFailed` events
- Update order status accordingly
- Handle compensating transactions

### Product Service Event Handler

Location: `product-service/events/orderEventHandler.js`

Responsibilities:

- Listen for `OrderCreated` events
- Validate and deduct stock
- Publish `InventoryReserved` on success
- Publish `InventoryFailed` on failure

### Notification Service Event Handler

Location: `notification-service/events/orderEventHandler.js`

Responsibilities:

- Listen for `InventoryReserved` and `InventoryFailed` events
- Send appropriate email notifications to users

## Error Handling

### Message Acknowledgment

- Messages are acknowledged only after successful processing
- Failed messages are rejected and not requeued to prevent infinite loops

### Service Failures

- Each service handles its own errors
- Failed operations publish appropriate failure events
- Compensating transactions are triggered by failure events

### RabbitMQ Connection Failures

- Services log connection errors
- Graceful shutdown procedures close connections properly

## Order States

1. **Pending** - Order created, waiting for inventory reservation
2. **Processing** - Inventory reserved, order being processed
3. **Failed** - Order failed due to inventory issues or other errors

## Running the System

### Prerequisites

```bash
# RabbitMQ must be running
docker-compose up rabbitmq
```

### Install Dependencies

```bash
cd order-service && npm install
cd product-service && npm install
cd notification-service && npm install
```

### Start Services

```bash
# Terminal 1
cd order-service && npm start

# Terminal 2
cd product-service && npm start

# Terminal 3
cd notification-service && npm start
```

### Test the Saga

```bash
# Place an order
curl -X POST http://localhost:5003/api/orders/user123 \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": "product456", "quantity": 2}
    ]
  }'
```

## Monitoring

### RabbitMQ Management UI

Access at: http://localhost:15672

- Username: admin
- Password: admin123

View:

- Exchange bindings
- Queue messages
- Message rates
- Consumer connections

### Service Logs

Each service logs:

- Event publishing (📤)
- Event receiving (📥)
- Success operations (✓)
- Failed operations (✗)
- Processing steps (🔄)

## Future Enhancements

1. **Dead Letter Queues**: Handle permanently failed messages
2. **Retry Mechanisms**: Automatic retry with exponential backoff
3. **Saga Timeout**: Implement timeout for long-running sagas
4. **Event Store**: Persist all events for auditing and replay
5. **Correlation IDs**: Better tracing across services
6. **Idempotency**: Ensure duplicate events don't cause issues
7. **Circuit Breaker**: Prevent cascading failures

## Comparison with Orchestration Saga

| Aspect                  | Choreography               | Orchestration         |
| ----------------------- | -------------------------- | --------------------- |
| Coordination            | Distributed                | Centralized           |
| Coupling                | Loose                      | Tight                 |
| Complexity              | Higher (distributed logic) | Lower (central logic) |
| Single Point of Failure | No                         | Yes (orchestrator)    |
| Visibility              | Harder to trace            | Easier to trace       |
| Best for                | Simple workflows           | Complex workflows     |

## Conclusion

This choreography saga pattern provides a resilient, scalable approach to handling distributed transactions across microservices. Each service maintains its autonomy while participating in a coordinated business process through event-driven communication.
