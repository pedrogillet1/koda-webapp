/**
 * Mark scanned PDFs for reprocessing
 *
 * This will set their status to 'pending' so the background processor
 * will automatically reprocess them with Mistral OCR
 */

import prisma from '../src/config/database';

const TARGET_PDFS = [
  'AnotaçõesAula2',
  'Anotacoes Aula 2',
  'anotacoes aula 2',
  'Capítulo 8',
  'Capitulo 8',
  'capitulo 8',
  'Scrum Framework',
  'scrum framework'
];

async function markPDFsForReprocessing() {
  try {
    console.log('🔍 Searching for target PDFs...\n');

    // Find all PDFs that match the target names (case-insensitive, partial match)
    const documents = await prisma.document.findMany({
      where: {
        OR: TARGET_PDFS.map(name => ({
          filename: {
            contains: name,
            mode: 'insensitive' as any
          }
        })),
        mimeType: 'application/pdf'
      },
      include: {
        metadata: true
      }
    });

    if (documents.length === 0) {
      console.log('❌ No matching PDFs found');
      console.log('   Target filenames:', TARGET_PDFS);

      // Show what PDFs exist
      const allPdfs = await prisma.document.findMany({
        where: { mimeType: 'application/pdf' },
        select: { filename: true, status: true }
      });

      console.log('\n📋 Available PDFs:');
      allPdfs.forEach(pdf => {
        console.log(`   - ${pdf.filename} (${pdf.status})`);
      });

      return;
    }

    console.log(`✅ Found ${documents.length} PDFs to reprocess:\n`);
    documents.forEach(doc => {
      console.log(`   📄 ${doc.filename}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Status: ${doc.status}`);
      console.log(`      Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
      if (doc.metadata) {
        console.log(`      Pages: ${doc.metadata.pageCount || 'N/A'}`);
        console.log(`      Old OCR Confidence: ${doc.metadata.ocrConfidence ? (doc.metadata.ocrConfidence * 100).toFixed(1) + '%' : 'N/A'}`);
      }
      console.log('');
    });

    console.log('🔄 Marking documents as pending for reprocessing...\n');

    // Update all documents to 'pending' status
    const result = await prisma.document.updateMany({
      where: {
        id: { in: documents.map(d => d.id) }
      },
      data: {
        status: 'pending',
        updatedAt: new Date()
      }
    });

    console.log(`✅ Marked ${result.count} documents as pending`);
    console.log('');
    console.log('📋 The background processor will automatically reprocess these documents with Mistral OCR.');
    console.log('⏰ Check the backend logs in ~30 seconds to see the processing start.');

  } catch (error) {
    console.error('❌ Error in script:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
markPDFsForReprocessing().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
