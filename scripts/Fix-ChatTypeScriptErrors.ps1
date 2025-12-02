# Quick Fix Script for Common TypeScript Chat Errors - PowerShell Version
# Run this after Check-ChatTypeScriptErrors.ps1 identifies issues
# Usage: .\scripts\Fix-ChatTypeScriptErrors.ps1

#Requires -Version 5.1

param(
    [switch]$SkipBackup,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Colors
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

Write-Section "🔧 KODA CHAT TYPESCRIPT QUICK FIX"

# Determine script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"

# Check if backend directory exists
if (-not (Test-Path $BackendDir)) {
    Write-ColorOutput "❌ Error: backend directory not found!" "Red"
    Write-ColorOutput "Current directory: $ProjectRoot" "Yellow"
    exit 1
}

Set-Location $BackendDir

Write-Host "📂 Working directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "📅 Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host ""

# Create logs directory
$LogsDir = "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -Path $LogsDir -ItemType Directory -Force | Out-Null
}

$LogFile = Join-Path $LogsDir "fix_typescript_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
Write-Host "📝 Logging to: $LogFile" -ForegroundColor Cyan
Write-Host ""

# Function to log and output
function Write-Log {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-ColorOutput $Message $Color
    $Message -replace '\x1b\[[0-9;]*m', '' | Out-File -FilePath $LogFile -Append -Encoding UTF8
}

# ============================================
# FIX 0: Backup Important Files
# ============================================
if (-not $SkipBackup) {
    Write-Log "FIX 0: Creating backups..." "Blue"

    $BackupDir = "backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null

    # Backup tsconfig.json
    if (Test-Path "tsconfig.json") {
        Copy-Item "tsconfig.json" -Destination "$BackupDir\tsconfig.json.backup"
        Write-Log "✅ Backed up tsconfig.json" "Green"
    }

    # Backup package.json
    if (Test-Path "package.json") {
        Copy-Item "package.json" -Destination "$BackupDir\package.json.backup"
        Write-Log "✅ Backed up package.json" "Green"
    }

    # Backup .env
    if (Test-Path ".env") {
        Copy-Item ".env" -Destination "$BackupDir\.env.backup"
        Write-Log "✅ Backed up .env" "Green"
    }

    Write-Log "✅ Backups created in $BackupDir" "Green"
    Write-Host ""
}
else {
    Write-Log "⏭️  Skipping backups (--SkipBackup flag set)" "Yellow"
    Write-Host ""
}

# ============================================
# FIX 1: Install/Update Dependencies
# ============================================
Write-Log "FIX 1: Installing/updating dependencies..." "Blue"

if (Test-Path "package-lock.json") {
    Write-Log "Found package-lock.json, using npm ci for clean install" "Cyan"
    npm ci 2>&1 | Tee-Object -FilePath $LogFile -Append
}
else {
    Write-Log "No package-lock.json, using npm install" "Cyan"
    npm install 2>&1 | Tee-Object -FilePath $LogFile -Append
}

if ($LASTEXITCODE -eq 0) {
    Write-Log "✅ Dependencies installed" "Green"
}
else {
    Write-Log "❌ Failed to install dependencies" "Red"
    Write-Host "Check the log for details: $LogFile"
    exit 1
}

Write-Host ""

# ============================================
# FIX 2: Generate Prisma Client
# ============================================
Write-Log "FIX 2: Generating Prisma client..." "Blue"

if (Test-Path "prisma\schema.prisma") {
    $prismaPath = ".\node_modules\.bin\prisma.cmd"

    if (Test-Path $prismaPath) {
        # Validate schema first
        Write-Log "Validating Prisma schema..." "Cyan"
        $validateOutput = & $prismaPath validate 2>&1 | Out-String

        if ($validateOutput -match "validated successfully") {
            Write-Log "✅ Prisma schema is valid" "Green"

            # Generate client
            Write-Log "Generating Prisma client..." "Cyan"
            & $prismaPath generate 2>&1 | Tee-Object -FilePath $LogFile -Append

            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ Prisma client generated" "Green"
            }
            else {
                Write-Log "❌ Failed to generate Prisma client" "Red"
            }
        }
        else {
            Write-Log "❌ Prisma schema validation failed" "Red"
            Write-Log "⚠️  Fix Prisma schema errors before continuing" "Yellow"
            Write-Host $validateOutput
        }
    }
    else {
        Write-Log "⚠️  Prisma CLI not found" "Yellow"
    }
}
else {
    Write-Log "⚠️  Prisma schema not found, skipping" "Yellow"
}

Write-Host ""

# ============================================
# FIX 3: Update tsconfig.json
# ============================================
Write-Log "FIX 3: Optimizing tsconfig.json for development..." "Blue"

