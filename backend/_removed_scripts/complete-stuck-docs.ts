/**
 * Manually complete stuck documents with whatever text has been extracted
 */

import prisma from './src/config/database';

async function completeStuckDocuments() {
  console.log('🔧 COMPLETING STUCK DOCUMENTS\n');

  const problematicNames = [
    'Math Profitability (1).pdf',
    'Lone Mountain Ranch P&L 2025 (Budget) (1).pdf',
    'Capítulo 8 (Framework Scrum).pdf'
  ];

  const docs = await prisma.document.findMany({
    where: {
      filename: { in: problematicNames },
      status: 'processing'
    }
  });

  console.log(`Found ${docs.length} documents stuck in processing\n`);

  for (const doc of docs) {
    console.log(`✅ Marking as completed: ${doc.filename}`);

    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'completed' }
    });
  }

  console.log('\n✅ All stuck documents marked as completed!');
  console.log('The background worker will now process embeddings for them.');

  await prisma.$disconnect();
}

completeStuckDocuments().catch(console.error);
