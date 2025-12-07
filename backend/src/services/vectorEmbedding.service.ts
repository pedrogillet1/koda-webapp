/**
 * Vector Embedding Service - FIXED IMPLEMENTATION
 *
 * Connects document.service.ts to pinecone.service.ts
 *
 * ROOT CAUSE: This service only stored to PostgreSQL, missing Pinecone storage.
 * Files uploaded but embeddings were never stored in Pinecone, making RAG fail.
 *
 * FIX: Now stores to BOTH Pinecone (for vector search) AND PostgreSQL (for BM25)
 */

import pineconeService from './pinecone.service';
import prisma from '../config/database';
import { generateMicroSummary } from './microSummaryGenerator.service';

/**
 * Store document embeddings in Pinecone AND PostgreSQL
 * Called from document.service.ts after embedding generation
 *
 * @param documentId - Document ID
 * @param chunks - Array of chunks with embeddings
 */
export const storeDocumentEmbeddings = async (
  documentId: string,
  chunks: Array<{
    chunkIndex?: number;
    content?: string;
    text?: string;
    embedding?: number[];
    metadata?: any;
    pageNumber?: number;
  }>
): Promise<void> => {
  if (!chunks || chunks.length === 0) {
    console.log(`[vectorEmbedding] No chunks to store for document ${documentId}`);
    return;
  }

  try {
    console.log(`💾 [vectorEmbedding] Storing ${chunks.length} embeddings for document ${documentId}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Fetch document metadata from database
    // ═══════════════════════════════════════════════════════════════════════════
    const document = await prisma.documents.findUnique({
      where: { id: documentId },
      include: {
        folder: true,
      },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Prepare document metadata for Pinecone
    // ═══════════════════════════════════════════════════════════════════════════
    const documentMetadata = {
      filename: document.filename,
      mimeType: document.mimeType,
      createdAt: document.createdAt,
      status: document.status,
      originalName: document.filename,
      folderId: document.folderId || undefined,
      folderName: document.folder?.name || undefined,
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Transform chunks to Pinecone format
    // ═══════════════════════════════════════════════════════════════════════════
    const pineconeChunks = chunks.map((chunk, index) => {
      const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
      const content = chunk.content || chunk.text || '';
      const embedding = chunk.embedding || [];

      return {
        chunkIndex,
        content,
        embedding,
        metadata: chunk.metadata || {},
      };
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Store in Pinecone via pinecone.service.ts (CRITICAL FOR RAG!)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`🔄 [vectorEmbedding] Upserting ${pineconeChunks.length} vectors to Pinecone...`);

    await pineconeService.upsertDocumentEmbeddings(
      documentId,
      document.userId,
      documentMetadata,
      pineconeChunks
    );

    console.log(`✅ [vectorEmbedding] Stored ${chunks.length} embeddings in Pinecone for document ${documentId}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4.5: Generate Micro-Summaries for each chunk (Phase 2 Optimization)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`📝 [vectorEmbedding] Generating micro-summaries for ${chunks.length} chunks...`);

    const documentType = detectDocumentType(document.mimeType, document.filename);
    const microSummaries: Map<number, string> = new Map();

    // Generate micro-summaries in parallel batches
    const MICRO_BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += MICRO_BATCH_SIZE) {
      const batch = chunks.slice(i, i + MICRO_BATCH_SIZE);
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? (i + batchIndex);
        const content = chunk.content || chunk.text || '';
        const chunkType = chunk.metadata?.chunkType || 'general';
        const sectionName = chunk.metadata?.section || chunk.metadata?.sectionName;

        try {
          const result = await generateMicroSummary(content, chunkType, documentType, sectionName);
          microSummaries.set(chunkIndex, result.summary);
          console.log(`  ✅ Chunk ${chunkIndex}: "${result.summary.substring(0, 50)}..."`);
        } catch (error) {
          console.warn(`  ⚠️ Chunk ${chunkIndex}: Failed to generate micro-summary`);
          microSummaries.set(chunkIndex, '');
        }
      });
      await Promise.all(batchPromises);
    }

    console.log(`✅ [vectorEmbedding] Generated ${microSummaries.size} micro-summaries`);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Store in DocumentEmbedding table (PostgreSQL backup for BM25)
    // ═══════════════════════════════════════════════════════════════════════════
    // Delete existing embeddings for this document
    await prisma.documentEmbedding.deleteMany({
      where: { documentId },
    });

    // Prepare data for PostgreSQL with micro-summaries
    const embeddingRecords = chunks.map((chunk, index) => {
      const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
      const content = chunk.content || chunk.text || '';
      const embedding = chunk.embedding || [];
      const microSummary = microSummaries.get(chunkIndex) || null;

      return {
        documentId,
        chunkIndex,
        content,
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify(chunk.metadata || {}),
        microSummary,  // Store micro-summary in database
        chunkType: chunk.metadata?.chunkType || null,
      };
    });

    // Insert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < embeddingRecords.length; i += BATCH_SIZE) {
      const batch = embeddingRecords.slice(i, i + BATCH_SIZE);
      await prisma.documentEmbedding.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    console.log(`✅ [vectorEmbedding] Stored ${embeddingRecords.length} embeddings in PostgreSQL (BM25 backup)`);

  } catch (error: any) {
    console.error(`❌ [vectorEmbedding] Failed to store embeddings for document ${documentId}:`, error.message);
    throw new Error(`Failed to store embeddings: ${error.message}`);
  }
};

