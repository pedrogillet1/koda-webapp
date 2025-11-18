/**
 * Migration Script: Re-embed All Documents with OpenAI Embeddings
 *
 * This script:
 * 1. Fetches all completed documents from the database
 * 2. Retrieves their extracted text and chunks
 * 3. Generates new OpenAI embeddings (1536 dimensions)
 * 4. Uploads embeddings to the new Pinecone index (koda-openai)
 *
 * Run with: npx ts-node scripts/migrate-to-openai-embeddings.ts
 */

import prisma from '../src/config/database';
import embeddingService from '../src/services/embedding.service';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

dotenv.config();

const BATCH_SIZE = 50; // Process 50 documents at a time
const CHUNK_BATCH_SIZE = 100; // Embed 100 chunks at a time

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME || 'koda-openai');

interface MigrationStats {
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;
  startTime: number;
}

async function migrateDocumentsToOpenAI() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 OpenAI Embeddings Migration Script                        ║');
  console.log('║  Migrating from Google Gemini (768d) to OpenAI (1536d)        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const stats: MigrationStats = {
    totalDocuments: 0,
    processedDocuments: 0,
    failedDocuments: 0,
    totalChunks: 0,
    processedChunks: 0,
    failedChunks: 0,
    startTime: Date.now(),
  };

  try {
    // Step 1: Get all completed documents
    console.log('📊 Step 1: Fetching completed documents from database...');
    const documents = await prisma.document.findMany({
      where: {
        status: 'completed',
      },
      include: {
        metadata: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    stats.totalDocuments = documents.length;
    console.log(`✅ Found ${stats.totalDocuments} documents to migrate\n`);

    if (documents.length === 0) {
      console.log('⚠️  No documents to migrate. Exiting...');
      return;
    }

    // Step 2: Process documents in batches
    console.log(`📦 Step 2: Processing documents in batches of ${BATCH_SIZE}...\n`);

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

      console.log(`\n┌─ Batch ${batchNum}/${totalBatches} (${batch.length} documents) ─────────────────────`);

      for (const doc of batch) {
        try {
          console.log(`\n📄 Processing: "${doc.filename}" (${doc.id})`);

          // Get document chunks
          const chunks = await prisma.documentChunk.findMany({
            where: {
              documentId: doc.id,
            },
            orderBy: {
              chunkIndex: 'asc',
            },
          });

          if (chunks.length === 0) {
            console.log(`   ⚠️  No chunks found, skipping...`);
            stats.failedDocuments++;
            continue;
          }

          console.log(`   📊 Found ${chunks.length} chunks to re-embed`);
          stats.totalChunks += chunks.length;

          // Generate embeddings in batches
          const chunkTexts = chunks.map(c => c.chunkText);
          const chunkBatches: string[][] = [];

          for (let j = 0; j < chunkTexts.length; j += CHUNK_BATCH_SIZE) {
            chunkBatches.push(chunkTexts.slice(j, j + CHUNK_BATCH_SIZE));
          }

          const allEmbeddings: number[][] = [];

          for (let j = 0; j < chunkBatches.length; j++) {
            const chunkBatch = chunkBatches[j];
            console.log(`   ⚡ Generating embeddings for chunk batch ${j + 1}/${chunkBatches.length} (${chunkBatch.length} chunks)...`);

            const result = await embeddingService.generateBatchEmbeddings(chunkBatch);

            if (result.failedCount > 0) {
              console.warn(`   ⚠️  ${result.failedCount} chunks failed in this batch`);
              stats.failedChunks += result.failedCount;
            }

            allEmbeddings.push(...result.embeddings.map(e => e.embedding));
            stats.processedChunks += (result.totalProcessed - result.failedCount);
          }

          // Upload to Pinecone
          console.log(`   📤 Uploading ${allEmbeddings.length} vectors to Pinecone...`);

          const vectors = chunks.map((chunk, idx) => ({
            id: chunk.id,
            values: allEmbeddings[idx],
            metadata: {
              documentId: doc.id,
              userId: doc.userId,
              filename: doc.filename,
              chunkIndex: chunk.chunkIndex,
              chunkText: chunk.chunkText.substring(0, 500), // Store first 500 chars
              createdAt: doc.createdAt.toISOString(),
            },
          }));

          // Upsert to Pinecone in batches of 100
          for (let j = 0; j < vectors.length; j += 100) {
            const vectorBatch = vectors.slice(j, j + 100);
            await pineconeIndex.upsert(vectorBatch);
          }

          console.log(`   ✅ Document completed: ${chunks.length} chunks uploaded`);
          stats.processedDocuments++;

        } catch (error: any) {
          console.error(`   ❌ Error processing document: ${error.message}`);
          stats.failedDocuments++;
        }
      }

      console.log(`└─────────────────────────────────────────────────────────────────\n`);
    }

    // Step 3: Print summary
    const duration = (Date.now() - stats.startTime) / 1000;

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  📊 Migration Summary                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`⏱️  Duration: ${duration.toFixed(2)}s (${(duration / 60).toFixed(2)} minutes)`);
    console.log(`📄 Documents: ${stats.processedDocuments}/${stats.totalDocuments} successful`);
    console.log(`📊 Chunks: ${stats.processedChunks}/${stats.totalChunks} embedded`);

    if (stats.failedDocuments > 0) {
      console.log(`\n⚠️  ${stats.failedDocuments} documents failed`);
    }
    if (stats.failedChunks > 0) {
      console.log(`⚠️  ${stats.failedChunks} chunks failed`);
    }

    console.log('\n✅ Migration complete! Your documents are now using OpenAI embeddings.');
    console.log('💡 You can now test queries in the application.\n');

  } catch (error: any) {
    console.error('\n❌ Fatal error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateDocumentsToOpenAI()
  .then(() => {
    console.log('✨ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
