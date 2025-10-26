# Saga Flow Diagrams

## Detailed Success Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUCCESS SCENARIO                            │
└─────────────────────────────────────────────────────────────────────┘

    CLIENT             ORDER SERVICE          RABBITMQ        PRODUCT SERVICE      NOTIFICATION SERVICE
      │                     │                     │                  │                      │
      │  POST /orders       │                     │                  │                      │
      ├────────────────────>│                     │                  │                      │
      │                     │                     │                  │                      │
      │                     │ 1. Create Order     │                  │                      │
      │                     │    (status=Pending) │                  │                      │
      │                     │                     │                  │                      │
      │                     │ 2. Publish          │                  │                      │
      │                     │    OrderCreated     │                  │                      │
      │                     ├────────────────────>│                  │                      │
      │                     │                     │                  │                      │
      │  201 Order Created  │                     │ 3. Route to      │                      │
      │  (status=Pending)   │                     │    inventory_q   │                      │
      │<────────────────────┤                     ├─────────────────>│                      │
      │                     │                     │                  │                      │
      │                     │                     │                  │ 4. Validate &        │
      │                     │                     │                  │    Deduct Stock      │
      │                     │                     │                  │                      │
      │                     │                     │                  │ 5. Publish           │
      │                     │                     │                  │    InventoryReserved │
      │                     │                     │<─────────────────┤                      │
      │                     │                     │                  │                      │
      │                     │ 6a. Route to        │                  │                      │
      │                     │     order_saga_q    │                  │                      │
      │                     │<────────────────────┤                  │                      │
      │                     │                     │                  │                      │
      │                     │ 7a. Update Status   │                  │                      │
      │                     │    to Processing    │                  │                      │
      │                     │                     │                  │                      │
      │                     │                     │ 6b. Route to     │                      │
      │                     │                     │     notification_q                     │
      │                     │                     ├───────────────────────────────────────>│
      │                     │                     │                  │                      │
      │                     │                     │                  │  7b. Send Email      │
      │                     │                     │                  │      (Success)       │
      │                     │                     │                  │                      │
```

## Detailed Failure Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FAILURE SCENARIO                            │
│                   (Compensating Transaction)                        │
└─────────────────────────────────────────────────────────────────────┘

    CLIENT             ORDER SERVICE          RABBITMQ        PRODUCT SERVICE      NOTIFICATION SERVICE
      │                     │                     │                  │                      │
      │  POST /orders       │                     │                  │                      │
      ├────────────────────>│                     │                  │                      │
      │                     │                     │                  │                      │
      │                     │ 1. Create Order     │                  │                      │
      │                     │    (status=Pending) │                  │                      │
      │                     │                     │                  │                      │
      │                     │ 2. Publish          │                  │                      │
      │                     │    OrderCreated     │                  │                      │
      │                     ├────────────────────>│                  │                      │
      │                     │                     │                  │                      │
      │  201 Order Created  │                     │ 3. Route to      │                      │
      │  (status=Pending)   │                     │    inventory_q   │                      │
      │<────────────────────┤                     ├─────────────────>│                      │
      │                     │                     │                  │                      │
      │                     │                     │                  │ 4. Try Deduct Stock  │
      │                     │                     │                  │    ❌ FAILS          │
      │                     │                     │                  │    (Insufficient)    │
      │                     │                     │                  │                      │
      │                     │                     │                  │ 5. Publish           │
      │                     │                     │                  │    InventoryFailed   │
      │                     │                     │<─────────────────┤                      │
      │                     │                     │                  │                      │
      │                     │ 6a. Route to        │                  │                      │
      │                     │     order_saga_q    │                  │                      │
      │                     │<────────────────────┤                  │                      │
      │                     │                     │                  │                      │
      │                     │ 7a. COMPENSATE!     │                  │                      │
      │                     │    Update Status    │                  │                      │
      │                     │    to Failed        │                  │                      │
      │                     │                     │                  │                      │
      │                     │                     │ 6b. Route to     │                      │
      │                     │                     │     notification_q                     │
      │                     │                     ├───────────────────────────────────────>│
      │                     │                     │                  │                      │
      │                     │                     │                  │  7b. Send Email      │
      │                     │                     │                  │      (Failure)       │
      │                     │                     │                  │                      │
```

## Order State Transitions

```
                        ┌──────────────────────────────────────────┐
                        │     Order Placed by Customer             │
                        └─────────────────┬────────────────────────┘
                                          │
                                          ▼
                        ┌─────────────────────────────────┐
                        │         PENDING                 │
                        │  (Order created, waiting for    │
                        │   inventory confirmation)       │
                        └─────────┬───────────────────────┘
                                  │
                                  │ OrderCreated event published
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
                ▼                                   ▼
  ┌──────────────────────────┐        ┌──────────────────────────┐
  │  InventoryReserved       │        │    InventoryFailed       │
  │  event received          │        │    event received        │
  └──────────┬───────────────┘        └──────────┬───────────────┘
             │                                    │
             │                                    │
             ▼                                    ▼
  ┌──────────────────────┐        ┌──────────────────────────────┐
  │     PROCESSING       │        │          FAILED              │
  │  (Inventory reserved,│        │  (Compensating transaction)  │
  │   order processing)  │        │  (Stock insufficient/error)  │
  └──────────────────────┘        └──────────────────────────────┘
             │                                    │
             │                                    │
             ▼                                    ▼
  ┌──────────────────────┐        ┌──────────────────────────────┐
  │  Success             │        │  Failure                     │
  │  Notification Sent   │        │  Notification Sent           │
  └──────────────────────┘        └──────────────────────────────┘
```

