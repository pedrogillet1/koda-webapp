# Koda Backend API

Secure document management system backend with AI-powered features.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and update the values:
```bash
cp .env.example .env
```

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_ACCESS_SECRET`: Secret for access tokens
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `FRONTEND_URL`: Frontend application URL
- `ENCRYPTION_KEY`: 32-character encryption key

### 3. Setup Database

**Option 1: Local PostgreSQL**
```bash
# Install PostgreSQL and create database
createdb koda_db

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://username:password@localhost:5432/koda_db?schema=public"
```

**Option 2: Google Cloud SQL**
1. Create PostgreSQL instance in Google Cloud Console
2. Create database named `koda_db`
3. Update DATABASE_URL with Cloud SQL connection string

### 4. Run Migrations
```bash
npm run prisma:migrate
npm run prisma:generate
```

### 5. Start Development Server
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "createdAt": "2024-10-03T00:00:00.000Z"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "requires2FA": false
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

#### Logout
```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

### Google OAuth

#### Initiate Google OAuth
```http
GET /api/auth/google
```
Redirects to Google login page.

#### OAuth Callback
```http
GET /api/auth/google/callback
```
Automatically called by Google after authentication.

### Two-Factor Authentication (2FA)

#### Enable 2FA (Requires Authentication)
```http
POST /api/auth/2fa/enable
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "message": "Scan the QR code with your authenticator app",
  "secret": "BASE32SECRET",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["XXXXXXXX", "XXXXXXXX", ...]
}
```

#### Verify and Activate 2FA
```http
POST /api/auth/2fa/verify
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "token": "123456"
}
```

#### Verify 2FA During Login
```http
POST /api/auth/2fa/verify-login
Content-Type: application/json

{
  "userId": "uuid",
  "token": "123456"
}
```

#### Disable 2FA
```http
POST /api/auth/2fa/disable
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "password": "SecurePass123!"
}
```

#### Get Backup Codes
```http
GET /api/auth/2fa/backup-codes
Authorization: Bearer {accessToken}
```

## Testing with Postman/Insomnia

### 1. Import Collection
Create a new collection with the following requests:

### 2. Test Flow

**Step 1: Register a new user**
```
POST http://localhost:5000/api/auth/register
Body: {
  "email": "test@example.com",
  "password": "Test123!@#"
}
```

**Step 2: Login**
```
POST http://localhost:5000/api/auth/login
Body: {
  "email": "test@example.com",
  "password": "Test123!@#"
}
```
Save the `accessToken` and `refreshToken` from response.

**Step 3: Enable 2FA**
```
POST http://localhost:5000/api/auth/2fa/enable
Headers: {
  "Authorization": "Bearer {accessToken}"
}
```
Scan the QR code with Google Authenticator or Authy app.

**Step 4: Verify 2FA**
```
POST http://localhost:5000/api/auth/2fa/verify
Headers: {
  "Authorization": "Bearer {accessToken}"
}
Body: {
  "token": "123456"  // From authenticator app
}
```

**Step 5: Test 2FA Login**
```
POST http://localhost:5000/api/auth/login
Body: {
  "email": "test@example.com",
  "password": "Test123!@#"
}
```
Then verify with 2FA:
```
POST http://localhost:5000/api/auth/2fa/verify-login
Body: {
  "userId": "{userId from login response}",
  "token": "123456"
}
```

**Step 6: Refresh Token**
```
POST http://localhost:5000/api/auth/refresh
Body: {
  "refreshToken": "{refreshToken}"
}
```

**Step 7: Logout**
```
POST http://localhost:5000/api/auth/logout
Body: {
  "refreshToken": "{refreshToken}"
}
```

## Security Features

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

### Rate Limiting
- Auth endpoints: 5 requests per 15 minutes
- 2FA verification: 3 attempts per 15 minutes
- General API: 100 requests per 15 minutes

### Token Expiry
- Access Token: 15 minutes
- Refresh Token: 7 days

### Encryption
- Passwords: bcrypt with 12 rounds + random salt
- 2FA secrets: AES-256-GCM encryption
- Refresh tokens: SHA-256 hashing

## Database Schema

### Users Table
- id (UUID)
- email (unique)
- passwordHash (nullable for OAuth users)
- salt (nullable for OAuth users)
- googleId (nullable, unique)
- isEmailVerified (boolean)
- createdAt, updatedAt

### Sessions Table
- id (UUID)
- userId (foreign key)
- refreshTokenHash
- expiresAt
- createdAt

### TwoFactorAuth Table
- id (UUID)
- userId (foreign key, unique)
- secret (encrypted)
- backupCodes (encrypted array)
- isEnabled (boolean)
- createdAt, updatedAt

## Error Handling

All errors return JSON with `error` field:

```json
{
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Prisma Studio (database GUI)
npm run prisma:studio

# Generate Prisma client
npm run prisma:generate

# Create new migration
npm run prisma:migrate
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

## Next Steps

Phase 1 (Authentication) is complete! ✅

**Completed Features:**
- ✅ User registration with password validation
- ✅ Login with JWT tokens
- ✅ Refresh token system
- ✅ Two-factor authentication (TOTP)
- ✅ Google OAuth 2.0
- ✅ Rate limiting
- ✅ Password hashing with bcrypt
- ✅ Encryption for sensitive data

**Ready for Phase 2:**
- Frontend authentication screens (React)
- Login/Register UI
- 2FA setup UI
- OAuth integration in frontend