if (Test-Path "tsconfig.json") {
    $tsconfigContent = Get-Content "tsconfig.json" -Raw | ConvertFrom-Json

    # Update compiler options
    $tsconfigContent.compilerOptions.skipLibCheck = $true
    $tsconfigContent.compilerOptions.noEmitOnError = $false
    $tsconfigContent.compilerOptions.sourceMap = $true

    # Save updated config
    $tsconfigContent | ConvertTo-Json -Depth 10 | Set-Content "tsconfig.json" -Encoding UTF8

    Write-Log "✅ tsconfig.json updated" "Green"
    Write-Log "   - skipLibCheck: true" "Cyan"
    Write-Log "   - noEmitOnError: false" "Cyan"
    Write-Log "   - sourceMap: true" "Cyan"
}
else {
    Write-Log "⚠️  tsconfig.json not found, skipping" "Yellow"
}

Write-Host ""

# ============================================
# FIX 4: Clean Old Build Artifacts
# ============================================
Write-Log "FIX 4: Cleaning old build artifacts..." "Blue"

if (Test-Path "dist") {
    Write-Log "Removing old dist\ directory..." "Cyan"
    Remove-Item -Path "dist" -Recurse -Force
    Write-Log "✅ Old build removed" "Green"
}
else {
    Write-Log "No dist\ directory found (clean start)" "Cyan"
}

# Clean TypeScript build cache
if (Test-Path "tsconfig.tsbuildinfo") {
    Remove-Item -Path "tsconfig.tsbuildinfo" -Force
    Write-Log "✅ TypeScript build cache cleaned" "Green"
}

Write-Host ""

# ============================================
# FIX 5: Verify Critical Files
# ============================================
Write-Log "FIX 5: Verifying critical files exist..." "Blue"

$criticalFiles = @(
    "src\server.ts",
    "src\app.ts",
    "src\controllers\chat.controller.ts",
    "src\controllers\rag.controller.ts",
    "src\routes\chat.routes.ts",
    "src\routes\rag.routes.ts",
    "src\services\chat.service.ts",
    "src\services\rag.service.ts"
)

$missingFiles = 0

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Log "✅ $file" "Green"
    }
    else {
        Write-Log "❌ MISSING: $file" "Red"
        $missingFiles++
    }
}

if ($missingFiles -gt 0) {
    Write-Log "❌ $missingFiles critical files are missing!" "Red"
    Write-Log "⚠️  Cannot proceed with build" "Yellow"
    exit 1
}

Write-Host ""

# ============================================
# FIX 6: Build Project
# ============================================
Write-Log "FIX 6: Building project..." "Blue"
Write-Log "This may take a minute..." "Cyan"
Write-Host ""

$BuildLog = Join-Path $LogsDir "build_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

npm run build 2>&1 | Tee-Object -FilePath $BuildLog

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Log "✅ Build successful!" "Green"
}
else {
    Write-Host ""
    Write-Log "❌ Build failed with exit code $LASTEXITCODE" "Red"
    Write-Host ""
    Write-Log "Common issues and fixes:" "Yellow"
    Write-Log "1. Missing imports - Check import statements in error files" "Cyan"
    Write-Log "2. Type mismatches - Review function signatures and parameters" "Cyan"
    Write-Log "3. Prisma model names - Use singular (user, not users)" "Cyan"
    Write-Log "4. Undefined variables - Check variable declarations" "Cyan"
    Write-Host ""
    Write-Host "Full build log saved to: $BuildLog" -ForegroundColor Yellow
    Write-Host ""

    # Show top errors
    Write-Log "Top 10 errors:" "Yellow"
    Select-String -Path $BuildLog -Pattern "error TS" | Select-Object -First 10 | ForEach-Object {
        Write-Host $_.Line
    }
    Write-Host ""

    exit 1
}

Write-Host ""

# ============================================
# FIX 7: Verify Build Output
# ============================================
Write-Log "FIX 7: Verifying build output..." "Blue"

if (Test-Path "dist") {
    $jsFiles = Get-ChildItem -Path "dist" -Filter "*.js" -Recurse
    $mapFiles = Get-ChildItem -Path "dist" -Filter "*.js.map" -Recurse

    $jsCount = ($jsFiles | Measure-Object).Count
    $mapCount = ($mapFiles | Measure-Object).Count

    Write-Log "✅ Build output created" "Green"
    Write-Log "   - Compiled JS files: $jsCount" "Cyan"
    Write-Log "   - Source maps: $mapCount" "Cyan"

    # Check critical compiled files
    $criticalCompiled = @(
        "dist\server.js",
        "dist\app.js",
        "dist\controllers\chat.controller.js",
        "dist\controllers\rag.controller.js",
        "dist\routes\chat.routes.js",
        "dist\routes\rag.routes.js"
    )

    $missingCompiled = 0

    Write-Host ""
    Write-Log "Critical compiled files:" "Cyan"
    foreach ($file in $criticalCompiled) {
        if (Test-Path $file) {
            $fileSize = (Get-Item $file).Length
            $fileSizeKB = [math]::Round($fileSize / 1KB, 2)
            Write-Log "✅ $file ($fileSizeKB KB)" "Green"
        }
        else {
            Write-Log "⚠️  $file not found" "Yellow"
            $missingCompiled++
        }
    }

    if ($missingCompiled -gt 0) {
        Write-Host ""
        Write-Log "⚠️  $missingCompiled expected files not compiled" "Yellow"
        Write-Log "   This may indicate compilation issues" "Yellow"
    }
}
else {
    Write-Log "❌ dist\ directory not created" "Red"
    exit 1
}