## RabbitMQ Exchange and Queue Topology

```
                         PUBLISHERS
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
  Order Service      Product Service    Notification Service
        │                     │
        │                     │
        ▼                     ▼

┌───────────────────────────────────────────────────────────────┐
│                        RABBITMQ                                │
│                                                                │
│  ┌──────────────────────┐      ┌──────────────────────────┐  │
│  │  order_exchange      │      │  inventory_exchange      │  │
│  │  (topic)             │      │  (topic)                 │  │
│  └──────┬───────────────┘      └───────┬──────────────────┘  │
│         │                               │                     │
│         │ order.created                 │ inventory.reserved  │
│         │                               │ inventory.failed    │
│         │                               │                     │
│         ▼                               ▼                     │
│  ┌────────────────┐            ┌─────────────────────┐       │
│  │ inventory_queue│            │  order_saga_queue   │       │
│  └───────┬────────┘            └──────────┬──────────┘       │
│          │                                 │                  │
│          │                      ┌──────────────────────┐      │
│          │                      │ notification_queue   │      │
│          │                      └───────┬──────────────┘      │
│          │                              │                     │
└──────────┼──────────────────────────────┼─────────────────────┘
           │                              │
           │                              │
           ▼                              ▼
                     CONSUMERS
           │                              │
           ▼                              ▼
    Product Service            Order Service
                               Notification Service
```

## Event Flow Timeline

```
Time    Order Service        Product Service      Notification Service
─────────────────────────────────────────────────────────────────────
t0      Create Order
        status: Pending

t1      Publish
        OrderCreated ───────>

t2                           Receive
                             OrderCreated

t3                           Validate Stock
                             Deduct Inventory

t4                           Publish
                             InventoryReserved ──>

t5      Receive                                   Receive
        InventoryReserved                         InventoryReserved

t6      Update Status                             Send Email
        to Processing                             Notification

t7      Saga Complete        Saga Complete        Saga Complete
```

## Component Responsibilities

```
┌────────────────────────────────────────────────────────────────┐
│                      ORDER SERVICE                             │
├────────────────────────────────────────────────────────────────┤
│ • Create order with Pending status                            │
│ • Publish OrderCreated event                                   │
│ • Listen for inventory events                                  │
│ • Update order status based on inventory result               │
│ • Execute compensating transaction on failure                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    PRODUCT SERVICE                             │
├────────────────────────────────────────────────────────────────┤
│ • Listen for OrderCreated events                              │
│ • Validate product availability                                │
│ • Attempt to deduct stock                                      │
│ • Publish InventoryReserved on success                        │
│ • Publish InventoryFailed on error                            │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                 NOTIFICATION SERVICE                           │
├────────────────────────────────────────────────────────────────┤
│ • Listen for inventory events                                  │
│ • Send success email on InventoryReserved                     │
│ • Send failure email on InventoryFailed                       │
│ • Handle notification errors gracefully                        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                       RABBITMQ                                 │
├────────────────────────────────────────────────────────────────┤
│ • Route events between services                                │
│ • Ensure message durability                                    │
│ • Handle message acknowledgments                               │
│ • Provide management and monitoring UI                         │
└────────────────────────────────────────────────────────────────┘
```

## Key Patterns Applied

### 1. Event-Driven Architecture

```
Service A ──[Event]──> Message Broker ──[Event]──> Service B
   │                                                    │
   └────────────────── No Direct Coupling ─────────────┘
```

### 2. Choreography (vs Orchestration)

```
CHOREOGRAPHY                     ORCHESTRATION
(This Implementation)            (Alternative)

Service A ──> Event             Service A ──> Request
    │         │                     │            │
    │         ▼                     │            ▼
    │      Service B              Orchestrator ──> Service B
    │         │                     │            │
    │         ▼                     │            ▼
    │      Service C              Orchestrator ──> Service C
    ▼         │                     │            │
Decentralized │                     ▼            ▼
    ▼         ▼                 Centralized Control
  Reactive  Reactive
```

### 3. Compensating Transaction

```
Forward Transaction:
  Order Created ──> Inventory Reserved ──> Success

Compensating Transaction:
  Order Created ──> Inventory Failed ──> Order Marked Failed
                                          (Compensation)
```

### 4. Eventual Consistency

```
t0: Order Pending (Consistent)
t1: Order Pending, Inventory Processing (Temporarily Inconsistent)
t2: Order Processing, Inventory Reserved (Eventually Consistent)
```
