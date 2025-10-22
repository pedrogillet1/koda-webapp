const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

async function listDocs() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'pedromgillet@gmail.com' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`✅ User: ${user.email} (ID: ${user.id})\n`);

    const docs = await prisma.document.findMany({
      where: { userId: user.id },
      include: {
        metadata: {
          select: {
            wordCount: true,
            extractedText: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📄 Total documents: ${docs.length}\n`);

    for (const doc of docs) {
      console.log(`📝 ${doc.filename}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Status: ${doc.status}`);
      console.log(`   - Created: ${doc.createdAt}`);
      console.log(`   - Word count: ${doc.metadata?.wordCount || 0}`);
      console.log(`   - Has text: ${doc.metadata?.extractedText ? 'YES (' + doc.metadata.extractedText.length + ' chars)' : 'NO'}`);

      const embCount = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });
      console.log(`   - Embeddings: ${embCount}`);
      console.log();
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listDocs();
