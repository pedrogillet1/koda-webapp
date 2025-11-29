/**
 * Reprocess Documents Script
 * 
 * This script reprocesses documents that have no extracted text.
 * It re-runs the text extraction and embedding generation for documents
 * that were uploaded but failed to process properly.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reprocessDocuments(userId?: string) {
  try {
    console.log('🔄 Starting document reprocessing...\n');

    // Find documents with no extracted text
    const where: any = {
      status: 'completed',
      OR: [
        { metadata: null },
        { metadata: { extractedText: null } },
        { metadata: { extractedText: '' } }
      ]
    };

    if (userId) {
      where.userId = userId;
      console.log(`📌 Filtering by userId: ${userId}\n`);
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${documents.length} documents without extracted text\n`);

    if (documents.length === 0) {
      console.log('✅ All documents already have extracted text!');
      return;
    }

    // Display documents
    console.log('Documents to reprocess:');
    documents.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.filename} (${doc.id})`);
      console.log(`   Created: ${doc.createdAt.toISOString()}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Metadata: ${doc.metadata ? 'exists' : 'missing'}`);
      console.log(`   ExtractedText: ${doc.metadata?.extractedText ? `${doc.metadata.extractedText.length} chars` : 'NONE'}`);
      console.log('');
    });

    // Import regenerateEmbeddings function
    const { regenerateEmbeddings } = await import('../src/services/document.service');

    console.log('\n🚀 Starting reprocessing...\n');

    let successCount = 0;
    let failCount = 0;

    for (const doc of documents) {
      try {
        console.log(`\n📄 Processing: ${doc.filename} (${doc.id})`);
        console.log('─'.repeat(60));

        const result = await regenerateEmbeddings(doc.id, doc.userId);

        console.log(`✅ Success: ${doc.filename}`);
        console.log(`   Text extracted: ${result.textLength} characters`);
        console.log(`   Chunks generated: ${result.chunksGenerated}`);
        
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed: ${doc.filename}`);
        console.error(`   Error: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Reprocessing Summary:');
    console.log(`   Total documents: ${documents.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error during reprocessing:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
const userId = process.argv[2]; // Optional: pass userId as argument

reprocessDocuments(userId)
  .then(() => {
    console.log('\n✅ Reprocessing complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Reprocessing failed:', error);
    process.exit(1);
  });
