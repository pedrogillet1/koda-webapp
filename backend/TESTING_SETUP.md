# Testing Setup Guide

## ✅ Build Status: SUCCESSFUL

TypeScript compilation completed without errors!

---

## 🔧 Prerequisites Before Testing

To fully test the backend, you need to configure the following services:

### 1. **PostgreSQL Database** (REQUIRED for all tests)

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL (if not installed)
# Windows: Download from https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql

# Create database
createdb koda_db

# Update .env with your credentials:
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/koda_db?schema=public"
```

**Option B: Use SQLite for quick testing** (Alternative)
```bash
# Install Prisma SQLite adapter
npm install @prisma/adapter-sqlite better-sqlite3
# Then update DATABASE_URL in .env to:
# DATABASE_URL="file:./dev.db"
```

### 2. **Redis** (REQUIRED for document processing)

**Option A: Local Redis**
```bash
# Windows: Download from https://github.com/microsoftarchive/redis/releases
# Mac: brew install redis && brew services start redis
# Linux: sudo apt-get install redis-server && sudo service redis-server start

# Redis should be running on localhost:6379 (default)
```

**Option B: Skip Redis for basic auth testing**
- You can test auth endpoints without Redis
- Document upload will fail without Redis

### 3. **Google Cloud Storage** (OPTIONAL - for document upload testing)

**To test document upload:**
1. Create GCS bucket in Google Cloud Console
2. Download service account JSON key
3. Update `.env`:
```bash
GCS_BUCKET_NAME=your-bucket-name
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILE=./gcp-service-account.json
```

**To skip GCS:**
- Auth and basic endpoints will work
- Document upload will fail without GCS

### 4. **Google OAuth** (OPTIONAL - for OAuth testing)

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Update `.env`:
```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 🚀 Quick Start (Minimal Setup)

### For Authentication Testing Only:

1. **Setup PostgreSQL** (see above)

2. **Update .env with database credentials**

3. **Run migrations:**
```bash
cd backend
npm run prisma:migrate
npm run prisma:generate
```

4. **Start server:**
```bash
npm run dev
```

5. **Test endpoints** (see below)

---

## 📋 What Can Be Tested Without Full Setup

| Feature | Requires PostgreSQL | Requires Redis | Requires GCS | Requires OAuth |
|---------|-------------------|----------------|--------------|----------------|
| Health Check | ❌ | ❌ | ❌ | ❌ |
| User Registration | ✅ | ❌ | ❌ | ❌ |
| Login | ✅ | ❌ | ❌ | ❌ |
| 2FA Setup | ✅ | ❌ | ❌ | ❌ |
| Google OAuth | ✅ | ❌ | ❌ | ✅ |
| Document Upload | ✅ | ✅ | ✅ | ❌ |
| Folders | ✅ | ❌ | ❌ | ❌ |
| Tags | ✅ | ❌ | ❌ | ❌ |
| Document Listing | ✅ | ❌ | ❌ | ❌ |

---

## 🧪 Testing Commands

### 1. Start the Server
```bash
cd backend
npm run dev
```

Expected output:
```
🚀 Server is running on http://localhost:5000
📝 Environment: development
🔗 Health check: http://localhost:5000/health
✅ Redis connected
⚙️  Background workers initialized
```

### 2. Test Health Check (No setup required)
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{"status":"OK","message":"Server is running"}
```

### 3. Test User Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### 4. Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

Save the `accessToken` from the response for authenticated requests.

### 5. Test 2FA Enable (Requires authentication)
```bash
curl -X POST http://localhost:5000/api/auth/2fa/enable \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6. Test Create Folder
```bash
curl -X POST http://localhost:5000/api/folders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Documents"}'
```

### 7. Test Create Tag
```bash
curl -X POST http://localhost:5000/api/tags \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "important", "color": "#FF0000"}'
```

---

## ⚠️ Common Issues

### Error: "Missing environment variable: DATABASE_URL"
- Update `.env` with valid PostgreSQL connection string

### Error: "Redis connection error"
- Install and start Redis, OR
- Comment out Redis-dependent features for basic testing

### Error: "GCS bucket not found"
- Create GCS bucket and configure credentials, OR
- Test only non-document features

### Error: "Port 5000 already in use"
- Change PORT in `.env` to a different port (e.g., 5001)

---

## 🎯 Recommended Testing Order

1. ✅ **Health check** (no setup)
2. ✅ **User registration** (needs PostgreSQL)
3. ✅ **Login** (needs PostgreSQL)
4. ✅ **Create folder** (needs PostgreSQL + auth token)
5. ✅ **Create tag** (needs PostgreSQL + auth token)
6. ✅ **2FA setup** (needs PostgreSQL + auth token)
7. ✅ **Document upload** (needs PostgreSQL + Redis + GCS + auth token)

---

## 📝 Next Steps

Once you have the required services configured:

1. Run `npm run prisma:migrate` to create database tables
2. Run `npm run dev` to start the server
3. Use the curl commands above or Postman/Insomnia to test endpoints
4. Check server logs for any errors

Let me know which services you have available, and I can help you test accordingly!
