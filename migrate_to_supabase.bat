@echo off
REM ===================================
REM KODA Supabase Migration Script
REM ===================================
REM This script automates the migration from SQLite to Supabase PostgreSQL
REM Run this from: C:\Users\Pedro\desktop\webapp\

echo.
echo ========================================
echo   KODA Supabase Migration Script
echo ========================================
echo.
echo This will migrate your database to Supabase.
echo Make sure you have:
echo   1. Created a Supabase project
echo   2. Updated backend\.env with connection strings
echo   3. Backed up your current database (if needed)
echo.
pause

REM Step 1: Update Prisma Schema
echo.
echo ========================================
echo Step 1: Updating Prisma Schema
echo ========================================
echo.
echo Changing datasource from SQLite to PostgreSQL...

cd backend

REM Backup original schema
copy prisma\schema.prisma prisma\schema.prisma.backup
echo Backup created: prisma\schema.prisma.backup

REM Replace sqlite with postgresql
powershell -Command "(Get-Content prisma\schema.prisma) -replace 'provider = \"sqlite\"', 'provider = \"postgresql\"' | Set-Content prisma\schema.prisma"

REM Add directUrl
powershell -Command "(Get-Content prisma\schema.prisma) -replace 'url      = env\(\"DATABASE_URL\"\)', 'url      = env(\"DATABASE_URL\")$([Environment]::NewLine)  directUrl = env(\"DIRECT_URL\")' | Set-Content prisma\schema.prisma"

REM Replace uuid() with PostgreSQL native
powershell -Command "(Get-Content prisma\schema.prisma) -replace '@default\(uuid\(\)\)', '@default(dbgenerated(\"gen_random_uuid()\"))' | Set-Content prisma\schema.prisma"

echo ✓ Prisma schema updated

REM Step 2: Install dependencies
echo.
echo ========================================
echo Step 2: Installing Dependencies
echo ========================================
echo.

call npm install @prisma/client
call npm install -D prisma

echo ✓ Dependencies installed

REM Step 3: Generate Prisma Client
echo.
echo ========================================
echo Step 3: Generating Prisma Client
echo ========================================
echo.

call npx prisma generate

echo ✓ Prisma Client generated

REM Step 4: Create and Apply Migration
echo.
echo ========================================
echo Step 4: Creating Migration
echo ========================================
echo.

call npx prisma migrate dev --name init_supabase

echo ✓ Migration created and applied

REM Step 5: Verify Migration
echo.
echo ========================================
echo Step 5: Verifying Migration
echo ========================================
echo.

call npx prisma migrate status

echo.
echo ========================================
echo Migration Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Open Supabase dashboard to verify tables
echo   2. Run: npm run dev (to start backend)
echo   3. Test user registration and file upload
echo   4. Follow SUPABASE_MIGRATION_GUIDE.md for analytics tables
echo.
pause

REM Optional: Open Prisma Studio
echo.
echo Would you like to open Prisma Studio to view your database?
echo.
choice /C YN /M "Open Prisma Studio"
if errorlevel 2 goto end
if errorlevel 1 goto studio

:studio
start cmd /k "npx prisma studio"

:end
echo.
echo Migration script finished.
echo.
pause
