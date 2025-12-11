import prisma from './src/config/database';

async function findError() {
  // Get the most recent failed upload
  const doc = await prisma.document.findFirst({
    where: {
      filename: { contains: 'Math Profitability' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!doc) {
    console.log('No document found');
    process.exit(1);
  }

  console.log('\n=== MOST RECENT UPLOAD ===');
  console.log('ID:', doc.id);
  console.log('Filename:', doc.filename);
  console.log('Status:', doc.status);
  console.log('Created:', doc.createdAt);
  console.log('Updated:', doc.updatedAt);
  console.log('\nSearching for this document ID in Pinecone...\n');

  // Try to verify in Pinecone
  const pineconeService = await import('./src/services/pinecone.service');
  const result = await pineconeService.default.verifyDocument(doc.id);

  console.log('Verification Result:');
  console.log('  Success:', result.success);
  console.log('  Vector Count:', result.vectorCount);
  console.log('  Error:', result.error || 'None');

  process.exit(0);
}

findError();
