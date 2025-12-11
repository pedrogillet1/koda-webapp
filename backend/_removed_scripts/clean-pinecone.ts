import { Pinecone } from '@pinecone-database/pinecone';
import prisma from './src/config/database';
import dotenv from 'dotenv';

dotenv.config();

async function clean() {
  const userId = '03ec97ac-1934-4188-8471-524366d87521';

  console.log('\n🧹 PINECONE CLEANUP FOR USER\n');

  // Get all valid document IDs from database
  const validDocs = await prisma.document.findMany({
    where: { userId },
    select: { id: true, filename: true }
  });

  console.log(`✅ Found ${validDocs.length} documents in PostgreSQL:`);
  validDocs.forEach((doc, i) => {
    console.log(`   ${i + 1}. ${doc.filename.substring(0, 50)}`);
  });
  console.log('');

  const validDocIds = new Set(validDocs.map(d => d.id));

  // Connect to Pinecone
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pinecone.index('koda-gemini');

  // Query all vectors for this user
  console.log('🔍 Fetching vectors from Pinecone...');
  const dummyVector = new Array(768).fill(0);
  const response = await index.query({
    vector: dummyVector,
    topK: 1000,
    filter: { userId: { $eq: userId } },
    includeMetadata: true
  });

  console.log(`   Found ${response.matches.length} vectors\n`);

  // Group by documentId
  const vectorsByDoc = new Map<string, { count: number; filename: string }>();
  for (const match of response.matches) {
    const docId = match.metadata?.documentId as string;
    const filename = match.metadata?.filename as string || 'Unknown';
    if (docId) {
      if (!vectorsByDoc.has(docId)) {
        vectorsByDoc.set(docId, { count: 0, filename });
      }
      vectorsByDoc.get(docId)!.count++;
    }
  }

  console.log('📊 Vectors by document in Pinecone:');
  const orphanedDocIds: string[] = [];

  for (const [docId, info] of vectorsByDoc.entries()) {
    const exists = validDocIds.has(docId);
    const status = exists ? '✅' : '❌ ORPHANED';
    console.log(`   ${status} ${info.filename.substring(0, 40)}: ${info.count} vectors`);

    if (!exists) {
      orphanedDocIds.push(docId);
    }
  }
  console.log('');

  // Delete orphaned vectors by collecting their IDs
  if (orphanedDocIds.length > 0) {
    console.log(`⚠️  Found ${orphanedDocIds.length} orphaned document(s)\n`);
    console.log('🗑️  Collecting vector IDs to delete...');

    // Collect all vector IDs that need to be deleted
    const vectorIdsToDelete: string[] = [];
    for (const match of response.matches) {
      const docId = match.metadata?.documentId as string;
      if (docId && orphanedDocIds.includes(docId)) {
        vectorIdsToDelete.push(match.id);
      }
    }

    console.log(`   Found ${vectorIdsToDelete.length} vectors to delete\n`);

    if (vectorIdsToDelete.length > 0) {
      console.log('🗑️  Deleting vectors in batches...');

      // Delete in batches of 100 (Pinecone limit)
      const batchSize = 100;
      for (let i = 0; i < vectorIdsToDelete.length; i += batchSize) {
        const batch = vectorIdsToDelete.slice(i, i + batchSize);
        console.log(`   Deleting batch ${Math.floor(i / batchSize) + 1} (${batch.length} vectors)...`);
        await index.deleteMany(batch);
      }

      console.log('\n✅ Cleanup complete! Orphaned vectors removed.\n');
    }
  } else {
    console.log('✅ No orphaned vectors found. Pinecone is clean!\n');
  }

  await prisma.$disconnect();
}

clean().catch(console.error);
