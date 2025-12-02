#!/bin/bash

# Script to set up git hooks for the project
# Run this once after cloning the repository

echo "=========================================="
echo "🔧 Git Hooks Setup"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Determine script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

echo -e "${CYAN}Project root: $PROJECT_ROOT${NC}"
echo ""

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: .git directory not found!${NC}"
    echo "This script must be run from a git repository"
    exit 1
fi

# Check if .githooks directory exists
if [ ! -d ".githooks" ]; then
    echo -e "${YELLOW}⚠️  .githooks directory not found${NC}"
    echo "Creating .githooks directory..."
    mkdir -p .githooks
    echo -e "${GREEN}✅ Created .githooks directory${NC}"
fi

# Configure git to use .githooks directory
echo -e "${CYAN}Configuring git to use .githooks directory...${NC}"
git config core.hooksPath .githooks

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Git hooks path configured${NC}"
else
    echo -e "${RED}❌ Failed to configure git hooks path${NC}"
    exit 1
fi

echo ""

# Make hooks executable
echo -e "${CYAN}Making hooks executable...${NC}"

HOOKS_MADE_EXECUTABLE=0

for hook in .githooks/*; do
    if [ -f "$hook" ]; then
        chmod +x "$hook"
        HOOK_NAME=$(basename "$hook")
        echo -e "${GREEN}✅ $HOOK_NAME${NC}"
        ((HOOKS_MADE_EXECUTABLE++))
    fi
done

if [ $HOOKS_MADE_EXECUTABLE -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No hooks found in .githooks directory${NC}"
else
    echo -e "${GREEN}✅ Made $HOOKS_MADE_EXECUTABLE hook(s) executable${NC}"
fi

echo ""

# List configured hooks
echo -e "${CYAN}Configured hooks:${NC}"
for hook in .githooks/*; do
    if [ -f "$hook" ] && [ -x "$hook" ]; then
        HOOK_NAME=$(basename "$hook")
        echo "  • $HOOK_NAME"
    fi
done

echo ""

echo -e "${GREEN}✅ Git hooks setup complete!${NC}"
echo ""
echo -e "${CYAN}Available hooks:${NC}"
echo "  • pre-commit: Runs TypeScript checks before each commit"
echo ""
echo -e "${CYAN}To skip hooks temporarily:${NC}"
echo "  git commit --no-verify"
echo ""
echo -e "${CYAN}To disable hooks:${NC}"
echo "  git config --unset core.hooksPath"
echo ""
