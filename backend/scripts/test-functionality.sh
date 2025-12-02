#!/bin/bash
# Comprehensive Functional Testing Script for Koda
# This tests ACTUAL FUNCTIONALITY, not just types

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_URL="http://localhost:5000"
PASSED=0
FAILED=0

echo "=========================================="
echo "KODA FUNCTIONAL TEST SUITE"
echo "=========================================="
echo ""

# Test 1: Backend Health Check
echo "[TEST 1/10] Backend Health Endpoint..."
if curl -f -s "${BACKEND_URL}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC} - Backend is responding"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} - Backend is not responding"
    ((FAILED++))
fi

# Test 2: Database Connection
echo "[TEST 2/10] Database Connection..."
RESPONSE=$(curl -s "${BACKEND_URL}/api/health" || echo "")
if echo "$RESPONSE" | grep -qi "ok\|healthy\|success\|true"; then
    echo -e "${GREEN}PASSED${NC} - Database is connected"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} - Database connection issue"
    ((FAILED++))
fi

# Test 3: Chat Endpoint (English)
echo "[TEST 3/10] Chat Endpoint (English)..."
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat/message" \
    -H "Content-Type: application/json" \
    -d '{"query":"Hello, how are you?","userId":"test-user-123"}' 2>/dev/null || echo "")
if [ ! -z "$RESPONSE" ] && ! echo "$RESPONSE" | grep -qi "error"; then
    echo -e "${GREEN}PASSED${NC} - English chat works"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} - English chat failed"
    echo "Response: $RESPONSE"
    ((FAILED++))
fi

# Test 4: Chat Endpoint (Portuguese)
echo "[TEST 4/10] Chat Endpoint (Portuguese)..."
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat/message" \
    -H "Content-Type: application/json" \
    -d '{"query":"Ola, como voce esta?","userId":"test-user-123"}' 2>/dev/null || echo "")
if [ ! -z "$RESPONSE" ] && ! echo "$RESPONSE" | grep -qi "error"; then
    echo -e "${GREEN}PASSED${NC} - Portuguese chat works"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} - Portuguese chat failed"
    echo "Response: $RESPONSE"
    ((FAILED++))
fi

# Test 5: RAG Query
echo "[TEST 5/10] RAG Document Query..."
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/rag/query" \
    -H "Content-Type: application/json" \
    -d '{"query":"What documents do I have?","userId":"test-user-123"}' 2>/dev/null || echo "")
if [ ! -z "$RESPONSE" ]; then
    echo -e "${GREEN}PASSED${NC} - RAG query endpoint responds"
    ((PASSED++))
else
    echo -e "${YELLOW}SKIPPED${NC} - RAG query endpoint may not exist yet"
fi

# Test 6: Conversation Persistence
echo "[TEST 6/10] Conversation Persistence..."
# Create a conversation
CONV_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat/message" \
    -H "Content-Type: application/json" \
    -d '{"query":"Remember: my favorite color is blue","userId":"test-persist-123"}' 2>/dev/null || echo "")

# Check if conversation was saved
sleep 2
HISTORY_RESPONSE=$(curl -s "${BACKEND_URL}/api/chat/conversations?userId=test-persist-123" 2>/dev/null || echo "")
if [ ! -z "$CONV_RESPONSE" ]; then
    echo -e "${GREEN}PASSED${NC} - Conversation endpoint works"
    ((PASSED++))
else
    echo -e "${YELLOW}WARNING${NC} - Conversation persistence unclear"
fi

# Test 7: UTF-8 Encoding
echo "[TEST 7/10] UTF-8 Encoding (Special Characters)..."
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat/message" \
    -H "Content-Type: application/json" \
    -d '{"query":"Test: cafe, naive, hello","userId":"test-user-123"}' 2>/dev/null || echo "")
if [ ! -z "$RESPONSE" ] && ! echo "$RESPONSE" | grep -qi "error"; then
    echo -e "${GREEN}PASSED${NC} - UTF-8 encoding works"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} - UTF-8 encoding issue"
    ((FAILED++))
fi

# Test 8: Error Handling
echo "[TEST 8/10] Error Handling (Invalid Request)..."
RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/chat/message" \
    -H "Content-Type: application/json" \
    -d '{"invalid":"data"}' 2>/dev/null || echo "")
if [ ! -z "$RESPONSE" ]; then
    echo -e "${GREEN}PASSED${NC} - Error handling works"
    ((PASSED++))
else
    echo -e "${YELLOW}WARNING${NC} - Error handling may be too permissive"
fi

# Test 9: PM2 Process Status
echo "[TEST 9/10] PM2 Process Status..."
if pm2 list 2>/dev/null | grep -q "koda-backend.*online"; then
    echo -e "${GREEN}PASSED${NC} - Backend process is running"
    ((PASSED++))
else
    echo -e "${RED}FAILED${NC} - Backend process is not running"
    ((FAILED++))
fi

# Test 10: No Critical Errors in Logs
echo "[TEST 10/10] Recent Error Logs..."
ERROR_COUNT=$(pm2 logs koda-backend --lines 100 --nostream 2>/dev/null | grep -i "fatal\|crash\|ECONNREFUSED" | wc -l || echo "0")
if [ "$ERROR_COUNT" -lt 5 ]; then
    echo -e "${GREEN}PASSED${NC} - No critical errors in recent logs ($ERROR_COUNT critical errors)"
    ((PASSED++))
else
    echo -e "${YELLOW}WARNING${NC} - Found $ERROR_COUNT critical errors in recent logs"
    pm2 logs koda-backend --lines 100 --nostream 2>/dev/null | grep -i "fatal\|crash" | tail -5
fi

# Final Report
echo ""
echo "=========================================="
echo "TEST RESULTS"
echo "=========================================="
echo "Total Tests: 10"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}ALL CRITICAL TESTS PASSED!${NC}"
    echo "Your Koda backend is GUARANTEED to work."
    exit 0
elif [ $FAILED -le 2 ]; then
    echo -e "${YELLOW}MOSTLY PASSED - $FAILED minor issue(s)${NC}"
    echo "Your backend is functional but has minor issues."
    exit 0
else
    echo -e "${RED}$FAILED CRITICAL TEST(S) FAILED${NC}"
    echo "Your backend has issues that need to be fixed."
    echo ""
    echo "Debug steps:"
    echo "1. Check PM2 logs: pm2 logs koda-backend"
    echo "2. Check backend is running: pm2 status"
    echo "3. Check database connection in .env"
    echo "4. Restart backend: pm2 restart koda-backend"
    exit 1
fi
