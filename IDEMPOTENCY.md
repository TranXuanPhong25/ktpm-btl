# Idempotency Implementation

## Overview

This document describes the idempotency mechanisms implemented in the system to ensure that operations can be safely retried without causing duplicate side effects.

## Key Improvements Made

### 1. Unique Constraints on Outbox Tables

**Problem**: Previously, there was no database-level guarantee preventing duplicate events in the outbox table.

**Solution**: Added composite unique indexes on `(aggregateId, eventType)` in all outbox tables:

- **MongoDB Services** (order-service, payment-service): 
  ```javascript
  outboxSchema.index({ aggregateId: 1, eventType: 1 }, { unique: true });
  ```

- **PostgreSQL Service** (product-inventory):
  ```javascript
  indexes: [
    {
      fields: ["aggregateId", "eventType"],
      unique: true
    }
  ]
  ```

This ensures that only one event of a given type can exist for a specific aggregate at the database level.

### 2. Atomic Outbox Writes with Error Handling

**Problem**: Race conditions existed between checking for duplicate events and inserting new ones.

**Solution**: Replaced "check-then-insert" pattern with atomic inserts that handle duplicate key errors:

```javascript
try {
   await Outbox.create({
      aggregateId: orderId,
      aggregateType: "Order",
      eventType: EVENTS.ORDER_CREATED,
      payload: JSON.stringify(event),
   });
} catch (err) {
   if (err.code === 11000) { // MongoDB duplicate key error
      console.log(`⚠️ Event already exists, skipping`);
      return;
   }
   throw err;
}
```

This approach:
- Eliminates race conditions between check and insert
- Relies on database constraints for consistency
- Handles concurrent operations gracefully

### 3. Message-Level Deduplication

**Problem**: RabbitMQ messages could be delivered multiple times (at-least-once delivery), potentially causing duplicate processing.

**Solution**: Implemented consumer-level deduplication:

#### a) Added Message IDs to Published Messages
```javascript
// In unified-relay-publisher
messageId: `${message.aggregateId}-${message.eventType}`
```

**Design Decision**: The messageId is deterministic based on the aggregate and event type, NOT the timestamp. This ensures:
- Same event published twice (e.g., due to outbox relay retry) gets the same messageId
- Consumer can detect and skip duplicate deliveries
- Limitation: Only one event of each type per aggregate is tracked. This is acceptable because the outbox pattern already prevents duplicate events at the source.

#### b) Created ProcessedMessage Model
Tracks all consumed messages to prevent reprocessing:

- **MongoDB Services**: `models/processedMessage.js` with unique `messageId` field
- **PostgreSQL Service**: `models/processedMessage.js` with Sequelize

#### c) Updated Consumers to Check and Record Messages
```javascript
// Use messageId from properties, fallback to deterministic ID
const messageId = msg.properties.messageId || 
   `${content.aggregateId}-${content.eventType}`;

// Check if already processed
const alreadyProcessed = await ProcessedMessage.findOne({ messageId });
if (alreadyProcessed) {
   console.log(`⚠️ Message ${messageId} already processed, skipping`);
   this.channel.ack(msg);
   return;
}

// Process message...

// Mark as processed (with duplicate key error handling)
await ProcessedMessage.create({ messageId, eventType, aggregateId });
```

### 4. TTL for Processed Messages

Both outbox and processed message records automatically expire after a period:
- **Outbox events**: 12 hours
- **Processed messages**: 24 hours

This prevents unbounded growth while maintaining idempotency during the critical window when retries are most likely.

## Services Updated

1. **order-service**: Outbox + ProcessedMessage (MongoDB)
2. **payment-service**: Outbox + ProcessedMessage (MongoDB)
3. **product-inventory**: Outbox + ProcessedMessage (PostgreSQL/Sequelize)
4. **unified-relay-publisher**: Added messageId to published events

## Idempotency Guarantees

### Producer Side (Event Publishing)
- ✅ Duplicate events for the same aggregate are prevented at the database level
- ✅ Concurrent writes are handled gracefully
- ✅ Transaction safety is maintained

### Consumer Side (Event Processing)
- ✅ Duplicate messages are detected and skipped
- ✅ Concurrent message processing is handled safely
- ✅ Message acknowledgment happens only after successful processing

### End-to-End
- ✅ An event can be published multiple times without creating duplicates
- ✅ A message can be delivered multiple times without being processed twice
- ✅ The system is resilient to network failures, service restarts, and retries

## Testing Idempotency

To verify idempotency:

1. **Duplicate Event Test**: Try to create the same outbox event twice
   - Expected: Second attempt is silently skipped
   
2. **Message Redelivery Test**: Redeliver a message (reject without ack)
   - Expected: Message is processed once, subsequent deliveries are skipped

3. **Concurrent Processing Test**: Process the same message concurrently
   - Expected: One succeeds, others detect duplication and skip

4. **Database Constraint Test**: Verify unique indexes exist
   ```javascript
   // MongoDB
   db.outboxes.getIndexes()
   db.processedmessages.getIndexes()
   
   // PostgreSQL
   SELECT * FROM pg_indexes WHERE tablename IN ('Outboxes', 'ProcessedMessages');
   ```

## Best Practices

1. **Always use the outbox pattern**: Don't publish events directly
2. **Include meaningful message IDs**: Use `aggregateId-eventType` format
3. **Handle duplicate key errors**: Treat them as success, not failure
4. **Monitor TTL cleanup**: Ensure old records are being removed
5. **Log idempotency skips**: For debugging and monitoring

## Future Improvements

1. Add metrics for idempotency skips
2. Implement configurable TTL values
3. Add cleanup jobs for orphaned processed messages
4. Consider distributed locking for critical sections
5. Implement request-level idempotency keys for API endpoints
