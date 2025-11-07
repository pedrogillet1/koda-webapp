# 🚀 KODA Supabase Migration Guide

**Last Updated**: November 7, 2025
**Estimated Time**: 45 minutes
**Difficulty**: Intermediate

---

## 📋 Prerequisites

- ✅ Supabase project created
- ✅ Connection strings copied (done!)
- ✅ Backup of current database (if you have data)

---

## 🎯 Migration Steps

### Step 1: Update Prisma Schema (5 minutes)

#### 1.1 Open `backend/prisma/schema.prisma`

#### 1.2 Change datasource from SQLite to PostgreSQL:

**Find:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Replace with:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

#### 1.3 Update all `@default(uuid())` to PostgreSQL native:

**Find all instances of:**
```prisma
id String @id @default(uuid())
```

**Replace with:**
```prisma
id String @id @default(dbgenerated("gen_random_uuid()"))
```

**Files to check:**
- Every model in `schema.prisma` that uses `@default(uuid())`

**Tip**: Use Find & Replace in VSCode:
- Find: `@default(uuid())`
- Replace: `@default(dbgenerated("gen_random_uuid()"))`

#### 1.4 Update BigInt fields (if any):

PostgreSQL handles `BigInt` better than SQLite. No changes needed for KODA's schema.

#### 1.5 Save the file

---

### Step 2: Update Environment Variables (2 minutes)

#### 2.1 Open `backend/.env`

#### 2.2 Replace the DATABASE_URL line:

**Before:**
```bash
DATABASE_URL="file:./test.db"
```

**After:**
```bash
# Supabase Database (Production)
DATABASE_URL="postgresql://postgres.vedmigwawogulttcscsea:Koda123!@#@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (for migrations)
DIRECT_URL="postgresql://postgres.vedmigwawogulttscsea:Koda123!@#@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
```

#### 2.3 Add Supabase API keys:

```bash
# Supabase API Keys
SUPABASE_URL="https://vedmigwawogulttscsea.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZG1pZ3dhd29ndWx0dHNjc2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NzkwMzYsImV4cCI6MjA3ODA1NTAzNn0.qb07_MuxRczwN8JcjkKajRNqGkVw_UMFNYxQnxMCw-w"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZG1pZ3dhd29ndWx0dHNjc2VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ3OTAzNiwiZXhwIjoyMDc4MDU1MDM2fQ.fgytK59XDUtmjK9sIpoPdmvu0IUgBKtgD7UC76oGurw"
```

#### 2.4 Save the file

---

### Step 3: Generate and Apply Migration (10 minutes)

#### 3.1 Open terminal in `C:\Users\Pedro\desktop\webapp\backend`

#### 3.2 Install Prisma dependencies (if not already):

```bash
npm install @prisma/client
npm install -D prisma
```

#### 3.3 Generate Prisma Client with new schema:

```bash
npx prisma generate
```

**Expected output:**
```
✔ Generated Prisma Client (5.x.x | library) to ./node_modules/@prisma/client
```

#### 3.4 Create initial migration:

```bash
npx prisma migrate dev --name init_supabase
```

**What this does:**
1. Reads your `schema.prisma`
2. Connects to Supabase using `DIRECT_URL`
3. Creates migration files in `prisma/migrations/`
4. Applies migration to Supabase database
5. Generates Prisma Client

**Expected output:**
```
Applying migration `20250107000000_init_supabase`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20250107000000_init_supabase/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (5.x.x | library) to ./node_modules/@prisma/client
```

#### 3.5 Verify migration:

```bash
npx prisma migrate status
```

**Expected output:**
```
Database schema is up to date!
```

---

### Step 4: Verify Database in Supabase (3 minutes)

#### 4.1 Go to Supabase Dashboard

1. Open https://supabase.com/dashboard/project/vedmigwawogulttscsea
2. Click **Table Editor** in left sidebar

#### 4.2 You should see all your tables:

**Core Tables:**
- ✅ `users`
- ✅ `sessions`
- ✅ `two_factor_auth`
- ✅ `verification_codes`
- ✅ `documents`
- ✅ `document_metadata`
- ✅ `folders`
- ✅ `tags`
- ✅ `document_tags`
- ✅ `conversations`
- ✅ `messages`
- ✅ `reminders`
- ✅ `notifications`
- ✅ `user_preferences`
- ✅ `cloud_integrations`
- ✅ `audit_logs`
- ✅ `action_history`
- ✅ `document_shares`
- ✅ `terminology_maps`

