# PowerShell script for Koda backend deployment
# Run with: pwsh scripts/deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "Starting Koda backend deployment..." -ForegroundColor Yellow

# Navigate to backend directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\.."

# Step 1: Run all pre-deployment checks
Write-Host ""
Write-Host "--- Running Pre-Deployment Checks ---" -ForegroundColor Cyan
& "$ScriptDir\check-types.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pre-deployment checks failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Clean old build
Write-Host ""
Write-Host "--- Cleaning Old Build ---" -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

# Step 3: Build the project
Write-Host ""
Write-Host "--- Building Project ---" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 4: Restart the application with PM2
Write-Host ""
Write-Host "--- Restarting Application ---" -ForegroundColor Cyan
$pm2List = pm2 list 2>&1
if ($pm2List -match "koda-backend") {
    pm2 restart koda-backend
} else {
    pm2 start dist/server.js --name koda-backend
}

Write-Host ""
Write-Host "Deployment successful! Koda is now live." -ForegroundColor Green

pm2 status
