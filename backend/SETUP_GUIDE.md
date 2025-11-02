# KODA Critical Features - Setup Guide

This guide will walk you through setting up and deploying the new critical features.

---

## Prerequisites

- Node.js 16+ installed
- PostgreSQL or SQLite database configured
- Redis server (for session storage)
- Pinecone account with API key
- Google Gemini API key

---

## Step 1: Install Dependencies

```bash
cd backend
npm install ioredis redis
```

---

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```env
# Existing variables
DATABASE_URL="your-database-url"
GEMINI_API_KEY="your-gemini-api-key"
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_INDEX_NAME="koda-gemini"

# NEW: Redis for session storage
REDIS_URL="redis://localhost:6379"

# Optional: Redis password if required
# REDIS_PASSWORD="your-redis-password"
```

---

## Step 3: Start Redis Server

### Option A: Local Redis (Development)

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**
Download Redis from: https://github.com/microsoftarchive/redis/releases
Or use Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
```

### Option B: Cloud Redis (Production)

Recommended services:
- **Redis Labs** (https://redis.com/) - Free tier available
- **Upstash** (https://upstash.com/) - Serverless Redis
- **AWS ElastiCache** - Production-grade Redis

Update your `.env` with the cloud Redis URL:
```env
REDIS_URL="redis://username:password@your-redis-host:6379"
```

---

## Step 4: Run Database Migration

```bash
# Generate migration for new schema changes
npx prisma migrate dev --name add-session-and-metadata-enhancements

# Generate Prisma client
npx prisma generate
```

### What This Does

The migration will:
1. Add `Session` and `SessionDocument` tables
2. Add metadata fields to `DocumentMetadata`:
   - `author`, `creationDate`, `modificationDate`
   - `language`, `characterCount`
   - `topics`, `keyEntities`
   - `hasSignature`, `hasTables`, `hasImages`

---

## Step 5: Update app.ts

Find your `src/app.ts` (or `src/server.ts`) and add the session routes:

```typescript
// Import session routes
import sessionRoutes from './routes/session.routes';

// ... existing imports and middleware ...

// Register routes (add this with your other routes)
app.use('/api/sessions', sessionRoutes);

// ... rest of your app setup ...
```

**Full example:**

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.routes';
import documentRoutes from './routes/document.routes';
import chatRoutes from './routes/chat.routes';
import sessionRoutes from './routes/session.routes'; // NEW

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/sessions', sessionRoutes); // NEW

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;
```

---

## Step 6: Verify Redis Connection

Create a test script `test-redis.ts`:

```typescript
import Redis from 'ioredis';

async function testRedis() {
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    await redis.set('test-key', 'Hello Redis!');
    const value = await redis.get('test-key');

    console.log('✅ Redis connection successful!');
    console.log('Test value:', value);

    await redis.del('test-key');
    await redis.disconnect();
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  }
}

testRedis();
```

Run it:
```bash
npx ts-node test-redis.ts
```

---

## Step 7: Start the Server

```bash
npm run dev
```

You should see:
```
✅ [SessionStorage] Redis connected successfully
✅ [Pinecone] Initialized successfully with index: "koda-gemini"
🚀 Server running on port 3000
```

---

## Step 8: Test the API

### Test 1: Create a Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "session": {
    "sessionId": "abc-123-def-456",
    "userId": "user-id",
    "createdAt": "2025-11-01T...",
    "expiresAt": "2025-11-02T...",
    "documentCount": 0,
    "documentIds": []
  }
}
```

### Test 2: Upload a Document to Session

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@path/to/document.pdf"
```

Expected response:
```json
{
  "success": true,
  "documentId": "doc-xyz-789",
  "filename": "document.pdf",
  "metadata": {
    "wordCount": 1500,
    "pageCount": 5,
    "language": "en"
  }
}
```

### Test 3: Query the Session

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is this document about?",
    "topK": 5
  }'
```

Expected response:
```json
{
  "success": true,
  "answer": "This document discusses...",
  "results": [
    {
      "documentId": "doc-xyz-789",
      "filename": "document.pdf",
      "content": "Relevant chunk text...",
      "similarity": 0.87
    }
  ],
  "documentCount": 1
}
```

### Test 4: Compare Documents

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/compare \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc-id-1", "doc-id-2"],
    "comparisonType": "full"
  }'
```

### Test 5: Save to Library

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/save \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "folderId": "folder-id-optional"
  }'
