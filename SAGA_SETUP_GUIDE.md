# Saga Pattern Setup Guide

## Quick Start

This guide will help you set up and test the choreography saga pattern implementation.

## Installation

### 1. Install Dependencies

```bash
# Order Service
cd order-service
npm install

# Product Service
cd ../product-service
npm install

# Notification Service
cd ../notification-service
npm install
```

## Running with Docker Compose

### Start All Services

```bash
# From the root directory
docker-compose up --build
```

This will start:

- RabbitMQ (ports 5672 and 15672)
- MongoDB instances for each service
- Order Service (port 5003)
- Product Service (port 5001)
- Notification Service (port 5005)
- Other services (User, Auth, Cart, Payment)

### Start Only Required Services for Saga Testing

```bash
docker-compose up rabbitmq mongo-orders mongo-products order-service product-service notification-service
```

## Running Locally (Without Docker)

### 1. Start RabbitMQ

```bash
# Using Docker
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3-management-alpine
```

### 2. Start MongoDB Instances

```bash
# For orders
docker run -d --name mongo-orders -p 27017:27017 mongo:latest

# For products
docker run -d --name mongo-products -p 27018:27017 mongo:latest
```

### 3. Start Services

```bash
# Terminal 1 - Order Service
cd order-service
PORT=5003 \
MONGO_URI=mongodb://localhost:27017/ecommerce-orders \
RABBITMQ_URI=amqp://admin:admin123@localhost:5672 \
npm start

# Terminal 2 - Product Service
cd product-service
PORT=5001 \
MONGO_URI=mongodb://localhost:27018/ecommerce-products \
RABBITMQ_URI=amqp://admin:admin123@localhost:5672 \
npm start

# Terminal 3 - Notification Service
cd notification-service
PORT=5005 \
RABBITMQ_URI=amqp://admin:admin123@localhost:5672 \
npm start
```

## Testing the Saga

### 1. Create Test Products

```bash
# Create a product with sufficient stock
curl -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "description": "A test product for saga",
    "price": 50.00,
    "category": "Electronics",
    "stock": 100
  }'

# Save the returned product ID
```

### 2. Test Success Scenario

```bash
# Place an order (replace PRODUCT_ID with actual ID)
curl -X POST http://localhost:5003/api/orders/user123 \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "PRODUCT_ID",
        "quantity": 2
      }
    ]
  }'
```

**Expected Flow:**

1. Order created with status "Pending"
2. Product service deducts stock
3. Order status updated to "Processing"
4. Success notification sent

**Check Logs:**

- Order Service: `📤 Publishing OrderCreated event`
- Product Service: `📥 Received event: order.created`, `✓ Inventory reserved`
- Order Service: `📥 Received event: inventory.reserved`, `✓ Order status updated`
- Notification Service: `📥 Received event: inventory.reserved`, `✓ Notification sent`

### 3. Test Failure Scenario

```bash
# Create a product with insufficient stock
curl -X POST http://localhost:5001/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Low Stock Product",
    "description": "Product with low stock",
    "price": 30.00,
    "category": "Test",
    "stock": 1
  }'

# Try to order more than available
curl -X POST http://localhost:5003/api/orders/user123 \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "LOW_STOCK_PRODUCT_ID",
        "quantity": 10
      }
    ]
  }'
```

**Expected Flow:**

1. Order created with status "Pending"
2. Product service fails to deduct stock
3. Order status updated to "Failed" (compensating transaction)
4. Failure notification sent

**Check Logs:**

- Order Service: `📤 Publishing OrderCreated event`
- Product Service: `📥 Received event: order.created`, `✗ Inventory reservation failed`
- Order Service: `📥 Received event: inventory.failed`, `✓ Compensating transaction`
- Notification Service: `📥 Received event: inventory.failed`, `✓ Failure notification sent`

### 4. Verify Order Status

```bash
# Get order details (replace ORDER_ID and USER_ID)
curl http://localhost:5003/api/orders/user123/ORDER_ID
```

### 5. Verify Stock Deduction

```bash
# Get product details (replace PRODUCT_ID)
curl http://localhost:5001/api/products/PRODUCT_ID
```

## Monitoring

### RabbitMQ Management UI

Access: http://localhost:15672

- Username: `admin`
- Password: `admin123`

**What to Check:**

1. **Exchanges** tab: Verify `order_exchange` and `inventory_exchange` exist
2. **Queues** tab: Check messages in `order_saga_queue`, `inventory_queue`, `notification_queue`
3. **Connections** tab: Verify all 3 services are connected
4. **Message rates**: See real-time message flow

### Service Logs

Watch for these emoji indicators:

- 📤 = Publishing event
- 📥 = Receiving event
- ✓ = Success operation
- ✗ = Failed operation
- 🔄 = Processing

## Troubleshooting

### Services can't connect to RabbitMQ

**Solution:**

```bash
# Check if RabbitMQ is running
docker ps | grep rabbitmq

# Check RabbitMQ logs
docker logs rabbitmq

# Restart RabbitMQ
docker restart rabbitmq
```

### No events being processed

**Solution:**

1. Check RabbitMQ Management UI for queue bindings
2. Verify all services show "✓ initialized successfully" in logs
3. Check that exchanges and queues are created
4. Restart all services

### Order stays in "Pending" status

**Causes:**

- Product service not running
- RabbitMQ connection failed
- Product doesn't exist

**Solution:**

1. Check product service logs
2. Verify product exists: `curl http://localhost:5001/api/products/PRODUCT_ID`
3. Check RabbitMQ for dead messages

### Database connection errors

**Solution:**

```bash
# Check MongoDB instances
docker ps | grep mongo

# Restart MongoDB
docker restart mongo-orders mongo-products
```

## Environment Variables

### Order Service

```env
PORT=5003
MONGO_URI=mongodb://localhost:27017/ecommerce-orders
RABBITMQ_URI=amqp://admin:admin123@localhost:5672
PRODUCT_SERVICE_URI=http://localhost:5001
SHOPPING_CART_SERVICE_URI=http://localhost:5002
```

### Product Service

```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/ecommerce-products
RABBITMQ_URI=amqp://admin:admin123@localhost:5672
```

### Notification Service

```env
PORT=5005
RABBITMQ_URI=amqp://admin:admin123@localhost:5672
NODEMAILER_EMAIL=your-email@gmail.com
NODEMAILER_PASSWORD=your-app-password
```

## Clean Up

### Stop All Services

```bash
docker-compose down
```

### Remove Volumes (Clean Database)

```bash
docker-compose down -v
```

### Remove Individual Containers

```bash
docker stop rabbitmq mongo-orders mongo-products
docker rm rabbitmq mongo-orders mongo-products
```

## Next Steps

1. Review the detailed architecture in `SAGA_ARCHITECTURE.md`
2. Explore the code in:
   - `order-service/saga/orderSaga.js`
   - `product-service/events/orderEventHandler.js`
   - `notification-service/events/orderEventHandler.js`
   - `shared/messaging/rabbitmq.js`
3. Test different scenarios (multiple items, partial failures)
4. Monitor message flow in RabbitMQ Management UI
5. Add more event handlers for extended workflows

## Support

For issues or questions, refer to:

- `SAGA_ARCHITECTURE.md` - Detailed architecture documentation
- RabbitMQ logs: `docker logs rabbitmq`
- Service logs: Check console output of each service
