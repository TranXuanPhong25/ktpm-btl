# Payment & Inventory Compensation Flow

## Tổng quan

Hệ thống đã được cập nhật để sử dụng messaging pattern (RabbitMQ) cho việc xử lý payment và compensate inventory khi payment thất bại.

## Kiến trúc Event-Driven

### Các Service liên quan:

1. **Order Service** - Orchestrator (Saga coordinator)
2. **Product Service** - Quản lý inventory
3. **Payment Service** - Xử lý thanh toán
4. **Shopping Cart Service** - Quản lý giỏ hàng

### Exchanges & Queues:

#### Exchanges:

- `order_exchange` - Phát sự kiện liên quan đến order
- `inventory_exchange` - Phát sự kiện liên quan đến inventory
- `payment_exchange` - Phát sự kiện liên quan đến payment

#### Queues:

- `order_saga_queue` - Order service lắng nghe inventory & payment events
- `inventory_queue` - Product service lắng nghe order created events
- `inventory_compensation_queue` - Product service lắng nghe payment failed events
- `payment_processing_queue` - Payment service lắng nghe inventory reserved events
- `cart_clear_queue` - Cart service lắng nghe order created events

## Flow Thành Công

```
1. User tạo order
   ↓
2. Order Service tạo order (status: "Pending")
   → Publish: order.created
   ↓
3. Product Service nhận event
   → Deduct inventory
   → Publish: inventory.reserved (bao gồm totalAmount)
   ↓
4. Payment Service nhận event
   → Process payment
   → Publish: payment.succeeded
   ↓
5. Order Service nhận event
   → Update order status: "Completed"
   ↓
6. Cart Service nhận order.created event
   → Clear user's cart
```

## Flow Thất Bại - Insufficient Inventory

```
1. User tạo order
   ↓
2. Order Service tạo order (status: "Pending")
   → Publish: order.created
   ↓
3. Product Service nhận event
   → Kiểm tra inventory
   → Inventory không đủ
   → Publish: inventory.failed
   ↓
4. Order Service nhận event
   → Update order status: "Failed"
   → Compensating transaction hoàn tất
```

## Flow Thất Bại - Payment Failed (với Compensation)

```
1. User tạo order
   ↓
2. Order Service tạo order (status: "Pending")
   → Publish: order.created
   ↓
3. Product Service nhận event
   → Deduct inventory THÀNH CÔNG
   → Publish: inventory.reserved (bao gồm items & totalAmount)
   ↓
4. Payment Service nhận event
   → Process payment
   → Payment THẤT BẠI
   → Publish: payment.failed (bao gồm items cho compensation)
   ↓
5a. Order Service nhận payment.failed
    → Update order status: "Failed"
    ↓
5b. Product Service nhận payment.failed
    → COMPENSATE: Add back inventory
    → Restore stock cho tất cả items
    → Log compensation completed
```

## Chi tiết Implementation

### 1. Payment Service

**File mới:**

- `messaging/rabbitmq.js` - RabbitMQ connection manager
- `events/paymentEventHandler.js` - Xử lý inventory events và publish payment events

**Thay đổi:**

- `services/paymentService.js` - Thêm `processPaymentForOrder()` method
- `index.js` - Khởi tạo payment event handler
- `package.json` - Thêm dependency `amqplib`

**Events lắng nghe:**

- `inventory.reserved` → Trigger payment processing

**Events phát ra:**

- `payment.succeeded` - Khi payment thành công
- `payment.failed` - Khi payment thất bại (bao gồm items)

### 2. Order Service (Saga)

**Thay đổi:**

- `saga/orderSaga.js` - Thêm xử lý payment events

**Events lắng nghe:**

- `inventory.reserved` → Update status: "Processing"
- `inventory.failed` → Update status: "Failed"
- `payment.succeeded` → Update status: "Completed"
- `payment.failed` → Update status: "Failed"

### 3. Product Service

**Thay đổi:**

- `events/orderEventHandler.js` - Thêm compensation logic

**Events lắng nghe:**

- `order.created` → Deduct inventory
- `payment.failed` → Compensate (restore inventory)

**Events phát ra:**

- `inventory.reserved` - Khi inventory đủ (bao gồm totalAmount)
- `inventory.failed` - Khi inventory không đủ

**Compensation Logic:**

- Khi nhận `payment.failed` event, service sẽ restore lại stock
- Sử dụng `addStock()` method để cộng lại số lượng đã deduct

### 4. Shopping Cart Service

**Đã implement trước đó:**

- Lắng nghe `order.created` event để clear cart

## Status Transitions của Order

```
Pending → Processing → Completed  (Success path)
   ↓
Failed (Inventory failed hoặc Payment failed)
```

## Lợi ích của Pattern này

1. **Loose Coupling**: Services không phụ thuộc trực tiếp vào nhau
2. **Resilience**: Failure ở một service không crash toàn bộ hệ thống
3. **Compensation**: Tự động rollback khi có lỗi
4. **Traceability**: Dễ trace flow thông qua events
5. **Scalability**: Có thể scale từng service độc lập
6. **Async Processing**: Payment không block order creation

## Testing

### Test Success Flow:

```bash
POST /api/orders
{
  "userId": "user123",
  "items": [
    {"productId": "prod1", "quantity": 2}
  ]
}
```

### Test Payment Failure (10% chance):

- Payment service có 90% success rate
- Chạy nhiều lần để test failure scenario
- Kiểm tra inventory đã được restore

### Kiểm tra Logs:

```bash
# Order Service
✓ Order created, saga initiated
📥 Received event: inventory.reserved
📥 Received event: payment.succeeded (or payment.failed)

# Product Service
📥 Received event: order.created
📤 Published InventoryReserved event
📥 Compensation queue received event: payment.failed
✓ Restored inventory

# Payment Service
📥 Payment service received event: inventory.reserved
💳 Processing payment
✓ Payment succeeded (or ✗ Payment failed)
```

## Environment Variables

Thêm vào `.env` của các services:

```bash
RABBITMQ_URI=amqp://localhost:5672
```

## Monitoring & Alerting

Cần monitor:

1. Payment failure rate
2. Compensation success rate
3. Queue depths
4. Message processing time
5. Dead letter queues (DLQ)

## Future Improvements

1. **Idempotency**: Đảm bảo events không xử lý duplicate
2. **Event Store**: Lưu trữ tất cả events cho audit
3. **Retry Logic**: Tự động retry khi compensation fail
4. **Dead Letter Queue**: Xử lý messages thất bại
5. **Distributed Tracing**: Trace order qua các services
6. **Real Payment Gateway**: Tích hợp Stripe/PayPal thực tế
