# Product Service - Architecture Documentation

## Overview

The Product Service has been refactored to follow a layered architecture pattern with clear separation of concerns.

## Architecture Layers

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP Request/Response handling
│     (routes/product.js)             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │  ← Business Logic & Validation
│   (services/productService.js)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Repository Layer              │  ← Data Access Logic
│  (repositories/productRepository.js)│
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Model Layer                 │  ← Database Schema
│     (models/product.js)             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Database Layer                 │  ← MongoDB Connection
│     (config/database.js)            │
└─────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Routes Layer (`routes/product.js`)

**Responsibility:** HTTP request/response handling

- Parse incoming HTTP requests
- Call appropriate service methods
- Handle HTTP status codes
- Return responses to clients

**Should NOT:**

- Contain business logic
- Directly access database
- Perform data validation

### 2. Service Layer (`services/productService.js`)

**Responsibility:** Business logic and validation

- Validate input data
- Implement business rules
- Coordinate between multiple repositories (if needed)
- Transform data for business needs

**Methods:**

- `createProduct(productData)` - Create product with validation
- `getAllProducts(filters)` - Get all products with optional filters
- `getProductById(productId)` - Get single product
- `updateProduct(productId, updateData)` - Update product with validation
- `deleteProduct(productId)` - Delete product
- `deductStock(productId, quantity)` - Deduct stock with business rules
- `addStock(productId, quantity)` - Add stock
- `checkAvailability(productId, quantity)` - Check product availability
- `getProductsByCategory(category)` - Get products by category
- `getLowStockProducts(threshold)` - Get low stock alerts

### 3. Repository Layer (`repositories/productRepository.js`)

**Responsibility:** Data access operations

- CRUD operations on database
- Abstract database queries
- No business logic

**Methods:**

- `create(productData)` - Insert new product
- `findAll()` - Fetch all products
- `findById(id)` - Fetch product by ID
- `update(id, updateData)` - Update product
- `delete(id)` - Delete product
- `deductStock(id, quantity)` - Atomic stock deduction
- `findByCategory(category)` - Query by category
- `hasStock(id, quantity)` - Check stock availability

### 4. Model Layer (`models/product.js`)

**Responsibility:** Database schema definition

- Define data structure
- Set field types and constraints
- Add indexes if needed

### 5. Database Layer (`config/database.js`)

**Responsibility:** Database connection management

- Singleton connection pattern
- Connection pooling configuration
- Graceful disconnect

## API Endpoints

### Core Endpoints

- `POST /api/products` - Create new product
- `GET /api/products` - Get all products (supports `?category=` filter)
- `GET /api/products/:id` - Get product by ID
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Stock Management

- `PUT /api/products/:id/deduction` - Deduct stock
   ```json
   { "quantity": 5 }
   ```
- `PUT /api/products/:id/addition` - Add stock
   ```json
   { "quantity": 10 }
   ```

### Additional Features

- `GET /api/products/:id/availability?quantity=5` - Check availability
- `GET /api/products/stock/low?threshold=10` - Get low stock products

## Benefits of This Architecture

1. **Separation of Concerns**
   - Each layer has a single, well-defined responsibility
   - Changes in one layer don't affect others

2. **Testability**
   - Each layer can be tested independently
   - Easy to mock dependencies

3. **Maintainability**
   - Code is organized and easy to navigate
   - Clear structure for adding new features

4. **Reusability**
   - Service methods can be called from multiple routes
   - Repository methods can be used by multiple services

5. **Scalability**
   - Easy to add new features without breaking existing code
   - Can add caching, logging, etc., at appropriate layers

## Example Usage

### Creating a Product

```javascript
// Route receives request
POST /api/products
Body: { name: "Laptop", price: 999, category: "Electronics", stock: 50 }

// Route calls Service
productService.createProduct(req.body)

// Service validates and calls Repository
productRepository.create(validatedData)

// Repository saves to Database
Product.save()
```

### Stock Deduction with Business Logic

```javascript
// Route receives request
PUT / api / products / 123 / deduction;
Body: {
   quantity: 5;
}

// Route calls Service
productService.deductStock("123", 5);

// Service checks availability first
productRepository.hasStock("123", 5);

// Service proceeds with deduction
productRepository.deductStock("123", 5);
```

## Error Handling

- **400 Bad Request**: Validation errors, insufficient stock
- **404 Not Found**: Product doesn't exist
- **500 Internal Server Error**: Unexpected server errors

All errors include descriptive messages for debugging.

## Future Enhancements

Possible additions to the service layer:

- Product search functionality
- Bulk operations (create/update multiple products)
- Product pricing strategies
- Discount calculations
- Product recommendations
- Inventory forecasting
- Integration with external services
