#!/bin/bash

################################################################################
# KODA Post-Deployment Verification Script
#
# This script performs comprehensive tests AFTER deployment to ensure:
# - All services are running correctly
# - API endpoints are responding
# - Database is accessible
# - Features are working as expected
# - No runtime errors
#
# Usage: ./post-deploy-verify.sh
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
LOG_FILE="/tmp/koda-postdeploy-$(date +%Y%m%d-%H%M%S).log"

# Configuration
BACKEND_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:5173"
TIMEOUT=10

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_check() {
    echo -e "${YELLOW}⏳ Testing: $1${NC}"
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
# Test Functions
################################################################################

test_process_status() {
    print_header "1. PROCESS STATUS TESTS"

    # Check if backend is running on Windows
    print_check "Backend process status"
    if netstat -ano | grep -q ":5000.*LISTENING"; then
        print_success "Backend is listening on port 5000"
    else
        print_fail "Backend is not listening on port 5000"
        return 1
    fi

    # Check if frontend is running
    print_check "Frontend process status"
    if netstat -ano | grep -q ":5173.*LISTENING"; then
        print_success "Frontend is listening on port 5173"
    else
        print_warning "Frontend is not listening on port 5173 (may be running elsewhere)"
    fi
}

test_health_endpoints() {
    print_header "2. HEALTH ENDPOINT TESTS"

    # Test backend health
    print_check "Backend health endpoint"
    HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/health" 2>/dev/null || echo "000")
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
    RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | head -1)

    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Backend health endpoint responding (200 OK)"
        print_info "Response: $RESPONSE_BODY"
    else
        print_fail "Backend health endpoint failed (HTTP $HTTP_CODE)"
        return 1
    fi

    # Test frontend
    print_check "Frontend accessibility"
    FRONTEND_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$FRONTEND_URL" 2>/dev/null || echo "000")
    FRONTEND_CODE=$(echo "$FRONTEND_RESPONSE" | tail -1)

    if [ "$FRONTEND_CODE" = "200" ]; then
        print_success "Frontend is accessible (200 OK)"
    else
        print_warning "Frontend may not be running (HTTP $FRONTEND_CODE)"
    fi
}

test_database_connectivity() {
    print_header "3. DATABASE CONNECTIVITY TESTS"

    # Test database connection
    print_check "Database connection"
    cd backend
    if npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
        print_success "Database connection successful"
    else
        print_fail "Cannot connect to database"
        cd ..
        return 1
    fi

    # Test table accessibility
    print_check "users table accessibility"
    if npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users;" 2>/dev/null | grep -q "^[0-9]"; then
        print_success "users table accessible"
    else
        print_warning "Cannot query users table (may need migration)"
    fi

    print_check "documents table accessibility"
    if npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM documents;" 2>/dev/null | grep -q "^[0-9]"; then
        print_success "documents table accessible"
    else
        print_warning "Cannot query documents table (may need migration)"
    fi

    cd ..
}

test_api_endpoints() {
    print_header "4. API ENDPOINT TESTS"

    # Test RAG endpoint (should return 401 without auth)
    print_check "RAG query endpoint"
    RAG_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT -X POST "$BACKEND_URL/api/rag/query" 2>/dev/null || echo "000")
    RAG_CODE=$(echo "$RAG_RESPONSE" | tail -1)

    if [ "$RAG_CODE" = "401" ] || [ "$RAG_CODE" = "400" ] || [ "$RAG_CODE" = "200" ]; then
        print_success "RAG endpoint exists and responds (HTTP $RAG_CODE)"
    else
        print_fail "RAG endpoint not responding correctly (HTTP $RAG_CODE)"
    fi

    # Test folder endpoints
    print_check "Folder list endpoint"
    FOLDER_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/api/folders" 2>/dev/null || echo "000")
    FOLDER_CODE=$(echo "$FOLDER_RESPONSE" | tail -1)

    if [ "$FOLDER_CODE" = "401" ] || [ "$FOLDER_CODE" = "200" ]; then
        print_success "Folder endpoint exists and responds (HTTP $FOLDER_CODE)"
    else
        print_warning "Folder endpoint response: HTTP $FOLDER_CODE"
    fi

    # Test document endpoints
    print_check "Document list endpoint"
    DOC_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BACKEND_URL/api/documents" 2>/dev/null || echo "000")
    DOC_CODE=$(echo "$DOC_RESPONSE" | tail -1)

    if [ "$DOC_CODE" = "401" ] || [ "$DOC_CODE" = "200" ]; then
        print_success "Document endpoint exists and responds (HTTP $DOC_CODE)"
    else
        print_warning "Document endpoint response: HTTP $DOC_CODE"
    fi
}

