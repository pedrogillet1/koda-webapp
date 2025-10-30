import prisma from './src/config/database';

(async () => {
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  console.log('\n📋 Recent Documents:');
  docs.forEach((doc, i) => {
    console.log(`\n${i + 1}. ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Status: ${doc.status}`);
    console.log(`   Created: ${doc.createdAt.toISOString()}`);
  });

  await prisma.$disconnect();
  process.exit(0);
})();
