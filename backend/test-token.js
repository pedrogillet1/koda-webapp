const jwt = require('jsonwebtoken');

// Use the same secret as in your .env
const JWT_SECRET = 'your-super-secret-jwt-access-key-change-this';

const token = jwt.sign(
  {
    userId: 'test-user',
    email: 'test@example.com',
    role: 'user'
  },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log(token);
