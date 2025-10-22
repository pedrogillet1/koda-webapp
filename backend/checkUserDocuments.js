/**
 * Check if user has documents and embeddings
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const FRIEND_USER_ID = 'd141ee38-1527-419a-a6ea-5b0ceab3af8b';

async function checkUserDocuments() {
  try {
    console.log('🔍 Checking documents for user:', FRIEND_USER_ID);

    // Get user info
    const user = await prisma.users.findUnique({
      where: { id: FRIEND_USER_ID }
    });

    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    console.log('✅ User found:', user.email);

    // Get documents
    const documents = await prisma.document.findMany({
      where: { userId: FRIEND_USER_ID },
      include: {
        metadata: true
      }
    });

    console.log(`\n📄 Documents: ${documents.length}`);

    if (documents.length === 0) {
      console.log('❌ NO DOCUMENTS found for this user!');
      console.log('⚠️  This is why normal mode returns "no sources" - user has no documents!');
      await prisma.$disconnect();
      process.exit(0);
    }

    // Show document details
    for (const doc of documents) {
      console.log(`\n📄 Document: ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Size: ${doc.fileSize} bytes`);
      console.log(`   Created: ${doc.createdAt}`);

      if (doc.metadata) {
        console.log(`   Has metadata: ✅`);
        console.log(`   Extracted text length: ${doc.metadata.extractedText?.length || 0} chars`);
        console.log(`   Word count: ${doc.metadata.wordCount || 0}`);
      } else {
        console.log(`   Has metadata: ❌`);
      }

      // Check embeddings
      const embeddings = await prisma.documentEmbedding.findMany({
        where: { documentId: doc.id }
      });

      console.log(`   Embeddings: ${embeddings.length}`);

      if (embeddings.length === 0) {
        console.log(`   ⚠️  NO EMBEDDINGS - Document won't be searchable!`);
      }
    }

    // Test vector search
    console.log('\n🔍 Testing vector search for "ICP" query...');

    const allEmbeddings = await prisma.documentEmbedding.findMany({
      where: {
        document: {
          userId: FRIEND_USER_ID
        }
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true
          }
        }
      }
    });

    console.log(`📦 Total embeddings for user: ${allEmbeddings.length}`);

    if (allEmbeddings.length > 0) {
      console.log('✅ User has embeddings - should be searchable');

      // Sample some embeddings
      console.log('\nSample embeddings:');
      allEmbeddings.slice(0, 3).forEach((emb, i) => {
        console.log(`\n${i + 1}. Document: ${emb.document.filename}`);
        console.log(`   Chunk ${emb.chunkIndex}: ${emb.content.substring(0, 100)}...`);
      });
    } else {
      console.log('❌ NO EMBEDDINGS - User documents are not indexed!');
    }

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkUserDocuments();
