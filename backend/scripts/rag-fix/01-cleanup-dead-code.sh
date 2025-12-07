#!/bin/bash
# 01-cleanup-dead-code.sh
# Removes dead files (unused code)
set -e # Exit on error

echo "🗑️ Starting dead code cleanup..."
echo ""

cd "$(dirname "$0")/../../src/services"

# Phase 1: Backup/patch files - ALREADY REMOVED (0 files)
echo "📦 Phase 1: Backup/patch files already removed"
echo ""

# Phase 2: Remove stub services (16 files that exist)
echo "📦 Phase 2: Removing stub services..."
rm -f conversationContext.service.ts
rm -f excelCellReader.service.ts
rm -f securityDashboard.service.ts
rm -f bruteForceProtection.service.ts
rm -f pii.service.ts
rm -f sessionManagement.service.ts
rm -f documentChunking.service.ts
rm -f gdpr.service.ts
rm -f backupEncryption.service.ts
rm -f auditLog.service.ts
rm -f twoFactor.service.ts
rm -f keyRotation.service.ts
rm -f dataRetention.service.ts
rm -f notification.service.ts
rm -f securityMonitoring.service.ts
rm -f rbac.service.ts
echo "✅ Removed 16 stub services"
echo ""

# Phase 3: Remove duplicate services (1 file that exists)
echo "📦 Phase 3: Removing duplicate services..."
rm -f confidence-scoring.service.ts
echo "✅ Removed 1 duplicate service"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup Complete!"
echo ""
echo "📊 Summary:"
echo "  - Removed 17 files total"
echo ""
echo "📝 Next steps:"
echo "  1. Check for broken imports"
echo "  2. Run TypeScript compiler"
echo "  3. Fix any import errors"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
