import 'dotenv/config';
import prisma from '../src/config/database';

async function test() {
  console.log('Checking all users with documents...\n');

  // Get users with document counts
  const usersWithDocs = await prisma.users.findMany({
    select: {
      id: true,
      email: true,
      _count: {
        select: {
          documents: true
        }
      }
    },
    orderBy: {
      documents: {
        _count: 'desc'
      }
    },
    take: 10
  });

  console.log('Users with most documents:');
  usersWithDocs.forEach(u => {
    console.log(`  ${u.email}: ${u._count.documents} documents (${u.id})`);
  });

  // Check if localhost@koda.com exists
  const testUser = await prisma.users.findFirst({
    where: {
      email: 'localhost@koda.com'
    },
    select: { id: true, email: true }
  });

  console.log('\nlocalhost@koda.com exists:', testUser ? 'YES' : 'NO');
  if (testUser) {
    console.log('  User ID:', testUser.id);
  }

  await prisma.$disconnect();
}

test().catch(console.error);
