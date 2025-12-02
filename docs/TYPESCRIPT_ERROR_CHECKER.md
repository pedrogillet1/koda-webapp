# TypeScript Error Checker & Fixer System

Complete system for checking and fixing TypeScript errors in the Koda webapp, with special focus on chat functionality.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Platform-Specific Usage](#platform-specific-usage)
- [Git Hooks](#git-hooks)
- [CI/CD Integration](#cicd-integration)
- [npm Scripts](#npm-scripts)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)

---

## Overview

This system provides comprehensive TypeScript error checking and automated fixing for the Koda webapp. It includes:

- ✅ **Bash scripts** for Linux/Unix/VPS environments
- ✅ **PowerShell scripts** for Windows development
- ✅ **Git pre-commit hooks** for automatic checking
- ✅ **GitHub Actions workflows** for CI/CD
- ✅ **npm scripts** for easy execution
- ✅ **Detailed logging and reporting**

### What Gets Checked

1. **Core Chat Files**: Controllers, services, and routes for chat and RAG
2. **Type Definitions**: All TypeScript type files
3. **Full Compilation**: Complete project TypeScript check
4. **Dependencies**: Critical packages verification
5. **Prisma Schema**: Database schema validation and client generation
6. **Build Output**: Verification of compiled JavaScript files
7. **Environment**: Configuration and environment variables

---

## Quick Start

### On Linux/Unix/VPS (Production)

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Check for errors
./scripts/check_chat_typescript_errors.sh

# 3. If errors found, run the fixer
./scripts/fix_chat_typescript_errors.sh

# 4. Restart your server
pm2 restart koda-backend
```

### On Windows (Development)

```powershell
# 1. Check for errors
.\scripts\Check-ChatTypeScriptErrors.ps1

# 2. If errors found, run the fixer
.\scripts\Fix-ChatTypeScriptErrors.ps1

# 3. Optionally export a report
.\scripts\Check-ChatTypeScriptErrors.ps1 -ExportReport
```

### Using npm Scripts (Cross-Platform)

```bash
# Check TypeScript errors (backend only)
npm run check:typescript

# Fix TypeScript errors automatically
npm run fix:typescript

# Check only chat-related files
npm run typecheck:chat

# Check both backend and frontend
npm run typecheck
```

---

## Available Scripts

### Bash Scripts (Linux/Unix/VPS)

#### 1. `check_chat_typescript_errors.sh`

**Location**: `scripts/check_chat_typescript_errors.sh`

**Purpose**: Comprehensive TypeScript error checking

**Usage**:
```bash
./scripts/check_chat_typescript_errors.sh
```

**What it checks**:
- Environment (Node.js, npm, TypeScript versions)
- Directory structure
- Core chat files (controllers, services, routes)
- Full project compilation
- Dependencies (node_modules, critical packages)
- Prisma schema and client
- tsconfig.json configuration
- Build output (dist directory)
- Environment files (.env)

**Exit codes**:
- `0`: No errors found
- `1`: Non-critical errors found
- `2`: Critical errors found (chat won't work)

---

#### 2. `fix_chat_typescript_errors.sh`

**Location**: `scripts/fix_chat_typescript_errors.sh`

**Purpose**: Automated fixing of common TypeScript errors

**Usage**:
```bash
./scripts/fix_chat_typescript_errors.sh
```

**What it fixes**:
1. Creates backups of important files
2. Installs/updates dependencies (`npm ci` or `npm install`)
3. Generates Prisma client
4. Optimizes tsconfig.json for development
5. Cleans old build artifacts
6. Verifies critical files exist
7. Builds the project
8. Verifies build output
9. Runs final TypeScript check
10. Checks environment configuration

**Logs**: Saves detailed logs to `backend/logs/`

---

### PowerShell Scripts (Windows)

#### 1. `Check-ChatTypeScriptErrors.ps1`

**Location**: `scripts/Check-ChatTypeScriptErrors.ps1`

**Purpose**: Windows version of the TypeScript error checker

**Usage**:
```powershell
# Basic check
.\scripts\Check-ChatTypeScriptErrors.ps1

# With detailed output
.\scripts\Check-ChatTypeScriptErrors.ps1 -Verbose

# Export JSON report
.\scripts\Check-ChatTypeScriptErrors.ps1 -ExportReport
```

**Parameters**:
- `-Verbose`: Show detailed output
- `-ExportReport`: Export results to JSON file in `logs/` directory

**Output**: Colored console output with section-by-section results

---

#### 2. `Fix-ChatTypeScriptErrors.ps1`

**Location**: `scripts/Fix-ChatTypeScriptErrors.ps1`

**Purpose**: Windows version of the automated fixer

**Usage**:
```powershell
# Standard fix
.\scripts\Fix-ChatTypeScriptErrors.ps1

# Skip backups (faster)
.\scripts\Fix-ChatTypeScriptErrors.ps1 -SkipBackup

# With detailed output
.\scripts\Fix-ChatTypeScriptErrors.ps1 -Verbose
```

**Parameters**:
- `-SkipBackup`: Skip creating backups (not recommended)
- `-Verbose`: Show detailed output

**Features**:
- Creates timestamped backups in `backend/backups/`
- Detailed logging to `backend/logs/`
- Progress indicators
- Final summary with next steps

---

## Platform-Specific Usage

### Linux/Unix/VPS

1. **Make scripts executable** (one time):
   ```bash
   chmod +x scripts/*.sh
   chmod +x .githooks/*
   ```

2. **Run checker**:
   ```bash
   cd /path/to/koda-webapp
   ./scripts/check_chat_typescript_errors.sh
   ```

3. **Run fixer**:
   ```bash
   ./scripts/fix_chat_typescript_errors.sh
   ```

4. **View logs**:
   ```bash
   ls -la backend/logs/
   cat backend/logs/fix_typescript_*.log
   ```

---

### Windows

1. **Open PowerShell as Administrator** (recommended)

2. **Set execution policy** (one time):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Run checker**:
   ```powershell
   cd C:\path\to\koda-webapp
   .\scripts\Check-ChatTypeScriptErrors.ps1
   ```

4. **Run fixer**:
   ```powershell
   .\scripts\Fix-ChatTypeScriptErrors.ps1
   ```

5. **View logs**:
   ```powershell
   Get-ChildItem backend\logs\ | Sort-Object LastWriteTime -Descending | Select-Object -First 5
   ```

---

## Git Hooks

### Setup

Run once after cloning the repository:

**Linux/Unix**:
```bash
./scripts/setup-git-hooks.sh
```

**Windows**:
```powershell
.\scripts\Setup-GitHooks.ps1
```

Or use npm:
```bash
npm run setup:hooks
```

### Available Hooks

#### Pre-Commit Hook

**Location**: `.githooks/pre-commit`

**Purpose**: Runs TypeScript checks on staged files before each commit

**What it does**:
1. Detects staged TypeScript files
2. Runs TypeScript compiler on backend and frontend
3. Checks if errors exist in staged files
4. Blocks commit if errors found in staged files

**Skip hook** (when needed):
```bash
git commit --no-verify
```

Or set environment variable:
```bash
SKIP_HOOKS=1 git commit -m "message"
```

### Hook Configuration

The git hooks path is configured in `.git/config`:
```ini
[core]
    hooksPath = .githooks
```

To disable hooks:
```bash
git config --unset core.hooksPath
```

---

## CI/CD Integration

### GitHub Actions

**Location**: `.github/workflows/typescript-checks.yml`

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Only when TypeScript files or configs change

**Jobs**:

1. **backend-typescript**: Checks backend TypeScript errors
2. **frontend-typescript**: Checks frontend TypeScript errors
3. **lint-backend**: Runs ESLint and Prettier checks
4. **build-test**: Tests full build process for both frontend and backend
5. **summary**: Generates summary of all checks

**Workflow Features**:
- ✅ Parallel job execution
- ✅ Uploads build artifacts (retained 7 days)
- ✅ Uploads TypeScript reports (retained 30 days)
- ✅ Generates job summary in GitHub UI
- ✅ Fails PR if critical checks fail

**View Results**:
1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select the workflow run
4. View logs and artifacts

---

## npm Scripts

### Root Package Scripts

From project root (`koda-webapp/`):

```bash
# Check TypeScript in both backend and frontend
npm run typecheck

# Check backend only
npm run typecheck:backend

# Check frontend only
npm run typecheck:frontend

# Check only chat-related files (fast)
npm run typecheck:chat

# Setup git hooks
npm run setup:hooks

# Run full TypeScript checker (bash script)
npm run check:typescript

# Run automated fixer (bash script)
npm run fix:typescript
```

---

### Backend Package Scripts

From backend directory (`koda-webapp/backend/`):

```bash
# Run TypeScript compiler without emitting files
npm run typecheck

# Watch mode - checks on file changes
npm run typecheck:watch

# Check only critical chat files (fast)
npm run typecheck:chat

# Run all checks (TypeScript + ESLint + Prettier)
npm run check:all

# Fix all fixable issues
npm run fix:all

# Individual checks
npm run lint          # ESLint check
npm run lint:fix      # Fix ESLint issues
npm run format:check  # Check Prettier formatting
npm run format        # Fix Prettier formatting
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module '@prisma/client'"

**Cause**: Prisma client not generated

**Fix**:
```bash
cd backend
npx prisma generate
```

Or run the fixer:
```bash
./scripts/fix_chat_typescript_errors.sh
```

---

#### 2. "Property 'users' does not exist on type 'PrismaClient'"

**Cause**: Prisma model names are plural (should be singular)

**Fix**: In your code, change:
```typescript
// Wrong
prisma.users
prisma.documents

// Correct
prisma.user
prisma.document
```

---

#### 3. "TypeScript compiler not found"

**Cause**: TypeScript not installed or node_modules missing

**Fix**:
```bash
cd backend
npm install
```

---

#### 4. 300+ TypeScript errors

**Cause**: Multiple issues (likely missing Prisma client + config issues)

**Fix**: Run the automated fixer:
```bash
./scripts/fix_chat_typescript_errors.sh
```

---

#### 5. Git hooks not running

**Cause**: Hooks path not configured or hooks not executable

**Fix**:
```bash
./scripts/setup-git-hooks.sh
```

Or manually:
```bash
git config core.hooksPath .githooks
chmod +x .githooks/*
```

---

#### 6. PowerShell script won't run

**Cause**: Execution policy restriction

**Fix**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

#### 7. Build succeeds but has TypeScript errors

**Cause**: `noEmitOnError` is `false` in tsconfig.json

**Explanation**: This is intentional for development. The code will still run, but you should fix the errors for production.

**Fix**: Run the checker to see errors:
```bash
npm run typecheck
```

---

### Debug Mode

For detailed debugging:

**Bash**:
```bash
set -x  # Enable debug mode
./scripts/check_chat_typescript_errors.sh
set +x  # Disable debug mode
```

**PowerShell**:
```powershell
$VerbosePreference = "Continue"
.\scripts\Check-ChatTypeScriptErrors.ps1
$VerbosePreference = "SilentlyContinue"
```

---

## Architecture

### Directory Structure

```
koda-webapp/
├── .github/
│   └── workflows/
│       └── typescript-checks.yml      # GitHub Actions workflow
├── .githooks/
│   └── pre-commit                     # Pre-commit hook
├── backend/
│   ├── logs/                          # Generated logs
│   ├── backups/                       # Backup files
│   ├── src/                           # Source code
│   ├── dist/                          # Compiled output
│   ├── tsconfig.json                  # TypeScript config
│   └── package.json                   # Dependencies & scripts
├── frontend/
│   ├── src/                           # Source code
│   └── package.json                   # Dependencies & scripts
├── scripts/
│   ├── check_chat_typescript_errors.sh        # Bash checker
│   ├── fix_chat_typescript_errors.sh          # Bash fixer
│   ├── Check-ChatTypeScriptErrors.ps1         # PowerShell checker
│   ├── Fix-ChatTypeScriptErrors.ps1           # PowerShell fixer
│   ├── setup-git-hooks.sh                     # Bash hook setup
│   └── Setup-GitHooks.ps1                     # PowerShell hook setup
├── docs/
│   └── TYPESCRIPT_ERROR_CHECKER.md            # This file
└── package.json                       # Root package scripts
```

---

### Script Flow

#### Checker Script Flow

```
1. Environment Check
   └── Node.js, npm, TypeScript versions

2. Directory Structure
   └── Verify required directories exist

3. Core File Checks
   └── Check each critical file individually

4. Full Compilation
   └── Run tsc --noEmit on entire project

5. Dependency Check
   └── Verify node_modules and critical packages

6. Prisma Check
   └── Validate schema and check client generation

7. Config Check
   └── Verify tsconfig.json settings

8. Build Check
   └── Verify dist/ directory and compiled files

9. Runtime Check
   └── Check .env and environment variables

10. Summary
    └── Generate report with recommendations
```

---

#### Fixer Script Flow

```
1. Backup
   └── Create timestamped backups of critical files

2. Install Dependencies
   └── npm ci or npm install

3. Generate Prisma Client
   └── Validate schema → Generate client

4. Optimize Config
   └── Update tsconfig.json for development

5. Clean Artifacts
   └── Remove old dist/ and build cache

6. Verify Files
   └── Check all critical files exist

7. Build Project
   └── Run npm run build

8. Verify Build
   └── Check dist/ output and file sizes

9. Final Check
   └── Run TypeScript compiler again

10. Environment
    └── Check/create .env file

11. Summary
    └── Report results and next steps
```

---

### Exit Codes

All scripts use standard exit codes:

- `0`: Success (no errors)
- `1`: Warning (non-critical errors)
- `2`: Failure (critical errors)

**Usage in scripts**:
```bash
./scripts/check_chat_typescript_errors.sh
if [ $? -eq 0 ]; then
  echo "All checks passed"
elif [ $? -eq 1 ]; then
  echo "Warnings found"
else
  echo "Critical errors found"
fi
```

---

## Best Practices

### Development Workflow

1. **Before starting work**:
   ```bash
   npm run typecheck
   ```

2. **During development** (optional):
   ```bash
   npm run typecheck:watch
   ```

3. **Before committing**:
   ```bash
   npm run check:all
   ```
   (Or let the pre-commit hook do it)

4. **Before pushing**:
   ```bash
   npm run typecheck
   npm run build
   ```

---

### Production Deployment

1. **Before deployment**:
   ```bash
   ./scripts/check_chat_typescript_errors.sh
   ```

2. **If errors found**:
   ```bash
   ./scripts/fix_chat_typescript_errors.sh
   ```

3. **Verify fix**:
   ```bash
   ./scripts/check_chat_typescript_errors.sh
   ```

4. **Deploy**:
   ```bash
   npm run build
   pm2 restart koda-backend
   ```

---

### CI/CD Best Practices

- ✅ Run checks on every PR
- ✅ Block merge if critical checks fail
- ✅ Allow non-critical warnings
- ✅ Cache dependencies for faster builds
- ✅ Upload artifacts for debugging
- ✅ Generate reports for visibility

---

## Performance

### Checker Script Performance

- **Full check**: ~30-60 seconds
- **Chat files only**: ~5-10 seconds
- **Individual file**: ~2-5 seconds

**Tips for faster checks**:
- Use `npm run typecheck:chat` for quick checks
- Use `--watch` mode during development
- Cache node_modules in CI/CD

---

### Fixer Script Performance

- **Full fix**: ~2-5 minutes (depending on internet speed)
- **Build only**: ~30-60 seconds

**Tips for faster fixes**:
- Use `npm ci` instead of `npm install` when possible
- Keep dependencies up to date
- Use `-SkipBackup` flag if backups not needed (PowerShell)

---

## Logs and Reports

### Log Locations

**Bash scripts**:
- Main log: `backend/logs/fix_typescript_YYYYMMDD_HHMMSS.log`
- Build log: `backend/logs/build_YYYYMMDD_HHMMSS.log`

**PowerShell scripts**:
- Main log: `backend\logs\fix_typescript_YYYYMMDD_HHMMSS.log`
- Build log: `backend\logs\build_YYYYMMDD_HHMMSS.log`
- JSON report: `backend\logs\typescript_check_report_YYYYMMDD_HHMMSS.json`

**GitHub Actions**:
- Workflow logs: Actions tab on GitHub
- Artifacts: Download from workflow run page

### Log Retention

- Local logs: Kept indefinitely (clean manually)
- GitHub Actions logs: 90 days
- GitHub Actions artifacts:
  - Build artifacts: 7 days
  - Reports: 30 days

---

## Support

### Getting Help

1. **Check this documentation** first
2. **Review logs** in `backend/logs/`
3. **Check GitHub Actions** logs if using CI/CD
4. **Run checker with verbose output**:
   ```bash
   # Bash
   ./scripts/check_chat_typescript_errors.sh | tee check-output.log

   # PowerShell
   .\scripts\Check-ChatTypeScriptErrors.ps1 -Verbose
   ```

---

### Reporting Issues

When reporting issues, include:
1. Operating system and version
2. Node.js version (`node --version`)
3. npm version (`npm --version`)
4. Full output from checker script
5. Relevant log files from `backend/logs/`
6. Steps to reproduce

---

## Changelog

### Version 1.0.0 (2025-12-02)

- ✅ Initial release
- ✅ Bash scripts for Linux/Unix/VPS
- ✅ PowerShell scripts for Windows
- ✅ Git pre-commit hooks
- ✅ GitHub Actions CI/CD workflow
- ✅ npm scripts integration
- ✅ Comprehensive documentation
- ✅ Detailed logging and reporting
- ✅ Error detection for chat functionality
- ✅ Automated fixing capabilities

---

## License

Part of the Koda webapp project.

---

## Credits

Created by the Koda development team.
Automated fixes inspired by common TypeScript errors in full-stack applications.

---

**Last Updated**: December 2, 2025
**Version**: 1.0.0
**Maintained by**: Koda Development Team
