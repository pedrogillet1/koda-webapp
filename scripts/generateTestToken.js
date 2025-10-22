/**
 * Generate a test JWT token for speed testing
 * Usage: node scripts/generateTestToken.js <userId> <email>
 */

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './backend/.env' });

const userId = process.argv[2] || '03ec97ac-1934-4188-8471-524366d87521'; // Default test user
const email = process.argv[3] || 'test@koda.com';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '7d';

if (!JWT_ACCESS_SECRET) {
  console.error('ERROR: JWT_ACCESS_SECRET not found in backend/.env');
  process.exit(1);
}

const payload = {
  userId,
  email
};

const token = jwt.sign(payload, JWT_ACCESS_SECRET, {
  expiresIn: JWT_ACCESS_EXPIRY
});

console.log('\n✅ Test JWT Token Generated:\n');
console.log(token);
console.log('\n📋 Payload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\n🔧 Usage:');
console.log(`export AUTH_TOKEN="${token}"`);
console.log('npm run test:speed\n');
