const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const user = await prisma.users.upsert({
      where: { id: 'test-user-capabilities' },
      update: {},
      create: {
        id: 'test-user-capabilities',
        email: 'test-capabilities@koda.local',
        firstName: 'Test',
        lastName: 'User (Capabilities)',
        passwordHash: 'test-password-hash'
      }
    });
    console.log('✅ Test user created/verified:', user.id);
    console.log('   Email:', user.email);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createTestUser();
