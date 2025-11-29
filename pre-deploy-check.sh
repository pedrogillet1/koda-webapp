#!/bin/bash

################################################################################
# KODA Pre-Deployment Validation Script
#
# This script performs comprehensive checks before deployment to ensure:
# - All services are properly configured
# - Database schema is up to date
# - Code compiles without errors
# - All integrations are working
# - No critical issues exist
#
# Usage: ./pre-deploy-check.sh
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Log file
LOG_FILE="/tmp/koda-predeploy-$(date +%Y%m%d-%H%M%S).log"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_check() {
    echo -e "${YELLOW}⏳ Checking: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((PASSED++))
    echo "[PASS] $1" >> "$LOG_FILE"
}

print_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    ((FAILED++))
    echo "[FAIL] $1" >> "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARN: $1${NC}"
    ((WARNINGS++))
    echo "[WARN] $1" >> "$LOG_FILE"
}

print_info() {
    echo -e "${BLUE}ℹ️  INFO: $1${NC}"
}

################################################################################
# Check Functions
################################################################################

check_environment() {
    print_header "1. ENVIRONMENT CHECKS"

    # Check if running on correct directory
    print_check "Current directory is webapp"
    if [[ $(basename "$PWD") == "webapp" ]]; then
        print_success "Running in webapp directory"
    else
        print_fail "Not in webapp directory. Current: $PWD"
        return 1
    fi

    # Check Node.js version
    print_check "Node.js version"
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_fail "Node.js not installed"
        return 1
    fi

    # Check npm/pnpm
    print_check "Package manager"
    if command -v pnpm &> /dev/null; then
        PNPM_VERSION=$(pnpm -v)
        print_success "pnpm installed: $PNPM_VERSION"
    elif command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        print_warning "Using npm instead of pnpm: $NPM_VERSION"
    else
        print_fail "No package manager found"
        return 1
    fi

    # Check PM2
    print_check "PM2 process manager"
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 -v)
        print_success "PM2 installed: $PM2_VERSION"
    else
        print_warning "PM2 not installed (needed for production)"
    fi
}

check_dependencies() {
    print_header "2. DEPENDENCY CHECKS"

    # Check backend dependencies
    print_check "Backend node_modules"
    if [ -d "backend/node_modules" ]; then
        print_success "Backend dependencies installed"
    else
        print_fail "Backend dependencies missing. Run: cd backend && npm install"
        return 1
    fi

    # Check frontend dependencies
    print_check "Frontend node_modules"
    if [ -d "frontend/node_modules" ]; then
        print_success "Frontend dependencies installed"
    else
        print_fail "Frontend dependencies missing. Run: cd frontend && npm install"
        return 1
    fi

    # Check for outdated critical packages
    print_check "Critical package versions"
    cd backend
    if npm outdated | grep -E "(prisma|express|openai)" &> /dev/null; then
        print_warning "Some critical packages are outdated"
    else
        print_success "Critical packages up to date"
    fi
    cd ..
}

check_environment_variables() {
    print_header "3. ENVIRONMENT VARIABLE CHECKS"

    # Check backend .env
    print_check "Backend .env file"
    if [ -f "backend/.env" ]; then
        print_success "Backend .env exists"

        # Check critical variables
        source backend/.env

        print_check "DATABASE_URL"
        if [ -n "$DATABASE_URL" ]; then
            print_success "DATABASE_URL is set"
        else
            print_fail "DATABASE_URL is missing"
        fi

        print_check "OPENAI_API_KEY"
        if [ -n "$OPENAI_API_KEY" ]; then
            print_success "OPENAI_API_KEY is set"
        else
            print_fail "OPENAI_API_KEY is missing"
        fi

        print_check "JWT_SECRET"
        if [ -n "$JWT_SECRET" ]; then
            print_success "JWT_SECRET is set"
        else
            print_fail "JWT_SECRET is missing"
        fi

        print_check "UPSTASH_REDIS_URL"
        if [ -n "$UPSTASH_REDIS_URL" ]; then
            print_success "UPSTASH_REDIS_URL is set"
        else
            print_warning "UPSTASH_REDIS_URL is missing (caching disabled)"
        fi

    else
        print_fail "Backend .env file not found"
        return 1
    fi

    # Check frontend .env
    print_check "Frontend .env file"
    if [ -f "frontend/.env" ]; then
        print_success "Frontend .env exists"
    else
        print_warning "Frontend .env file not found (may use defaults)"
    fi
}

