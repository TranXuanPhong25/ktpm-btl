# Idempotency Flow Diagrams

## Before Fixes (Vulnerable)

```
┌─────────────────────────────────────────────────────────────┐
│ Event Publishing (Producer Side) - VULNERABLE              │
└─────────────────────────────────────────────────────────────┘

Service A                    Service B
   │                            │
   ├─ Check Outbox ────────────┤─ Check Outbox
   │  (No duplicate found)      │  (No duplicate found)
   │                            │
   ├─ Create Event ────────────┤─ Create Event
   │  ✅ SUCCESS                 │  ✅ SUCCESS
   │                            │
   └─ Result: DUPLICATE EVENTS CREATED ❌


┌─────────────────────────────────────────────────────────────┐
│ Message Consumption (Consumer Side) - VULNERABLE           │
└─────────────────────────────────────────────────────────────┘

RabbitMQ                    Consumer
   │                            │
   ├─ Deliver Message ─────────┤─ Process Message
   │                            │  ✅ Success
   │                            │
   ├─ (Network issue)           │
   │                            │
   ├─ Redeliver Message ───────┤─ Process AGAIN
   │                            │  ❌ DUPLICATE PROCESSING
   └────────────────────────────┴─────────────────────────────
```

## After Fixes (Secure)

```
┌─────────────────────────────────────────────────────────────┐
│ Event Publishing (Producer Side) - SECURE                  │
└─────────────────────────────────────────────────────────────┘

Service A                    Service B
   │                            │
   ├─ Try Create Event ────────┤─ Try Create Event
   │  with unique constraint    │  with unique constraint
   │                            │
   ├─ ✅ SUCCESS                 ├─ ❌ Duplicate Key Error
   │  (Event created)           │  (Caught & handled)
   │                            │
   └─ Result: ONLY ONE EVENT CREATED ✅


┌─────────────────────────────────────────────────────────────┐
│ Message Consumption (Consumer Side) - SECURE               │
└─────────────────────────────────────────────────────────────┘

RabbitMQ                    Consumer
   │                            │
   ├─ Deliver Message ─────────┤─ Check ProcessedMessage
   │  (messageId: ABC-event)    │  (Not found)
   │                            │
   │                            ├─ Process Message
   │                            │  ✅ Success
   │                            │
   │                            ├─ Save ProcessedMessage
   │                            │  (messageId: ABC-event)
   │                            │
   ├─ (Network issue)           │
   │                            │
   ├─ Redeliver Message ───────┤─ Check ProcessedMessage
   │  (messageId: ABC-event)    │  ✅ FOUND! Skip processing
   │                            │
   └────────────────────────────┴─────────────────────────────
```

## Complete Flow with Both Protections

```
┌──────────────────────────────────────────────────────────────┐
│                    End-to-End Idempotency                    │
└──────────────────────────────────────────────────────────────┘

Producer               Outbox DB          Relay           Consumer          ProcessedMsg DB
   │                       │                │                 │                    │
   ├─ Create Event ───────┤                │                 │                    │
   │  (Order-123,CREATED) │                │                 │                    │
   │                      │                │                 │                    │
   │  ✅ Insert Success    │                │                 │                    │
   │  (Unique constraint) │                │                 │                    │
   │                      │                │                 │                    │
   ├─ Try Again (Retry) ──┤                │                 │                    │
   │  (Order-123,CREATED) │                │                 │                    │
   │                      │                │                 │                    │
   │  ⚠️ Duplicate Key     │                │                 │                    │
   │  (Skipped safely)    │                │                 │                    │
   │                      │                │                 │                    │
   │                      ├─ Publish ──────┤                 │                    │
   │                      │  (messageId:    │                 │                    │
   │                      │   Order-123-    │                 │                    │
   │                      │   CREATED)      │                 │                    │
   │                      │                │                 │                    │
   │                      │                ├─ Deliver ───────┤                    │
   │                      │                │  (messageId)    │                    │
   │                      │                │                 │                    │
   │                      │                │                 ├─ Check ────────────┤
   │                      │                │                 │  (Not found)       │
   │                      │                │                 │                    │
   │                      │                │                 ├─ Process           │
   │                      │                │                 │  ✅ Success         │
   │                      │                │                 │                    │
   │                      │                │                 ├─ Save ─────────────┤
   │                      │                │                 │  (messageId)       │
   │                      │                │                 │                    │
   │                      ├─ Retry Publish ┤                 │                    │
   │                      │  (Same msgId)  │                 │                    │
   │                      │                │                 │                    │
   │                      │                ├─ Redeliver ─────┤                    │
   │                      │                │  (messageId)    │                    │
   │                      │                │                 │                    │
   │                      │                │                 ├─ Check ────────────┤
   │                      │                │                 │  ✅ FOUND!          │
   │                      │                │                 │                    │
   │                      │                │                 ├─ Skip (ACK)        │
   │                      │                │                 │  ⚠️ Already done   │
   └──────────────────────┴────────────────┴─────────────────┴────────────────────┘

Result: No duplicate processing, system is idempotent! ✅
```

## Key Components

### 1. Unique Constraint (Outbox)
```sql
-- MongoDB
{ aggregateId: 1, eventType: 1 } UNIQUE

-- PostgreSQL
UNIQUE (aggregateId, eventType)
```

### 2. ProcessedMessage Model
```javascript
{
  messageId: String,      // "Order-123-CREATED"
  eventType: String,      // "order.created"
  aggregateId: String,    // "Order-123"
  processedAt: Date,
  expireAt: Date         // TTL: 24 hours
}
```

### 3. Error Handling
```javascript
try {
  await Outbox.create(event);
} catch (err) {
  if (err.code === 11000) {  // MongoDB
    // Already exists, this is OK!
    return;
  }
  throw err;
}
```

## Testing Idempotency

### Test 1: Duplicate Event Creation
```bash
# Try to create same event twice
curl -X POST /api/orders -d '{"userId":"123",...}'
curl -X POST /api/orders -d '{"userId":"123",...}'

# Expected: Only ONE outbox entry created
db.outboxes.find({aggregateId: "Order-123", eventType: "order.created"})
# Should return exactly 1 document
```

### Test 2: Message Redelivery
```javascript
// Simulate message redelivery
await consumer.handleMessage(message);  // First delivery
await consumer.handleMessage(message);  // Redelivery

// Expected: Only processed once
const count = await ProcessedMessage.count({
  messageId: "Order-123-CREATED"
});
expect(count).toBe(1);
```

### Test 3: Concurrent Processing
```javascript
// Two workers process same message simultaneously
await Promise.all([
  worker1.handleMessage(message),
  worker2.handleMessage(message)
]);

// Expected: Only one succeeds, other detects duplicate
const processed = await ProcessedMessage.findOne({
  messageId: "Order-123-CREATED"
});
expect(processed).not.toBeNull();
expect(processed.processedCount).toBe(1);
```
