# Hướng dẫn Xem Distributed Tracing với Jaeger

## ✅ Kiểm tra Jaeger đang chạy

```bash
# Check Jaeger status
curl http://localhost:16686/api/services

# Hoặc mở browser
open http://localhost:16686
```

## 🚀 Cách Tạo Traces

### Option 1: Tự động tạo traffic với script

```bash
# Chạy script test (đã có sẵn)
./test-envoy-observability.sh
```

### Option 2: Manual test với curl

```bash
# Tạo một trace ID unique
TRACE_ID="my-test-$(date +%s)"
echo "Trace ID: $TRACE_ID"

# Gọi các services với trace ID
curl -H "x-request-id: $TRACE_ID" http://localhost:5000/api/users
curl -H "x-request-id: $TRACE_ID" http://localhost:5001/api/products
curl -H "x-request-id: $TRACE_ID" http://localhost:5002/api/cart/user123

# Wait 2-3 giây để traces được gửi đến Jaeger
sleep 3
```

### Option 3: Test với browser/Postman

Thêm header vào request:

```
x-request-id: your-unique-trace-id
```

## 📊 Xem Traces trong Jaeger UI

### Bước 1: Mở Jaeger UI

```
http://localhost:16686
```

### Bước 2: Tìm Traces

#### Cách 1: Search by Service

1. Chọn **Service** từ dropdown (ví dụ: `user-service`, `product-service`)
2. Chọn **Operation** (ví dụ: `ingress`)
3. Click **"Find Traces"**

#### Cách 2: Search by Trace ID

1. Click tab **"Search"** ở top
2. Paste trace ID vào ô **"Trace ID"**
3. Click **"Find Traces"**

#### Cách 3: Search by Tags

1. Thêm tags: `http.method=GET`, `http.status_code=200`
2. Set lookback: Last 1 hour
3. Click **"Find Traces"**

### Bước 3: Xem Chi Tiết Trace

Click vào một trace để xem:

- **Timeline**: Visualize request flow qua các services
- **Spans**: Chi tiết từng bước trong request
- **Tags**: HTTP method, status code, URLs
- **Logs**: Events trong quá trình xử lý
- **Duration**: Thời gian xử lý tại mỗi service

## 📈 Thông tin trong Trace

### Trace Information:

- **Trace ID**: Unique identifier cho toàn bộ request flow
- **Span ID**: Unique identifier cho mỗi service hop
- **Duration**: Tổng thời gian request (ms)
- **Services**: Số lượng services tham gia
- **Depth**: Độ sâu của call chain

### Span Details:

- **Service Name**: Tên service (ví dụ: `user-service`)
- **Operation Name**: Operation được thực hiện
- **Start Time**: Thời gian bắt đầu
- **Duration**: Thời gian xử lý (ms)
- **Tags**:
   - `http.method`: GET, POST, PUT, DELETE
   - `http.url`: Request URL
   - `http.status_code`: Response code (200, 404, 500)
   - `peer.address`: Backend service address
   - `component`: envoy
- **Logs**: Chi tiết events

## 🔍 Use Cases

### 1. Debug Performance Issues

```bash
# Generate load
for i in {1..10}; do
  curl -H "x-request-id: perf-test-$i" http://localhost:5001/api/products &
done
wait

# Xem traces để tìm slow requests
# Filter by: Latency > 500ms
```

### 2. Trace Cross-Service Requests

```bash
# Tạo order (gọi nhiều services)
curl -X POST http://localhost:5003/api/orders \
  -H "Content-Type: application/json" \
  -H "x-request-id: order-trace-123" \
  -d '{
    "userId": "user123",
    "items": [{"productId": "prod1", "quantity": 2}]
  }'

# Xem trace để thấy flow: Order -> Product -> Cart -> Payment
```

### 3. Find Errors

```bash
# Filter traces by error
# Tags: error=true
# Or: http.status_code >= 500
```

## 🎯 Jaeger UI Features

### System Architecture (Dependencies)

1. Click **"System Architecture"** tab
2. Xem dependency graph giữa các services
3. Thấy được request flow patterns

### Compare Traces

