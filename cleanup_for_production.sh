#!/bin/bash

echo "================================"
echo "KODA Webapp Production Cleanup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}Current directory: $(pwd)${NC}"
echo ""

# Confirm cleanup
echo -e "${YELLOW}This script will clean up the codebase for production.${NC}"
echo "It will remove:"
echo "  - node_modules directories"
echo "  - Build artifacts"
echo "  - Temporary files"
echo "  - Optional: .git folder (not recommended)"
echo "  - Optional: OCR data files"
echo ""
read -p "Do you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Cleanup cancelled.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Starting cleanup...${NC}"
echo ""

# Function to remove directory safely
remove_dir() {
    if [ -d "$1" ]; then
        echo -e "${YELLOW}Removing: $1${NC}"
        rm -rf "$1"
        echo -e "${GREEN}✓ Removed${NC}"
    else
        echo -e "${YELLOW}Not found: $1 (skipping)${NC}"
    fi
}

# Function to remove file safely
remove_file() {
    if [ -f "$1" ]; then
        echo -e "${YELLOW}Removing: $1${NC}"
        rm -f "$1"
        echo -e "${GREEN}✓ Removed${NC}"
    else
        echo -e "${YELLOW}Not found: $1 (skipping)${NC}"
    fi
}

# Remove node_modules
echo "Step 1: Removing node_modules..."
remove_dir "backend/node_modules"
remove_dir "frontend/node_modules"
echo ""

# Remove build artifacts
echo "Step 2: Removing build artifacts..."
remove_dir "backend/dist"
remove_dir "frontend/build"
remove_dir "frontend/.next"
remove_dir "backend/.next"
echo ""

# Remove cache directories
echo "Step 3: Removing cache directories..."
remove_dir "backend/.cache"
remove_dir "frontend/.cache"
remove_dir ".cache"
remove_dir "backend/.turbo"
remove_dir "frontend/.turbo"
echo ""

# Remove log files
echo "Step 4: Removing log files..."
find . -name "*.log" -type f -delete 2>/dev/null
find . -name "npm-debug.log*" -type f -delete 2>/dev/null
find . -name "yarn-debug.log*" -type f -delete 2>/dev/null
find . -name "yarn-error.log*" -type f -delete 2>/dev/null
echo -e "${GREEN}✓ Log files removed${NC}"
echo ""

# Remove OS-specific files
echo "Step 5: Removing OS-specific files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null
find . -name "Thumbs.db" -type f -delete 2>/dev/null
find . -name "desktop.ini" -type f -delete 2>/dev/null
echo -e "${GREEN}✓ OS-specific files removed${NC}"
echo ""

# Remove temporary files
echo "Step 6: Removing temporary files..."
remove_dir "backend/tmp"
remove_dir "frontend/tmp"
remove_dir "backend/temp"
remove_dir "frontend/temp"
echo ""

# Remove coverage reports
echo "Step 7: Removing test coverage reports..."
remove_dir "backend/coverage"
remove_dir "frontend/coverage"
remove_dir "backend/.nyc_output"
remove_dir "frontend/.nyc_output"
echo ""

# Ask about .git folder
echo ""
read -p "Remove .git folder? (yes/no) [RECOMMENDED: no]: " remove_git
if [ "$remove_git" = "yes" ]; then
    remove_dir ".git"
else
    echo -e "${GREEN}Keeping .git folder for version control${NC}"
fi
echo ""

# Ask about OCR data
echo ""
read -p "Remove OCR data files? (yes/no): " remove_ocr
if [ "$remove_ocr" = "yes" ]; then
    remove_dir "backend/ocr_data"
    remove_dir "backend/public/ocr_data"
    echo -e "${GREEN}✓ OCR data removed${NC}"
else
    echo -e "${GREEN}Keeping OCR data${NC}"
fi
echo ""

# Remove other large/unnecessary files
echo "Step 8: Removing other unnecessary files..."
remove_file "backend/package-lock.json"
remove_file "frontend/package-lock.json"
remove_file "backend/yarn.lock"
remove_file "frontend/yarn.lock"
echo ""

# Display final sizes
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Directory sizes:"
if [ -d "backend" ]; then
    echo -ne "Backend:  "
    du -sh backend 2>/dev/null || echo "N/A"
fi
if [ -d "frontend" ]; then
    echo -ne "Frontend: "
    du -sh frontend 2>/dev/null || echo "N/A"
fi
echo ""
echo -e "${YELLOW}Note: You'll need to run 'npm install' in both backend and frontend${NC}"
echo -e "${YELLOW}before running the application again.${NC}"
echo ""
