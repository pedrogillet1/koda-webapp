#!/bin/bash

echo "🧪 Running E2E Tests"
echo "===================="
echo ""

# Check if backend is running
if ! curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
  echo "⚠️  Backend not running. Starting..."
  cd backend
  npm run dev > /tmp/backend.log 2>&1 &
  BACKEND_PID=$!
  cd ..
  echo "   Started backend (PID: $BACKEND_PID)"
  sleep 5
else
  echo "✅ Backend already running"
  BACKEND_PID=""
fi

# Check if frontend is running
if ! curl -s http://localhost:3000 >/dev/null 2>&1; then
  echo "⚠️  Frontend not running. Starting..."
  cd frontend
  npm start > /tmp/frontend.log 2>&1 &
  FRONTEND_PID=$!
  cd ..
  echo "   Started frontend (PID: $FRONTEND_PID)"
  sleep 10
else
  echo "✅ Frontend already running"
  FRONTEND_PID=""
fi

echo ""
echo "Running Playwright tests..."
npx playwright test --reporter=list

TEST_RESULT=$?

# Cleanup if we started services
if [ -n "$BACKEND_PID" ]; then
  echo ""
  echo "Stopping backend..."
  kill $BACKEND_PID 2>/dev/null || true
fi

if [ -n "$FRONTEND_PID" ]; then
  echo "Stopping frontend..."
  kill $FRONTEND_PID 2>/dev/null || true
fi

exit $TEST_RESULT
