# Payment Service - Architecture Documentation

## Overview

The Payment Service handles payment processing with Stripe integration using a clean 3-tier architecture pattern.

## Architecture Layers

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP Request/Response handling
│     (routes/payment.js)             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │  ← Business Logic & Stripe Integration
│   (services/paymentService.js)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Repository Layer              │  ← Data Access Logic
│  (repositories/paymentRepository.js)│
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Model Layer                 │  ← Database Schema
│     (models/payment.js)             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Database Layer                 │  ← MongoDB Connection
│     (config/database.js)            │
└─────────────────────────────────────┘
```

## API Endpoints

### Payment Processing

- `POST /api/payments/:orderId` - Process a payment
   ```json
   {
      "amount": 1000,
      "paymentMethodId": "pm_1234567890"
   }
   ```

### Payment Retrieval

- `GET /api/payments/:paymentId` - Get payment by ID
- `GET /api/payments/order/:orderId` - Get all payments for an order
- `GET /api/payments?status=succeeded` - Get payments by status
- `GET /api/payments?paymentMethod=stripe` - Get payments by method

### Payment Management

- `PATCH /api/payments/:paymentId/status` - Update payment status
   ```json
   { "status": "succeeded" }
   ```
- `POST /api/payments/:paymentId/refund` - Refund a payment
   ```json
   { "amount": 500 } // Optional, defaults to full refund
   ```

### Payment Information

- `GET /api/payments/order/:orderId/summary` - Get payment summary for order
- `GET /api/payments/:paymentId/verify` - Verify payment with Stripe

## Service Layer Methods

### PaymentService

- `processPayment(orderId, amount, paymentMethodId)` - Process payment via Stripe
- `getPaymentById(paymentId)` - Get single payment
- `getPaymentsByOrder(orderId)` - Get all payments for an order
- `getAllPayments(filters)` - Get all payments with optional filters
- `updatePaymentStatus(paymentId, status)` - Update payment status
- `refundPayment(paymentId, amount)` - Process refund via Stripe
- `getOrderPaymentSummary(orderId)` - Get payment summary with statistics
- `verifyPayment(paymentId)` - Verify payment status with Stripe

## Repository Layer Methods

### PaymentRepository

- `create(paymentData)` - Create new payment record
- `findById(paymentId)` - Find payment by ID
- `findByOrderId(orderId)` - Find all payments for order
- `findAll()` - Find all payments
- `updateStatus(paymentId, status)` - Update payment status
- `update(paymentId, updateData)` - Update payment
- `delete(paymentId)` - Delete payment
- `findByStatus(status)` - Find payments by status
- `findByPaymentMethod(paymentMethod)` - Find payments by method
- `getTotalAmountByOrder(orderId)` - Calculate total paid amount

## Key Features

### 1. Stripe Integration

- Secure payment processing via Stripe API
- Payment intent creation and confirmation
- Automatic payment status tracking
- Refund processing

### 2. Payment Tracking

- Complete payment history per order
- Status tracking (pending, succeeded, failed, refunded)
- Payment method tracking
- Error message logging for failed payments

### 3. Refund Management

- Full or partial refunds
- Automatic Stripe refund processing
- Refund validation (only succeeded payments)
- Refund amount validation

### 4. Payment Verification

- Verify payment status with Stripe
- Sync local status with Stripe status
- Detect status discrepancies

### 5. Payment Summary

- Total payments count
- Amount breakdowns by status
- Overall order payment status
- Complete payment history

## Payment Statuses

- `pending` - Payment initiated but not completed
- `succeeded` - Payment successfully processed
- `failed` - Payment processing failed
- `canceled` - Payment canceled
- `refunded` - Payment refunded

## Business Rules

1. **Payment Validation**
   - Order ID is required
   - Amount must be greater than 0
   - Payment method ID is required for Stripe

2. **Refund Rules**
   - Only succeeded payments can be refunded
   - Refund amount cannot exceed payment amount
   - Full refund if no amount specified

3. **Status Updates**
   - Only valid statuses are accepted
   - Status changes are logged

4. **Amount Conversion**
   - Amounts are stored in main currency units
   - Converted to cents for Stripe (x100)

## Stripe Configuration

**Environment Variable:**

```
STRIPE_SECRET_KEY=sk_test_...
```

**Payment Flow:**

1. Client provides payment method ID
2. Service creates Stripe Payment Intent
3. Payment is confirmed automatically
4. Status is tracked in database
5. Failed payments are logged with error messages

## Usage Examples

### Process Payment

```bash
POST /api/payments/order123
{
  "amount": 1500,
  "paymentMethodId": "pm_1234567890"
}
```

Response:

```json
{
   "_id": "pay456",
   "orderId": "order123",
   "amount": 1500,
   "status": "succeeded",
   "paymentMethod": "stripe",
   "stripePaymentIntentId": "pi_xyz",
   "paymentDate": "2025-10-20T10:30:00.000Z"
}
```

### Get Payment Summary

```bash
GET /api/payments/order/order123/summary
```

Response:

```json
{
  "orderId": "order123",
  "totalPayments": 2,
  "totalAmount": 2000,
  "succeededAmount": 1500,
  "failedAmount": 500,
  "refundedAmount": 0,
  "status": "paid",
  "payments": [...]
}
```

### Refund Payment

```bash
POST /api/payments/pay456/refund
{
  "amount": 500
}
```

### Verify Payment

```bash
GET /api/payments/pay456/verify
```

Response:

```json
{
   "verified": true,
   "stripeStatus": "succeeded",
   "localStatus": "succeeded",
   "synced": true
}
```

## Error Handling

- **400 Bad Request**: Validation errors, invalid amounts, invalid refund requests
- **404 Not Found**: Payment not found
- **500 Internal Server Error**: Stripe API errors, database errors

## Benefits

- ✅ **Secure Payment Processing** - Integrated with Stripe
- ✅ **Complete Audit Trail** - All payments logged
- ✅ **Failed Payment Tracking** - Error messages saved
- ✅ **Flexible Refunds** - Full or partial refunds
- ✅ **Payment Verification** - Sync with Stripe status
- ✅ **Order-level Summaries** - Complete payment overview
- ✅ **Testable Architecture** - Easy to mock Stripe integration

---

**Last Updated:** October 20, 2025
**Version:** 2.0 (3-Tier Architecture)
