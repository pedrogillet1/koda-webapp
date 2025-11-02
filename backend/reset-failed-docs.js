const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetFailedDocs() {
  try {
    // First, let's see how many failed docs we have
    const failedCount = await prisma.document.count({
      where: {
        status: 'failed',
        userId: '447eb2d0-7b34-4f26-ad86-24b0bf2fd785'
      }
    });

    console.log(`Found ${failedCount} failed documents`);

    // Reset them to pending so they can be reprocessed
    const result = await prisma.document.updateMany({
      where: {
        status: 'failed',
        userId: '447eb2d0-7b34-4f26-ad86-24b0bf2fd785'
      },
      data: {
        status: 'pending'
      }
    });

    console.log(`✅ Updated ${result.count} documents from 'failed' to 'pending'`);
    console.log('\nThe background processor will now attempt to process these documents.');
    console.log('Check the backend logs for processing status.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetFailedDocs();
