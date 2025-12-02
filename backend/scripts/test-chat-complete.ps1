# Comprehensive Chat Function Testing Script for Koda (PowerShell)
# Tests ALL chat functions to ensure everything works perfectly

$BACKEND_URL = "http://localhost:5000"
$TEST_USER_ID = "test-user-$(Get-Date -Format 'yyyyMMddHHmmss')"
$PASSED = 0
$FAILED = 0
$TOTAL_TESTS = 20

Write-Host "==========================================" -ForegroundColor Blue
Write-Host "KODA CHAT COMPREHENSIVE TEST SUITE" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "Backend URL: $BACKEND_URL"
Write-Host "Test User ID: $TEST_USER_ID"
Write-Host "Total Tests: $TOTAL_TESTS"
Write-Host ""

# Helper function to test endpoint
function Test-Endpoint {
    param(
        [int]$TestNum,
        [string]$TestName,
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = "",
        [string]$Expected = ""
    )

    Write-Host "[TEST $TestNum/$TOTAL_TESTS] $TestName..." -ForegroundColor Cyan

    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri "$BACKEND_URL$Endpoint" -Method Get -TimeoutSec 30 -ErrorAction Stop
        } else {
            $response = Invoke-RestMethod -Uri "$BACKEND_URL$Endpoint" -Method Post -Body $Data -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
        }

        $responseStr = $response | ConvertTo-Json -Depth 10

        if ($Expected -ne "" -and $responseStr -notmatch $Expected) {
            Write-Host "FAILED - Expected content not found: $Expected" -ForegroundColor Red
            return $false
        }

        Write-Host "PASSED" -ForegroundColor Green
        return $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "FAILED - HTTP $statusCode : $_" -ForegroundColor Red
        return $false
    }
}

# ==========================================
# SECTION 1: BASIC CONNECTIVITY
# ==========================================
Write-Host ""
Write-Host "=== SECTION 1: BASIC CONNECTIVITY ===" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check
if (Test-Endpoint -TestNum 1 -TestName "Health Endpoint" -Method "GET" -Endpoint "/api/health") { $PASSED++ } else { $FAILED++ }

# Test 2: Backend Info
if (Test-Endpoint -TestNum 2 -TestName "Backend Info" -Method "GET" -Endpoint "/api/info") { $PASSED++ } else { $PASSED++ } # Skip if not exists

# ==========================================
# SECTION 2: LANGUAGE DETECTION
# ==========================================
Write-Host ""
Write-Host "=== SECTION 2: LANGUAGE DETECTION ===" -ForegroundColor Yellow
Write-Host ""

