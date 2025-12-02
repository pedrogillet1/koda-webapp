#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Koda backend deployment...${NC}"

# Navigate to backend directory if not already there
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Step 1: Run all pre-deployment checks
echo ""
echo "--- Running Pre-Deployment Checks ---"
./scripts/check-types.sh

# Step 2: Clean old build
echo ""
echo "--- Cleaning Old Build ---"
rm -rf dist/

# Step 3: Build the project
echo ""
echo "--- Building Project ---"
npm run build

# Step 4: Restart the application with PM2
echo ""
echo "--- Restarting Application ---"
if pm2 list | grep -q "koda-backend"; then
    pm2 restart koda-backend
else
    pm2 start dist/server.js --name koda-backend
fi

echo ""
echo -e "${GREEN}Deployment successful! Koda is now live.${NC}"

pm2 status
