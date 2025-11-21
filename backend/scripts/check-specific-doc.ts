import prisma from '../src/config/database';

async function checkSpecificDoc() {
  try {
    const docId = 'a3c96b44-3c1b-4140-a57f-ce8e7c8f8174'; // Completed Anotações Aula 2.pdf

    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: {
        metadata: true
      }
    });

    if (!doc) {
      console.log('Document not found');
      return;
    }

    console.log(`\n=== Document Info ===`);
    console.log(`Filename: ${doc.filename}`);
    console.log(`Status: ${doc.status}`);
    console.log(`Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
    console.log(`Created: ${doc.createdAt}`);
    console.log(`Updated: ${doc.updatedAt}`);

    if (doc.metadata) {
      console.log(`\n=== Metadata ===`);
      console.log(`Pages: ${doc.metadata.pageCount || 'N/A'}`);
      console.log(`Words: ${doc.metadata.wordCount || 'N/A'}`);
      console.log(`OCR Confidence: ${doc.metadata.ocrConfidence ? (doc.metadata.ocrConfidence * 100).toFixed(1) + '%' : 'N/A'}`);
      console.log(`Processing Method: ${doc.metadata.processingMethod || 'N/A'}`);

      if (doc.metadata.pageCount && doc.metadata.wordCount) {
        const wordsPerPage = doc.metadata.wordCount / doc.metadata.pageCount;
        console.log(`Words/Page: ${wordsPerPage.toFixed(1)} ${wordsPerPage < 50 ? '⚠️ LIKELY SCANNED (OCR used)' : '✅ Text-based'}`);
      }

      // Check extracted text in metadata
      if (doc.metadata.extractedText) {
        console.log(`\n=== Extracted Text in Metadata ===`);
        console.log(`Total length: ${doc.metadata.extractedText.length} characters`);
        console.log(`\nFirst 3000 characters:\n`);
        console.log('---START---');
        console.log(doc.metadata.extractedText.substring(0, 3000));
        console.log('---END---');

        if (doc.metadata.extractedText.length > 3000) {
          console.log(`\n... (${doc.metadata.extractedText.length - 3000} more characters)`);
        }
      } else {
        console.log('\n⚠️ No extracted text in metadata.extractedText');
      }
    }

    if (doc.renderableContent) {
      console.log(`\n=== Extracted Content ===`);
      console.log(`Total length: ${doc.renderableContent.length} characters`);
      console.log(`\nFirst 3000 characters:\n`);
      console.log('---START---');
      console.log(doc.renderableContent.substring(0, 3000));
      console.log('---END---');

      if (doc.renderableContent.length > 3000) {
        console.log(`\n... (${doc.renderableContent.length - 3000} more characters)`);
      }
    } else {
      console.log('\n⚠️ No extracted content found (renderableContent is null/empty)');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificDoc();
