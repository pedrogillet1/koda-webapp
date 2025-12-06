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
    // STEP 5: Store in DocumentEmbedding table (PostgreSQL backup for BM25)
    // ═══════════════════════════════════════════════════════════════════════════
    // Delete existing embeddings for this document
    await prisma.documentEmbedding.deleteMany({
      where: { documentId },
    });

    // Prepare data for PostgreSQL
    const embeddingRecords = chunks.map((chunk, index) => {
      const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
      const content = chunk.content || chunk.text || '';
      const embedding = chunk.embedding || [];

      return {
        documentId,
        chunkIndex,
        content,
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify(chunk.metadata || {}),
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

export default {
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
  generateEmbeddings,
  searchSimilar,
};
