/**
 * Retry Failed Documents Script
 * Reprocesses all documents with status='failed'
 *
 * Since we fixed the root causes:
 * - Metadata initialization ✅
 * - Python symlink ✅
 * - Pinecone metadata field ✅
 * - Memory service ✅
 *
 * These 36 failed documents should now succeed!
 */

const { PrismaClient } = require('@prisma/client');
const { addDocumentToQueue } = require('./dist/queues/document.queue');

const prisma = new PrismaClient();

async function retryFailedDocuments() {
  try {
    console.log('🔄 Starting failed document retry process...\n');

    // Find test user
    const user = await prisma.users.findUnique({
      where: { email: 'test@koda.com' }
    });

    if (!user) {
      console.log('❌ User test@koda.com not found');
      return;
    }

    console.log(`✅ User found: ${user.email} (ID: ${user.id})\n`);

    // Get all failed documents
    const failedDocs = await prisma.documents.findMany({
      where: {
        userId: user.id,
        status: 'failed'
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        fileSize: true,
        encryptedFilename: true,
        createdAt: true,
      }
    });

    console.log(`📊 Found ${failedDocs.length} failed documents\n`);

    if (failedDocs.length === 0) {
      console.log('✅ No failed documents to retry!');
      return;
    }

    // Show list
    console.log('=== FAILED DOCUMENTS TO RETRY ===');
    failedDocs.forEach((doc, i) => {
      const sizeMB = (doc.fileSize / (1024 * 1024)).toFixed(2);
      console.log(`${i + 1}. ${doc.filename} (${sizeMB} MB)`);
      console.log(`   └── Type: ${doc.mimeType}`);
      console.log(`   └── ID: ${doc.id}`);
    });

    console.log('\n=== STARTING RETRY ===\n');

    let successCount = 0;
    let failCount = 0;

    // Retry each document
    for (let i = 0; i < failedDocs.length; i++) {
      const doc = failedDocs[i];
      console.log(`\n[${i + 1}/${failedDocs.length}] Retrying: ${doc.filename}`);

      try {
        // Reset status to 'pending' so it can be reprocessed
        await prisma.documents.update({
          where: { id: doc.id },
          data: {
            status: 'pending',
            updatedAt: new Date(),
          }
        });

        console.log(`   ✅ Reset to 'pending' status`);

        // Add to processing queue
        await addDocumentToQueue({
          documentId: doc.id,
          userId: user.id,
          encryptedFilename: doc.encryptedFilename,
          filename: doc.filename,
          mimeType: doc.mimeType,
        });

        console.log(`   ✅ Added to processing queue`);
        successCount++;

        // Wait a bit between documents to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`   ❌ Failed to retry: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n=== RETRY SUMMARY ===');
    console.log(`Total documents:     ${failedDocs.length}`);
    console.log(`✅ Queued for retry: ${successCount}`);
    console.log(`❌ Failed to queue:  ${failCount}`);

    console.log('\n⏳ Documents are now being processed...');
    console.log('   Monitor progress with: pm2 logs koda-backend');
    console.log('   Check status in ~5 minutes with: node diagnostic-doc-count.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
retryFailedDocuments()
  .then(() => {
    console.log('\n✅ Retry script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
