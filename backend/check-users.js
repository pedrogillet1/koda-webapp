const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      include: {
        twoFactorAuth: true,
      }
    });

    console.log('\n📊 Users in database:', users.length);
    console.log('\n👥 User details:');
    console.log('=====================================');

    if (users.length === 0) {
      console.log('No users found. Try signing up at http://localhost:3000/signup');
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. User`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Login Type: ${user.googleId ? 'Google OAuth' : 'Email/Password'}`);
        console.log(`   2FA Enabled: ${user.twoFactorAuth ? 'Yes' : 'No'}`);
        console.log(`   Email Verified: ${user.isEmailVerified ? 'Yes' : 'No'}`);
        console.log(`   Created: ${user.createdAt}`);
      });
    }

    console.log('\n=====================================\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
