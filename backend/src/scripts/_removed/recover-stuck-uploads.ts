/**
 * Recovery Script for Stuck Uploads
 *
 * This script finds all documents with fileHash='pending' regardless of status
 * and queues them for reprocessing.
 *
 * Run with: npx ts-node --transpile-only src/scripts/recover-stuck-uploads.ts
 */

import prisma from '../config/database';
import { addDocumentProcessingJob } from '../queues/document.queue';

const BATCH_SIZE = 50; // Process in batches to avoid overwhelming the queue
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

async function recoverStuckUploads() {
  console.log('\n' + '='.repeat(70));
  console.log('  STUCK UPLOAD RECOVERY SCRIPT');
  console.log('='.repeat(70) + '\n');

  try {
    // Find ALL documents with fileHash='pending' (regardless of status)
    const stuckDocuments = await prisma.documents.findMany({
      where: {
        fileHash: 'pending'
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        encryptedFilename: true,
        mimeType: true,
        status: true,
        fileHash: true,
        createdAt: true,
        fileSize: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📊 Found ${stuckDocuments.length} documents with pending fileHash\n`);

    if (stuckDocuments.length === 0) {
      console.log('✅ No stuck documents found. All uploads are processed.');
      return;
    }

    // Group by status for reporting
    const statusGroups: Record<string, number> = {};
    stuckDocuments.forEach(doc => {
      statusGroups[doc.status] = (statusGroups[doc.status] || 0) + 1;
    });
    console.log('📈 Current status breakdown:');
    Object.entries(statusGroups).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
    console.log('');

    // Process in batches
    const totalBatches = Math.ceil(stuckDocuments.length / BATCH_SIZE);
    let processedCount = 0;
    let queuedCount = 0;
    let errorCount = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batch = stuckDocuments.slice(batchStart, batchStart + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} documents)`);

      // Update status to 'processing' for this batch
      const documentIds = batch.map(d => d.id);

      await prisma.documents.updateMany({
        where: { id: { in: documentIds } },
        data: { status: 'processing' }
      });

      // Queue each document for processing
      for (const doc of batch) {
        try {
          await addDocumentProcessingJob({
            documentId: doc.id,
            userId: doc.userId,
            encryptedFilename: doc.encryptedFilename,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize || 0
          });
          queuedCount++;
          processedCount++;

          // Progress indicator
          if (processedCount % 100 === 0) {
            console.log(`   ✓ Queued ${processedCount}/${stuckDocuments.length} documents...`);
          }
        } catch (error: any) {
          console.error(`   ❌ Failed to queue ${doc.filename}: ${error.message}`);
          errorCount++;

          // Revert status on error
          await prisma.documents.update({
            where: { id: doc.id },
            data: { status: 'failed' }
          });
        }
      }

      // Delay between batches to avoid overwhelming the queue
      if (batchIndex < totalBatches - 1) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('  RECOVERY COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n  📊 Summary:`);
    console.log(`     - Total documents found: ${stuckDocuments.length}`);
    console.log(`     - Successfully queued: ${queuedCount}`);
    console.log(`     - Errors: ${errorCount}`);
    console.log(`\n  ℹ️  Documents are now in the processing queue.`);
    console.log(`     The background worker will process them automatically.`);
    console.log(`     Monitor progress in Prisma Studio or with:`);
    console.log(`     SELECT status, COUNT(*) FROM documents GROUP BY status;`);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Recovery script failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recoverStuckUploads()
  .then(() => {
    console.log('✅ Recovery script completed successfully.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Recovery script failed:', error);
    process.exit(1);
  });
