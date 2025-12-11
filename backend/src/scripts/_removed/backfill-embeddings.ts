/**
 * ============================================================================
 * KODA BACKFILL SCRIPT - BM25 Chunks + Pinecone Embeddings
 * ============================================================================
 *
 * This script backfills:
 * 1. BM25 chunks in PostgreSQL (document_chunks table) for keyword search
 * 2. Vector embeddings in Pinecone for semantic search
 *
 * Run: npx ts-node --transpile-only src/scripts/backfill-embeddings.ts
 *
 * Options:
 *   --user <email>    Backfill only for specific user
 *   --limit <n>       Limit number of documents to process
 *   --bm25-only       Only create BM25 chunks (skip Pinecone)
 *   --pinecone-only   Only create Pinecone embeddings (skip BM25)
 */

import prisma from '../config/database';
import embeddingService from '../services/embedding.service';
import pineconeService from '../services/pinecone.service';
import { createBM25Chunks } from '../services/bm25ChunkCreation.service';

// Configuration
const BATCH_SIZE = 10; // Process documents in batches
const CHUNK_SIZE = 1000; // Characters per chunk for embeddings
const MAX_CHUNKS_PER_DOC = 100; // Prevent memory issues on huge docs

interface ProcessingStats {
  totalDocs: number;
  processedDocs: number;
  skippedDocs: number;
  failedDocs: number;
  totalBM25Chunks: number;
  totalPineconeEmbeddings: number;
}

/**
 * Split text into chunks for embedding
 */
function splitIntoChunks(text: string): Array<{ content: string; chunkIndex: number; startChar: number; endChar: number }> {
  const chunks: Array<{ content: string; chunkIndex: number; startChar: number; endChar: number }> = [];

  if (!text || text.length === 0) return chunks;

  // Limit text to prevent memory issues
  const limitedText = text.length > 500000 ? text.slice(0, 500000) : text;

  let start = 0;
  let chunkIndex = 0;

  while (start < limitedText.length && chunkIndex < MAX_CHUNKS_PER_DOC) {
    let end = Math.min(start + CHUNK_SIZE, limitedText.length);

    // Try to break at sentence boundary
    if (end < limitedText.length) {
      const chunkText = limitedText.slice(start, end);
      const lastSentence = chunkText.lastIndexOf('. ');
      if (lastSentence > CHUNK_SIZE * 0.5) {
        end = start + lastSentence + 2;
      }
    }

    chunks.push({
      content: limitedText.slice(start, end).trim(),
      chunkIndex,
      startChar: start,
      endChar: end
    });

    chunkIndex++;
    start = end - 200; // 200 char overlap
    if (start >= limitedText.length) break;
  }

  return chunks;
}

/**
 * Process a single document
 */
async function processDocument(
  doc: {
    id: string;
    userId: string;
    filename: string;
    mimeType: string;
    createdAt: Date;
    folderId: string | null;
    folder: { name: string; path: string | null } | null;
    metadata: { extractedText: string | null; markdownContent: string | null; pageCount: number | null } | null;
  },
  options: { bm25Only: boolean; pineconeOnly: boolean }
): Promise<{ bm25Chunks: number; pineconeEmbeddings: number; error?: string }> {
  const result = { bm25Chunks: 0, pineconeEmbeddings: 0 };

  // Get text content (prefer markdown, fallback to extracted text)
  const textContent = doc.metadata?.markdownContent || doc.metadata?.extractedText;

  if (!textContent || textContent.trim().length < 50) {
    return { ...result, error: 'Text too short' };
  }

  // ========================================
  // Step 1: Create BM25 chunks
  // ========================================
  if (!options.pineconeOnly) {
    try {
      const existingBM25 = await prisma.documentChunk.count({
        where: { documentId: doc.id }
      });

      if (existingBM25 === 0) {
        const chunkCount = await createBM25Chunks(
          doc.id,
          textContent,
          doc.metadata?.pageCount || null
        );
        result.bm25Chunks = chunkCount;
      }
    } catch (error: any) {
      console.error(`  ❌ BM25 error for ${doc.filename}:`, error.message);
    }
  }

  // ========================================
  // Step 2: Create Pinecone embeddings
  // ========================================
  if (!options.bm25Only && pineconeService.isAvailable()) {
    try {
      // Split text into chunks
      const chunks = splitIntoChunks(textContent);

      if (chunks.length === 0) {
        return result;
      }

      // Generate embeddings for each chunk
      const chunksWithEmbeddings = [];
      for (const chunk of chunks) {
        try {
          const embeddingResult = await embeddingService.generateEmbedding(chunk.content);
          chunksWithEmbeddings.push({
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: embeddingResult.embedding,
            metadata: {
              startChar: chunk.startChar,
              endChar: chunk.endChar
            }
          });
        } catch (chunkError: any) {
          console.warn(`    ⚠️ Failed to embed chunk ${chunk.chunkIndex}: ${chunkError.message}`);
        }
      }

      // Store in Pinecone
      if (chunksWithEmbeddings.length > 0) {
        await pineconeService.upsertDocumentEmbeddings(
          doc.id,
          doc.userId,
          {
            filename: doc.filename,
            mimeType: doc.mimeType,
            createdAt: doc.createdAt,
            status: 'completed',
            folderId: doc.folderId || undefined,
            folderName: doc.folder?.name || undefined,
            folderPath: doc.folder?.path || undefined,
          },
          chunksWithEmbeddings
        );
        result.pineconeEmbeddings = chunksWithEmbeddings.length;
      }
    } catch (error: any) {
      console.error(`  ❌ Pinecone error for ${doc.filename}:`, error.message);
    }
  }

  return result;
}

