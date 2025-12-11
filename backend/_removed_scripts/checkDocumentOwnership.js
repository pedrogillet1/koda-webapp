/**
 * Check who owns the "koda business plan" document
 * and if friend has access to it
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const FRIEND_USER_ID = 'd141ee38-1527-419a-a6ea-5b0ceab3af8b';

async function checkDocumentOwnership() {
  try {
    console.log('🔍 Searching for "koda business plan" document...\n');

    // Find all documents with "koda" in the name
    const allDocuments = await prisma.document.findMany({
      include: {
        metadata: true
      }
    });

    // Filter for "koda" (case insensitive)
    const documents = allDocuments.filter(doc =>
      doc.filename.toLowerCase().includes('koda')
    );

    console.log(`📄 Found ${documents.length} documents matching "koda":\n`);

    for (const doc of documents) {
      console.log(`📄 Document: ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Owner User ID: ${doc.userId}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Created: ${doc.createdAt}`);

      // Get owner info
      const owner = await prisma.users.findUnique({
        where: { id: doc.userId }
      });

      console.log(`   Owner Email: ${owner?.email || 'Unknown'}`);

      // Check if friend is the owner
      if (doc.userId === FRIEND_USER_ID) {
        console.log(`   ✅ OWNED BY FRIEND`);
      } else {
        console.log(`   ❌ NOT owned by friend (${FRIEND_USER_ID})`);
      }

      // Check embeddings
      const embeddingCount = await prisma.documentEmbedding.count({
        where: { documentId: doc.id }
      });

      console.log(`   Embeddings: ${embeddingCount}`);
      console.log('');
    }

    // Check friend's documents
    console.log('\n📦 Friend\'s own documents:');
    const friendDocs = await prisma.document.findMany({
      where: { userId: FRIEND_USER_ID }
    });

    if (friendDocs.length === 0) {
      console.log('❌ Friend has NO documents uploaded!');
      console.log('\n⚠️  ISSUE FOUND:');
      console.log('   - Friend is trying to query documents');
      console.log('   - But friend has no documents in their account');
      console.log('   - The "koda business plan" belongs to another user');
      console.log('   - Friend CANNOT access other users\' documents (by design)');
      console.log('\n✅ SOLUTION:');
      console.log('   - Friend needs to upload "koda business plan" to THEIR account');
      console.log('   - OR implement document sharing feature');
    } else {
      console.log(`✅ Friend has ${friendDocs.length} documents:`);
      friendDocs.forEach(doc => {
        console.log(`   - ${doc.filename}`);
      });
    }

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDocumentOwnership();