1. Select multiple traces
2. Click **"Compare"**
3. So sánh latency và spans

### Statistics

1. Xem trace count per service
2. Average/p95/p99 latencies
3. Error rates

## 🛠️ Troubleshooting

### Không thấy traces?

**1. Check Envoy logs:**

```bash
docker logs user-service-envoy 2>&1 | grep -i trace
```

**2. Check Jaeger connectivity:**

```bash
docker exec user-service-envoy ping -c 3 jaeger
```

**3. Verify tracing config:**

```bash
curl http://localhost:9901/config_dump | jq '.configs[] | select(.["@type"] | contains("Listener"))'
```

**4. Check if requests are coming through Envoy:**

```bash
docker logs user-service-envoy 2>&1 | tail -20
```

**5. Generate more traffic:**

```bash
# Run load test
k6 run benchmarks/k6-scripts/product-service-test.js
```

### Traces bị missing spans?

- Check if all services có Envoy proxy
- Verify trace ID được propagate qua headers
- Check network connectivity giữa Envoy và Jaeger

### Jaeger UI không load?

```bash
# Check Jaeger logs
docker logs jaeger

# Restart Jaeger
docker-compose restart jaeger

# Check ports
curl http://localhost:16686/api/services
```

## 📚 Advanced Usage

### Query API directly:

```bash
# Get all services
curl http://localhost:16686/api/services | jq

# Get traces for a service
curl "http://localhost:16686/api/traces?service=user-service&limit=10" | jq

# Get specific trace
curl "http://localhost:16686/api/traces/YOUR_TRACE_ID" | jq
```

### Export traces:

1. Open trace in UI
2. Click **"JSON"** button
3. Copy or download trace data

## 🎓 Example Trace Analysis

### Scenario: Slow Order Creation

1. **Create order with trace:**

```bash
curl -X POST http://localhost:5003/api/orders \
  -H "x-request-id: slow-order-trace" \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","items":[{"productId":"p1","quantity":1}]}'
```

2. **Find trace in Jaeger:**
   - Service: order-service
   - Trace ID: slow-order-trace

3. **Analyze spans:**
   - Check which service takes longest
   - Look for retry attempts
   - Check for errors in logs

4. **Identify bottleneck:**
   - Database queries?
   - External API calls?
   - Service-to-service latency?

## ✅ Quick Test

Chạy lệnh này và xem kết quả trong Jaeger UI:

```bash
#!/bin/bash
echo "🧪 Testing Distributed Tracing..."
echo "=================================="

# Generate unique trace ID
TRACE_ID="quick-test-$(date +%s)"
echo "Trace ID: $TRACE_ID"
echo ""

# Test User Service
echo "1. Testing User Service..."
curl -s -H "x-request-id: ${TRACE_ID}-user" \
     http://localhost:5000/api/users > /dev/null && echo "   ✓ Done"

# Test Product Service
echo "2. Testing Product Service..."
curl -s -H "x-request-id: ${TRACE_ID}-product" \
     http://localhost:5001/api/products > /dev/null && echo "   ✓ Done"

# Test Cart Service
echo "3. Testing Cart Service..."
curl -s -H "x-request-id: ${TRACE_ID}-cart" \
     http://localhost:5002/api/cart/testuser > /dev/null && echo "   ✓ Done"

echo ""
echo "⏳ Waiting for traces to be collected..."
sleep 3

echo ""
echo "✅ Done! Now check Jaeger UI:"
echo "   URL: http://localhost:16686"
echo "   Search for: ${TRACE_ID}"
echo ""
```

Lưu script này và chạy:

```bash
bash quick-trace-test.sh
```

## 📖 More Resources

- **Jaeger Documentation**: https://www.jaegertracing.io/docs/
- **Envoy Tracing**: https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/observability/tracing
- **OpenTracing**: https://opentracing.io/docs/

## 🎯 Key Metrics to Watch

1. **Latency Percentiles**: p50, p95, p99
2. **Error Rate**: % of traces with errors
3. **Request Rate**: Traces per second
4. **Service Dependencies**: Số services trong một trace
5. **Depth**: Call chain depth (nên < 5)
