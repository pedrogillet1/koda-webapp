const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDocuments() {
  try {
    const allDocs = await prisma.document.findMany({
      include: {
        metadata: true
      }
    });

    console.log(`\n📊 Total documents: ${allDocs.length}\n`);

    for (const doc of allDocs) {
      console.log('━'.repeat(60));
      console.log(`📄 Filename: ${doc.filename}`);
      console.log(`🆔 ID: ${doc.id}`);
      console.log(`📊 Status: ${doc.status}`);
      console.log(`📅 Created: ${doc.createdAt}`);
      console.log(`📝 Has metadata: ${doc.metadata ? 'Yes' : 'No'}`);

      if (doc.metadata) {
        console.log(`   - Has extracted text: ${doc.metadata.extractedText ? 'Yes (' + doc.metadata.extractedText.length + ' chars)' : 'No'}`);
        console.log(`   - OCR confidence: ${doc.metadata.ocrConfidence || 'N/A'}`);
        console.log(`   - Classification: ${doc.metadata.classification || 'None'}`);
      }
      console.log('');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDocuments();
