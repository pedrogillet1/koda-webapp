#!/bin/bash

###############################################################################
# PM2 SETUP SCRIPT FOR KODA BACKEND
#
# This script sets up PM2 to run Koda backend in the background
###############################################################################

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PM2 SETUP FOR KODA BACKEND                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please do not run this script as root${NC}"
  exit 1
fi

# Install PM2 globally if not installed
echo -e "${YELLOW}[1/7] Checking PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}Installing PM2 globally...${NC}"
  npm install -g pm2
else
  echo -e "${GREEN}PM2 already installed${NC}"
fi
echo -e "${GREEN}✓ PM2 ready${NC}\n"

# Navigate to backend directory
BACKEND_DIR="/home/koda/koda-webapp/backend"
echo -e "${YELLOW}[2/7] Navigating to backend directory...${NC}"
if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${RED}Backend directory not found: $BACKEND_DIR${NC}"
  exit 1
fi
cd "$BACKEND_DIR"
echo -e "${GREEN}✓ In directory: $(pwd)${NC}\n"

# Create logs directory
echo -e "${YELLOW}[3/7] Creating logs directory...${NC}"
mkdir -p logs
chmod 755 logs
echo -e "${GREEN}✓ Logs directory created${NC}\n"

# Build the project
echo -e "${YELLOW}[4/7] Building TypeScript project...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}\n"

# Stop any existing PM2 processes
echo -e "${YELLOW}[5/7] Stopping existing processes...${NC}"
pm2 delete koda-backend 2>/dev/null || echo "No existing process to stop"
echo -e "${GREEN}✓ Cleaned up existing processes${NC}\n"

# Start backend with PM2
echo -e "${YELLOW}[6/7] Starting backend with PM2...${NC}"
pm2 start ecosystem.config.js
echo -e "${GREEN}✓ Backend started${NC}\n"

# Save PM2 process list
echo -e "${YELLOW}[7/7] Saving PM2 process list...${NC}"
pm2 save
echo -e "${GREEN}✓ Process list saved${NC}\n"

# Show status
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PM2 SETUP COMPLETE!                                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Display PM2 status
pm2 list

echo ""
echo -e "${GREEN}✓ Backend is now running in the background${NC}"
echo ""
echo -e "${YELLOW}To enable auto-start on boot, run:${NC}"
echo -e "${BLUE}pm2 startup${NC}"
echo -e "${YELLOW}Then copy and run the sudo command it outputs${NC}"
echo ""
echo -e "${YELLOW}Common commands:${NC}"
echo -e "  ${BLUE}pm2 list${NC}                  - List all processes"
echo -e "  ${BLUE}pm2 logs koda-backend${NC}     - View logs"
echo -e "  ${BLUE}pm2 restart koda-backend${NC}  - Restart backend"
echo -e "  ${BLUE}pm2 stop koda-backend${NC}     - Stop backend"
echo -e "  ${BLUE}pm2 monit${NC}                 - Real-time monitoring"
echo ""
echo -e "${GREEN}Your backend will now run forever in the background!${NC}"
echo -e "${GREEN}You can close this terminal and use unlimited other terminals.${NC}"
echo ""
