# How to Find Supabase Connection String

## Step 1: Go to Supabase Dashboard

1. Open https://supabase.com/dashboard
2. Sign in to your account
3. Click on your project (or create a new one if you haven't yet)

## Step 2: Navigate to Database Settings

Click on the **Settings** icon (⚙️) in the left sidebar, then click **Database**

OR

Click **Project Settings** → **Database**

## Step 3: Find Connection Strings

Scroll down to the **Connection String** section. You'll see several formats:

### Option 1: Connection Pooling (RECOMMENDED for Production)

```
Pooler Connection String (Transaction Mode)
```

This will look like:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Use this one for production!** (It's more efficient)

### Option 2: Direct Connection

```
URI Connection String
```

This will look like:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## Step 4: Replace `[PASSWORD]` Placeholder

⚠️ **IMPORTANT**: The connection string will show `[YOUR-PASSWORD]` as a placeholder.

You need to replace it with your **actual database password**.

### Where is my password?

**Option A: You saved it during project creation**
- Use the password you saved when you first created the project

**Option B: You forgot your password**
1. Go to **Settings** → **Database**
2. Scroll to **Database Password** section
3. Click **Reset Database Password**
4. Copy the new password (you'll only see it once!)
5. Replace `[YOUR-PASSWORD]` in the connection string

## Step 5: Copy the Complete Connection String

Example final connection string:
```bash
# Pooler (Recommended)
postgresql://postgres.abcdefghijk:MySecurePassword123@aws-0-us-west-1.pooler.supabase.com:6543/postgres

# Direct (Alternative)
postgresql://postgres:MySecurePassword123@db.abcdefghijk.supabase.co:5432/postgres
```

## Step 6: Add to Your `.env` File

In your `backend/.env` file:

```bash
# Supabase Database (Production)
DATABASE_URL="postgresql://postgres.abcdefghijk:MySecurePassword123@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Supabase Direct Connection (alternative)
DIRECT_URL="postgresql://postgres:MySecurePassword123@db.abcdefghijk.supabase.co:5432/postgres"
```

---

## Visual Guide

```
Supabase Dashboard
├── Settings ⚙️
│   └── Database
│       ├── Connection String
│       │   ├── Pooler (Transaction) ← USE THIS
│       │   └── URI (Direct) ← Alternative
│       └── Database Password
│           └── Reset Password (if needed)
```

---

## Quick Test

Test your connection string works:

```bash
# Install psql (if needed)
# Windows: choco install postgresql
# Mac: brew install postgresql
# Ubuntu: sudo apt install postgresql-client

# Test connection
psql "postgresql://postgres.abcdefghijk:MySecurePassword123@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

# Should see:
# psql (14.x)
# Type "help" for help.
# postgres=>
```

---

## Troubleshooting

### ❌ "Password authentication failed"
- You used the wrong password
- Reset password in **Settings** → **Database** → **Reset Database Password**

### ❌ "Could not translate host name"
- Check your internet connection
- Verify the project reference is correct (`abcdefghijk` part)
- Make sure you're using the correct region endpoint

### ❌ "Connection timeout"
- Check if you're behind a firewall
- Try the Direct URL instead of Pooler
- Verify your IP isn't blocked

### ❌ "Database does not exist"
- Make sure you're connecting to `postgres` (default database)
- Don't change `/postgres` at the end of the URL

---

## Pro Tips

1. **Use Connection Pooler for Production**
   - More efficient
   - Handles more concurrent connections
   - Better for serverless environments

2. **Keep Direct URL as Backup**
   - Use for migrations (`prisma migrate`)
   - Use for database management tools
   - Use if pooler has issues

3. **Never Commit Connection Strings**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

4. **Use Environment Variables**
   ```bash
   # Different URLs for different environments
   DATABASE_URL=... # Production (Supabase)
   SHADOW_DATABASE_URL=... # Development (local)
   ```

---

## Next Steps

Once you have the connection string:

1. ✅ Add to `backend/.env`
2. ✅ Test connection: `npx prisma db pull`
3. ✅ Run migrations: `npx prisma migrate deploy`
4. ✅ Generate Prisma Client: `npx prisma generate`
5. ✅ Start backend: `npm run dev`

---

## Need More Help?

- **Supabase Docs**: https://supabase.com/docs/guides/database/connecting-to-postgres
- **Prisma + Supabase**: https://supabase.com/docs/guides/integrations/prisma
- **Discord Support**: https://discord.supabase.com

---

**Last Updated**: November 7, 2025
