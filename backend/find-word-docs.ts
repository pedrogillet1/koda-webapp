import prisma from './src/config/database';

async function findWordDocs() {
  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { mimeType: { contains: 'word' } },
        { filename: { contains: '.docx' } },
        { filename: { contains: '.doc' } }
      ]
    },
    select: {
      filename: true,
      id: true,
      mimeType: true
    }
  });

  console.log('Word documents found:');
  docs.forEach(doc => {
    console.log(`  - ${doc.filename} (${doc.id})`);
    console.log(`    MIME: ${doc.mimeType}`);
  });

  await prisma.$disconnect();
}

findWordDocs();
