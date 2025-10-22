const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

async function checkBlueprint() {
  try {
    // Find Pedro's account
    const user = await prisma.user.findUnique({
      where: { email: 'pedromgillet@gmail.com' }
    });

    if (!user) {
      console.log('❌ User not found: pedromgillet@gmail.com');
      return;
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})\n`);

    // Find blueprint documents
    const allDocs = await prisma.document.findMany({
      where: {
        userId: user.id
      },
      include: {
        metadata: {
          select: {
            extractedText: true,
            wordCount: true
          }
        }
      }
    });

    // Filter case-insensitively in JavaScript
    const docs = allDocs.filter(d => d.filename.toLowerCase().includes('blueprint'));

    console.log(`📄 Found ${docs.length} blueprint document(s):\n`);

    for (const doc of docs) {
      console.log(`📝 ${doc.filename}`);
      console.log(`   - Document ID: ${doc.id}`);
      console.log(`   - Status: ${doc.status}`);
      console.log(`   - Created: ${doc.createdAt}`);

      if (doc.metadata) {
        console.log(`   - Word count: ${doc.metadata.wordCount || 0}`);
        console.log(`   - Text length: ${doc.metadata.extractedText?.length || 0} chars`);
        if (doc.metadata.extractedText) {
          console.log(`   - Text preview: "${doc.metadata.extractedText.substring(0, 100)}..."`);
        }
      } else {
        console.log(`   - ❌ NO METADATA`);
      }

      // Check embeddings
      const embCount = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });

      console.log(`   - Vector embeddings: ${embCount}`);

      if (embCount > 0) {
        // Show a sample embedding
        const sampleEmb = await prisma.documentEmbedding.findFirst({
          where: { documentId: doc.id },
          select: {
            content: true,
            chunkIndex: true
          }
        });
        console.log(`   - Sample chunk ${sampleEmb.chunkIndex}: "${sampleEmb.content.substring(0, 80)}..."`);
      } else {
        console.log(`   - ⚠️  NO EMBEDDINGS FOUND - RAG won't work!`);
      }

      console.log();
    }

    // Check total embeddings for this user
    const totalEmbs = await prisma.documentEmbedding.count({
      where: {
        document: {
          userId: user.id
        }
      }
    });

    console.log(`\n📊 Total embeddings for ${user.email}: ${totalEmbs}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBlueprint();
