import prisma from '../src/config/database';
import { getDocumentPreview } from '../src/services/document.service';

async function testPreviewEndpoint() {
  console.log('\n🧪 Testing DOCX Preview Endpoint\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Find DOCX documents
    const docxDocs = await prisma.document.findMany({
      where: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      take: 5
    });

    console.log(`📄 Found ${docxDocs.length} DOCX document(s)\n`);

    if (docxDocs.length === 0) {
      console.log('❌ No DOCX documents found in database');
      console.log('💡 Please upload a .docx file to test the preview feature\n');
      return;
    }

    // Test preview for each DOCX
    for (const doc of docxDocs) {
      console.log(`\n📝 Testing: ${doc.filename}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   User ID: ${doc.userId}`);
      console.log(`   MIME: ${doc.mimeType}`);
      console.log(`   Size: ${doc.fileSize} bytes\n`);

      try {
        const preview = await getDocumentPreview(doc.id, doc.userId);

        console.log('✅ Preview generated successfully:');
        console.log(`   Preview Type: ${preview.previewType}`);
        console.log(`   Preview URL: ${preview.previewUrl.substring(0, 100)}...`);
        console.log(`   Original Type: ${preview.originalType}`);
        console.log(`   Filename: ${preview.filename}\n`);

      } catch (error: any) {
        console.error(`❌ Preview failed for ${doc.filename}:`);
        console.error(`   Error: ${error.message}\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ Test complete\n');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testPreviewEndpoint().catch(console.error);