check_database() {
    print_header "4. DATABASE CHECKS"

    # Check Prisma schema
    print_check "Prisma schema file"
    if [ -f "backend/prisma/schema.prisma" ]; then
        print_success "Prisma schema exists"
    else
        print_fail "Prisma schema missing"
        return 1
    fi

    # Check database connection
    print_check "Database connection"
    cd backend
    if npx prisma db pull --force &> /dev/null; then
        print_success "Database connection successful"
    else
        print_fail "Cannot connect to database"
        cd ..
        return 1
    fi

    # Check if migrations are up to date
    print_check "Database migrations status"
    if npx prisma migrate status 2>&1 | grep -q "Database schema is up to date"; then
        print_success "Database schema is up to date"
    elif npx prisma migrate status 2>&1 | grep -q "pending migrations"; then
        print_fail "Pending database migrations. Run: npx prisma migrate deploy"
        cd ..
        return 1
    else
        print_warning "Cannot determine migration status"
    fi

    # Check for required tables
    print_check "Required database tables"
    REQUIRED_TABLES=("User" "Document" "DocumentChunk" "Folder" "Conversation" "Message")
    MISSING_TABLES=()

    for table in "${REQUIRED_TABLES[@]}"; do
        if npx prisma db execute --stdin <<< "SELECT 1 FROM \"$table\" LIMIT 1;" &> /dev/null; then
            echo -e "  ${GREEN}✓${NC} Table '$table' exists"
        else
            echo -e "  ${RED}✗${NC} Table '$table' missing"
            MISSING_TABLES+=("$table")
        fi
    done

    if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
        print_success "All required tables exist"
    else
        print_fail "Missing tables: ${MISSING_TABLES[*]}"
        cd ..
        return 1
    fi

    cd ..
}

check_typescript_compilation() {
    print_header "5. TYPESCRIPT COMPILATION CHECKS"

    # Check backend TypeScript
    print_check "Backend TypeScript compilation"
    cd backend
    if npm run build &> /tmp/backend-build.log; then
        print_success "Backend compiles without errors"
    else
        print_fail "Backend compilation failed. Check /tmp/backend-build.log"
        cat /tmp/backend-build.log | tail -20
        cd ..
        return 1
    fi
    cd ..

    # Check frontend TypeScript
    print_check "Frontend TypeScript compilation"
    cd frontend
    if npm run build &> /tmp/frontend-build.log; then
        print_success "Frontend compiles without errors"
    else
        print_fail "Frontend compilation failed. Check /tmp/frontend-build.log"
        cat /tmp/frontend-build.log | tail -20
        cd ..
        return 1
    fi
    cd ..
}

