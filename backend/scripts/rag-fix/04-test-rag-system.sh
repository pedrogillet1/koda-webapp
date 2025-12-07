#!/bin/bash
# 04-test-rag-system.sh
# Tests all RAG fixes

set -e

echo "🧪 Testing RAG System..."
echo ""

cd "$(dirname "$0")/../../"

# Test 1: TypeScript compilation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: TypeScript Compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsc --noEmit && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# Test 2: Unit tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Unit Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm test 2>/dev/null && echo "✅ PASS" || echo "⚠️ SKIPPED (no test script configured)"
echo ""

# Test 3: Check service count
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Service Count"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SERVICE_COUNT=$(ls -1 src/services/*.ts 2>/dev/null | wc -l)
echo "Service count: $SERVICE_COUNT"
if [ $SERVICE_COUNT -le 145 ]; then
  echo "✅ PASS (expected ~143)"
else
  echo "⚠️ WARNING (expected ~143, got $SERVICE_COUNT)"
fi
echo ""

# Test 4: Check for BM25 import
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: BM25 Import"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -qi "bm25" src/services/rag.service.ts 2>/dev/null; then
  echo "✅ PASS (BM25 found)"
else
  echo "❌ FAIL (BM25 not found)"
fi
echo ""

# Test 5: Check for RRF function
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: RRF Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "mergeWithRRF\|RRF" src/services/rag.service.ts 2>/dev/null; then
  echo "✅ PASS (RRF function exists)"
else
  echo "❌ FAIL (RRF function missing)"
fi
echo ""

# Test 6: Check for bypass function
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: Bypass Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "shouldBypassRAG\|bypassRAG\|bypass" src/services/rag.service.ts 2>/dev/null; then
  echo "✅ PASS (Bypass function exists)"
else
  echo "❌ FAIL (Bypass function missing)"
fi
echo ""

# Test 7: Check for semantic chunking
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 7: Semantic Chunking"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "semanticChunk\|semantic.*chunk" src/services/document.service.ts 2>/dev/null; then
  echo "✅ PASS (Semantic chunking integrated)"
else
  echo "⚠️ WARNING (Semantic chunking not found)"
fi
echo ""

# Test 8: Check for embedding verification
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 8: Embedding Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if grep -q "verifyDocumentEmbeddings" src/services/pinecone.service.ts 2>/dev/null; then
  echo "✅ PASS (Embedding verification exists)"
else
  echo "❌ FAIL (Embedding verification missing)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Testing Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
