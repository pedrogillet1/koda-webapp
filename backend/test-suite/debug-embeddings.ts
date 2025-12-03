import 'dotenv/config';
import prisma from '../src/config/database';

async function test() {
  const userId = 'ad137f5b-1591-4e51-bcb6-851491604dc9'; // localhost@koda.com

  console.log('Checking embeddings for localhost@koda.com...\n');

  // Get documents with their embedding counts
  const docsWithEmbeddings = await prisma.documents.findMany({
    where: { userId, status: { not: 'deleted' } },
    select: {
      id: true,
      filename: true,
      status: true,
      _count: {
        select: {
          embeddings: true
        }
      }
    },
    take: 15
  });

  console.log('Documents and their embedding counts:');
  let totalEmbeddings = 0;
  docsWithEmbeddings.forEach(d => {
    console.log(`  ${d.filename}: ${d._count.embeddings} embeddings`);
    totalEmbeddings += d._count.embeddings;
  });

  console.log('\nTotal embeddings in DB:', totalEmbeddings);

  // Check if any embeddings exist at all
  const embeddingCount = await prisma.embeddings.count({
    where: {
      document: {
        userId
      }
    }
  });
  console.log('Total embedding rows in embeddings table:', embeddingCount);

  // Check document_metadata for extractedText
  const metadataCount = await prisma.document_metadata.count({
    where: {
      document: {
        userId
      }
    }
  });
  console.log('\nDocuments with metadata:', metadataCount);

  // Sample metadata
  const sampleMeta = await prisma.document_metadata.findFirst({
    where: {
      document: { userId }
    },
    select: {
      documentId: true,
      extractedText: true,
      document: {
        select: { filename: true }
      }
    }
  });

  if (sampleMeta) {
    console.log('\nSample metadata:');
    console.log('  File:', sampleMeta.document.filename);
    console.log('  Has extractedText:', !!sampleMeta.extractedText);
    console.log('  Text length:', sampleMeta.extractedText?.length || 0);
  }

  await prisma.$disconnect();
}

test().catch(console.error);
