const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocTypes() {
  try {
    // Check for PDFs, Word, PowerPoint
    const docs = await prisma.document.findMany({
      where: {
        OR: [
          { mimeType: { contains: 'pdf' } },
          { mimeType: { contains: 'word' } },
          { mimeType: { contains: 'presentation' } }
        ]
      },
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

    console.log('\n📄 PDF/WORD/PPTX FILES:\n');
    if (docs.length === 0) {
      console.log('  No PDF, Word, or PowerPoint files found!');
    } else {
      docs.forEach(d => {
        const type = d.mimeType.includes('pdf') ? 'PDF' :
                     d.mimeType.includes('word') ? 'WORD' :
                     d.mimeType.includes('presentation') ? 'PPTX' :
                     'OTHER';
        console.log(`  [${d.status}] ${type} - ${d.filename}`);
        console.log(`     Created: ${d.createdAt.toISOString().split('T')[0]}`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDocTypes();
