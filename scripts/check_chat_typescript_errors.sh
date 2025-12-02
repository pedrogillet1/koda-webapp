#!/bin/bash

# TypeScript Chat Error Checker - Enhanced Version
# This script checks for TypeScript errors specifically in chat-related files
# that could prevent the chat from working

set -e

echo "=========================================="
echo "🔍 KODA CHAT TYPESCRIPT ERROR CHECKER"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counter for errors
TOTAL_ERRORS=0
CRITICAL_ERRORS=0
WARNINGS=0

# Determine script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if we're in the right directory
if [ ! -d "$PROJECT_ROOT/backend" ]; then
    echo -e "${RED}❌ Error: backend directory not found!${NC}"
    echo "Current directory: $PROJECT_ROOT"
    echo "Please run this script from the project root or scripts directory"
    exit 1
fi

cd "$PROJECT_ROOT/backend"

echo "📂 Working directory: $(pwd)"
echo "📅 Date: $(date)"
echo ""

# Function to check if a file exists
check_file_exists() {
    local file=$1
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}⚠️  File not found: $file${NC}"
        return 1
    fi
    return 0
}

# Function to run TypeScript compiler on specific files
check_typescript_file() {
    local file=$1
    local description=$2

    echo -e "${BLUE}Checking: $description${NC}"
    echo "File: $file"

    if ! check_file_exists "$file"; then
        echo -e "${RED}❌ CRITICAL: File missing!${NC}"
        ((CRITICAL_ERRORS++))
        echo ""
        return 1
    fi

    # Run tsc on the specific file
    local errors=$(./node_modules/.bin/tsc --noEmit "$file" 2>&1 | grep -i "error" || true)

    if [ -z "$errors" ]; then
        echo -e "${GREEN}✅ No errors${NC}"
    else
        echo -e "${RED}❌ ERRORS FOUND:${NC}"
        echo "$errors" | head -10
        local error_count=$(echo "$errors" | wc -l)
        ((TOTAL_ERRORS += error_count))

        # Check if errors are critical (would prevent compilation)
        if echo "$errors" | grep -q "Cannot find\|is not defined\|has no exported member"; then
            ((CRITICAL_ERRORS++))
            echo -e "${RED}🚨 CRITICAL: Missing imports/modules/exports${NC}"
        fi
    fi

    echo ""
}

# Function to check directory structure
check_directory_structure() {
    echo -e "${CYAN}Checking directory structure...${NC}"
    local required_dirs=("src" "src/controllers" "src/services" "src/routes" "prisma")

    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            echo -e "${GREEN}✅ $dir exists${NC}"
        else
            echo -e "${RED}❌ $dir missing${NC}"
            ((CRITICAL_ERRORS++))
        fi
    done
    echo ""
}

# ============================================
# SECTION 0: ENVIRONMENT CHECK
# ============================================
echo "=========================================="
echo "SECTION 0: ENVIRONMENT CHECK"
echo "=========================================="
echo ""

echo -e "${BLUE}Node.js version:${NC}"
node --version || echo -e "${RED}Node.js not found${NC}"

echo -e "${BLUE}npm version:${NC}"
npm --version || echo -e "${RED}npm not found${NC}"

echo -e "${BLUE}TypeScript version:${NC}"
./node_modules/.bin/tsc --version 2>/dev/null || echo -e "${YELLOW}TypeScript not installed locally${NC}"

echo ""

check_directory_structure

# ============================================
# SECTION 1: CORE CHAT FILES
# ============================================
echo "=========================================="
echo "SECTION 1: CORE CHAT FILES"
echo "=========================================="
echo ""

check_typescript_file "src/controllers/chat.controller.ts" "Chat Controller"
check_typescript_file "src/controllers/chatDocument.controller.ts" "Chat Document Controller"
check_typescript_file "src/controllers/rag.controller.ts" "RAG Controller"
check_typescript_file "src/services/chat.service.ts" "Chat Service"
check_typescript_file "src/services/rag.service.ts" "RAG Service"
check_typescript_file "src/services/chatActions.service.ts" "Chat Actions Service"
check_typescript_file "src/services/conversationContext.service.ts" "Conversation Context Service" || true
check_typescript_file "src/services/conversationState.service.ts" "Conversation State Service" || true

