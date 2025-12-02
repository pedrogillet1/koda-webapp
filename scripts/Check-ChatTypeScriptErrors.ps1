# TypeScript Chat Error Checker - PowerShell Version
# This script checks for TypeScript errors specifically in chat-related files
# Usage: .\scripts\Check-ChatTypeScriptErrors.ps1

#Requires -Version 5.1

param(
    [switch]$Verbose,
    [switch]$ExportReport
)

# Set error action preference
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

# Initialize counters
$script:TotalErrors = 0
$script:CriticalErrors = 0
$script:Warnings = 0
$script:CheckResults = @()

Write-Section "🔍 KODA CHAT TYPESCRIPT ERROR CHECKER"

# Determine script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $ProjectRoot "backend"

# Check if backend directory exists
if (-not (Test-Path $BackendDir)) {
    Write-ColorOutput "❌ Error: backend directory not found!" "Red"
    Write-ColorOutput "Current directory: $ProjectRoot" "Yellow"
    Write-ColorOutput "Please run this script from the project root or scripts directory" "Yellow"
    exit 1
}

Set-Location $BackendDir

Write-Host "📂 Working directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "📅 Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host ""

# Function to check if a file exists
function Test-FileExists {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        Write-ColorOutput "⚠️  File not found: $FilePath" "Yellow"
        return $false
    }
    return $true
}

# Function to check TypeScript file
function Test-TypeScriptFile {
    param(
        [string]$FilePath,
        [string]$Description
    )

    Write-ColorOutput "Checking: $Description" "Blue"
    Write-Host "File: $FilePath"

    if (-not (Test-FileExists $FilePath)) {
        Write-ColorOutput "❌ CRITICAL: File missing!" "Red"
        $script:CriticalErrors++
        $script:CheckResults += [PSCustomObject]@{
            File = $FilePath
            Description = $Description
            Status = "Missing"
            ErrorCount = 1
        }
        Write-Host ""
        return $false
    }

    # Run tsc on the specific file
    $tscPath = ".\node_modules\.bin\tsc.cmd"
    if (-not (Test-Path $tscPath)) {
        $tscPath = ".\node_modules\.bin\tsc"
    }

    if (Test-Path $tscPath) {
        $errors = & $tscPath --noEmit $FilePath 2>&1 | Select-String -Pattern "error" -SimpleMatch

        if ($null -eq $errors -or $errors.Count -eq 0) {
            Write-ColorOutput "✅ No errors" "Green"
            $script:CheckResults += [PSCustomObject]@{
                File = $FilePath
                Description = $Description
                Status = "OK"
                ErrorCount = 0
            }
        }
        else {
            Write-ColorOutput "❌ ERRORS FOUND:" "Red"
            $errors | Select-Object -First 10 | ForEach-Object { Write-Host $_.Line }

            $errorCount = $errors.Count
            $script:TotalErrors += $errorCount

            # Check for critical errors
            $criticalPatterns = @("Cannot find", "is not defined", "has no exported member")
            $hasCritical = $false
            foreach ($pattern in $criticalPatterns) {
                if ($errors -match $pattern) {
                    $hasCritical = $true
                    break
                }
            }

            if ($hasCritical) {
                $script:CriticalErrors++
                Write-ColorOutput "🚨 CRITICAL: Missing imports/modules/exports" "Red"
            }

            $script:CheckResults += [PSCustomObject]@{
                File = $FilePath
                Description = $Description
                Status = "Errors"
                ErrorCount = $errorCount
            }
        }
    }
    else {
        Write-ColorOutput "⚠️  TypeScript compiler not found" "Yellow"
        $script:Warnings++
    }

    Write-Host ""
    return $true
}

# Function to check directory structure
function Test-DirectoryStructure {
    Write-ColorOutput "Checking directory structure..." "Cyan"

    $requiredDirs = @("src", "src\controllers", "src\services", "src\routes", "prisma")

    foreach ($dir in $requiredDirs) {
        if (Test-Path $dir) {
            Write-ColorOutput "✅ $dir exists" "Green"
        }
        else {
            Write-ColorOutput "❌ $dir missing" "Red"
            $script:CriticalErrors++
        }
    }
    Write-Host ""
}

