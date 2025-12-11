import prisma from './src/config/database';

async function diagnoseFailed() {
  const doc = await prisma.document.findFirst({
    where: {
      filename: { contains: 'Math Profitability' },
    },
    include: {
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!doc) {
    console.log('Document not found');
    process.exit(1);
  }

  console.log('\n=== DOCUMENT DIAGNOSIS ===\n');
  console.log('Filename:', doc.filename);
  console.log('Status:', doc.status);
  console.log('FileHash:', doc.fileHash);
  console.log('MimeType:', doc.mimeType);
  console.log('FileSize:', doc.fileSize, 'bytes');
  console.log('Created:', doc.createdAt);
  console.log('Updated:', doc.updatedAt);
  console.log('\nMetadata:', doc.metadata ? 'EXISTS' : 'MISSING');

  if (doc.metadata) {
    console.log('  - PageCount:', doc.metadata.pageCount);
    console.log('  - WordCount:', doc.metadata.wordCount);
    console.log('  - OCR Confidence:', doc.metadata.ocrConfidence);
    console.log('  - Extracted Text Length:', doc.metadata.extractedText?.length || 0);
  }

  process.exit(0);
}

diagnoseFailed();
