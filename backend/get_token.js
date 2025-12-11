const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'localhost@koda.com' },
    select: { id: true, email: true }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('User:', user);

  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET || 'k8mP2vXqL9nR4wYj6tF1hB3cZ5sA7uD0eG8iK2oM4qW6yT1xV3nJ5bH7fL9pU2rE',
    { expiresIn: '24h' }
  );

  console.log('TOKEN=' + token);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
