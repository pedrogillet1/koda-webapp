const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FRIEND_USER_ID = 'd141ee38-1527-419a-a6ea-5b0ceab3af8b';

(async () => {
  try {
    const allDocs = await prisma.document.findMany({
      include: {
        metadata: true
      }
    });

    const businessDocs = allDocs.filter(doc =>
      doc.filename.toLowerCase().includes('business') ||
      doc.filename.toLowerCase().includes('plan')
    );

    console.log(`Found ${businessDocs.length} documents with "business" or "plan":\n`);

    for (const doc of businessDocs) {
      console.log('📄 Filename:', doc.filename);
      console.log('   Owner ID:', doc.userId);
      console.log('   Document ID:', doc.id);
      console.log('   Status:', doc.status);

      if (doc.userId === FRIEND_USER_ID) {
        console.log('   ✅ OWNED BY FRIEND');
      } else {
        console.log('   ❌ NOT owned by friend');
      }

      // Check embeddings
      const embCount = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });
      console.log('   Embeddings:', embCount);

      if (doc.metadata) {
        console.log('   Text length:', doc.metadata.extractedText?.length || 0, 'chars');
      }

      console.log('');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
})();