# ============================================
# SECTION 0: ENVIRONMENT CHECK
# ============================================
Write-Section "SECTION 0: ENVIRONMENT CHECK"

Write-ColorOutput "Node.js version:" "Blue"
try {
    $nodeVersion = node --version
    Write-ColorOutput "✅ $nodeVersion" "Green"
}
catch {
    Write-ColorOutput "❌ Node.js not found" "Red"
    $script:CriticalErrors++
}

Write-ColorOutput "npm version:" "Blue"
try {
    $npmVersion = npm --version
    Write-ColorOutput "✅ $npmVersion" "Green"
}
catch {
    Write-ColorOutput "❌ npm not found" "Red"
    $script:CriticalErrors++
}

Write-ColorOutput "TypeScript version:" "Blue"
$tscPath = ".\node_modules\.bin\tsc.cmd"
if (Test-Path $tscPath) {
    try {
        $tsVersion = & $tscPath --version
        Write-ColorOutput "✅ $tsVersion" "Green"
    }
    catch {
        Write-ColorOutput "⚠️  TypeScript not installed locally" "Yellow"
    }
}
else {
    Write-ColorOutput "⚠️  TypeScript not installed locally" "Yellow"
}

Write-Host ""

Test-DirectoryStructure

# ============================================
# SECTION 1: CORE CHAT FILES
# ============================================
Write-Section "SECTION 1: CORE CHAT FILES"

Test-TypeScriptFile "src\controllers\chat.controller.ts" "Chat Controller"
Test-TypeScriptFile "src\controllers\chatDocument.controller.ts" "Chat Document Controller"
Test-TypeScriptFile "src\controllers\rag.controller.ts" "RAG Controller"
Test-TypeScriptFile "src\services\chat.service.ts" "Chat Service"
Test-TypeScriptFile "src\services\rag.service.ts" "RAG Service"
Test-TypeScriptFile "src\services\chatActions.service.ts" "Chat Actions Service"

# Optional files
if (Test-Path "src\services\conversationContext.service.ts") {
    Test-TypeScriptFile "src\services\conversationContext.service.ts" "Conversation Context Service"
}
if (Test-Path "src\services\conversationState.service.ts") {
    Test-TypeScriptFile "src\services\conversationState.service.ts" "Conversation State Service"
}

# ============================================
# SECTION 2: ROUTES
# ============================================
Write-Section "SECTION 2: ROUTE REGISTRATION"

Test-TypeScriptFile "src\routes\chat.routes.ts" "Chat Routes"
Test-TypeScriptFile "src\routes\chatDocument.routes.ts" "Chat Document Routes"
Test-TypeScriptFile "src\routes\rag.routes.ts" "RAG Routes"
Test-TypeScriptFile "src\app.ts" "Main App (Route Registration)"

# ============================================
# SECTION 3: MODELS & TYPES
# ============================================
Write-Section "SECTION 3: MODELS & TYPES"

if (Test-Path "src\types\rag.types.ts") {
    Test-TypeScriptFile "src\types\rag.types.ts" "RAG Types"
}

Write-ColorOutput "Checking for type definition files..." "Blue"
$typeFiles = Get-ChildItem -Path "src\types" -Filter "*.ts" -ErrorAction SilentlyContinue
$typeCount = ($typeFiles | Measure-Object).Count
Write-ColorOutput "Found $typeCount type definition files" "Green"
Write-Host ""

# ============================================
# SECTION 4: FULL COMPILATION TEST
# ============================================
Write-Section "SECTION 4: FULL COMPILATION TEST"

Write-ColorOutput "Running full TypeScript compilation..." "Blue"
Write-Host ""