/**
 * Main backfill function
 */
async function backfillEmbeddings() {
  console.log('🚀 ============================================');
  console.log('   KODA EMBEDDING BACKFILL SCRIPT');
  console.log('   ============================================\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const userEmail = args.includes('--user') ? args[args.indexOf('--user') + 1] : null;
  const limitArg = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null;
  const bm25Only = args.includes('--bm25-only');
  const pineconeOnly = args.includes('--pinecone-only');

  console.log('📋 Configuration:');
  console.log(`   User filter: ${userEmail || 'all users'}`);
  console.log(`   Document limit: ${limitArg || 'no limit'}`);
  console.log(`   BM25 chunks: ${!pineconeOnly ? '✅' : '❌ (skipped)'}`);
  console.log(`   Pinecone embeddings: ${!bm25Only ? '✅' : '❌ (skipped)'}`);
  console.log(`   Pinecone available: ${pineconeService.isAvailable() ? '✅' : '❌'}`);
  console.log('');

  const stats: ProcessingStats = {
    totalDocs: 0,
    processedDocs: 0,
    skippedDocs: 0,
    failedDocs: 0,
    totalBM25Chunks: 0,
    totalPineconeEmbeddings: 0
  };

  try {
    // Build where clause
    const whereClause: any = {
      status: 'completed',
      metadata: { isNot: null }
    };

    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { id: true }
      });
      if (!user) {
        console.error(`❌ User not found: ${userEmail}`);
        process.exit(1);
      }
      whereClause.userId = user.id;
    }

    // Get total count
    const totalCount = await prisma.document.count({ where: whereClause });
    stats.totalDocs = limitArg ? Math.min(limitArg, totalCount) : totalCount;

    console.log(`📊 Found ${totalCount} documents, will process ${stats.totalDocs}\n`);

    // Process in batches
    let processed = 0;
    const startTime = Date.now();

    while (processed < stats.totalDocs) {
      // Fetch batch
      const documents = await prisma.document.findMany({
        where: whereClause,
        include: {
          folder: { select: { name: true, path: true } },
          metadata: { select: { extractedText: true, markdownContent: true, pageCount: true } }
        },
        skip: processed,
        take: Math.min(BATCH_SIZE, stats.totalDocs - processed),
        orderBy: { createdAt: 'desc' }
      });

      if (documents.length === 0) break;

      // Process batch
      for (const doc of documents) {
        process.stdout.write(`  [${processed + 1}/${stats.totalDocs}] ${doc.filename.substring(0, 40)}... `);

        const result = await processDocument(doc, { bm25Only, pineconeOnly });

        if (result.error) {
          stats.skippedDocs++;
          console.log(`⏭️ (${result.error})`);
        } else if (result.bm25Chunks === 0 && result.pineconeEmbeddings === 0) {
          stats.skippedDocs++;
          console.log(`⏭️ (already processed)`);
        } else {
          stats.processedDocs++;
          stats.totalBM25Chunks += result.bm25Chunks;
          stats.totalPineconeEmbeddings += result.pineconeEmbeddings;
          console.log(`✅ (BM25: ${result.bm25Chunks}, Pinecone: ${result.pineconeEmbeddings})`);
        }

        processed++;
      }

      // Progress update
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (stats.totalDocs - processed) / rate;
      console.log(`\n  📈 Progress: ${processed}/${stats.totalDocs} (${(processed/stats.totalDocs*100).toFixed(1)}%) - ETA: ${remaining.toFixed(0)}s\n`);
    }

    // Final summary
    console.log('\n🎉 ============================================');
    console.log('   BACKFILL COMPLETE');
    console.log('   ============================================');
    console.log(`   Total documents: ${stats.totalDocs}`);
    console.log(`   Processed: ${stats.processedDocs}`);
    console.log(`   Skipped: ${stats.skippedDocs}`);
    console.log(`   Failed: ${stats.failedDocs}`);
    console.log(`   BM25 chunks created: ${stats.totalBM25Chunks}`);
    console.log(`   Pinecone embeddings: ${stats.totalPineconeEmbeddings}`);
    console.log(`   Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log('   ============================================\n');

  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
backfillEmbeddings();