# ============================================
# SECTION 2: ROUTES
# ============================================
echo "=========================================="
echo "SECTION 2: ROUTE REGISTRATION"
echo "=========================================="
echo ""

check_typescript_file "src/routes/chat.routes.ts" "Chat Routes"
check_typescript_file "src/routes/chatDocument.routes.ts" "Chat Document Routes"
check_typescript_file "src/routes/rag.routes.ts" "RAG Routes"
check_typescript_file "src/app.ts" "Main App (Route Registration)"

# ============================================
# SECTION 3: MODELS & TYPES
# ============================================
echo "=========================================="
echo "SECTION 3: MODELS & TYPES"
echo "=========================================="
echo ""

if [ -f "src/types/rag.types.ts" ]; then
    check_typescript_file "src/types/rag.types.ts" "RAG Types"
fi

echo -e "${BLUE}Checking for type definition files...${NC}"
TYPE_FILES=$(find src/types -name "*.ts" 2>/dev/null | wc -l || echo "0")
echo -e "${GREEN}Found $TYPE_FILES type definition files${NC}"
echo ""

# ============================================
# SECTION 4: FULL PROJECT COMPILATION TEST
# ============================================
echo "=========================================="
echo "SECTION 4: FULL COMPILATION TEST"
echo "=========================================="
echo ""

echo -e "${BLUE}Running full TypeScript compilation...${NC}"
echo ""

# Capture full compilation output
COMPILE_OUTPUT=$(./node_modules/.bin/tsc --noEmit 2>&1 || true)

# Count total errors
FULL_ERROR_COUNT=$(echo "$COMPILE_OUTPUT" | grep -c "error TS" || true)

if [ "$FULL_ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ Full compilation successful - NO ERRORS!${NC}"
else
    echo -e "${RED}❌ Found $FULL_ERROR_COUNT TypeScript errors in total project${NC}"
    echo ""
    echo "Top 20 errors:"
    echo "$COMPILE_OUTPUT" | grep "error TS" | head -20

    # Filter chat-related errors
    echo ""
    echo -e "${YELLOW}Chat-related errors:${NC}"
    CHAT_ERRORS=$(echo "$COMPILE_OUTPUT" | grep -i "chat\|rag\|conversation\|message" | grep "error TS" || echo "")
    if [ -z "$CHAT_ERRORS" ]; then
        echo "No chat-specific errors in output"
    else
        echo "$CHAT_ERRORS"
        CHAT_ERROR_COUNT=$(echo "$CHAT_ERRORS" | wc -l)
        echo ""
        echo -e "${MAGENTA}Total chat-related errors: $CHAT_ERROR_COUNT${NC}"
    fi
fi

echo ""

# ============================================
# SECTION 5: CRITICAL DEPENDENCY CHECK
# ============================================
echo "=========================================="
echo "SECTION 5: DEPENDENCY CHECK"
echo "=========================================="
echo ""

echo -e "${BLUE}Checking for missing dependencies...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ CRITICAL: node_modules directory not found!${NC}"
    echo "Run: npm install"
    ((CRITICAL_ERRORS++))
else
    echo -e "${GREEN}✅ node_modules exists${NC}"

    # Get node_modules size
    NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1 || echo "unknown")
    echo -e "${CYAN}   Size: $NODE_MODULES_SIZE${NC}"
fi

# Check for critical packages
CRITICAL_PACKAGES=("express" "prisma" "@prisma/client" "typescript" "openai" "socket.io")

for package in "${CRITICAL_PACKAGES[@]}"; do
    if [ -d "node_modules/$package" ]; then
        # Get package version if package.json exists
        if [ -f "node_modules/$package/package.json" ]; then
            VERSION=$(grep '"version"' "node_modules/$package/package.json" | head -1 | cut -d'"' -f4)
            echo -e "${GREEN}✅ $package@$VERSION${NC}"
        else
            echo -e "${GREEN}✅ $package installed${NC}"
        fi
    else
        echo -e "${RED}❌ CRITICAL: $package NOT installed${NC}"
        ((CRITICAL_ERRORS++))
    fi