#### 4.3 Check table structure:

Click on `users` table → you should see columns:
- `id` (uuid)
- `email` (text)
- `first_name` (text)
- `last_name` (text)
- `password_hash` (text)
- etc.

---

### Step 5: Test Connection Locally (5 minutes)

#### 5.1 Stop your current backend server:

```bash
# Press Ctrl+C in your terminal
```

#### 5.2 Start backend with Supabase:

```bash
cd C:\Users\Pedro\desktop\webapp\backend
npm run dev
```

#### 5.3 Check logs for successful connection:

**Look for:**
```
✅ [Prisma] Connected to PostgreSQL database
🚀 Server is running on http://localhost:5000
```

**If you see connection errors:**
- Check your `DATABASE_URL` is correct
- Check your Supabase password has no typos
- Check your internet connection

#### 5.4 Test a simple query:

Open Prisma Studio:
```bash
npx prisma studio
```

This should open http://localhost:5555 with a UI to browse your database.

**If it works**: ✅ Migration successful!

---

### Step 6: Add Analytics Tables (10 minutes)

Now let's add the analytics tables we designed earlier.

#### 6.1 Create analytics migration:

```bash
npx prisma migrate create --name add_analytics_tables
```

This creates an empty migration file.

#### 6.2 Open the generated migration file:

```bash
# File location:
prisma/migrations/[timestamp]_add_analytics_tables/migration.sql
```

#### 6.3 Copy and paste this SQL:

