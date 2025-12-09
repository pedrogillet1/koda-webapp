import prisma from './src/config/database';
import { addDocumentProcessingJob } from './src/queues/document.queue';

async function forceProcessDocuments() {
  console.log('🔍 Finding documents stuck in processing...\n');

  const stuckDocs = await prisma.document.findMany({
    where: {
      status: 'processing',
      userId: '03ec97ac-1934-4188-8471-524366d87521'
    },
    select: {
      id: true,
      userId: true,
      filename: true,
      encryptedFilename: true,
      mimeType: true,
      createdAt: true,
      fileSize: true
    }
  });

  console.log(`📊 Found ${stuckDocs.length} stuck documents:\n`);

  for (const doc of stuckDocs) {
    console.log(`📄 ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Type: ${doc.mimeType}`);
    console.log(`   Created: ${doc.createdAt}`);

    try {
      console.log(`   🔄 Adding to processing queue...`);

      await addDocumentProcessingJob({
        documentId: doc.id,
        userId: doc.userId,
        encryptedFilename: doc.encryptedFilename,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize || 0
      });

      console.log(`   ✅ Job queued successfully\n`);
    } catch (error: any) {
      console.error(`   ❌ Failed to queue: ${error.message}\n`);
    }
  }

  console.log('\n✅ All stuck documents queued for processing');
  console.log('⏳ Worker will process them in the background (check server logs)');

  await prisma.$disconnect();
}

forceProcessDocuments().catch(console.error);
