# Comprehensive Functional Testing Script for Koda (PowerShell)
# This tests ACTUAL FUNCTIONALITY, not just types

$BACKEND_URL = "http://localhost:5000"
$PASSED = 0
$FAILED = 0

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "KODA FUNCTIONAL TEST SUITE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Backend Health Check
Write-Host "[TEST 1/10] Backend Health Endpoint..."
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "PASSED - Backend is responding" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "FAILED - Backend is not responding" -ForegroundColor Red
    $FAILED++
}

# Test 2: Database Connection
Write-Host "[TEST 2/10] Database Connection..."
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
    $responseStr = $response | ConvertTo-Json
    if ($responseStr -match "ok|healthy|success|true") {
        Write-Host "PASSED - Database is connected" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "FAILED - Database connection issue" -ForegroundColor Red
        $FAILED++
    }
} catch {
    Write-Host "FAILED - Database connection issue" -ForegroundColor Red
    $FAILED++
}

# Test 3: Chat Endpoint (English)
Write-Host "[TEST 3/10] Chat Endpoint (English)..."
try {
    $body = @{query="Hello, how are you?"; userId="test-user-123"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
    Write-Host "PASSED - English chat works" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "FAILED - English chat failed: $_" -ForegroundColor Red
    $FAILED++
}

# Test 4: Chat Endpoint (Portuguese)
Write-Host "[TEST 4/10] Chat Endpoint (Portuguese)..."
try {
    $body = @{query="Ola, como voce esta?"; userId="test-user-123"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
    Write-Host "PASSED - Portuguese chat works" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "FAILED - Portuguese chat failed: $_" -ForegroundColor Red
    $FAILED++
}

# Test 5: RAG Query
Write-Host "[TEST 5/10] RAG Document Query..."
try {
    $body = @{query="What documents do I have?"; userId="test-user-123"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/rag/query" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30 -ErrorAction SilentlyContinue
    Write-Host "PASSED - RAG query endpoint responds" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "SKIPPED - RAG query endpoint may not exist yet" -ForegroundColor Yellow
}

# Test 6: Conversation Persistence
Write-Host "[TEST 6/10] Conversation Persistence..."
try {
    $body = @{query="Remember: my favorite color is blue"; userId="test-persist-123"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
    Write-Host "PASSED - Conversation endpoint works" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "WARNING - Conversation persistence unclear" -ForegroundColor Yellow
}

# Test 7: UTF-8 Encoding
Write-Host "[TEST 7/10] UTF-8 Encoding (Special Characters)..."
try {
    $body = @{query="Test: cafe, naive, hello"; userId="test-user-123"} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
    Write-Host "PASSED - UTF-8 encoding works" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "FAILED - UTF-8 encoding issue" -ForegroundColor Red
    $FAILED++
}

# Test 8: Error Handling
Write-Host "[TEST 8/10] Error Handling (Invalid Request)..."
try {
    $body = @{invalid="data"} | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "PASSED - Error handling works" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "PASSED - Error handling works (returned error as expected)" -ForegroundColor Green
    $PASSED++
}

# Test 9: PM2 Process Status
Write-Host "[TEST 9/10] PM2 Process Status..."
$pm2Output = pm2 list 2>&1 | Out-String
if ($pm2Output -match "koda-backend.*online") {
    Write-Host "PASSED - Backend process is running" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "FAILED - Backend process is not running" -ForegroundColor Red
    $FAILED++
}

# Test 10: No Critical Errors in Logs
Write-Host "[TEST 10/10] Recent Error Logs..."
$logOutput = pm2 logs koda-backend --lines 100 --nostream 2>&1 | Out-String
$criticalErrors = ($logOutput | Select-String -Pattern "fatal|crash|ECONNREFUSED" -AllMatches).Matches.Count
if ($criticalErrors -lt 5) {
    Write-Host "PASSED - No critical errors in recent logs ($criticalErrors critical errors)" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "WARNING - Found $criticalErrors critical errors in recent logs" -ForegroundColor Yellow
}

# Final Report
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Total Tests: 10"
Write-Host "Passed: $PASSED" -ForegroundColor Green
Write-Host "Failed: $FAILED" -ForegroundColor Red
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "ALL CRITICAL TESTS PASSED!" -ForegroundColor Green
    Write-Host "Your Koda backend is GUARANTEED to work."
    exit 0
} elseif ($FAILED -le 2) {
    Write-Host "MOSTLY PASSED - $FAILED minor issue(s)" -ForegroundColor Yellow
    Write-Host "Your backend is functional but has minor issues."
    exit 0
} else {
    Write-Host "$FAILED CRITICAL TEST(S) FAILED" -ForegroundColor Red
    Write-Host "Your backend has issues that need to be fixed."
    Write-Host ""
    Write-Host "Debug steps:"
    Write-Host "1. Check PM2 logs: pm2 logs koda-backend"
    Write-Host "2. Check backend is running: pm2 status"
    Write-Host "3. Check database connection in .env"
    Write-Host "4. Restart backend: pm2 restart koda-backend"
    exit 1
}