done

echo ""

# Check package-lock.json exists
if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✅ package-lock.json exists${NC}"
else
    echo -e "${YELLOW}⚠️  package-lock.json missing - dependencies may be inconsistent${NC}"
    ((WARNINGS++))
fi

echo ""

# ============================================
# SECTION 6: PRISMA SCHEMA CHECK
# ============================================
echo "=========================================="
echo "SECTION 6: PRISMA SCHEMA CHECK"
echo "=========================================="
echo ""

if [ -f "prisma/schema.prisma" ]; then
    echo -e "${BLUE}Checking Prisma schema...${NC}"

    # Check if Prisma client is generated
    if ./node_modules/.bin/prisma validate 2>&1 | grep -q "validated successfully"; then
        echo -e "${GREEN}✅ Prisma schema is valid${NC}"
    else
        echo -e "${RED}❌ Prisma schema has errors${NC}"
        ./node_modules/.bin/prisma validate 2>&1 || true
        ((CRITICAL_ERRORS++))
    fi

    # Check if Prisma client is generated
    if [ -d "node_modules/.prisma/client" ] || [ -d "node_modules/@prisma/client" ]; then
        echo -e "${GREEN}✅ Prisma client is generated${NC}"

        # Check Prisma client version
        if [ -f "node_modules/@prisma/client/package.json" ]; then
            PRISMA_VERSION=$(grep '"version"' node_modules/@prisma/client/package.json | head -1 | cut -d'"' -f4)
            echo -e "${CYAN}   Prisma Client version: $PRISMA_VERSION${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Prisma client not generated. Run: npx prisma generate${NC}"
        ((WARNINGS++))
    fi

    # Count models in schema
    MODEL_COUNT=$(grep -c "^model " prisma/schema.prisma || echo "0")
    echo -e "${CYAN}   Models defined in schema: $MODEL_COUNT${NC}"
else
    echo -e "${RED}❌ CRITICAL: prisma/schema.prisma not found${NC}"
    ((CRITICAL_ERRORS++))
fi

echo ""

# ============================================
# SECTION 7: TSCONFIG CHECK
# ============================================
echo "=========================================="
echo "SECTION 7: TSCONFIG CHECK"
echo "=========================================="
echo ""

if [ -f "tsconfig.json" ]; then
    echo -e "${GREEN}✅ tsconfig.json exists${NC}"
    echo ""

    # Check for important compiler options
    echo -e "${CYAN}Compiler Options:${NC}"

    if grep -q '"skipLibCheck": true' tsconfig.json; then
        echo -e "${GREEN}✅ skipLibCheck: true${NC}"
    else
        echo -e "${YELLOW}⚠️  skipLibCheck not set to true${NC}"
        echo "   Consider setting to true to avoid library errors"
        ((WARNINGS++))
    fi

    if grep -q '"strict": true' tsconfig.json; then
        echo -e "${YELLOW}⚠️  strict mode is enabled - may cause more errors${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ strict mode is disabled${NC}"
    fi

    if grep -q '"noEmitOnError": true' tsconfig.json; then
        echo -e "${YELLOW}⚠️  noEmitOnError is true - compilation will fail on any error${NC}"
        echo "   Consider setting to false for development"
        ((WARNINGS++))
    fi

    # Check target and module
    TARGET=$(grep '"target"' tsconfig.json | cut -d'"' -f4 || echo "unknown")
    MODULE=$(grep '"module"' tsconfig.json | cut -d'"' -f4 || echo "unknown")
    echo -e "${CYAN}   Target: $TARGET${NC}"
    echo -e "${CYAN}   Module: $MODULE${NC}"
else
    echo -e "${RED}❌ CRITICAL: tsconfig.json not found${NC}"
    ((CRITICAL_ERRORS++))
fi

