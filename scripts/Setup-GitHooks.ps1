# Script to set up git hooks for the project - PowerShell Version
# Run this once after cloning the repository
# Usage: .\scripts\Setup-GitHooks.ps1

#Requires -Version 5.1

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

Write-Section "🔧 Git Hooks Setup"

# Determine script location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

Write-ColorOutput "Project root: $ProjectRoot" "Cyan"
Write-Host ""

# Check if .git directory exists
if (-not (Test-Path ".git")) {
    Write-ColorOutput "❌ Error: .git directory not found!" "Red"
    Write-Host "This script must be run from a git repository"
    exit 1
}

# Check if .githooks directory exists
if (-not (Test-Path ".githooks")) {
    Write-ColorOutput "⚠️  .githooks directory not found" "Yellow"
    Write-Host "Creating .githooks directory..."
    New-Item -Path ".githooks" -ItemType Directory -Force | Out-Null
    Write-ColorOutput "✅ Created .githooks directory" "Green"
}

# Configure git to use .githooks directory
Write-ColorOutput "Configuring git to use .githooks directory..." "Cyan"
git config core.hooksPath .githooks

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "✅ Git hooks path configured" "Green"
}
else {
    Write-ColorOutput "❌ Failed to configure git hooks path" "Red"
    exit 1
}

Write-Host ""

# On Windows, hooks need to be executable and might need a shebang
# We'll ensure all hook files are properly configured
Write-ColorOutput "Configuring hooks..." "Cyan"

$hooksMadeExecutable = 0

Get-ChildItem -Path ".githooks" -File | ForEach-Object {
    $hookPath = $_.FullName
    $hookName = $_.Name

    # Check if file has a shebang
    $firstLine = Get-Content $hookPath -First 1
    if ($firstLine -notmatch "^#!") {
        Write-ColorOutput "⚠️  $hookName missing shebang, adding..." "Yellow"
        $content = Get-Content $hookPath -Raw
        "#!/bin/bash`n$content" | Set-Content $hookPath -NoNewline
    }

    Write-ColorOutput "✅ $hookName" "Green"
    $hooksMadeExecutable++
}

if ($hooksMadeExecutable -eq 0) {
    Write-ColorOutput "⚠️  No hooks found in .githooks directory" "Yellow"
}
else {
    Write-ColorOutput "✅ Configured $hooksMadeExecutable hook(s)" "Green"
}

Write-Host ""

# List configured hooks
Write-ColorOutput "Configured hooks:" "Cyan"
Get-ChildItem -Path ".githooks" -File | ForEach-Object {
    Write-Host "  • $($_.Name)"
}

Write-Host ""

Write-ColorOutput "✅ Git hooks setup complete!" "Green"
Write-Host ""
Write-ColorOutput "Available hooks:" "Cyan"
Write-Host "  • pre-commit: Runs TypeScript checks before each commit"
Write-Host ""
Write-ColorOutput "To skip hooks temporarily:" "Cyan"
Write-Host "  git commit --no-verify"
Write-Host ""
Write-ColorOutput "To disable hooks:" "Cyan"
Write-Host "  git config --unset core.hooksPath"
Write-Host ""

# Additional Windows note
Write-ColorOutput "Note for Windows users:" "Yellow"
Write-Host "  Git hooks require Git Bash to run on Windows."
Write-Host "  Make sure you have Git for Windows installed."
Write-Host ""