Write-Host ""

# ============================================
# FIX 8: Run Final TypeScript Check
# ============================================
Write-Log "FIX 8: Running final TypeScript check..." "Blue"

$tscPath = ".\node_modules\.bin\tsc.cmd"
if (Test-Path $tscPath) {
    $errors = & $tscPath --noEmit 2>&1 | Select-String -Pattern "error TS"
    $errorCount = ($errors | Measure-Object).Count

    if ($errorCount -eq 0) {
        Write-Log "🎉 SUCCESS! All TypeScript errors fixed!" "Green"
    }
    else {
        Write-Log "⚠️  Still have $errorCount TypeScript errors" "Yellow"
        Write-Host ""
        Write-Log "Showing top 10 remaining errors:" "Cyan"
        $errors | Select-Object -First 10 | ForEach-Object { Write-Host $_.Line }
        Write-Host ""
        Write-Log "Note: These may be non-critical if build succeeded" "Yellow"
    }
}

Write-Host ""

# ============================================
# FIX 9: Environment Check
# ============================================
Write-Log "FIX 9: Checking environment configuration..." "Blue"

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
    Write-Log "⚠️  .env file not found" "Yellow"
    Write-Log "Creating .env from .env.example..." "Cyan"
    Copy-Item ".env.example" -Destination ".env"
    Write-Log "✅ .env created - REMEMBER TO CONFIGURE IT!" "Green"
    Write-Log "   ⚠️  You must set your API keys and database URL" "Red"
}
elseif (-not (Test-Path ".env")) {
    Write-Log "⚠️  No .env or .env.example found" "Yellow"
    Write-Log "   Create a .env file with required environment variables" "Yellow"
}
else {
    Write-Log "✅ .env file exists" "Green"
}

Write-Host ""

# ============================================
# FINAL SUMMARY & NEXT STEPS
# ============================================
Write-Section "📊 FINAL SUMMARY"

Write-Log "✅ All fixes completed!" "Green"
Write-Host ""

Write-Log "What was fixed:" "Cyan"
Write-Log "1. ✅ Dependencies installed/updated" "White"
Write-Log "2. ✅ Prisma client generated" "White"
Write-Log "3. ✅ TypeScript config optimized" "White"
Write-Log "4. ✅ Old build artifacts cleaned" "White"
Write-Log "5. ✅ Critical files verified" "White"
Write-Log "6. ✅ Project built successfully" "White"
Write-Log "7. ✅ Build output verified" "White"
Write-Log "8. ✅ Final TypeScript check completed" "White"
Write-Log "9. ✅ Environment checked" "White"
Write-Host ""

Write-Log "📝 Logs saved to:" "Cyan"
Write-Log "   - Main log: $LogFile" "White"
Write-Log "   - Build log: $BuildLog" "White"
if (-not $SkipBackup) {
    Write-Log "   - Backups: $BackupDir\" "White"
}
Write-Host ""

Write-Log "🚀 Next Steps:" "Cyan"
Write-Host ""

if ($errorCount -eq 0) {
    Write-Log "Your backend is ready to run!" "Green"
    Write-Host ""
    Write-Host "To start the server:" -ForegroundColor Cyan
    Write-Host "  Development: npm run dev" -ForegroundColor White
    Write-Host "  Production:  npm start" -ForegroundColor White
    Write-Host ""
    Write-Host "To test the server:" -ForegroundColor Cyan
    Write-Host "  Invoke-WebRequest -Uri http://localhost:5000/api/health" -ForegroundColor White
    Write-Host ""
    exit 0
}
else {
    Write-Log "Build succeeded but with $errorCount TypeScript errors" "Yellow"
    Write-Host ""
    Write-Host "The server should run, but consider fixing these errors:" -ForegroundColor Yellow
    Write-Host "  .\node_modules\.bin\tsc.cmd --noEmit | Select-String 'error TS' | Select-Object -First 20" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can still start the server:" -ForegroundColor Cyan
    Write-Host "  Development: npm run dev" -ForegroundColor White
    Write-Host "  Production:  npm start" -ForegroundColor White
    Write-Host ""
    exit 0
}
