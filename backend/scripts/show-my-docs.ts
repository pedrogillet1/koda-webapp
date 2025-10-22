import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showMyDocs() {
  // Your user ID
  const yourUserId = '03ec97ac-1934-4188-8471-524366d87521';

  const docs = await prisma.document.findMany({
    where: { userId: yourUserId },
    include: { metadata: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n📄 YOUR DOCUMENTS (Total: ${docs.length}):\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const doc of docs) {
    console.log(`📄 ${doc.filename}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Size: ${doc.fileSize} bytes`);
    console.log(`   Hash: ${doc.fileHash.substring(0, 16)}...`);
    console.log(`   Created: ${doc.createdAt}`);
    console.log(`   Status: ${doc.status}`);

    if (doc.metadata?.extractedText) {
      const textLength = doc.metadata.extractedText.length;
      const preview = doc.metadata.extractedText.substring(0, 200);
      console.log(`   Extracted text (${textLength} chars): "${preview}..."`);

      // Check for specific markers
      const hasComprovante = doc.metadata.extractedText.toLowerCase().includes('comprovante');
      const hasPsych = doc.metadata.extractedText.includes('AGITAÇÃO PSICOMOTORA');
      const hasBizPlan = doc.metadata.extractedText.toLowerCase().includes('business plan');

      if (hasComprovante) console.log(`   ⚠️  Contains "comprovante"`);
      if (hasPsych) console.log(`   ⚠️  Contains psychiatric content`);
      if (hasBizPlan) console.log(`   ⚠️  Contains business plan content`);
    } else {
      console.log(`   ❌ No extracted text`);
    }

    console.log('');
  }

  await prisma.$disconnect();
}

showMyDocs().catch(console.error);