```

---

## Step 9: Monitor Redis (Optional)

### Using Redis CLI

```bash
redis-cli

# View all session keys
127.0.0.1:6379> KEYS session:*

# View session data
127.0.0.1:6379> GET session:abc-123-def-456

# View all document keys
127.0.0.1:6379> KEYS session_doc:*

# Monitor all commands in real-time
127.0.0.1:6379> MONITOR
```

### Using Redis Commander (GUI)

```bash
npm install -g redis-commander
redis-commander
```

Then open: http://localhost:8081

---

## Troubleshooting

### Issue: Redis connection error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:**
1. Verify Redis is running: `redis-cli ping` (should return `PONG`)
2. Check REDIS_URL in `.env`
3. Restart Redis: `brew services restart redis` (macOS) or `sudo systemctl restart redis` (Linux)

---

### Issue: Session not found

**Error:** `Session not found`

**Possible causes:**
1. Session expired (24-hour TTL)
2. Redis was restarted (in-memory data lost)
3. Wrong session ID

**Solution:**
- Create a new session
- Consider using Redis persistence: https://redis.io/docs/management/persistence/

---

### Issue: Prisma migration error

**Error:** `Migration failed`

**Solution:**
```bash
# Reset database (⚠️ WARNING: This deletes all data!)
npx prisma migrate reset

# Or create a new migration
npx prisma migrate dev --name add-session-models
```

---

### Issue: Out of memory (Redis)

**Error:** `OOM command not allowed`

**Solution:**
1. Configure Redis max memory:
```bash
# Edit redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

2. Restart Redis

---

## Production Deployment

### 1. Use Cloud Redis

Don't use local Redis in production. Use:
- **Redis Labs** (recommended)
- **AWS ElastiCache**
- **Upstash** (serverless)

### 2. Configure Redis Persistence

Enable AOF (Append-Only File) for durability:

```bash
# redis.conf
appendonly yes
appendfsync everysec
```

### 3. Set Up Redis Monitoring

Use Redis monitoring tools:
- Redis Insight (free)
- Datadog
- New Relic

### 4. Configure Session Cleanup Job

Add a cron job to clean up expired sessions:

```typescript
// src/jobs/sessionCleanup.job.ts
import cron from 'node-cron';
import Redis from 'ioredis';

// Run every hour
cron.schedule('0 * * * *', async () => {
  const redis = new Redis(process.env.REDIS_URL);

  // Get all session keys
  const sessionKeys = await redis.keys('session:*');

  // Check each session for expiration
  for (const key of sessionKeys) {
    const ttl = await redis.ttl(key);
    if (ttl < 0) {
      // Session expired, delete it
      await redis.del(key);
      console.log(`Cleaned up expired session: ${key}`);
    }
  }

  await redis.disconnect();
});
```

### 5. Enable Redis Security

```bash
# redis.conf
requirepass your-strong-password
```

Update `.env`:
```env
REDIS_URL="redis://:your-strong-password@your-redis-host:6379"
```

---

## Performance Optimization

### 1. Redis Connection Pooling

```typescript
// src/config/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  // Connection pooling
  enableOfflineQueue: true,
  connectTimeout: 10000,
});

export default redis;
```

### 2. Compression for Large Documents

```typescript
import zlib from 'zlib';

// Compress before storing
const compressed = zlib.gzipSync(JSON.stringify(document));
await redis.set(key, compressed);

// Decompress when retrieving
const data = await redis.getBuffer(key);
const decompressed = zlib.gunzipSync(data).toString();
const document = JSON.parse(decompressed);
```

### 3. Batch Operations

```typescript
// Use pipeline for multiple operations
const pipeline = redis.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.set('key3', 'value3');
await pipeline.exec();
```

---

## Next Steps

1. ✅ Complete setup
2. ✅ Test all endpoints
3. 🔲 Update frontend to use session APIs
4. 🔲 Add session UI components
5. 🔲 Deploy to production
6. 🔲 Monitor and optimize

---

## Support

For issues or questions:
- Check the implementation summary: `IMPLEMENTATION_SUMMARY.md`
- Review the code in `src/services/` and `src/controllers/`
- Test with the provided curl commands

---

## Summary

You've successfully set up:

✅ Session-based document analysis
✅ Multi-document comparison
✅ Advanced metadata extraction
✅ Advanced search filters

All features are production-ready and integrated with KODA!