$tscPath = ".\node_modules\.bin\tsc.cmd"
if (Test-Path $tscPath) {
    $compileOutput = & $tscPath --noEmit 2>&1 | Out-String
    $errorLines = $compileOutput -split "`n" | Select-String -Pattern "error TS"

    $fullErrorCount = ($errorLines | Measure-Object).Count

    if ($fullErrorCount -eq 0) {
        Write-ColorOutput "✅ Full compilation successful - NO ERRORS!" "Green"
    }
    else {
        Write-ColorOutput "❌ Found $fullErrorCount TypeScript errors in total project" "Red"
        Write-Host ""
        Write-Host "Top 20 errors:" -ForegroundColor Yellow
        $errorLines | Select-Object -First 20 | ForEach-Object { Write-Host $_.Line }

        # Filter chat-related errors
        Write-Host ""
        Write-ColorOutput "Chat-related errors:" "Yellow"
        $chatErrors = $errorLines | Select-String -Pattern "chat|rag|conversation|message" -SimpleMatch
        if ($null -eq $chatErrors -or $chatErrors.Count -eq 0) {
            Write-Host "No chat-specific errors in output"
        }
        else {
            $chatErrors | ForEach-Object { Write-Host $_.Line }
            $chatErrorCount = ($chatErrors | Measure-Object).Count
            Write-Host ""
            Write-ColorOutput "Total chat-related errors: $chatErrorCount" "Magenta"
        }
    }
}
else {
    Write-ColorOutput "⚠️  TypeScript compiler not found, skipping" "Yellow"
    $fullErrorCount = -1
}

Write-Host ""

# ============================================
# SECTION 5: DEPENDENCY CHECK
# ============================================
Write-Section "SECTION 5: DEPENDENCY CHECK"

Write-ColorOutput "Checking for missing dependencies..." "Blue"

