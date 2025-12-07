/**
 * ============================================================================
 * KODA BM25 CHUNK POPULATION SCRIPT
 * ============================================================================
 *
 * This script populates the document_chunks table from existing documents.
 * It extracts text from DocumentMetadata and chunks it for BM25 search.
 *
 * Run: npx ts-node src/scripts/populate-bm25-chunks.ts
 */

import prisma from '../config/database';

// Chunk size for text splitting (characters)
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

interface ChunkData {
  documentId: string;
  chunkIndex: number;
  text: string;
  page: number | null;
  startChar: number;
  endChar: number;
}

/**
 * Split text into overlapping chunks
 */
function splitIntoChunks(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): Array<{ text: string; start: number; end: number }> {
  const chunks: Array<{ text: string; start: number; end: number }> = [];

  if (!text || text.length === 0) {
    return chunks;
  }

  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end);

    // Try to break at sentence boundary
    let adjustedEnd = end;
    if (end < text.length) {
      const lastSentenceEnd = chunkText.lastIndexOf('. ');
      if (lastSentenceEnd > chunkSize * 0.5) {
        adjustedEnd = start + lastSentenceEnd + 2;
      }
    }

    chunks.push({
      text: text.slice(start, adjustedEnd).trim(),
      start,
      end: adjustedEnd
    });

    start = adjustedEnd - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

async function populateChunks() {
  console.log('🚀 [BM25 POPULATE] Starting chunk population...\n');

  try {
    // ========================================
    // Step 1: Get document IDs (not full content)
    // ========================================
    console.log('📋 [Step 1] Counting documents...');

    const documentIds = await prisma.document.findMany({
      where: {
        status: { in: ['ready', 'completed'] },
        metadata: {
          isNot: null
        }
      },
      select: {
        id: true,
        filename: true
      }
    });

    console.log(`   📊 Found ${documentIds.length} documents with metadata`);

    if (documentIds.length === 0) {
      console.log('   ⚠️ No documents found. Nothing to populate.');
      return;
    }

    // ========================================
    // Step 2: Process documents ONE AT A TIME
    // ========================================
    console.log('\n📋 [Step 2] Processing documents one at a time...');

    let totalChunks = 0;
    let processedDocs = 0;
    let skippedDocs = 0;

    for (let i = 0; i < documentIds.length; i++) {
      const docInfo = documentIds[i];

      // Check if chunks already exist (skip if already processed)
      const existingChunks = await prisma.documentChunk.count({
        where: { documentId: docInfo.id }
      });

      if (existingChunks > 0) {
        skippedDocs++;
        continue;
      }

      // Fetch metadata for this single document
      const metadata = await prisma.documentMetadata.findUnique({
        where: { documentId: docInfo.id },
        select: {
          extractedText: true,
          markdownContent: true,
          pageCount: true
        }
      });

      if (!metadata) {
        skippedDocs++;
        continue;
      }

      // Get text content (prefer markdown, fallback to extracted)
      const textContent = metadata.markdownContent || metadata.extractedText;

      if (!textContent || textContent.trim().length < 50) {
        skippedDocs++;
        continue;
      }

      // Split into chunks
      const textChunks = splitIntoChunks(textContent);

      if (textChunks.length === 0) {
        skippedDocs++;
        continue;
      }

      // Prepare chunk records
      const chunkRecords: ChunkData[] = textChunks.map((chunk, index) => ({
        documentId: docInfo.id,
        chunkIndex: index,
        text: chunk.text,
        page: metadata.pageCount ? Math.ceil((chunk.start / textContent.length) * metadata.pageCount) : null,
        startChar: chunk.start,
        endChar: chunk.end
      }));

      // Insert chunks in batch
      await prisma.documentChunk.createMany({
        data: chunkRecords
      });

      totalChunks += chunkRecords.length;
      processedDocs++;

      // Log progress every 10 documents
      if (processedDocs % 10 === 0) {
        console.log(`   📝 Progress: ${processedDocs}/${documentIds.length - skippedDocs} documents (${totalChunks} chunks)`);
      }
    }

    // ========================================
    // Step 3: Summary
    // ========================================
    console.log('\n📋 [Step 3] Summary');
    console.log(`   ✅ Processed: ${processedDocs} documents`);
    console.log(`   ⏭️ Skipped: ${skippedDocs} documents`);
    console.log(`   📊 Total chunks created: ${totalChunks}`);

    // Verify
    const finalCount = await prisma.documentChunk.count();
    console.log(`\n   📊 Total chunks in database: ${finalCount}`);

    console.log('\n✅ [BM25 POPULATE] Population complete!\n');

  } catch (error) {
    console.error('❌ [BM25 POPULATE] Population failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the population
populateChunks();
