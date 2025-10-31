/**
 * Force reprocess ALL problematic documents by marking them as pending
 * The background worker will pick them up automatically
 */

import prisma from './src/config/database';

async function forceReprocessAll() {
  console.log('🔧 FORCE REPROCESS ALL PROBLEMATIC DOCUMENTS\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Find all problematic documents
  const problematicDocs = await prisma.document.findMany({
    where: {
      OR: [
        { status: 'failed' },
        {
          AND: [
            { status: 'completed' },
            {
              OR: [
                { filename: 'Lgpd.docx' },
                { filename: 'Lone Mountain Ranch P&L 2025 (Budget) (1).pdf' },
                { filename: 'Math Profitability (1).pdf' },
              ]
            }
          ]
        }
      ]
    }
  });

  console.log(`Found ${problematicDocs.length} documents to reprocess:\n`);

  for (const doc of problematicDocs) {
    console.log(`📄 ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Current status: ${doc.status}`);
    console.log(`   Size: ${(doc.fileSize / 1024).toFixed(2)} KB`);
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
  console.log('Marking all as PENDING for background processing...\n');

  for (const doc of problematicDocs) {
    try {
      // Delete existing metadata to force fresh processing
      await prisma.documentMetadata.deleteMany({
        where: { documentId: doc.id }
      });

      // Update status to pending
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: 'pending' }
      });

      console.log(`✅ ${doc.filename} - Marked as PENDING`);
    } catch (error: any) {
      console.error(`❌ Error updating ${doc.filename}:`, error.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
  console.log('✅ All documents marked as PENDING!\n');
  console.log('The background worker will automatically process them.\n');
  console.log('Check the backend logs to monitor processing progress.\n');
  console.log('It may take 1-2 minutes for large PDFs like the Scrum book.\n');

  await prisma.$disconnect();
}

forceReprocessAll().catch(console.error);
