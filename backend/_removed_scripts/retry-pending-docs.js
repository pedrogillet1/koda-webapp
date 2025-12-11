/**
 * Retry Pending Documents
 * Add all pending documents to the BullMQ processing queue
 */

const { PrismaClient } = require('@prisma/client');
const { addDocumentProcessingJob } = require('./dist/queues/document.queue');

const prisma = new PrismaClient();

async function retryPendingDocuments() {
  try {
    console.log('🔄 Adding pending documents to processing queue...\n');

    const user = await prisma.users.findUnique({
      where: { email: 'test@koda.com' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    // Get all pending documents
    const pendingDocs = await prisma.documents.findMany({
      where: {
        userId: user.id,
        status: 'pending'
      },
      select: {
        id: true,
        filename: true,
        encryptedFilename: true,
        mimeType: true,
      }
    });

    console.log(`📊 Found ${pendingDocs.length} pending documents\n`);

    if (pendingDocs.length === 0) {
      console.log('✅ No pending documents to process');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // Add each to the queue
    for (let i = 0; i < pendingDocs.length; i++) {
      const doc = pendingDocs[i];
      console.log(`[${i + 1}/${pendingDocs.length}] Queuing: ${doc.filename}`);

      try {
        await addDocumentProcessingJob({
          documentId: doc.id,
          userId: user.id,
          encryptedFilename: doc.encryptedFilename,
          filename: doc.filename,
          mimeType: doc.mimeType,
        });

        console.log(`   ✅ Added to queue`);
        successCount++;

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`✅ Queued: ${successCount}`);
    console.log(`❌ Failed:  ${failCount}`);
    console.log('\n⏳ Documents are now processing...');
    console.log('   Monitor: pm2 logs koda-backend');
    console.log('   Check in 5 min: node diagnostic-doc-count.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
    // Allow time for queue connections to close
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

retryPendingDocuments()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