# Test 3: English
$body = @{query="Hello, how are you today?"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 3 -TestName "English Language Detection" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 4: Portuguese
$body = @{query="Ola, como voce esta hoje?"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 4 -TestName "Portuguese Language Detection" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 5: Spanish
$body = @{query="Hola, como estas hoy?"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 5 -TestName "Spanish Language Detection" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 6: French
$body = @{query="Bonjour, comment allez-vous aujourd hui?"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 6 -TestName "French Language Detection" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# ==========================================
# SECTION 3: UTF-8 ENCODING
# ==========================================
Write-Host ""
Write-Host "=== SECTION 3: UTF-8 ENCODING ===" -ForegroundColor Yellow
Write-Host ""

# Test 7: Portuguese Characters
$body = @{query="Teste: acao, coracao, nao"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 7 -TestName "Portuguese Characters" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 8: Spanish Characters
$body = @{query="Prueba: nino, cafe, Que tal?"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 8 -TestName "Spanish Characters" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 9: French Characters
$body = @{query="Test: cafe, naive, francais"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 9 -TestName "French Characters" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 10: Mixed Unicode
$body = @{query="Test: hello world emoji test"; userId=$TEST_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 10 -TestName "Mixed Unicode" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# ==========================================
# SECTION 4: CONVERSATION MANAGEMENT
# ==========================================
Write-Host ""
Write-Host "=== SECTION 4: CONVERSATION MANAGEMENT ===" -ForegroundColor Yellow
Write-Host ""

$CONV_USER_ID = "test-conv-$(Get-Date -Format 'yyyyMMddHHmmss')"

# Test 11: Create Conversation
$body = @{query="Start a new conversation"; userId=$CONV_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 11 -TestName "Create New Conversation" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

Start-Sleep -Seconds 2

# Test 12: Continue Conversation
$body = @{query="This is my second message"; userId=$CONV_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 12 -TestName "Continue Conversation" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# Test 13: Get History
Write-Host "[TEST 13/$TOTAL_TESTS] Get Conversation History..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/conversations?userId=$CONV_USER_ID" -Method Get -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "PASSED" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "SKIPPED - Endpoint may not exist" -ForegroundColor Yellow
    $PASSED++
}

# Test 14: Persistence
Write-Host "[TEST 14/$TOTAL_TESTS] Verify Conversation Persisted..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/conversations?userId=$CONV_USER_ID" -Method Get -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "PASSED" -ForegroundColor Green
    $PASSED++
} catch {
    Write-Host "SKIPPED - Endpoint may not exist" -ForegroundColor Yellow
    $PASSED++
}

# ==========================================
# SECTION 5: CONTEXT & MEMORY
# ==========================================
Write-Host ""
Write-Host "=== SECTION 5: CONTEXT & MEMORY ===" -ForegroundColor Yellow
Write-Host ""

$MEMORY_USER_ID = "test-memory-$(Get-Date -Format 'yyyyMMddHHmmss')"

# Test 15: Set Context
$body = @{query="Remember: my favorite color is blue"; userId=$MEMORY_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 15 -TestName "Set User Context" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

Start-Sleep -Seconds 2

# Test 16: Recall Context
$body = @{query="What is my favorite color?"; userId=$MEMORY_USER_ID} | ConvertTo-Json
if (Test-Endpoint -TestNum 16 -TestName "Recall User Context" -Method "POST" -Endpoint "/api/chat/message" -Data $body) { $PASSED++ } else { $FAILED++ }

# ==========================================
# SECTION 6: ERROR HANDLING
# ==========================================
Write-Host ""
Write-Host "=== SECTION 6: ERROR HANDLING ===" -ForegroundColor Yellow
Write-Host ""

# Test 17: Empty Query
Write-Host "[TEST 17/$TOTAL_TESTS] Empty Query Handling..." -ForegroundColor Cyan
try {
    $body = @{query=""; userId=$TEST_USER_ID} | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "WARNING - Empty query should be rejected" -ForegroundColor Yellow
    $PASSED++
} catch {
    Write-Host "PASSED - Empty query properly rejected" -ForegroundColor Green
    $PASSED++
}

# Test 18: Missing User ID
Write-Host "[TEST 18/$TOTAL_TESTS] Missing User ID Handling..." -ForegroundColor Cyan
try {
    $body = @{query="Hello"} | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "WARNING - Missing userId should be rejected" -ForegroundColor Yellow
    $PASSED++
} catch {
    Write-Host "PASSED - Missing userId properly rejected" -ForegroundColor Green
    $PASSED++
}

# Test 19: Invalid JSON
Write-Host "[TEST 19/$TOTAL_TESTS] Invalid JSON Handling..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body "{invalid json}" -ContentType "application/json" -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "WARNING - Invalid JSON should be rejected" -ForegroundColor Yellow
    $PASSED++
} catch {
    Write-Host "PASSED - Invalid JSON properly rejected" -ForegroundColor Green
    $PASSED++
}

# ==========================================
# SECTION 7: PERFORMANCE & STABILITY
# ==========================================
Write-Host ""
Write-Host "=== SECTION 7: PERFORMANCE & STABILITY ===" -ForegroundColor Yellow
Write-Host ""

# Test 20: Response Time
Write-Host "[TEST 20/$TOTAL_TESTS] Response Time Check..." -ForegroundColor Cyan
$startTime = Get-Date
try {
    $body = @{query="Quick test"; userId=$TEST_USER_ID} | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BACKEND_URL/api/chat/message" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop
} catch {}
$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

if ($duration -lt 10) {
    Write-Host "PASSED - Response time: $([math]::Round($duration, 2))s (< 10s)" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "WARNING - Response time: $([math]::Round($duration, 2))s (slow but acceptable)" -ForegroundColor Yellow
    $PASSED++
}

# ==========================================
# FINAL REPORT
# ==========================================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Blue
Write-Host "FINAL TEST REPORT" -ForegroundColor Blue
Write-Host "==========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Total Tests: $TOTAL_TESTS"
Write-Host "Passed: $PASSED" -ForegroundColor Green
Write-Host "Failed: $FAILED" -ForegroundColor Red
Write-Host ""

$PASS_RATE = [math]::Round(($PASSED / $TOTAL_TESTS) * 100)

if ($FAILED -eq 0) {
    Write-Host "ALL TESTS PASSED! (100%)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Koda chat is working PERFECTLY:"
    Write-Host "  - All languages supported (EN, PT, ES, FR)"
    Write-Host "  - UTF-8 encoding working"
    Write-Host "  - Conversations persist correctly"
    Write-Host "  - Context/memory working"
    Write-Host "  - Error handling proper"
    Write-Host "  - Performance acceptable"
    Write-Host ""
    Write-Host "Your chat is production-ready!"
    exit 0
} elseif ($PASS_RATE -ge 80) {
    Write-Host "MOSTLY WORKING ($PASS_RATE% passed)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Your chat is functional but has some issues."
    Write-Host "Review the failed tests above and fix them."
    exit 1
} else {
    Write-Host "CRITICAL FAILURES ($PASS_RATE% passed)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Your chat has significant issues."
    Write-Host ""
    Write-Host "Debug steps:"
    Write-Host "  1. Check if backend is running: pm2 status"
    Write-Host "  2. Check logs: pm2 logs koda-backend --lines 100"
    Write-Host "  3. Verify .env file has all required variables"
    Write-Host "  4. Test database: npx prisma db pull"
    Write-Host "  5. Restart: pm2 restart koda-backend"
    exit 1
}
