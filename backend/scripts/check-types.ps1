# PowerShell script for TypeScript pre-deployment checks
# Run with: pwsh scripts/check-types.ps1

$ErrorActionPreference = "Stop"

Write-Host "Running TypeScript pre-deployment checks..." -ForegroundColor Yellow

# Navigate to backend directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\.."

# 1. Check for missing dependencies
Write-Host ""
Write-Host "[1/4] Checking for missing dependencies..." -ForegroundColor Cyan
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# 2. Linting for code quality
Write-Host ""
Write-Host "[2/4] Running ESLint..." -ForegroundColor Cyan
npx eslint src --ext .ts --max-warnings=50
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: ESLint found issues. Consider fixing them." -ForegroundColor Yellow
}

# 3. Prisma validation
Write-Host ""
Write-Host "[3/4] Validating Prisma schema and generating client..." -ForegroundColor Cyan
npx prisma validate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Prisma validation failed" -ForegroundColor Red
    exit 1
}
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Prisma generate failed" -ForegroundColor Red
    exit 1
}

# 4. Full TypeScript compilation check
Write-Host ""
Write-Host "[4/4] Running TypeScript compiler check..." -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "TypeScript compilation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All checks passed! Ready to deploy." -ForegroundColor Green
