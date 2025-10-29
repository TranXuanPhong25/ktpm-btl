# Saga Pattern Testing - Quick Reference

## 🚀 Quick Commands

```bash
# Interactive Demo (Best for first-time users)
./scripts/demo.sh

# Automated Tests
./scripts/quick-test.sh

# Generate Test Data
cd scripts && npm run generate-data

# Generate and Execute Orders
cd scripts && npm run generate-and-execute

# Run Full Test Suite
cd scripts && npm run test-saga

# Cleanup Test Data
cd scripts && npm run cleanup
```

## 📊 Service URLs

| Service      | URL                    | Health Check            |
| ------------ | ---------------------- | ----------------------- |
| Order        | http://localhost:5003  | GET /api/orders/:userId |
| Product      | http://localhost:5001  | GET /api/products       |
| Notification | http://localhost:5005  | GET /api/notification   |
| RabbitMQ UI  | http://localhost:15672 | admin/admin123          |

## 🔍 Monitoring Commands

```bash
# Check services
docker ps | grep -E "(order|product|notification|rabbitmq)"

# View logs
docker logs order-service -f
docker logs product-service -f
docker logs notification-service -f

# All logs combined
docker-compose logs -f order-service product-service notification-service

# RabbitMQ queues
curl -s -u admin:admin123 http://localhost:15672/api/queues | jq '.[] | {name, messages}'
```

## 🧪 Manual Test Commands

### Success Scenario

```bash
# 1. Create product
PRODUCT=$(curl -s -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","price":50,"category":"Test","stock":100}')

PRODUCT_ID=$(echo $PRODUCT | jq -r '._id')

# 2. Place order
ORDER=$(curl -s -X POST http://localhost:5003/api/orders/testuser \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":5}]}")

ORDER_ID=$(echo $ORDER | jq -r '._id')

# 3. Wait for saga
sleep 3

# 4. Check status
curl http://localhost:5003/api/orders/testuser/$ORDER_ID | jq '.status'
```

### Failure Scenario

```bash
# 1. Create low-stock product
PRODUCT=$(curl -s -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Low Stock","price":30,"category":"Test","stock":2}')

PRODUCT_ID=$(echo $PRODUCT | jq -r '._id')

# 2. Order more than available
curl -X POST http://localhost:5003/api/orders/testuser \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":10}]}"
```

## 🎯 Expected Results

### Success Path

```
Order Status: Pending → Processing
Stock: 100 → 95 (deducted)
Notification: ✓ Success email sent
```

### Failure Path

```
Order Status: Pending → Failed
Stock: 2 → 2 (unchanged, rollback)
Notification: ✓ Failure email sent
```

## 🐛 Quick Troubleshooting

### Services not responding

```bash
docker-compose restart order-service product-service notification-service
```

### RabbitMQ issues

```bash
docker restart rabbitmq
# Wait 10 seconds
docker-compose restart order-service product-service notification-service
```

### Reset everything

```bash
docker-compose down
docker-compose up -d
```

### Clean test data

```bash
cd scripts && npm run cleanup
```

## 📝 Event Flow Cheat Sheet

```
1. POST /api/orders/:userId
   └─> Order created (status: Pending)
   └─> 📤 OrderCreated event

2. Product Service receives OrderCreated
   └─> Validates stock
   └─> Deducts inventory
   └─> 📤 InventoryReserved (success) OR InventoryFailed

3. Order Service receives inventory event
   └─> Updates status (Processing or Failed)

4. Notification Service receives inventory event
   └─> Sends email notification
```

## 🔑 Key Files

| File                                               | Purpose              |
| -------------------------------------------------- | -------------------- |
| `order-service/saga/orderSaga.js`                  | Saga orchestration   |
| `product-service/events/orderEventHandler.js`      | Inventory management |
| `notification-service/events/orderEventHandler.js` | Notifications        |
| `shared/messaging/rabbitmq.js`                     | RabbitMQ utilities   |

## 📚 Documentation Quick Links

- Architecture: `SAGA_ARCHITECTURE.md`
- Setup Guide: `SAGA_SETUP_GUIDE.md`
- Flow Diagrams: `SAGA_FLOW_DIAGRAMS.md`
- Testing Guide: `TESTING.md`
- Script Guide: `scripts/SCRIPTS_GUIDE.md`

## 💡 Pro Tips

✓ Always check RabbitMQ UI when testing
✓ Wait 2-3 seconds between operations for saga completion
✓ Use colored logs to track event flow (📤📥✓✗)
✓ Clean up test data regularly
✓ Monitor service logs during tests
