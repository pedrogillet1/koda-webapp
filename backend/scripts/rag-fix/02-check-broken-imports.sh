#!/bin/bash
# 02-check-broken-imports.sh
# Checks for imports of deleted services
set -e

echo "🔍 Checking for broken imports..."
echo ""

cd "$(dirname "$0")/../../src"

# List of deleted services (only the ones that were actually removed)
DELETED_SERVICES=(
  "conversationContext"
  "excelCellReader"
  "securityDashboard"
  "bruteForceProtection"
  "pii"
  "sessionManagement"
  "documentChunking"
  "gdpr"
  "backupEncryption"
  "auditLog"
  "twoFactor"
  "keyRotation"
  "dataRetention"
  "notification"
  "securityMonitoring"
  "rbac"
  "confidence-scoring"
)

# Check for imports
FOUND_IMPORTS=0
for service in "${DELETED_SERVICES[@]}"; do
  MATCHES=$(grep -r "from.*services.*${service}" . --include="*.ts" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "❌ Found import of deleted service: ${service}"
    echo "$MATCHES"
    echo ""
    FOUND_IMPORTS=$((FOUND_IMPORTS + 1))
  fi
done

echo ""
if [ $FOUND_IMPORTS -eq 0 ]; then
  echo "✅ No broken imports found!"
else
  echo "⚠️ Found ${FOUND_IMPORTS} broken imports"
  echo "  Please remove these imports manually"
fi
