import prisma from './src/config/database';
import { deleteFile } from './src/config/storage';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

async function deleteBaxter() {
  console.log('\n🗑️  DELETING CONTAMINATED BAXTER DOCUMENT\n');
  console.log('─'.repeat(80));

  // Find Baxter document
  const doc = await prisma.document.findFirst({
    where: { filename: { contains: 'Baxter Main' } },
    select: {
      id: true,
      filename: true,
      encryptedFilename: true,
      userId: true
    }
  });

  if (!doc) {
    console.log('❌ Baxter document not found');
    await prisma.$disconnect();
    return;
  }

  console.log('📄 Found document:', doc.filename);
  console.log('🆔 ID:', doc.id);
  console.log('🔒 Encrypted filename:', doc.encryptedFilename);
  console.log('');

  try {
    // Step 1: Delete Pinecone vectors
    console.log('🗑️  Step 1: Deleting Pinecone vectors...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'koda-gemini');

    // We need to delete all vectors for this document
    // Vector IDs follow pattern: ${documentId}-${chunkIndex}
    // Since we don't know how many chunks, we'll try to delete first 200 (more than enough)
    const vectorIds: string[] = [];
    for (let i = 0; i < 200; i++) {
      vectorIds.push(`${doc.id}-${i}`);
    }

    // Delete in batches of 100
    const batchSize = 100;
    let deletedCount = 0;
    for (let i = 0; i < vectorIds.length; i += batchSize) {
      const batch = vectorIds.slice(i, i + batchSize);
      try {
        await index.deleteMany(batch);
        deletedCount += batch.length;
      } catch (error) {
        // Ignore errors for non-existent vectors
      }
    }
    console.log(`   ✅ Deleted up to ${deletedCount} Pinecone vectors`);

    // Step 2: Delete database embeddings
    console.log('\n🗑️  Step 2: Deleting database embeddings...');
    const embeddingsDeleted = await prisma.documentEmbedding.deleteMany({
      where: { documentId: doc.id }
    });
    console.log(`   ✅ Deleted ${embeddingsDeleted.count} database embeddings`);

    // Step 3: Delete document metadata
    console.log('\n🗑️  Step 3: Deleting document metadata...');
    await prisma.documentMetadata.deleteMany({
      where: { documentId: doc.id }
    });
    console.log('   ✅ Metadata deleted');

    // Step 4: Delete from Google Cloud Storage
    console.log('\n🗑️  Step 4: Deleting file from Google Cloud Storage...');
    try {
      await deleteFile(doc.encryptedFilename);
      console.log('   ✅ File deleted from GCS');
    } catch (error: any) {
      console.log(`   ⚠️  Could not delete from GCS: ${error.message}`);
      console.log('   (This is okay if the file was already deleted)');
    }

    // Step 5: Delete document record
    console.log('\n🗑️  Step 5: Deleting document record from database...');
    await prisma.document.delete({
      where: { id: doc.id }
    });
    console.log('   ✅ Document record deleted');

    console.log('\n' + '─'.repeat(80));
    console.log('✅ BAXTER DOCUMENT SUCCESSFULLY DELETED\n');
    console.log('Next step: Re-upload the correct Baxter PDF through the UI');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Error during deletion:', error.message);
    console.error(error.stack);
  }

  await prisma.$disconnect();
}

deleteBaxter();
