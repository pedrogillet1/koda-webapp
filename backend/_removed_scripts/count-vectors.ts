import { Pinecone } from '@pinecone-database/pinecone';
import prisma from './src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function checkVectors() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index('koda-gemini');

  const docs = await prisma.document.findMany({
    where: { userId: '03ec97ac-1934-4188-8471-524366d87521' },
    select: { id: true, filename: true, mimeType: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log('📊 Vector counts per document:\n');

  for (const doc of docs) {
    const response = await index.query({
      vector: new Array(768).fill(0),
      topK: 100,
      filter: { documentId: { $eq: doc.id } },
    });

    const icon = doc.mimeType.includes('presentation') ? '📊' :
                 doc.mimeType.includes('image') ? '🖼️' :
                 doc.mimeType.includes('pdf') ? '📕' :
                 doc.mimeType.includes('word') ? '📘' :
                 doc.mimeType.includes('spreadsheet') ? '📗' : '📄';

    console.log(`${icon} ${doc.filename}: ${response.matches.length} vectors`);
  }

  await prisma.$disconnect();
}

checkVectors().catch(console.error);
