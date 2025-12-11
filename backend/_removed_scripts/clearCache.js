/**
 * Script to clear semantic cache for all users
 * This will remove all cached answers, fixing the poisoning issue
 */

const http = require('http');

// You need to get a valid JWT token from your browser's localStorage or cookie
// Open DevTools -> Application -> Local Storage -> find 'token' or 'accessToken'
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/chat/cache/semantic',
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

console.log('🗑️  Clearing semantic cache for all users...');
console.log(`📡 Connecting to: http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\n✅ Response Status: ${res.statusCode}`);
    console.log('📦 Response Body:', JSON.parse(data));

    if (res.statusCode === 200) {
      console.log('\n🎉 SUCCESS! Semantic cache cleared for all users!');
      console.log('💡 All users will now get fresh, correct answers.');
    } else {
      console.log('\n❌ ERROR: Cache clear failed');
      console.log('💡 Make sure you set a valid JWT_TOKEN');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\n💡 Make sure:');
  console.log('  1. Backend server is running on port 5000');
  console.log('  2. You have a valid JWT_TOKEN set');
});

req.end();
