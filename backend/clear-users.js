const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function clearUserData() {
  try {
    console.log('🗑️  Deleting all user data...');

    // Delete in order to respect foreign key constraints
    await prisma.session.deleteMany({});
    console.log('✅ Deleted all sessions');

    await prisma.verificationCode.deleteMany({});
    console.log('✅ Deleted all verification codes');

    await prisma.user.deleteMany({});
    console.log('✅ Deleted all users');

    await prisma.pendingUser.deleteMany({});
    console.log('✅ Deleted all pending users');

    console.log('✨ All user data cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearUserData();
