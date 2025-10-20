# Shopping Cart Service - Architecture Documentation

## Overview

The Shopping Cart Service manages user shopping carts with a clean 3-tier architecture pattern.

## Architecture Layers

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP Request/Response handling
│     (routes/cart.js)                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │  ← Business Logic & Validation
│   (services/cartService.js)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Repository Layer              │  ← Data Access Logic
│  (repositories/cartRepository.js)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Model Layer                 │  ← Database Schema
│     (models/cart.js)                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Database Layer                 │  ← MongoDB Connection
│     (config/database.js)            │
└─────────────────────────────────────┘
```

## API Endpoints

### Cart Management

- `GET /api/cart/:userId` - Get user's cart (creates if doesn't exist)
- `POST /api/cart/:userId/items` - Add item to cart
   ```json
   { "productId": "123", "quantity": 2 }
   ```
- `PUT /api/cart/:userId/items/:productId` - Update item quantity
   ```json
   { "quantity": 5 }
   ```
- `DELETE /api/cart/:userId/items/:productId` - Remove single item
- `DELETE /api/cart/:userId/items?productIds=id1,id2` - Remove multiple items
- `DELETE /api/cart/:userId` - Clear all items from cart

### New Features

- `GET /api/cart/:userId/summary` - Get cart summary (total items, unique products)
- `GET /api/cart/:userId/validate` - Validate cart items against product availability

## Service Layer Methods

### CartService

- `getCart(userId)` - Get or create cart for user
- `addItem(userId, productId, quantity)` - Add item with product verification
- `updateItemQuantity(userId, productId, quantity)` - Update quantity (0 removes item)
- `removeItem(userId, productId)` - Remove single item
- `removeItems(userId, productIds)` - Remove multiple items
- `clearCart(userId)` - Clear all items
- `getCartSummary(userId)` - Get cart statistics
- `validateCart(userId)` - Validate all items against product service

## Repository Layer Methods

### CartRepository

- `findByUserId(userId)` - Find cart by user ID
- `create(userId, items)` - Create new cart
- `update(userId, cartData)` - Update cart
- `save(cart)` - Save cart changes
- `delete(userId)` - Delete cart
- `clearItems(userId)` - Clear all items
- `getOrCreate(userId)` - Get existing or create new cart

## Key Features

### 1. Automatic Cart Creation

- Carts are automatically created when accessed if they don't exist
- No need for explicit cart initialization

### 2. Product Verification

- Verifies product exists before adding to cart
- Integrates with Product Service

### 3. Cart Validation

- Can validate entire cart against product availability
- Checks stock levels for all items
- Returns detailed validation report

### 4. Flexible Item Removal

- Remove single item
- Remove multiple items at once
- Clear entire cart

### 5. Smart Quantity Updates

- Setting quantity to 0 removes the item
- Adding existing item increments quantity

## Business Rules

1. **Quantity Validation**
   - Quantity must be greater than 0 when adding
   - Quantity must be 0 or greater when updating
   - Setting to 0 removes the item

2. **Product Verification**
   - Product must exist in Product Service before adding
   - Validation endpoint checks real-time availability

3. **Cart Auto-Creation**
   - Empty cart is created automatically on first access
   - Prevents "Cart not found" errors

4. **Error Handling**
   - 400: Validation errors (invalid quantity, missing fields)
   - 404: Cart not found, Product not found
   - 500: Server errors

## Integration

### Product Service Integration

The cart service integrates with the product service to:

- Verify products exist before adding to cart
- Validate stock availability
- Get product details

**Environment Variable:**

```
PRODUCT_SERVICE_URI=http://product-service:5001
```

## Usage Examples

### Add Item to Cart

```bash
POST /api/cart/user123/items
{
  "productId": "prod456",
  "quantity": 2
}
```

### Get Cart with Summary

```bash
GET /api/cart/user123/summary
```

Response:

```json
{
   "userId": "user123",
   "totalItems": 5,
   "uniqueProducts": 2,
   "items": [
      { "productId": "prod456", "quantity": 3 },
      { "productId": "prod789", "quantity": 2 }
   ]
}
```

### Validate Cart

```bash
GET /api/cart/user123/validate
```

Response:

```json
{
   "valid": false,
   "invalidItems": [
      {
         "productId": "prod456",
         "requestedQuantity": 10,
         "availableStock": 5,
         "reason": "Insufficient stock"
      }
   ],
   "message": "1 item(s) have issues"
}
```

## Benefits

- ✅ **Clean Separation** - Each layer has clear responsibilities
- ✅ **Testable** - Easy to unit test each layer
- ✅ **Maintainable** - Easy to locate and fix bugs
- ✅ **Extensible** - Easy to add new features
- ✅ **Integrated** - Seamless product verification
- ✅ **Validated** - Real-time cart validation

---

**Last Updated:** October 20, 2025
**Version:** 2.0 (3-Tier Architecture)
