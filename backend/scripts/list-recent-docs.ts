import prisma from '../src/config/database';

async function listRecentDocs() {
  try {
    // Get all documents
    const docs = await prisma.document.findMany({
      select: {
        id: true,
        filename: true,
        status: true,
        mimeType: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 30
    });

    console.log(`\n📋 Recent Documents (${docs.length} total):\n`);
    docs.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Type: ${doc.mimeType}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Updated: ${doc.updatedAt}\n`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listRecentDocs();
