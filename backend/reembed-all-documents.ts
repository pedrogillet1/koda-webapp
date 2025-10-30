/**
 * Re-embed all completed documents
 * Fixes broken Pinecone embeddings
 */

import prisma from './src/config/database';
import documentProcessorService from './src/services/documentProcessor.service';

async function reembedAllDocuments() {
  console.log('🔄 Starting re-embedding of all documents...\n');

  try {
    // Get all completed documents
    const documents = await prisma.document.findMany({
      where: {
        status: 'completed'
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        userId: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📚 Found ${documents.length} completed documents\n`);

    for (const doc of documents) {
      console.log(`\n📄 Processing: ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Type: ${doc.mimeType}`);

      try {
        // Force reprocess the document
        await documentProcessorService.processDocument(doc.id, doc.userId);
        console.log(`   ✅ Successfully re-embedded`);
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
      }
    }

    console.log(`\n\n🎉 Re-embedding complete!`);
    console.log(`✅ All documents have been re-processed`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reembedAllDocuments();
