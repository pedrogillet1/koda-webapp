# TypeScript Error Checker - Quick Reference Card

## 🚀 Quick Commands

### Linux/Unix/VPS
```bash
# Check errors
./scripts/check_chat_typescript_errors.sh

# Fix errors
./scripts/fix_chat_typescript_errors.sh

# Setup hooks
./scripts/setup-git-hooks.sh
```

### Windows
```powershell
# Check errors
.\scripts\Check-ChatTypeScriptErrors.ps1

# Fix errors
.\scripts\Fix-ChatTypeScriptErrors.ps1

# Setup hooks
.\scripts\Setup-GitHooks.ps1
```

### npm Scripts (Cross-Platform)
```bash
npm run check:typescript      # Check TS errors
npm run fix:typescript        # Fix TS errors
npm run typecheck            # Check both frontend/backend
npm run typecheck:chat       # Check chat files only (fast)
npm run setup:hooks          # Setup git hooks
```

---

## 📊 Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | ✅ No errors | Deploy/commit safely |
| 1 | ⚠️ Warnings | Fix recommended |
| 2 | ❌ Critical | Must fix before deploy |

---

## 🔧 Common Fixes

### 1. Missing Prisma Client
```bash
cd backend && npx prisma generate
```

### 2. Wrong Model Names
```typescript
// ❌ Wrong
prisma.users

// ✅ Correct
prisma.user
```

### 3. Missing Dependencies
```bash
cd backend && npm install
```

### 4. Build Errors
```bash
cd backend
rm -rf dist/
npm run build
```

### 5. 300+ Errors
```bash
./scripts/fix_chat_typescript_errors.sh
```

---

## 🪝 Git Hooks

### Skip hooks temporarily
```bash
git commit --no-verify
```

### Disable hooks
```bash
git config --unset core.hooksPath
```

### Re-enable hooks
```bash
npm run setup:hooks
```

---

## 📝 Logs Location

**All platforms**:
- `backend/logs/fix_typescript_*.log`
- `backend/logs/build_*.log`
- `backend/logs/typescript_check_report_*.json` (Windows only)

**View recent logs**:
```bash
# Linux/Unix
ls -lt backend/logs/ | head -10

# Windows
Get-ChildItem backend\logs\ | Sort-Object LastWriteTime -Descending | Select-Object -First 10
```

---

## 🎯 Critical Files Checked

- `src/controllers/chat.controller.ts`
- `src/controllers/rag.controller.ts`
- `src/services/chat.service.ts`
- `src/services/rag.service.ts`
- `src/routes/chat.routes.ts`
- `src/routes/rag.routes.ts`
- `src/app.ts`

---

## ⚡ Performance Tips

| Command | Speed | When to Use |
|---------|-------|-------------|
| `npm run typecheck:chat` | ⚡⚡⚡ Fast (5-10s) | Quick chat check |
| `npm run typecheck` | ⚡⚡ Medium (30-60s) | Full check |
| `npm run check:all` | ⚡ Slow (1-2m) | Before commit |

---

## 🐛 Troubleshooting Flowchart

```
TypeScript errors found?
    │
    ├─ Yes → Run fixer script
    │         │
    │         ├─ Fixed? → ✅ Done
    │         │
    │         └─ Still errors?
    │               │
    │               ├─ Check logs in backend/logs/
    │               ├─ Verify node_modules exists
    │               ├─ Run: npx prisma generate
    │               └─ Check tsconfig.json
    │
    └─ No → ✅ Deploy/commit safely
```

---

## 📞 Support Checklist

Before asking for help, check:
- [ ] Reviewed this quick reference
- [ ] Ran checker script with full output
- [ ] Checked logs in `backend/logs/`
- [ ] Verified Node.js and npm versions
- [ ] Tried running the fixer script
- [ ] Checked `docs/TYPESCRIPT_ERROR_CHECKER.md`

---

## 🎨 Script Color Codes

| Color | Meaning |
|-------|---------|
| 🔵 Blue | Info/running |
| 🟢 Green | Success |
| 🟡 Yellow | Warning |
| 🔴 Red | Error |
| 🔷 Cyan | Section header |

---

## ⌨️ Keyboard Shortcuts

### During script execution:
- `Ctrl+C` - Stop script
- `Ctrl+Z` - Suspend (Unix/Linux)
- `Ctrl+Break` - Stop (Windows PowerShell)

### View logs in terminal:
```bash
# Last 50 lines
tail -50 backend/logs/fix_typescript_*.log

# Follow log in real-time
tail -f backend/logs/fix_typescript_*.log

# Search in log
grep "error" backend/logs/fix_typescript_*.log
```

---

## 📦 Quick Installation

### First time setup:
```bash
# 1. Clone repository
git clone <repo-url>
cd koda-webapp

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Setup git hooks
cd ..
npm run setup:hooks

# 4. Check everything works
npm run check:typescript
```

---

## 🔄 CI/CD Integration

**GitHub Actions** automatically runs on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Changes to `.ts` or `.tsx` files

**View results**:
1. Go to repository → Actions tab
2. Select latest workflow run
3. View logs and download artifacts

---

## 💡 Pro Tips

1. **Use watch mode during development**:
   ```bash
   cd backend && npm run typecheck:watch
   ```

2. **Check only changed files before commit**:
   ```bash
   git diff --name-only | grep "\.ts$" | xargs npx tsc --noEmit
   ```

3. **Export PowerShell report for sharing**:
   ```powershell
   .\scripts\Check-ChatTypeScriptErrors.ps1 -ExportReport
   ```

4. **Create alias for quick access** (Linux/Unix):
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   alias tscheck='./scripts/check_chat_typescript_errors.sh'
   alias tsfix='./scripts/fix_chat_typescript_errors.sh'
   ```

5. **Pre-commit checks in VS Code**:
   - Install "TypeScript Error Lens" extension
   - Enable "TypeScript: Check JS" in settings
   - Use "Problems" panel to see all errors

---

## 📅 Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Check errors | Before every commit | `npm run typecheck` |
| Full check | Daily | `npm run check:all` |
| Clean logs | Weekly | `rm backend/logs/*.log` |
| Update dependencies | Monthly | `npm update` |
| Review backups | Monthly | `ls -lh backend/backups/` |

---

**Quick Access**: Pin this file for easy reference!
**Last Updated**: December 2, 2025
