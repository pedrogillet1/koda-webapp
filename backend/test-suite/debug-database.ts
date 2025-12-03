import 'dotenv/config';
import prisma from '../src/config/database';

async function test() {
  const testUserId = '4260da92-5005-4d4f-aa04-c260ece38542'; // localhost@koda.com

  console.log('Checking database for test user...\n');

  // Check if user exists
  const user = await prisma.users.findUnique({
    where: { id: testUserId },
    select: { id: true, email: true, firstName: true }
  });

  console.log('User found:', user ? 'YES' : 'NO');
  if (user) {
    console.log('  Email:', user.email);
    console.log('  Name:', user.firstName);
  }

  // Count documents for this user
  const docCount = await prisma.documents.count({
    where: { userId: testUserId, status: { not: 'deleted' } }
  });
  console.log('\nDocument count in database:', docCount);

  // Get a sample of documents
  const docs = await prisma.documents.findMany({
    where: { userId: testUserId, status: { not: 'deleted' } },
    select: { id: true, filename: true, status: true },
    take: 5
  });
  console.log('\nSample documents:');
  docs.forEach(d => {
    console.log(`  - ${d.filename} (${d.id}) [${d.status}]`);
  });

  // Check embeddings table
  const embeddingCount = await prisma.embeddings.count({
    where: {
      document: {
        userId: testUserId
      }
    }
  });
  console.log('\nEmbedding count in database:', embeddingCount);

  await prisma.$disconnect();
}

test().catch(console.error);
