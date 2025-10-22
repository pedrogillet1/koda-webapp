const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearAllDocuments() {
  console.log('🗑️  Starting cleanup of all documents and embeddings...');

  try {
    // Delete in correct order (respecting foreign key constraints)

    console.log('Deleting chat contexts...');
    const chatContexts = await prisma.chatContext.deleteMany({});
    console.log(`✅ Deleted ${chatContexts.count} chat contexts`);

    console.log('Deleting document embeddings...');
    const embeddings = await prisma.documentEmbedding.deleteMany({});
    console.log(`✅ Deleted ${embeddings.count} document embeddings`);

    console.log('Deleting document summaries...');
    const summaries = await prisma.documentSummary.deleteMany({});
    console.log(`✅ Deleted ${summaries.count} document summaries`);

    console.log('Deleting document tags...');
    const docTags = await prisma.documentTag.deleteMany({});
    console.log(`✅ Deleted ${docTags.count} document tags`);

    console.log('Deleting document metadata...');
    const metadata = await prisma.documentMetadata.deleteMany({});
    console.log(`✅ Deleted ${metadata.count} document metadata records`);

    console.log('Deleting documents...');
    const documents = await prisma.document.deleteMany({});
    console.log(`✅ Deleted ${documents.count} documents`);

    console.log('\n✅ All documents, embeddings, and related data have been deleted!');
    console.log('📤 You can now re-upload documents and embeddings will be generated automatically.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllDocuments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
