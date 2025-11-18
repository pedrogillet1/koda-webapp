import prisma from '../src/config/database';

async function listPDFs() {
  const pdfs = await prisma.document.findMany({
    where: { mimeType: 'application/pdf' },
    include: { metadata: true },
    orderBy: { filename: 'asc' }
  });

  console.log(`\n📋 All PDFs (${pdfs.length} total):\n`);

  pdfs.forEach(pdf => {
    console.log(`📄 ${pdf.filename}`);
    console.log(`   ID: ${pdf.id}`);
    console.log(`   Status: ${pdf.status}`);
    console.log(`   Size: ${(pdf.fileSize / 1024).toFixed(2)} KB`);
    console.log(`   Pages: ${pdf.metadata?.pageCount || 'N/A'}`);
    console.log(`   Words: ${pdf.metadata?.wordCount || 'N/A'}`);
    console.log(`   OCR Confidence: ${pdf.metadata?.ocrConfidence ? (pdf.metadata.ocrConfidence * 100).toFixed(1) + '%' : 'N/A'}`);

    // Calculate words per page to detect scanned PDFs
    if (pdf.metadata?.pageCount && pdf.metadata?.wordCount) {
      const wordsPerPage = pdf.metadata.wordCount / pdf.metadata.pageCount;
      console.log(`   Words/Page: ${wordsPerPage.toFixed(1)} ${wordsPerPage < 50 ? '⚠️ LIKELY SCANNED' : '✅ Text-based'}`);
    }

    console.log('');
  });

  await prisma.$disconnect();
}

listPDFs();
