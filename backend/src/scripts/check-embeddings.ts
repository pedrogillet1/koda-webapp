import prisma from '../config/database';

async function checkEmbeddings() {
  const documentId = '034c8e07-c6be-447d-90c9-c2f7cef119bd';

  const count = await prisma.documentEmbedding.count({
    where: { documentId }
  });

  console.log(`Embeddings for Lista_9: ${count}`);

  // Check if we have ex2 sheet data
  const ex2Embeddings = await prisma.documentEmbedding.findMany({
    where: {
      documentId,
      content: { contains: 'ex2' }
    },
    take: 3
  });

  console.log(`\nex2 sheet embeddings: ${ex2Embeddings.length > 0 ? 'YES ✅' : 'NO ❌'}`);

  if (ex2Embeddings.length > 0) {
    console.log('\nSample ex2 content:');
    ex2Embeddings.forEach((emb, idx) => {
      console.log(`\n${idx + 1}. ${emb.content.substring(0, 150)}...`);
    });
  }

  await prisma.$disconnect();
}

checkEmbeddings().catch(console.error);
