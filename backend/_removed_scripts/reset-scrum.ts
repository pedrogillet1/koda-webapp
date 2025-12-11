import prisma from './src/config/database';

async function resetScrumDocument() {
  await prisma.document.update({
    where: { id: 'a624589e-3dd4-4aa7-b1b8-62ff1b3c8c3b' },
    data: { status: 'pending' }
  });

  console.log('✅ Reset Scrum PDF to pending status');
  console.log('   The background worker will reprocess it in ~30 seconds');

  await prisma.$disconnect();
}

resetScrumDocument();
