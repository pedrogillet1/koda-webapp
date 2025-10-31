import prisma from './src/config/database';
import pineconeService from './src/services/pinecone.service';

/**
 * Delete ALL documents from database and Pinecone
 *
 * WARNING: This will permanently delete all documents, metadata, and embeddings
 * Use this to clean up old/stuck/deleted documents
 */

async function deleteAllDocuments() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          DELETE ALL DOCUMENTS - FULL CLEANUP              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get all documents
    console.log('📋 Step 1: Fetching all documents...');
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        filename: true,
        status: true
      }
    });

    console.log(`   Found ${documents.length} documents in database\n`);

    if (documents.length === 0) {
      console.log('✅ No documents to delete. Database is already clean!\n');
      process.exit(0);
    }

    // Show what will be deleted
    console.log('Documents to be deleted:');
    documents.forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.filename} (${doc.status})`);
    });
    console.log('');

    // Step 2: Delete from Pinecone
    console.log('🗑️  Step 2: Deleting embeddings from Pinecone...');
    let pineconeDeleted = 0;
    let pineconeErrors = 0;

    for (const doc of documents) {
      try {
        await pineconeService.deleteDocumentEmbeddings(doc.id);
        pineconeDeleted++;
        console.log(`   ✅ Deleted vectors for: ${doc.filename}`);
      } catch (error: any) {
        pineconeErrors++;
        console.warn(`   ⚠️  Failed to delete vectors for ${doc.filename}: ${error.message}`);
      }
    }

    console.log(`   Pinecone cleanup: ${pineconeDeleted} successful, ${pineconeErrors} errors\n`);

    // Step 3: Delete metadata
    console.log('🗑️  Step 3: Deleting document metadata...');
    const metadataResult = await prisma.documentMetadata.deleteMany({});
    console.log(`   ✅ Deleted ${metadataResult.count} metadata records\n`);

    // Step 4: Delete documents
    console.log('🗑️  Step 4: Deleting documents...');
    const documentsResult = await prisma.document.deleteMany({});
    console.log(`   ✅ Deleted ${documentsResult.count} documents\n`);

    // Final summary
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    CLEANUP COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Total documents processed: ${documents.length}`);
    console.log(`✅ Pinecone vectors deleted: ${pineconeDeleted}`);
    console.log(`✅ Metadata records deleted: ${metadataResult.count}`);
    console.log(`✅ Documents deleted: ${documentsResult.count}`);
    console.log('');
    console.log('🎉 Database is now clean. Ready for fresh uploads!\n');

  } catch (error: any) {
    console.error('\n❌ Error during cleanup:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

deleteAllDocuments();
