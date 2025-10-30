import prisma from './src/config/database';

(async () => {
  try {
    console.log('🔄 Updating document statuses to "completed"...\n');

    // Documents that have extracted text but are stuck in "processing"
    const docsToUpdate = [
      '73d5ac40-59bb-4800-a756-cea68f4758d5', // Koda Business Plan
      '3e8555c3-74e1-416d-9a24-c91b987ac1e2'  // Math Profitability
    ];

    for (const docId of docsToUpdate) {
      const doc = await prisma.document.findUnique({
        where: { id: docId },
        include: { metadata: true }
      });

      if (doc) {
        await prisma.document.update({
          where: { id: docId },
          data: { status: 'completed' }
        });

        console.log(`✅ ${doc.filename}`);
        console.log(`   Status: processing → completed`);
        console.log(`   Has text: ${!!doc.metadata?.extractedText} (${doc.metadata?.extractedText?.length || 0} chars)\n`);
      }
    }

    console.log('✅ All documents updated!\n');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
