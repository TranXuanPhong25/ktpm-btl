# Order Service - Architecture Documentation

## Overview

The Order Service handles order placement and retrieval. It integrates with the Product Service to validate items and deduct stock.

## Layers

- `routes/order.js` - HTTP handling
- `services/orderService.js` - Business logic, validation, product-service integration
- `repositories/orderRepository.js` - Data access
- `models/order.js` - Mongoose schema
- `config/database.js` - Database connection

## Endpoints

- `POST /api/orders/:userId` - Place order
- `GET /api/orders/:userId` - Get orders for a user
- `GET /api/orders/:userId/:orderId` - Get a specific order
- `PUT /api/orders/:orderId/status` - Update order status

## Business Rules

- Validate each item: product exists and has sufficient stock
- Calculate totalAmount = sum(price \* quantity)
- Use product-service bulk endpoints for efficiency
- Rollback order if stock deduction fails

## External Integration

- Product Service: `PRODUCT_SERVICE_URI`
   - `GET /api/products/bulk/get?ids=...` to fetch products
   - `POST /api/products/bulk/deduction` to deduct stock

## Errors

- 400: Validation errors
- 404: Product or Order not found
- 500: Server errors

---
