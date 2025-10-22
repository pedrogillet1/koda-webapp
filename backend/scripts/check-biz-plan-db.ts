import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBizPlanDB() {
  const doc = await prisma.document.findUnique({
    where: { id: 'df64c6f3-7cca-48bf-ab81-4b5fb3cfe232' },
    include: { metadata: true }
  });

  if (!doc) {
    console.log('Document not found!');
    await prisma.$disconnect();
    return;
  }

  console.log('\n📄 KODA BUSINESS PLAN - CURRENT DATABASE STATE\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Filename: ${doc.filename}`);
  console.log(`Status: ${doc.status}`);
  console.log(`Updated: ${doc.updatedAt}\n`);

  if (doc.metadata?.extractedText) {
    const text = doc.metadata.extractedText;
    console.log(`Text length in DB: ${text.length} characters`);
    console.log(`\nFirst 300 characters:`);
    console.log(`"${text.substring(0, 300)}"\n`);
    console.log(`\nLast 200 characters:`);
    console.log(`"${text.substring(text.length - 200)}"\n`);

    const hasComprovante = text.toLowerCase().includes('comprovante');
    const hasPsych = text.includes('AGITAÇÃO PSICOMOTORA');
    const hasBizPlan = text.toLowerCase().includes('business plan');

    console.log(`Contains "comprovante": ${hasComprovante ? 'YES ⚠️  CONTAMINATED!' : 'NO ✅'}`);
    console.log(`Contains psychiatric content: ${hasPsych ? 'YES ⚠️  CONTAMINATED!' : 'NO ✅'}`);
    console.log(`Contains business plan: ${hasBizPlan ? 'YES ✅' : 'NO ❌'}`);

  } else {
    console.log('❌ No extracted text in database');
  }

  await prisma.$disconnect();
}

checkBizPlanDB().catch(console.error);