check_service_files() {
    print_header "6. SERVICE FILE CHECKS"

    # Check if new services exist
    REQUIRED_SERVICES=(
        "backend/src/services/systemPrompts.service.ts"
        "backend/src/services/fileActions.service.ts"
        "backend/src/services/rag.service.ts"
        "backend/src/services/conversationContext.service.ts"
        "backend/src/services/p0Features.service.ts"
        "backend/src/services/intelligentQuery.service.ts"
    )

    MISSING_SERVICES=()

    for service in "${REQUIRED_SERVICES[@]}"; do
        print_check "Service: $(basename $service)"
        if [ -f "$service" ]; then
            print_success "$(basename $service) exists"
        else
            print_fail "$(basename $service) missing"
            MISSING_SERVICES+=("$service")
        fi
    done

    if [ ${#MISSING_SERVICES[@]} -gt 0 ]; then
        print_fail "Missing services: ${MISSING_SERVICES[*]}"
        return 1
    fi
}

check_service_integrations() {
    print_header "7. SERVICE INTEGRATION CHECKS"

    # Check if P0 features are integrated in RAG controller
    print_check "P0 features integration in RAG controller"
    if grep -q "p0FeaturesService.preProcessQuery" backend/src/controllers/rag.controller.ts; then
        print_success "P0 features integrated in RAG controller"
    else
        print_warning "P0 features may not be integrated in RAG controller"
    fi

    # Check if intelligent query service is used
    print_check "Intelligent query service integration"
    if grep -q "intelligentQueryService" backend/src/controllers/rag.controller.ts || \
       grep -q "intelligentQueryService" backend/src/services/rag.service.ts; then
        print_success "Intelligent query service integrated"
    else
        print_warning "Intelligent query service may not be integrated"
    fi

    # Check if file actions service is used
    print_check "File actions service integration"
    if grep -q "fileActionsService" backend/src/controllers/rag.controller.ts; then
        print_success "File actions service integrated"
    else
        print_fail "File actions service not integrated"
        return 1
    fi
}

check_api_endpoints() {
    print_header "8. API ENDPOINT CHECKS"

    # Check if backend is running
    print_check "Backend server status"
    if pm2 list | grep -q "koda-backend.*online"; then
        print_success "Backend is running"
        BACKEND_RUNNING=true
    else
        print_warning "Backend is not running (will skip API tests)"
        BACKEND_RUNNING=false
        return 0
    fi

    if [ "$BACKEND_RUNNING" = true ]; then
        # Test health endpoint
        print_check "Health endpoint"
        if curl -s http://localhost:3000/health | grep -q "ok"; then
            print_success "Health endpoint responding"
        else
            print_fail "Health endpoint not responding"
        fi

        # Test API endpoints exist
        print_check "RAG endpoint"
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/rag/query | grep -q "401\|200"; then
            print_success "RAG endpoint exists"
        else
            print_fail "RAG endpoint not found"
        fi
    fi
}

check_code_quality() {
    print_header "9. CODE QUALITY CHECKS"

    # Check for console.log statements (should use logger)
    print_check "Console.log usage"
    CONSOLE_LOGS=$(grep -r "console\.log" backend/src --exclude-dir=node_modules | wc -l)
    if [ "$CONSOLE_LOGS" -gt 10 ]; then
        print_warning "Found $CONSOLE_LOGS console.log statements (consider using logger)"
    else
        print_success "Minimal console.log usage ($CONSOLE_LOGS found)"
    fi

    # Check for TODO comments
    print_check "TODO comments"
    TODO_COUNT=$(grep -r "TODO\|FIXME" backend/src --exclude-dir=node_modules | wc -l)
    if [ "$TODO_COUNT" -gt 0 ]; then
        print_info "Found $TODO_COUNT TODO/FIXME comments"
    fi

    # Check for hardcoded secrets
    print_check "Hardcoded secrets"
    if grep -r "sk-\|password.*=.*['\"]" backend/src --exclude-dir=node_modules | grep -v "\.env" &> /dev/null; then
        print_fail "Potential hardcoded secrets found"
        grep -r "sk-\|password.*=.*['\"]" backend/src --exclude-dir=node_modules | grep -v "\.env" | head -5
        return 1
    else
        print_success "No hardcoded secrets detected"
    fi
}

check_file_permissions() {
    print_header "10. FILE PERMISSION CHECKS"

    # Check if upload directory exists and is writable
    print_check "Upload directory"
    UPLOAD_DIR="backend/uploads"
    if [ -d "$UPLOAD_DIR" ]; then
        if [ -w "$UPLOAD_DIR" ]; then
            print_success "Upload directory exists and is writable"
        else
            print_fail "Upload directory is not writable"
            return 1
        fi
    else
        print_warning "Upload directory doesn't exist (will be created on first upload)"
    fi

    # Check log directory
    print_check "Log directory"
    LOG_DIR="backend/logs"
    if [ -d "$LOG_DIR" ]; then
        if [ -w "$LOG_DIR" ]; then
            print_success "Log directory exists and is writable"
        else
            print_fail "Log directory is not writable"
            return 1
        fi
    else
        print_warning "Log directory doesn't exist (will be created)"
    fi
}

check_git_status() {
    print_header "11. GIT STATUS CHECKS"

    # Check if in git repo
    print_check "Git repository"
    if git rev-parse --git-dir &> /dev/null; then
        print_success "In git repository"
    else
        print_warning "Not in a git repository"
        return 0
    fi

    # Check for uncommitted changes
    print_check "Uncommitted changes"
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes"
        git status --short | head -10
    else
        print_success "No uncommitted changes"
    fi

    # Check current branch
    print_check "Current branch"
    CURRENT_BRANCH=$(git branch --show-current)
    print_info "Current branch: $CURRENT_BRANCH"

    # Check if behind remote
    print_check "Remote sync status"
    git fetch &> /dev/null
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse @{u} 2>/dev/null)

    if [ "$LOCAL" = "$REMOTE" ]; then
        print_success "Up to date with remote"
    elif [ -z "$REMOTE" ]; then
        print_warning "No remote branch set"
    else
        print_warning "Local branch is not in sync with remote"
    fi
}

check_security() {
    print_header "12. SECURITY CHECKS"

    # Check .env is in .gitignore
    print_check ".env in .gitignore"
    if grep -q "\.env" .gitignore; then
        print_success ".env is in .gitignore"
    else
        print_fail ".env is NOT in .gitignore (security risk!)"
        return 1
    fi

    # Check node_modules in .gitignore
    print_check "node_modules in .gitignore"
    if grep -q "node_modules" .gitignore; then
        print_success "node_modules is in .gitignore"
    else
        print_warning "node_modules should be in .gitignore"
    fi

    # Check for exposed API keys in code
    print_check "Exposed API keys"
    if grep -r "OPENAI_API_KEY.*=.*sk-" backend/src --exclude-dir=node_modules &> /dev/null; then
        print_fail "OpenAI API key exposed in code!"
        return 1
    else
        print_success "No exposed API keys in code"
    fi
}

check_performance() {
    print_header "13. PERFORMANCE CHECKS"

    # Check bundle sizes
    print_check "Frontend bundle size"
    if [ -d "frontend/dist" ]; then
        BUNDLE_SIZE=$(du -sh frontend/dist | cut -f1)
        print_info "Frontend bundle size: $BUNDLE_SIZE"

        # Warn if bundle is too large
        BUNDLE_SIZE_MB=$(du -sm frontend/dist | cut -f1)
        if [ "$BUNDLE_SIZE_MB" -gt 10 ]; then
            print_warning "Frontend bundle is large (${BUNDLE_SIZE_MB}MB). Consider code splitting."
        else
            print_success "Frontend bundle size is reasonable"
        fi
    else
        print_warning "Frontend not built yet"
    fi

    # Check for large files in repo
    print_check "Large files in repository"
    LARGE_FILES=$(find . -type f -size +5M -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null)
    if [ -n "$LARGE_FILES" ]; then
        print_warning "Large files found in repository:"
        echo "$LARGE_FILES"
    else
        print_success "No large files in repository"
    fi
}

check_documentation() {
    print_header "14. DOCUMENTATION CHECKS"

    # Check README exists
    print_check "README.md"
    if [ -f "README.md" ]; then
        print_success "README.md exists"
    else
        print_warning "README.md missing"
    fi

    # Check API documentation
    print_check "API documentation"
    if [ -f "backend/API.md" ] || [ -f "docs/API.md" ]; then
        print_success "API documentation exists"
    else
        print_warning "API documentation missing"
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                  ║"
    echo "║          KODA PRE-DEPLOYMENT VALIDATION SCRIPT                   ║"
    echo "║                                                                  ║"
    echo "║  This script will perform comprehensive checks before deployment ║"
    echo "║                                                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    print_info "Starting validation at $(date)"
    print_info "Log file: $LOG_FILE"
    echo ""

    # Run all checks
    check_environment || true
    check_dependencies || true
    check_environment_variables || true
    check_database || true
    check_typescript_compilation || true
    check_service_files || true
    check_service_integrations || true
    check_api_endpoints || true
    check_code_quality || true
    check_file_permissions || true
    check_git_status || true
    check_security || true
    check_performance || true
    check_documentation || true

    # Print summary
    print_header "VALIDATION SUMMARY"

    echo -e "${GREEN}✅ Passed:   $PASSED${NC}"
    echo -e "${RED}❌ Failed:   $FAILED${NC}"
    echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
    echo ""

    # Determine overall status
    if [ $FAILED -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║                                                                  ║${NC}"
            echo -e "${GREEN}║                    ✅ ALL CHECKS PASSED ✅                        ║${NC}"
            echo -e "${GREEN}║                                                                  ║${NC}"
            echo -e "${GREEN}║              Ready to deploy to production! 🚀                   ║${NC}"
            echo -e "${GREEN}║                                                                  ║${NC}"
            echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
            exit 0
        else
            echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${YELLOW}║                                                                  ║${NC}"
            echo -e "${YELLOW}║                 ⚠️  PASSED WITH WARNINGS ⚠️                      ║${NC}"
            echo -e "${YELLOW}║                                                                  ║${NC}"
            echo -e "${YELLOW}║         You can deploy, but review warnings first               ║${NC}"
            echo -e "${YELLOW}║                                                                  ║${NC}"
            echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════╝${NC}"
            exit 0
        fi
    else
        echo -e "${RED}╔══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                                                  ║${NC}"
        echo -e "${RED}║                    ❌ VALIDATION FAILED ❌                        ║${NC}"
        echo -e "${RED}║                                                                  ║${NC}"
        echo -e "${RED}║              DO NOT DEPLOY - Fix errors first!                   ║${NC}"
        echo -e "${RED}║                                                                  ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${RED}Please fix the $FAILED failed check(s) before deploying.${NC}"
        echo -e "${BLUE}Check the log file for details: $LOG_FILE${NC}"
        exit 1
    fi
}

# Run main function
main
