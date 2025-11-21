import prisma from '../src/config/database';

async function mark() {
  await prisma.document.update({
    where: { id: 'f0aaffa3-d5aa-4544-9250-39236c8b7edb' },
    data: { status: 'pending', updatedAt: new Date() }
  });

  console.log('✅ Marked "Anotações Aula 2.pdf" (scanned) as pending for reprocessing');
  console.log('   ID: f0aaffa3-d5aa-4544-9250-39236c8b7edb');
  console.log('   Size: 18.7 MB, 14 pages, 42.1 words/page (likely scanned)');
  console.log('\n⏰ Background processor will pick it up in ~30 seconds');

  await prisma.$disconnect();
}

mark();
