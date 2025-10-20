# User Service - Architecture Documentation

## Overview

The User Service handles user authentication and management with a clean 3-tier architecture pattern.

## Architecture Layers

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP Request/Response handling
│     (routes/user.js)                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Service Layer               │  ← Business Logic & Authentication
│   (services/userService.js)         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       Repository Layer              │  ← Data Access Logic
│  (repositories/userRepository.js)   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Model Layer                 │  ← Database Schema + Password Hashing
│     (models/user.js)                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Database Layer                 │  ← MongoDB Connection
│     (config/database.js)            │
└─────────────────────────────────────┘
```

## API Endpoints

### Authentication

- `POST /api/users/register` - Register new user

   ```json
   {
      "name": "John Doe",
      "email": "john@example.com",
      "password": "password123"
   }
   ```

   Response:

   ```json
   {
      "user": { "id": "...", "name": "John Doe", "email": "john@example.com" },
      "token": "jwt_token_here"
   }
   ```

- `POST /api/users/login` - Login user
   ```json
   {
      "email": "john@example.com",
      "password": "password123"
   }
   ```
   Response:
   ```json
   {
      "user": { "id": "...", "name": "John Doe", "email": "john@example.com" },
      "token": "jwt_token_here"
   }
   ```

### User Management

- `GET /api/users/:userId` - Get user by ID
- `GET /api/users` - Get all users
- `PUT /api/users/:userId` - Update user profile
   ```json
   {
      "name": "John Updated",
      "email": "newemail@example.com"
   }
   ```

### Password Management

- `POST /api/users/:userId/change-password` - Change password
   ```json
   {
      "currentPassword": "oldpass123",
      "newPassword": "newpass456"
   }
   ```

### User Operations

- `DELETE /api/users/:userId` - Delete user
- `POST /api/users/verify-token` - Verify JWT token
   ```json
   {
      "token": "jwt_token_here"
   }
   ```

## Service Layer Methods

### UserService

- `register(name, email, password)` - Register user with validation
- `login(email, password)` - Authenticate user
- `getUserById(userId)` - Get user details
- `getAllUsers()` - Get all users (without passwords)
- `updateProfile(userId, updateData)` - Update user profile
- `changePassword(userId, currentPassword, newPassword)` - Change password
- `deleteUser(userId)` - Delete user account
- `verifyToken(token)` - Verify JWT token
- `generateToken(userId)` - Generate JWT token
- `isValidEmail(email)` - Validate email format
- `getUserByEmail(email)` - Get user by email

## Repository Layer Methods

### UserRepository

- `create(userData)` - Create new user
- `findByEmail(email)` - Find user by email
- `findById(userId)` - Find user by ID
- `findAll()` - Find all users (without passwords)
- `update(userId, updateData)` - Update user
- `delete(userId)` - Delete user
- `emailExists(email)` - Check if email exists
- `updatePassword(userId, newPassword)` - Update password

## Key Features

### 1. Secure Authentication

- Password hashing with Argon2
- JWT token generation
- Token verification
- 1-hour token expiration

### 2. Input Validation

- Email format validation
- Password length requirements (min 6 characters)
- Required field validation
- Duplicate email prevention

### 3. Password Management

- Automatic password hashing (model pre-save hook)
- Current password verification for changes
- Secure password update process

### 4. User Privacy

- Passwords excluded from query results
- Safe profile updates (can't update password via profile endpoint)
- Token-based authentication

### 5. Comprehensive Error Handling

- Descriptive error messages
- Appropriate HTTP status codes
- Validation error handling

## Security Features

### Password Hashing

- Uses Argon2 (industry-standard)
- Automatic hashing on user creation and password updates
- Pre-save hook in User model

### JWT Authentication

- Tokens expire after 1 hour
- User ID embedded in token
- Token verification endpoint

### Data Protection

- Passwords never returned in API responses
- Email uniqueness enforced at database level
- Validation before database operations

## Business Rules

1. **Registration**
   - Name, email, and password required
   - Email must be valid format
   - Password must be at least 6 characters
   - Email must be unique

2. **Login**
   - Email and password required
   - Password verified with Argon2
   - JWT token generated on success

3. **Profile Updates**
   - Cannot update password through profile endpoint
   - Email must be unique if changed
   - User must exist

4. **Password Changes**
   - Current password must be correct
   - New password must meet requirements
   - Uses separate endpoint for security

## Error Handling

- **400 Bad Request**: Validation errors, duplicate emails, invalid credentials
- **401 Unauthorized**: Invalid or expired tokens
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server errors

## Usage Examples

### Register User

```bash
POST /api/users/register
{
  "name": "Alice Smith",
  "email": "alice@example.com",
  "password": "securepass123"
}
```

Response:

```json
{
   "user": {
      "id": "user123",
      "name": "Alice Smith",
      "email": "alice@example.com"
   },
   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login

```bash
POST /api/users/login
{
  "email": "alice@example.com",
  "password": "securepass123"
}
```

### Change Password

```bash
POST /api/users/user123/change-password
{
  "currentPassword": "securepass123",
  "newPassword": "newsecurepass456"
}
```

### Verify Token

```bash
POST /api/users/verify-token
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response:

```json
{
   "valid": true,
   "userId": "user123"
}
```

## Environment Variables

```env
JWT_SECRET=your_secret_key_here
MONGO_URI=mongodb://localhost:27017/ecommerce-users
PORT=5000
```

## Benefits

- ✅ **Secure Authentication** - Argon2 password hashing, JWT tokens
- ✅ **Input Validation** - Email format, password strength
- ✅ **Privacy Protection** - Passwords never exposed in responses
- ✅ **Flexible User Management** - Full CRUD operations
- ✅ **Token Verification** - Verify JWT tokens programmatically
- ✅ **Testable Architecture** - Easy to unit test each layer

---

**Last Updated:** October 20, 2025
**Version:** 2.0 (3-Tier Architecture)
