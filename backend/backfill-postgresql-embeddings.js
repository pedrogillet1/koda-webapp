/**
 * Backfill PostgreSQL document_embeddings from Pinecone
 *
 * This script pulls chunk data from Pinecone and stores it in PostgreSQL
 * for BM25 keyword search.
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function backfillEmbeddings() {
  console.log('🔄 Backfilling PostgreSQL embeddings from Pinecone...\n');

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pc.index('koda-openai');

  // Get user
  const user = await prisma.user.findUnique({
    where: { email: 'localhost@koda.com' }
  });

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  // Get all completed documents
  const documents = await prisma.document.findMany({
    where: {
      userId: user.id,
      status: 'completed'
    },
    select: { id: true, filename: true }
  });

  console.log(`📊 Found ${documents.length} documents to backfill\n`);

  let totalChunks = 0;
  let processedDocs = 0;

  for (const doc of documents) {
    try {
      // Query Pinecone for this document's vectors with metadata
      const results = await index.query({
        vector: new Array(1536).fill(0),
        topK: 100,
        filter: { documentId: doc.id },
        includeMetadata: true
      });

      const chunks = results.matches || [];

      if (chunks.length === 0) {
        console.log(`⚠️  ${doc.filename}: No chunks in Pinecone`);
        continue;
      }

      // Delete existing embeddings
      await prisma.documentEmbedding.deleteMany({
        where: { documentId: doc.id }
      });

      // Prepare data for PostgreSQL
      const data = chunks.map((chunk, index) => {
        const metadata = chunk.metadata || {};
        const content = metadata.text || metadata.content || metadata.pageContent || '';
        const chunkIndex = metadata.chunkIndex ?? metadata.pageNumber ?? index;

        return {
          documentId: doc.id,
          chunkIndex: typeof chunkIndex === 'number' ? chunkIndex : index,
          content: content,
          embedding: JSON.stringify(chunk.values || []),
          metadata: JSON.stringify(metadata),
        };
      });

      // Filter out empty content
      const validData = data.filter(d => d.content && d.content.length > 0);

      if (validData.length === 0) {
        console.log(`⚠️  ${doc.filename}: No valid content found in Pinecone metadata`);
        continue;
      }

      // Insert into PostgreSQL
      await prisma.documentEmbedding.createMany({
        data: validData,
        skipDuplicates: true,
      });

      totalChunks += validData.length;
      processedDocs++;
      console.log(`✅ ${doc.filename}: ${validData.length} chunks stored`);

    } catch (error) {
      console.error(`❌ ${doc.filename}: ${error.message}`);
    }
  }

  console.log('\n=== BACKFILL COMPLETE ===');
  console.log(`Documents processed: ${processedDocs}/${documents.length}`);
  console.log(`Total chunks stored: ${totalChunks}`);

  // Verify
  const totalEmbeddings = await prisma.documentEmbedding.count({
    where: { document: { userId: user.id } }
  });
  console.log(`\nPostgreSQL embeddings count: ${totalEmbeddings}`);

  await prisma.$disconnect();
}

backfillEmbeddings().catch(console.error);