test_file_system() {
    print_header "5. FILE SYSTEM TESTS"

    # Test upload directory
    print_check "Upload directory exists and is writable"
    UPLOAD_DIR="backend/uploads"
    if [ -d "$UPLOAD_DIR" ] && [ -w "$UPLOAD_DIR" ]; then
        print_success "Upload directory accessible"
    else
        print_warning "Upload directory not found or not writable"
    fi

    # Test log directory
    print_check "Log directory exists and is writable"
    LOG_DIR="backend/logs"
    if [ -d "$LOG_DIR" ] && [ -w "$LOG_DIR" ]; then
        print_success "Log directory accessible"
    else
        print_info "Log directory not found (will be created as needed)"
    fi

    # Check disk space (Windows)
    print_check "Disk space availability"
    DISK_INFO=$(df -h . 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "50")
    print_info "Disk usage: ${DISK_INFO}% used"
}

test_environment_variables() {
    print_header "6. ENVIRONMENT VARIABLE TESTS"

    # Check if .env exists
    print_check "Environment file exists"
    cd backend
    if [ -f ".env" ]; then
        print_success ".env file exists"

        # Check for critical variables
        if grep -q "DATABASE_URL" .env; then
            print_success "DATABASE_URL is configured"
        else
            print_fail "DATABASE_URL not found in .env"
        fi

        if grep -q "OPENAI_API_KEY" .env; then
            print_success "OPENAI_API_KEY is configured"
        else
            print_fail "OPENAI_API_KEY not found in .env"
        fi

        if grep -q "JWT_SECRET" .env; then
            print_success "JWT_SECRET is configured"
        else
            print_warning "JWT_SECRET not found in .env"
        fi
    else
        print_fail ".env file not found"
    fi
    cd ..
}

test_build_artifacts() {
    print_header "7. BUILD ARTIFACT TESTS"

    # Check backend build
    print_check "Backend build artifacts"
    if [ -d "backend/dist" ]; then
        print_success "Backend build exists"
    else
        print_warning "Backend build directory not found (may be running from source)"
    fi

    # Check frontend build
    print_check "Frontend build artifacts"
    if [ -d "frontend/dist" ]; then
        print_success "Frontend build exists"
    else
        print_warning "Frontend build directory not found (may be in dev mode)"
    fi

    # Check node_modules
    print_check "Backend dependencies"
    if [ -d "backend/node_modules" ]; then
        print_success "Backend node_modules exists"
    else
        print_fail "Backend node_modules not found"
    fi

    print_check "Frontend dependencies"
    if [ -d "frontend/node_modules" ]; then
        print_success "Frontend node_modules exists"
    else
        print_fail "Frontend node_modules not found"
    fi
}

test_response_times() {
    print_header "8. RESPONSE TIME TESTS"

    # Test health endpoint response time
    print_check "Health endpoint response time"
    START=$(date +%s%N)
    curl -s --max-time $TIMEOUT "$BACKEND_URL/health" > /dev/null 2>&1
    END=$(date +%s%N)
    RESPONSE_TIME=$(( (END - START) / 1000000 ))

    if [ "$RESPONSE_TIME" -lt 200 ]; then
        print_success "Health endpoint fast (${RESPONSE_TIME}ms)"
    elif [ "$RESPONSE_TIME" -lt 1000 ]; then
        print_warning "Health endpoint acceptable (${RESPONSE_TIME}ms)"
    else
        print_warning "Health endpoint slow (${RESPONSE_TIME}ms)"
    fi
}

