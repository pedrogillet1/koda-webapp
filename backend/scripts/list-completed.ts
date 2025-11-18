import prisma from '../src/config/database';
import * as dotenv from 'dotenv';

dotenv.config();

async function listCompleted() {
  const docs = await prisma.document.findMany({
    where: { status: 'completed' },
    select: { filename: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' }
  });

  console.log(`\n✅ ${docs.length} Completed document(s):\n`);
  docs.forEach(d => {
    console.log(`  - ${d.filename}`);
  });
  console.log('');

  await prisma.$disconnect();
}

listCompleted();
