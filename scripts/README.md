# Scripts Directory

This directory contains all automation scripts for the Koda webapp.

## TypeScript Error Checking Scripts

### Quick Start

**Linux/Unix/VPS**:
```bash
# Check for errors
./scripts/check_chat_typescript_errors.sh

# Fix errors automatically
./scripts/fix_chat_typescript_errors.sh
```

**Windows**:
```powershell
# Check for errors
.\scripts\Check-ChatTypeScriptErrors.ps1

# Fix errors automatically
.\scripts\Fix-ChatTypeScriptErrors.ps1
```

**Using npm** (cross-platform):
```bash
npm run check:typescript
npm run fix:typescript
```

---

## Available Scripts

### TypeScript Checking

| Script | Platform | Purpose |
|--------|----------|---------|
| `check_chat_typescript_errors.sh` | Linux/Unix | Comprehensive TS error checker |
| `fix_chat_typescript_errors.sh` | Linux/Unix | Automated error fixer |
| `Check-ChatTypeScriptErrors.ps1` | Windows | TS error checker (PowerShell) |
| `Fix-ChatTypeScriptErrors.ps1` | Windows | Automated error fixer (PowerShell) |

### Git Hooks

| Script | Platform | Purpose |
|--------|----------|---------|
| `setup-git-hooks.sh` | Linux/Unix | Setup pre-commit hooks |
| `Setup-GitHooks.ps1` | Windows | Setup pre-commit hooks (PowerShell) |

---

## Script Permissions

### Make scripts executable (Linux/Unix):

```bash
chmod +x scripts/*.sh
```

### Allow PowerShell scripts (Windows):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Documentation

For complete documentation, see:
- **Full Documentation**: `docs/TYPESCRIPT_ERROR_CHECKER.md`
- **Original Guide**: `docs/TYPESCRIPT_ERROR_CHECKER_README.md` (legacy)

---

## Common Commands

### Check TypeScript errors:
```bash
# Root level
npm run typecheck

# Backend only
cd backend && npm run typecheck

# Chat files only (fast)
cd backend && npm run typecheck:chat
```

### Setup git hooks:
```bash
npm run setup:hooks
```

### Run all checks:
```bash
cd backend && npm run check:all
```

### Fix all issues:
```bash
cd backend && npm run fix:all
```

---

## Exit Codes

All scripts use standard exit codes:
- `0`: Success (no errors)
- `1`: Warning (non-critical errors)
- `2`: Failure (critical errors)

---

## Logs

Scripts generate logs in `backend/logs/`:
- `fix_typescript_*.log` - Fixer script logs
- `build_*.log` - Build process logs
- `typescript_check_report_*.json` - JSON reports (PowerShell only)

---

## Support

For issues or questions:
1. Check `docs/TYPESCRIPT_ERROR_CHECKER.md`
2. Review logs in `backend/logs/`
3. Run scripts with verbose output
4. Check GitHub Actions if using CI/CD

---

**Last Updated**: December 2, 2025