/**
 * Delete document embeddings from Pinecone and PostgreSQL
 * Called when a document is deleted
 *
 * @param documentId - Document ID
 */
export const deleteDocumentEmbeddings = async (documentId: string): Promise<void> => {
  try {
    console.log(`🗑️ [vectorEmbedding] Deleting embeddings for document ${documentId}`);

    // Delete from Pinecone
    await pineconeService.deleteDocumentEmbeddings(documentId);

    // Delete from PostgreSQL
    const result = await prisma.documentEmbedding.deleteMany({
      where: { documentId },
    });

    console.log(`✅ [vectorEmbedding] Deleted embeddings (Pinecone + ${result.count} PostgreSQL rows)`);
  } catch (error: any) {
    console.error(`❌ [vectorEmbedding] Failed to delete embeddings for document ${documentId}:`, error.message);
    // Don't throw - allow document deletion to proceed even if embedding deletion fails
  }
};

/**
 * Generate embeddings (deprecated - use embedding.service.ts)
 */
export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  console.warn('⚠️ [vectorEmbedding] generateEmbeddings() is deprecated - use embedding.service.ts instead');
  return [];
};

/**
 * Search similar (deprecated - use pinecone.service.ts)
 */
export const searchSimilar = async (
  queryEmbedding: number[],
  userId: string,
  topK: number = 5
): Promise<any[]> => {
  console.warn('⚠️ [vectorEmbedding] searchSimilar() is deprecated - use pinecone.service.ts directly');
  return [];
};

/**
 * Detect document type from mimeType and filename
 * Used for micro-summary generation context
 */
function detectDocumentType(mimeType: string, filename: string): string {
  const lower = (mimeType + ' ' + filename).toLowerCase();

  if (lower.includes('pdf')) {
    // Check filename for hints
    if (/contract|agreement|lease|terms/i.test(filename)) return 'legal';
    if (/medical|health|patient|diagnosis/i.test(filename)) return 'medical';
    if (/financial|budget|revenue|invoice/i.test(filename)) return 'financial';
    if (/report|analysis|study/i.test(filename)) return 'report';
    return 'document';
  }

  if (lower.includes('spreadsheet') || lower.includes('excel') || lower.includes('xlsx') || lower.includes('csv')) {
    return 'financial';
  }

  if (lower.includes('presentation') || lower.includes('powerpoint') || lower.includes('pptx')) {
    return 'presentation';
  }

  if (lower.includes('word') || lower.includes('docx')) {
    if (/contract|agreement|lease/i.test(filename)) return 'legal';
    return 'document';
  }

  return 'general';
}

export default {
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
  generateEmbeddings,
  searchSimilar,
};
