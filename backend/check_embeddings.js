const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '271a9282-463b-42bd-ac2c-4034ce9d9524';

  // Get all documents for this user
  const docs = await prisma.document.findMany({
    where: { userId },
    select: {
      id: true,
      filename: true,
      displayTitle: true,
      status: true,
      mimeType: true,
      embeddingsGenerated: true,
      chunksCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 60
  });

  console.log('Documents for localhost@koda.com:');
  console.log('================================');

  let withEmbeddings = 0;
  let withoutEmbeddings = 0;

  for (const doc of docs) {
    const title = doc.displayTitle || doc.filename;
    const hasEmb = doc.embeddingsGenerated ? 'YES' : 'NO';
    const status = doc.status || 'unknown';

    if (doc.embeddingsGenerated) withEmbeddings++;
    else withoutEmbeddings++;

    console.log(`[${status}] [Emb:${hasEmb}] [Chunks:${doc.chunksCount || 0}] ${title}`);
  }

  console.log('');
  console.log('================================');
  console.log(`Total shown: ${docs.length}`);
  console.log(`With embeddings: ${withEmbeddings}`);
  console.log(`Without embeddings: ${withoutEmbeddings}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
