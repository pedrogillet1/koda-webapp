const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');
require('dotenv').config();

const userId = '03ec97ac-1934-4188-8471-524366d87521';
const userEmail = 'pedrolimajn@gmail.com'; // Update this if needed
const jwtSecret = process.env.JWT_ACCESS_SECRET;

if (!jwtSecret) {
  console.error('❌ JWT_ACCESS_SECRET not found in .env file');
  process.exit(1);
}

// Generate JWT token with correct payload structure
const token = jwt.sign({ userId: userId, email: userEmail }, jwtSecret, { expiresIn: '1h' });

console.log('🔑 Generated JWT token for user:', userId);
console.log('🗑️  Calling DELETE /api/documents/delete-all...\n');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/documents/delete-all',
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📊 Response Status:', res.statusCode);
    console.log('📄 Response Body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));

      if (jsonData.deleted) {
        console.log(`\n✅ Successfully deleted ${jsonData.deleted} documents!`);
        if (jsonData.failed > 0) {
          console.log(`⚠️  Failed to delete ${jsonData.failed} documents`);
        }
      }
    } catch (error) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

req.end();
