const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

async function cleanupOldEmbeddings() {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index('koda-gemini');

  console.log('\n🗑️  CLEANING UP OLD EXCEL EMBEDDINGS\n');

  // Delete embeddings for all old Excel documents
  const oldDocumentIds = [
    'cc938a00-2e93-40fe-bdd4-408b1ad494a7',  // Old version
    'bbd9ad28-4985-4aaa-8d3b-fafb9ba61724',  // Old version
    '93726e8d-4628-4f40-bb68-5466fa878815',  // Old version (already deleted)
  ];

  for (const docId of oldDocumentIds) {
    console.log(`Deleting embeddings for document: ${docId}`);
    try {
      await index.deleteMany({ documentId: docId });
      console.log(`✅ Deleted embeddings for ${docId}`);
    } catch (error) {
      console.log(`⚠️  Error deleting ${docId}:`, error.message);
    }
  }

  console.log('\n✅ Cleanup complete!');
  console.log('Only the latest Excel embeddings (with filename prefix) should remain.\n');
}

cleanupOldEmbeddings().catch(console.error);
