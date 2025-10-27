# 3-Tier Architecture Refactoring Plan

## Overview

This document outlines the plan to refactor all microservices to follow the same 3-tier architecture pattern as the product-service.

## Target Architecture Pattern

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP Request/Response
│     (routes/*.js)                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │  ← Business Logic & Validation
│     (services/*Service.js)          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Repository Layer              │  ← Data Access Logic
│  (repositories/*Repository.js)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Model Layer                 │  ← Database Schema
│     (models/*.js)                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Database Layer                 │  ← MongoDB Connection
│     (config/database.js)            │
└─────────────────────────────────────┘
```

## Services to Refactor

### ✅ 1. Product Service (COMPLETED)

- ✅ Database config layer
- ✅ Repository layer
- ✅ Service layer
- ✅ Updated routes
- ✅ Architecture documentation

### 2. User Service

**Current State:** Direct DB access in routes
**Complexity:** Medium (has authentication logic)

**Required Files:**

- `config/database.js` - Database connection management
- `repositories/userRepository.js` - User CRUD operations
- `services/userService.js` - Authentication, validation, JWT handling
- Update `routes/user.js` - Use service layer
- Update `index.js` - Use database config

**Key Features:**

- User registration with password hashing
- User login with JWT token generation
- Password validation with argon2
- User profile management

### 3. Order Service

**Current State:** Direct DB access in routes, external API calls
**Complexity:** High (integrates with product service, complex business logic)

**Required Files:**

- `config/database.js` - Database connection management
- `repositories/orderRepository.js` - Order CRUD operations
- `services/orderService.js` - Order creation logic, product service integration
- Update `routes/order.js` - Use service layer
- Update `index.js` - Use database config

**Key Features:**

- Order creation with item validation
- Stock checking via product service
- Bulk stock deduction
- Order status management
- Total amount calculation

### 4. Payment Service

**Current State:** Direct DB access in routes
**Complexity:** Medium

**Required Files:**

- `config/database.js` - Database connection management
- `repositories/paymentRepository.js` - Payment CRUD operations
- `services/paymentService.js` - Payment processing logic, validation
- Update `routes/payment.js` - Use service layer
- Update `index.js` - Use database config

**Key Features:**

- Payment processing
- Payment status tracking
- Order association
- Payment validation

### 5. Shopping Cart Service

**Current State:** Direct DB access in routes
**Complexity:** Medium

**Required Files:**

- `config/database.js` - Database connection management
- `repositories/cartRepository.js` - Cart CRUD operations
- `services/cartService.js` - Cart management logic
- Update `routes/cart.js` - Use service layer
- Update `index.js` - Use database config

**Key Features:**

- Add/remove items from cart
- Update item quantities
- Clear cart
- Get cart by user

### 6. Notification Service

**Current State:** No database, has email and SMS services
**Complexity:** Low (no database)

**Required Files:**

- `services/notificationService.js` - Notification orchestration
- Update `routes/notification.js` - Use service layer
- Keep existing `services/emailService.js` and `services/smsService.js`

**Key Features:**

- Email notifications
- SMS notifications
- Unified notification interface

## Implementation Order

### Phase 1: Simple Services (Week 1)

1. ✅ Product Service (DONE)
2. Shopping Cart Service
3. Payment Service

### Phase 2: Medium Complexity (Week 2)

4. User Service (authentication complexity)
5. Notification Service (refactor only)

### Phase 3: Complex Service (Week 3)

6. Order Service (external dependencies, complex logic)

## Refactoring Checklist Template

For each service, complete these steps:

### Step 1: Create Database Configuration

- [ ] Create `config/database.js` with connection pooling
- [ ] Add singleton pattern for connection management
- [ ] Include graceful disconnect
- [ ] Configure connection options (pool size, timeouts)

### Step 2: Create Repository Layer

- [ ] Create `repositories/*Repository.js`
- [ ] Implement CRUD operations
- [ ] Add JSDoc documentation
- [ ] Include error handling
- [ ] Export as singleton

### Step 3: Create Service Layer

- [ ] Create `services/*Service.js`
- [ ] Implement business logic
- [ ] Add input validation
- [ ] Add JSDoc documentation
- [ ] Handle external service calls (if any)
- [ ] Export as singleton

### Step 4: Update Routes

- [ ] Remove direct model imports
- [ ] Import service layer
- [ ] Update all route handlers to use service methods
- [ ] Improve error handling with proper HTTP status codes
- [ ] Add request validation

### Step 5: Update Index.js

- [ ] Import database config instead of mongoose directly
- [ ] Use database.connect()
- [ ] Add graceful shutdown handlers
- [ ] Remove direct mongoose connection code

### Step 6: Documentation

- [ ] Create `ARCHITECTURE.md` for the service
- [ ] Document all API endpoints
- [ ] Include usage examples
- [ ] Document error responses

### Step 7: Testing

- [ ] Test all endpoints
- [ ] Verify error handling
- [ ] Check backward compatibility
- [ ] Test graceful shutdown

## Benefits of Refactoring

### 1. Separation of Concerns

- Routes handle HTTP only
- Services handle business logic
- Repositories handle data access
- Clear boundaries between layers

### 2. Testability

- Each layer can be tested independently
- Easy to mock dependencies
- Better unit test coverage

### 3. Maintainability

- Easier to locate and fix bugs
- Clear structure for new developers
- Consistent patterns across services

### 4. Reusability

- Service methods can be reused across routes
- Repository methods can be used by multiple services
- Reduces code duplication

### 5. Scalability

- Easy to add new features
- Can add caching at service layer
- Can add logging at any layer
- Easy to swap implementations

## Code Standards

### Naming Conventions

- Files: camelCase (e.g., `userService.js`, `orderRepository.js`)
- Classes: PascalCase (e.g., `UserService`, `OrderRepository`)
- Methods: camelCase (e.g., `createUser`, `findById`)
- Constants: UPPER_SNAKE_CASE (e.g., `PRODUCT_SERVICE_URI`)

### Error Handling

- Throw descriptive errors in repositories
- Catch and handle errors in services
- Return appropriate HTTP status codes in routes
- Include error messages for debugging

### Documentation

- Add JSDoc comments for all public methods
- Include parameter types and return types
- Add usage examples for complex methods
- Document business rules

### Singleton Pattern

```javascript
class ServiceName {
   // Implementation
}

module.exports = new ServiceName();
```

## Migration Strategy

### For Each Service:

1. **Create new files** (don't delete old ones yet)
2. **Test new implementation** alongside old one
3. **Switch routes** to use new service layer
4. **Verify functionality** with existing tests
5. **Remove old code** once verified
6. **Update documentation**

### Rollback Plan

- Keep git commits small and focused
- Tag working versions before major changes
- Maintain backward compatibility during transition
- Can revert individual services if needed

## Timeline

| Week | Services                               | Status      |
| ---- | -------------------------------------- | ----------- |
| 1    | Product (done), Shopping Cart, Payment | In Progress |
| 2    | User, Notification                     | Planned     |
| 3    | Order                                  | Planned     |
| 4    | Testing & Documentation                | Planned     |

## Success Metrics

- [ ] All services follow consistent 3-tier architecture
- [ ] All API endpoints work without breaking changes
- [ ] Improved code coverage with unit tests
- [ ] Architecture documentation for each service
- [ ] No regression in functionality
- [ ] Improved error messages and handling

## Next Steps

1. Start with Shopping Cart Service (simplest remaining)
2. Create database config
3. Create repository layer
4. Create service layer
5. Update routes and index.js
6. Test and document
7. Move to next service

---

**Last Updated:** October 20, 2025
**Status:** In Progress (1/6 services completed)
