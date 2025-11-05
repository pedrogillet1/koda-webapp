# Hybrid RAG Smoke Tests

## Test Setup
- Backend URL: http://localhost:5000
- User: Test user (ID from token)
- Date: 2025-11-04

## 5 Smoke Tests

### Test 1: Meta-Query - "what can you do"
**Expected**: Should detect meta-query, answer from knowledge without searching documents

### Test 2: Regular Query - "what does pedro1 talk about"
**Expected**: Should search pedro1 document and return relevant content

### Test 3: Comparison - "compare pedro 1 and lone mountain ranch excel"
**Expected**: Should detect comparison, retrieve from BOTH documents, provide comparison

### Test 4: File Action - "create folder Reports"
**Expected**: Should detect file action, respond naturally about creating folder

### Test 5: Meta-Query - "hello"
**Expected**: Should detect greeting, respond professionally

## Test Results
(To be filled after running tests)
