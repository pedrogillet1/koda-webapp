import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetStuckDocuments() {
  try {
    // Find documents that have been "processing" for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const stuckDocs = await prisma.document.findMany({
      where: {
        status: 'processing',
        updatedAt: {
          lt: tenMinutesAgo,
        },
      },
      select: {
        id: true,
        filename: true,
        updatedAt: true,
      },
    });

    if (stuckDocs.length === 0) {
      console.log('✅ No stuck documents found.');
      return;
    }

    console.log(`\n🔧 Found ${stuckDocs.length} stuck document(s) (processing > 10min):\n`);
    stuckDocs.forEach((doc, i) => {
      const ageMinutes = Math.floor((Date.now() - new Date(doc.updatedAt).getTime()) / 1000 / 60);
      console.log(`  ${i + 1}. ${doc.filename}`);
      console.log(`     Status: processing for ${ageMinutes} minutes`);
    });

    console.log(`\n🔄 Resetting to "pending" status...\n`);

    // Reset to pending so background worker can retry
    const result = await prisma.document.updateMany({
      where: {
        id: {
          in: stuckDocs.map(d => d.id),
        },
      },
      data: {
        status: 'pending',
      },
    });

    console.log(`✅ Reset ${result.count} document(s) to pending status.`);
    console.log(`\n⏳ The background worker will pick them up within 5 seconds.`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetStuckDocuments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
