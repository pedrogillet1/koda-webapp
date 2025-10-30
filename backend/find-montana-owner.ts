import prisma from './src/config/database';

async function findMontanaOwner() {
  console.log('\n🔍 FINDING MONTANA DOCUMENT OWNER\n');
  console.log('─'.repeat(80));

  // Find Montana document
  const montanaDoc = await prisma.document.findFirst({
    where: { filename: { contains: 'Montana' } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!montanaDoc) {
    console.log('❌ Montana document not found');
    await prisma.$disconnect();
    return;
  }

  console.log('📄 Montana Document:');
  console.log(`   Filename: ${montanaDoc.filename}`);
  console.log(`   ID: ${montanaDoc.id}`);
  console.log('');

  console.log('👤 Owner:');
  console.log(`   User ID: ${montanaDoc.user.id}`);
  console.log(`   Email: ${montanaDoc.user.email}`);
  console.log(`   Name: ${montanaDoc.user.firstName} ${montanaDoc.user.lastName}`);
  console.log('');

  // Get all users
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      _count: {
        select: {
          documents: true
        }
      }
    }
  });

  console.log('─'.repeat(80));
  console.log('\n📊 All Users:\n');

  allUsers.forEach(user => {
    const isOwner = user.id === montanaDoc.user.id;
    const marker = isOwner ? '✅ OWNER' : '      ';
    console.log(`${marker} ${user.email}`);
    console.log(`         ID: ${user.id}`);
    console.log(`         Documents: ${user._count.documents}`);
    console.log('');
  });

  await prisma.$disconnect();
}

findMontanaOwner();
