import prisma from '../src/config/database';

async function getVerificationCode() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Please provide an email address');
    console.log('Usage: npx ts-node scripts/get-verification-code.ts <email>');
    process.exit(1);
  }

  const pendingUser = await prisma.pendingUser.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      email: true,
      emailCode: true,
      expiresAt: true,
      emailVerified: true,
    }
  });

  if (!pendingUser) {
    console.error(`❌ No pending user found for ${email}`);
    process.exit(1);
  }

  console.log('\n📧 Verification Code Information:');
  console.log('================================');
  console.log(`Email: ${pendingUser.email}`);
  console.log(`Code: ${pendingUser.emailCode}`);
  console.log(`Expires: ${pendingUser.expiresAt}`);
  console.log(`Verified: ${pendingUser.emailVerified ? 'Yes' : 'No'}`);
  console.log('================================\n');

  await prisma.$disconnect();
}

getVerificationCode().catch(console.error);