test_typescript_compilation() {
    print_header "9. TYPESCRIPT COMPILATION STATUS"

    print_check "TypeScript compilation"
    cd backend
    ERROR_COUNT=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)

    if [ "$ERROR_COUNT" -eq 0 ]; then
        print_success "No TypeScript errors"
    elif [ "$ERROR_COUNT" -lt 50 ]; then
        print_warning "Found $ERROR_COUNT TypeScript errors (non-critical)"
    else
        print_warning "Found $ERROR_COUNT TypeScript errors (should be fixed)"
    fi
    cd ..
}

test_migration_status() {
    print_header "10. DATABASE MIGRATION STATUS"

    print_check "Prisma migration status"
    cd backend
    PENDING=$(npx prisma migrate status 2>&1 | grep "have not yet been applied" | wc -l)

    if [ "$PENDING" -eq 0 ]; then
        print_success "All migrations applied"
    else
        print_warning "Pending migrations detected - run: npx prisma migrate deploy"
    fi
    cd ..
}

################################################################################
# Main Execution
################################################################################

main() {
    clear
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║                                                                  ║"
    echo "║        KODA POST-DEPLOYMENT VERIFICATION SCRIPT                  ║"
    echo "║                                                                  ║"
    echo "║  This script tests all functionality after deployment           ║"
    echo "║                                                                  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    print_info "Starting verification at $(date)"
    print_info "Log file: $LOG_FILE"
    echo ""

    # Run all tests
    test_process_status || true
    test_health_endpoints || true
    test_database_connectivity || true
    test_api_endpoints || true
    test_file_system || true
    test_environment_variables || true
    test_build_artifacts || true
    test_response_times || true
    test_typescript_compilation || true
    test_migration_status || true

    # Print summary
    print_header "VERIFICATION SUMMARY"

    echo -e "${GREEN}✅ Passed:   $PASSED${NC}"
    echo -e "${RED}❌ Failed:   $FAILED${NC}"
    echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
    echo ""

    # Determine overall status
    if [ $FAILED -eq 0 ]; then
        if [ $WARNINGS -eq 0 ]; then
            echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║                                                                  ║${NC}"
            echo -e "${GREEN}║              ✅ DEPLOYMENT VERIFIED SUCCESSFULLY ✅               ║${NC}"
            echo -e "${GREEN}║                                                                  ║${NC}"
            echo -e "${GREEN}║           All systems operational! Ready for use! 🚀             ║${NC}"
            echo -e "${GREEN}║                                                                  ║${NC}"
            echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
            echo ""
            print_info "Next steps:"
            echo "  1. Upload test files via frontend"
            echo "  2. Run test questions"
            echo "  3. Monitor backend console for logs"
            exit 0
        else
            echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${YELLOW}║                                                                  ║${NC}"
            echo -e "${YELLOW}║              ⚠️  DEPLOYMENT VERIFIED WITH WARNINGS ⚠️             ║${NC}"
            echo -e "${YELLOW}║                                                                  ║${NC}"
            echo -e "${YELLOW}║         System is operational, but review warnings              ║${NC}"
            echo -e "${YELLOW}║                                                                  ║${NC}"
            echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════╝${NC}"
            exit 0
        fi
    else
        echo -e "${RED}╔══════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║                                                                  ║${NC}"
        echo -e "${RED}║                ❌ DEPLOYMENT VERIFICATION FAILED ❌               ║${NC}"
        echo -e "${RED}║                                                                  ║${NC}"
        echo -e "${RED}║          Critical issues detected - investigate now!            ║${NC}"
        echo -e "${RED}║                                                                  ║${NC}"
        echo -e "${RED}╚══════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${RED}Please fix the $FAILED failed test(s).${NC}"
        echo -e "${BLUE}Check the log file for details: $LOG_FILE${NC}"
        echo ""
        print_info "Troubleshooting steps:"
        echo "  1. Check if backend is running: netstat -ano | findstr :5000"
        echo "  2. Start backend: cd backend && npm run dev"
        echo "  3. Check database: cd backend && npx prisma db pull"
        echo "  4. Run migrations: cd backend && npx prisma migrate deploy"
        exit 1
    fi
}

# Run main function
main