if (Test-Path "node_modules") {
    Write-ColorOutput "✅ node_modules exists" "Green"

    # Get node_modules size
    $nodeModulesSize = (Get-ChildItem -Path "node_modules" -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $sizeGB = [math]::Round($nodeModulesSize / 1GB, 2)
    Write-ColorOutput "   Size: $sizeGB GB" "Cyan"
}
else {
    Write-ColorOutput "❌ CRITICAL: node_modules directory not found!" "Red"
    Write-Host "Run: npm install"
    $script:CriticalErrors++
}

# Check for critical packages
$criticalPackages = @("express", "prisma", "@prisma/client", "typescript", "openai", "socket.io")

foreach ($package in $criticalPackages) {
    $packagePath = Join-Path "node_modules" $package
    if (Test-Path $packagePath) {
        $packageJsonPath = Join-Path $packagePath "package.json"
        if (Test-Path $packageJsonPath) {
            $packageJson = Get-Content $packageJsonPath | ConvertFrom-Json
            $version = $packageJson.version
            Write-ColorOutput "✅ $package@$version" "Green"
        }
        else {
            Write-ColorOutput "✅ $package installed" "Green"
        }
    }
    else {
        Write-ColorOutput "❌ CRITICAL: $package NOT installed" "Red"
        $script:CriticalErrors++
    }
}

Write-Host ""

if (Test-Path "package-lock.json") {
    Write-ColorOutput "✅ package-lock.json exists" "Green"
}
else {
    Write-ColorOutput "⚠️  package-lock.json missing - dependencies may be inconsistent" "Yellow"
    $script:Warnings++
}

Write-Host ""

# ============================================
# SECTION 6: PRISMA SCHEMA CHECK
# ============================================
Write-Section "SECTION 6: PRISMA SCHEMA CHECK"

if (Test-Path "prisma\schema.prisma") {
    Write-ColorOutput "Checking Prisma schema..." "Blue"

    $prismaPath = ".\node_modules\.bin\prisma.cmd"
    if (Test-Path $prismaPath) {
        $validateOutput = & $prismaPath validate 2>&1 | Out-String

        if ($validateOutput -match "validated successfully") {
            Write-ColorOutput "✅ Prisma schema is valid" "Green"
        }
        else {
            Write-ColorOutput "❌ Prisma schema has errors" "Red"
            Write-Host $validateOutput
            $script:CriticalErrors++
        }

        # Check if Prisma client is generated
        if ((Test-Path "node_modules\.prisma\client") -or (Test-Path "node_modules\@prisma\client")) {
            Write-ColorOutput "✅ Prisma client is generated" "Green"

            if (Test-Path "node_modules\@prisma\client\package.json") {
                $prismaClientJson = Get-Content "node_modules\@prisma\client\package.json" | ConvertFrom-Json
                $prismaVersion = $prismaClientJson.version
                Write-ColorOutput "   Prisma Client version: $prismaVersion" "Cyan"
            }
        }
        else {
            Write-ColorOutput "⚠️  Prisma client not generated. Run: npx prisma generate" "Yellow"
            $script:Warnings++
        }

        # Count models in schema
        $schemaContent = Get-Content "prisma\schema.prisma" -Raw
        $modelCount = ([regex]::Matches($schemaContent, "^model ", [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
        Write-ColorOutput "   Models defined in schema: $modelCount" "Cyan"
    }
    else {
        Write-ColorOutput "⚠️  Prisma CLI not found" "Yellow"
    }
}
else {
    Write-ColorOutput "❌ CRITICAL: prisma\schema.prisma not found" "Red"
    $script:CriticalErrors++
}

Write-Host ""

# ============================================
# SECTION 7: TSCONFIG CHECK
# ============================================
Write-Section "SECTION 7: TSCONFIG CHECK"

if (Test-Path "tsconfig.json") {
    Write-ColorOutput "✅ tsconfig.json exists" "Green"
    Write-Host ""

    $tsconfigContent = Get-Content "tsconfig.json" -Raw

    Write-ColorOutput "Compiler Options:" "Cyan"

    if ($tsconfigContent -match '"skipLibCheck":\s*true') {
        Write-ColorOutput "✅ skipLibCheck: true" "Green"
    }
    else {
        Write-ColorOutput "⚠️  skipLibCheck not set to true" "Yellow"
        Write-Host "   Consider setting to true to avoid library errors"
        $script:Warnings++
    }

    if ($tsconfigContent -match '"strict":\s*true') {
        Write-ColorOutput "⚠️  strict mode is enabled - may cause more errors" "Yellow"
        $script:Warnings++
    }
    else {
        Write-ColorOutput "✅ strict mode is disabled" "Green"
    }

    if ($tsconfigContent -match '"noEmitOnError":\s*true') {
        Write-ColorOutput "⚠️  noEmitOnError is true - compilation will fail on any error" "Yellow"
        Write-Host "   Consider setting to false for development"
        $script:Warnings++
    }

    # Extract target and module
    if ($tsconfigContent -match '"target":\s*"([^"]+)"') {
        $target = $Matches[1]
        Write-ColorOutput "   Target: $target" "Cyan"
    }

    if ($tsconfigContent -match '"module":\s*"([^"]+)"') {
        $module = $Matches[1]
        Write-ColorOutput "   Module: $module" "Cyan"
    }
}
else {
    Write-ColorOutput "❌ CRITICAL: tsconfig.json not found" "Red"
    $script:CriticalErrors++
}

Write-Host ""

# ============================================
# SECTION 8: BUILD OUTPUT CHECK
# ============================================
Write-Section "SECTION 8: BUILD OUTPUT CHECK"

if (Test-Path "dist") {
    Write-ColorOutput "✅ dist directory exists" "Green"

    $jsFiles = Get-ChildItem -Path "dist" -Filter "*.js" -Recurse -ErrorAction SilentlyContinue
    $jsCount = ($jsFiles | Measure-Object).Count
    Write-ColorOutput "   Compiled JS files: $jsCount" "Cyan"

    # Check for critical compiled files
    $criticalCompiled = @(
        "dist\server.js",
        "dist\controllers\chat.controller.js",
        "dist\controllers\rag.controller.js"
    )

    foreach ($file in $criticalCompiled) {
        if (Test-Path $file) {
            $fileSize = (Get-Item $file).Length
            $fileSizeKB = [math]::Round($fileSize / 1KB, 2)
            Write-ColorOutput "✅ $file ($fileSizeKB KB)" "Green"
        }
        else {
            Write-ColorOutput "⚠️  $file not found" "Yellow"
        }
    }
}
else {
    Write-ColorOutput "⚠️  dist directory not found - project not built yet" "Yellow"
    Write-Host "   Run: npm run build"
    $script:Warnings++
}

Write-Host ""

# ============================================
# SECTION 9: RUNTIME CHECKS
# ============================================
Write-Section "SECTION 9: RUNTIME CHECKS"

Write-ColorOutput "Checking environment files..." "Blue"

if (Test-Path ".env") {
    Write-ColorOutput "✅ .env file exists" "Green"

    $envContent = Get-Content ".env" -Raw
    $requiredEnvVars = @("DATABASE_URL", "JWT_SECRET", "OPENAI_API_KEY")

    foreach ($var in $requiredEnvVars) {
        if ($envContent -match "^$var=") {
            Write-ColorOutput "✅ $var is set" "Green"
        }
        else {
            Write-ColorOutput "⚠️  $var not found in .env" "Yellow"
            $script:Warnings++
        }
    }
}
else {
    Write-ColorOutput "⚠️  .env file not found" "Yellow"
    if (Test-Path ".env.example") {
        Write-Host "   Copy .env.example to .env and configure it"
    }
    $script:Warnings++
}

Write-Host ""

# ============================================
# FINAL SUMMARY
# ============================================
Write-Section "📊 FINAL SUMMARY"

Write-ColorOutput "Statistics:" "Cyan"
Write-Host "• Total TypeScript errors: $fullErrorCount"
Write-Host "• Critical errors (blocking): $($script:CriticalErrors)"
Write-Host "• Warnings: $($script:Warnings)"
Write-Host ""

# Export report if requested
if ($ExportReport) {
    $reportPath = "logs\typescript_check_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
    New-Item -Path "logs" -ItemType Directory -Force | Out-Null

    $report = @{
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        TotalErrors = $fullErrorCount
        CriticalErrors = $script:CriticalErrors
        Warnings = $script:Warnings
        CheckResults = $script:CheckResults
    }

    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportPath -Encoding UTF8
    Write-ColorOutput "📄 Report exported to: $reportPath" "Cyan"
    Write-Host ""
}

# Generate recommendations
if ($script:CriticalErrors -eq 0 -and $fullErrorCount -eq 0) {
    Write-ColorOutput "🎉 SUCCESS! No errors found. Chat should work 100%" "Green"
    Write-Host ""
    Write-ColorOutput "Next steps:" "Cyan"
    Write-Host "1. Start the server: npm run dev"
    Write-Host "2. Test chat endpoint: curl http://localhost:5000/api/health"
    Write-Host "3. Monitor logs for any runtime errors"
    exit 0
}
elseif ($script:CriticalErrors -eq 0) {
    Write-ColorOutput "⚠️  WARNING: Found $fullErrorCount non-critical errors" "Yellow"
    Write-Host "Chat may work, but should fix these errors"
    Write-Host ""
    Write-ColorOutput "Recommended actions:" "Cyan"
    Write-Host "1. Review error output above"
    Write-Host "2. Run: npm run build to see detailed errors"
    Write-Host "3. Fix type errors gradually"
    Write-Host "4. Consider running: .\scripts\Fix-ChatTypeScriptErrors.ps1"
    exit 1
}
else {
    Write-ColorOutput "🚨 CRITICAL ERRORS FOUND!" "Red"
    Write-Host "Chat will NOT work until these are fixed"
    Write-Host ""
    Write-ColorOutput "Quick fixes to try:" "Cyan"
    Write-Host "1. npm install                    # Install missing dependencies"
    Write-Host "2. npx prisma generate            # Generate Prisma client"
    Write-Host "3. .\scripts\Fix-ChatTypeScriptErrors.ps1  # Run automated fixer"
    Write-Host "4. npx tsc --noEmit               # See all errors in detail"
    Write-Host ""

    if ($script:Warnings -gt 0) {
        Write-ColorOutput "Additionally, fix $($script:Warnings) warning(s) for better stability" "Yellow"
    }
    exit 2
}
