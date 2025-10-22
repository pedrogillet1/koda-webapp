const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function regenerateExcelEmbeddings() {
  try {
    console.log('\n🔄 REGENERATING EXCEL EMBEDDINGS\n');

    // Get the latest Excel file
    const latestExcel = await prisma.document.findFirst({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestExcel) {
      console.log('❌ No Excel file found!');
      return;
    }

    console.log(`📄 Found: ${latestExcel.filename}`);
    console.log(`   ID: ${latestExcel.id}`);
    console.log(`   Status: ${latestExcel.status}`);
    console.log(`   Created: ${latestExcel.createdAt.toISOString()}\n`);

    // Import document service to trigger re-processing
    console.log('🔄 Triggering embedding generation...\n');

    // We need to call the embedding generation directly
    // This will require importing the service and calling processAndStoreEmbeddings
    const documentService = require('./dist/services/document.service');

    // Call the embeddings generation
    await documentService.processAndStoreEmbeddings(latestExcel.id);

    console.log('\n✅ Embeddings regenerated successfully!\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

regenerateExcelEmbeddings();