```sql
-- AnalyticsEvent: Track all user interactions
CREATE TABLE "analytics_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL, -- 'page_view', 'button_click', 'query', etc.
  "event_name" TEXT NOT NULL, -- Specific event name
  "event_data" JSONB, -- Additional event metadata
  "session_id" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "referrer" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- QueryAnalytics: Detailed RAG query metrics
CREATE TABLE "query_analytics" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "query_type" TEXT NOT NULL, -- 'regular', 'comparison', 'file_action', etc.
  "intent" TEXT, -- Detected user intent
  "response_length" INTEGER,
  "response_time_ms" INTEGER,
  "sources_used" INTEGER, -- Number of RAG sources retrieved
  "embeddings_generated" INTEGER,
  "llm_model" TEXT, -- e.g., 'gemini-2.5-flash'
  "llm_tokens_input" INTEGER,
  "llm_tokens_output" INTEGER,
  "llm_cost_usd" DECIMAL(10, 6),
  "user_satisfaction" INTEGER, -- 1-5 rating (if provided)
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "query_analytics_pkey" PRIMARY KEY ("id")
);

-- DocumentAnalytics: Document usage tracking
CREATE TABLE "document_analytics" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- 'upload', 'view', 'query', 'download', 'delete'
  "query_count" INTEGER DEFAULT 0, -- Number of queries made to this document
  "view_count" INTEGER DEFAULT 0,
  "download_count" INTEGER DEFAULT 0,
  "processing_time_ms" INTEGER, -- For uploads
  "file_size_bytes" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "document_analytics_pkey" PRIMARY KEY ("id")
);

-- UserEngagementMetrics: Daily user activity
CREATE TABLE "user_engagement_metrics" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "queries_made" INTEGER DEFAULT 0,
  "documents_uploaded" INTEGER DEFAULT 0,
  "documents_viewed" INTEGER DEFAULT 0,
  "time_spent_seconds" INTEGER DEFAULT 0,
  "sessions_count" INTEGER DEFAULT 0,
  "features_used" JSONB, -- List of features used that day
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_engagement_metrics_pkey" PRIMARY KEY ("id")
);

-- SystemPerformanceMetrics: System health tracking
CREATE TABLE "system_performance_metrics" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "metric_type" TEXT NOT NULL, -- 'api_response_time', 'database_query_time', etc.
  "metric_value" DECIMAL(10, 2) NOT NULL,
  "endpoint" TEXT, -- API endpoint measured
  "status_code" INTEGER,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "system_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- FeatureUsage: Feature adoption tracking
CREATE TABLE "feature_usage" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "feature_name" TEXT NOT NULL, -- 'file_actions', 'comparison', 'folders', etc.
  "usage_count" INTEGER DEFAULT 1,
  "first_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feature_usage_pkey" PRIMARY KEY ("id")
);

-- ConversionFunnel: User journey tracking
CREATE TABLE "conversion_funnel" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT,
  "session_id" TEXT,
  "funnel_stage" TEXT NOT NULL, -- 'landing', 'signup', 'first_upload', 'first_query', etc.
  "completed" BOOLEAN DEFAULT false,
  "time_to_complete_seconds" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversion_funnel_pkey" PRIMARY KEY ("id")
);

-- ErrorLog: Error tracking and debugging
CREATE TABLE "error_log" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT,
  "error_type" TEXT NOT NULL, -- 'api_error', 'database_error', 'llm_error', etc.
  "error_message" TEXT NOT NULL,
  "error_stack" TEXT,
  "endpoint" TEXT,
  "request_data" JSONB,
  "severity" TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  "resolved" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "error_log_pkey" PRIMARY KEY ("id")
);

-- UserRetentionMetrics: Cohort analysis
CREATE TABLE "user_retention_metrics" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "cohort_date" DATE NOT NULL, -- Week/month user signed up
  "cohort_size" INTEGER NOT NULL,
  "period" INTEGER NOT NULL, -- Days since signup (0, 1, 7, 14, 30, etc.)
  "retained_users" INTEGER NOT NULL,
  "retention_rate" DECIMAL(5, 2) NOT NULL, -- Percentage
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_retention_metrics_pkey" PRIMARY KEY ("id")
);

-- ABTest: A/B testing support
CREATE TABLE "ab_test" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "test_name" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "variant" TEXT NOT NULL, -- 'control', 'variant_a', 'variant_b', etc.
  "converted" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ab_test_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "analytics_events_user_id_idx" ON "analytics_events"("user_id");
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events"("event_type");
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

CREATE INDEX "query_analytics_user_id_idx" ON "query_analytics"("user_id");
CREATE INDEX "query_analytics_conversation_id_idx" ON "query_analytics"("conversation_id");
CREATE INDEX "query_analytics_created_at_idx" ON "query_analytics"("created_at");

CREATE INDEX "document_analytics_user_id_idx" ON "document_analytics"("user_id");
CREATE INDEX "document_analytics_document_id_idx" ON "document_analytics"("document_id");
CREATE INDEX "document_analytics_action_idx" ON "document_analytics"("action");

CREATE INDEX "user_engagement_metrics_user_id_idx" ON "user_engagement_metrics"("user_id");
CREATE INDEX "user_engagement_metrics_date_idx" ON "user_engagement_metrics"("date");

CREATE INDEX "system_performance_metrics_metric_type_idx" ON "system_performance_metrics"("metric_type");
CREATE INDEX "system_performance_metrics_created_at_idx" ON "system_performance_metrics"("created_at");

CREATE INDEX "feature_usage_user_id_idx" ON "feature_usage"("user_id");
CREATE INDEX "feature_usage_feature_name_idx" ON "feature_usage"("feature_name");

CREATE INDEX "conversion_funnel_user_id_idx" ON "conversion_funnel"("user_id");
CREATE INDEX "conversion_funnel_funnel_stage_idx" ON "conversion_funnel"("funnel_stage");

CREATE INDEX "error_log_user_id_idx" ON "error_log"("user_id");
CREATE INDEX "error_log_error_type_idx" ON "error_log"("error_type");
CREATE INDEX "error_log_severity_idx" ON "error_log"("severity");
CREATE INDEX "error_log_resolved_idx" ON "error_log"("resolved");

CREATE INDEX "user_retention_metrics_cohort_date_idx" ON "user_retention_metrics"("cohort_date");
CREATE INDEX "user_retention_metrics_period_idx" ON "user_retention_metrics"("period");

CREATE INDEX "ab_test_test_name_idx" ON "ab_test"("test_name");
CREATE INDEX "ab_test_user_id_idx" ON "ab_test"("user_id");

-- Add foreign key constraints
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "query_analytics" ADD CONSTRAINT "query_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "query_analytics" ADD CONSTRAINT "query_analytics_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_analytics" ADD CONSTRAINT "document_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_analytics" ADD CONSTRAINT "document_analytics_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_engagement_metrics" ADD CONSTRAINT "user_engagement_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feature_usage" ADD CONSTRAINT "feature_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ab_test" ADD CONSTRAINT "ab_test_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

#### 6.4 Apply the migration:

```bash
npx prisma migrate deploy
```

**Expected output:**
```
1 migration found in prisma/migrations

