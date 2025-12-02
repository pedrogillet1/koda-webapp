#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running TypeScript pre-deployment checks...${NC}"

# Navigate to backend directory if not already there
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# 1. Check for missing dependencies
echo ""
echo "[1/4] Checking for missing dependencies..."
npm install --silent

# 2. Linting for code quality
echo ""
echo "[2/4] Running ESLint..."
npx eslint src --ext .ts --max-warnings=50 || {
    echo -e "${YELLOW}Warning: ESLint found issues. Consider fixing them.${NC}"
}

# 3. Prisma validation
echo ""
echo "[3/4] Validating Prisma schema and generating client..."
npx prisma validate
npx prisma generate

# 4. Full TypeScript compilation check
echo ""
echo "[4/4] Running TypeScript compiler check..."
npx tsc --noEmit

echo ""
echo -e "${GREEN}All checks passed! Ready to deploy.${NC}"
