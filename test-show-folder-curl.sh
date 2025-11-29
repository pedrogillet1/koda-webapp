#!/bin/bash

# Test Show Folder Action via API
# Make sure the backend server is running on port 5001

echo "🧪 Testing Show Folder Action via API"
echo "========================================"
echo ""

# Get auth token (replace with your actual token or login first)
# For now, we'll assume you're logged in and have a token

# Test 1: List all folders to find one to test
echo "📋 Step 1: Getting list of folders..."
curl -s -X GET "http://localhost:5001/api/folders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  | jq '.'

echo ""
echo "Copy a folder name from above and test it manually with:"
echo ""
echo "curl -X POST http://localhost:5001/api/rag/stream \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  --data '{\"query\":\"show me the FOLDER_NAME folder\",\"conversationId\":\"test-123\"}'"
echo ""