Applying migration `20250107000001_add_analytics_tables`

The following migration have been applied:

migrations/
  └─ 20250107000001_add_analytics_tables/
    └─ migration.sql
```

#### 6.5 Verify analytics tables in Supabase:

Go to **Table Editor** and you should now see:
- ✅ `analytics_events`
- ✅ `query_analytics`
- ✅ `document_analytics`
- ✅ `user_engagement_metrics`
- ✅ `system_performance_metrics`
- ✅ `feature_usage`
- ✅ `conversion_funnel`
- ✅ `error_log`
- ✅ `user_retention_metrics`
- ✅ `ab_test`

---

### Step 7: Test Everything (5 minutes)

#### 7.1 Restart your backend:

```bash
npm run dev
```

#### 7.2 Test user registration:

Open your frontend and try creating a new user.

**Check logs:**
```
✅ [Auth] User registered: test@example.com
```

**Check Supabase:**
Go to **Table Editor** → `users` → You should see the new user!

#### 7.3 Test file upload:

Upload a document through your frontend.

**Check Supabase:**
Go to **Table Editor** → `documents` → You should see the new document!

#### 7.4 Test query:

Ask a question in the chat.

**Check Supabase:**
Go to **Table Editor** → `messages` → You should see the new message!

---

## ✅ Migration Complete!

Your KODA app is now running on Supabase! 🎉

**What you've accomplished:**
- ✅ Migrated from SQLite to PostgreSQL
- ✅ Connected to Supabase
- ✅ Added 10 analytics tables
- ✅ Tested core functionality

---

## 🚨 Troubleshooting

### Error: "P1001: Can't reach database server"

**Cause**: Network issue or wrong connection string

**Fix:**
1. Check your internet connection
2. Verify `DATABASE_URL` in `.env` is correct
3. Check Supabase dashboard is accessible
4. Try using `DIRECT_URL` instead of pooler

### Error: "P3009: migrate found failed migrations"

**Cause**: Previous migration failed

**Fix:**
```bash
# Reset migration history
npx prisma migrate resolve --rolled-back "20250107000000_init_supabase"

# Re-apply migration
npx prisma migrate deploy
```

### Error: "Invalid password"

**Cause**: Wrong password in connection string

**Fix:**
1. Go to Supabase → **Settings** → **Database**
2. **Reset Database Password**
3. Copy new password
4. Update `DATABASE_URL` in `.env`

### Error: "Table already exists"

**Cause**: Tables were created manually or migration ran twice

**Fix:**
```bash
# Option 1: Drop all tables and re-migrate
# In Supabase SQL Editor, run:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Then re-run migration:
npx prisma migrate deploy

# Option 2: Mark migration as applied without running
npx prisma migrate resolve --applied "20250107000000_init_supabase"
```

### Backend won't start

**Check:**
1. `DATABASE_URL` is set correctly
2. No typos in connection string
3. Supabase project is running
4. Check logs: `npm run dev`

---

## 📊 Next Steps

1. **Enable Row Level Security (RLS)**
   - Go to Supabase → **Authentication** → **Policies**
   - Create policies to restrict user access to their own data

2. **Set up file storage**
   - Go to Supabase → **Storage**
   - Create bucket: `user-files`
   - Enable encryption (AES-256)

3. **Add analytics tracking**
   - Integrate analytics events in your backend
   - Track user actions, queries, performance

4. **Deploy to Hostinger**
   - Follow `KODA_PRODUCTION_DEPLOYMENT_GUIDE.md`

5. **Test thoroughly**
   - Test all features with Supabase
   - Monitor logs for errors
   - Check analytics data

---

## 🎁 Bonus: Useful SQL Queries

### Check database size:
```sql
SELECT pg_size_pretty(pg_database_size('postgres'));
```

### Check table sizes:
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check user count:
```sql
SELECT COUNT(*) FROM users;
```

### Check recent queries:
```sql
SELECT * FROM query_analytics
ORDER BY created_at DESC
LIMIT 10;
```

### Check error logs:
```sql
SELECT * FROM error_log
WHERE resolved = false
ORDER BY created_at DESC;
```

---

**Need help?** Check the troubleshooting section or reach out to:
- Supabase Discord: https://discord.supabase.com
- Supabase Docs: https://supabase.com/docs

---

**Last Updated**: November 7, 2025
**Migration Status**: ✅ Complete