echo ""

# ============================================
# SECTION 8: BUILD OUTPUT CHECK
# ============================================
echo "=========================================="
echo "SECTION 8: BUILD OUTPUT CHECK"
echo "=========================================="
echo ""

if [ -d "dist" ]; then
    echo -e "${GREEN}✅ dist directory exists${NC}"

    # Count files in dist
    DIST_FILES=$(find dist -type f -name "*.js" 2>/dev/null | wc -l || echo "0")
    echo -e "${CYAN}   Compiled JS files: $DIST_FILES${NC}"

    # Check for critical compiled files
    CRITICAL_COMPILED=("dist/server.js" "dist/controllers/chat.controller.js" "dist/controllers/rag.controller.js")

    for file in "${CRITICAL_COMPILED[@]}"; do
        if [ -f "$file" ]; then
            FILE_SIZE=$(du -h "$file" 2>/dev/null | cut -f1 || echo "unknown")
            echo -e "${GREEN}✅ $file ($FILE_SIZE)${NC}"
        else
            echo -e "${YELLOW}⚠️  $file not found${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️  dist directory not found - project not built yet${NC}"
    echo "   Run: npm run build"
    ((WARNINGS++))
fi

echo ""

# ============================================
# SECTION 9: RUNTIME CHECKS
# ============================================
echo "=========================================="
echo "SECTION 9: RUNTIME CHECKS"
echo "=========================================="
echo ""

echo -e "${BLUE}Checking environment files...${NC}"

if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"

    # Check for critical env vars (without revealing values)
    REQUIRED_ENV_VARS=("DATABASE_URL" "JWT_SECRET" "OPENAI_API_KEY")

    for var in "${REQUIRED_ENV_VARS[@]}"; do
        if grep -q "^${var}=" .env 2>/dev/null; then
            echo -e "${GREEN}✅ $var is set${NC}"
        else
            echo -e "${YELLOW}⚠️  $var not found in .env${NC}"
            ((WARNINGS++))
        fi
    done
else
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    if [ -f ".env.example" ]; then
        echo "   Copy .env.example to .env and configure it"
    fi
    ((WARNINGS++))
fi

echo ""

# ============================================
# FINAL SUMMARY
# ============================================
echo "=========================================="
echo "📊 FINAL SUMMARY"
echo "=========================================="
echo ""

echo -e "${CYAN}Statistics:${NC}"
echo "• Total TypeScript errors: $FULL_ERROR_COUNT"
echo "• Critical errors (blocking): $CRITICAL_ERRORS"
echo "• Warnings: $WARNINGS"
echo ""

# Generate recommendations
if [ "$CRITICAL_ERRORS" -eq 0 ] && [ "$FULL_ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS! No errors found. Chat should work 100%${NC}"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Start the server: npm run dev"
    echo "2. Test chat endpoint: curl http://localhost:5000/api/health"
    echo "3. Monitor logs for any runtime errors"
    exit 0
elif [ "$CRITICAL_ERRORS" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Found $FULL_ERROR_COUNT non-critical errors${NC}"
    echo "Chat may work, but should fix these errors"
    echo ""
    echo -e "${CYAN}Recommended actions:${NC}"
    echo "1. Review error output above"
    echo "2. Run: npm run build to see detailed errors"
    echo "3. Fix type errors gradually"
    echo "4. Consider running: ./scripts/fix_chat_typescript_errors.sh"
    exit 1
else
    echo -e "${RED}🚨 CRITICAL ERRORS FOUND!${NC}"
    echo "Chat will NOT work until these are fixed"
    echo ""
    echo -e "${CYAN}Quick fixes to try:${NC}"
    echo "1. npm install                    # Install missing dependencies"
    echo "2. npx prisma generate            # Generate Prisma client"
    echo "3. ./scripts/fix_chat_typescript_errors.sh  # Run automated fixer"
    echo "4. npx tsc --noEmit               # See all errors in detail"
    echo ""

    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}Additionally, fix $WARNINGS warning(s) for better stability${NC}"
    fi
    exit 2
fi
