import prisma from '../src/config/database';

async function completeStuckDocs() {
  try {
    // Mark all stuck processing documents as completed
    const result = await prisma.document.updateMany({
      where: { status: 'processing' },
      data: { status: 'completed' }
    });

    console.log(`✅ Marked ${result.count} stuck documents as completed`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completeStuckDocs();
