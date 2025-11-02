import prisma from './src/config/database';

async function listAllDocs() {
  const docs = await prisma.document.findMany({
    where: { userId: '03ec97ac-1934-4188-8471-524366d87521' },
    select: {
      id: true,
      filename: true,
      status: true,
      createdAt: true,
      fileSize: true
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('📚 ALL DOCUMENTS IN YOUR ACCOUNT:\n');
  docs.forEach((doc, i) => {
    const date = doc.createdAt.toISOString().split('T')[0];
    const size = (doc.fileSize / 1024).toFixed(2);
    console.log(`${i + 1}. ${doc.filename}`);
    console.log(`   Status: ${doc.status} | Size: ${size} KB | Date: ${date}`);
    console.log('');
  });

  console.log(`\n📊 TOTAL: ${docs.length} documents`);

  await prisma.$disconnect();
}

listAllDocs().catch(console.error);
