const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllDocs() {
  try {
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        filename: true,
        status: true,
        mimeType: true,
        createdAt: true
      }
    });

    console.log('\n📊 RECENT UPLOADS (All Types):\n');

    docs.forEach(d => {
      const type = d.mimeType.includes('pdf') ? 'PDF' :
                   d.mimeType.includes('sheet') ? 'EXCEL' :
                   d.mimeType.includes('word') ? 'WORD' :
                   d.mimeType.includes('presentation') ? 'PPTX' :
                   'OTHER';

      console.log(`  [${d.status.toUpperCase().padEnd(10)}] ${type.padEnd(6)} - ${d.filename}`);
      console.log(`     Created: ${d.createdAt.toISOString()}`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllDocs();
