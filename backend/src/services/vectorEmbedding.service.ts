/**
 * Vector Embedding Service - COMPLETE IMPLEMENTATION
 *
 * This service stores document chunks to PostgreSQL for BM25 keyword search.
 * Pinecone already handles vector storage (done in pinecone.service.ts).
 *
 * HYBRID SEARCH ARCHITECTURE:
 * - Pinecone: Stores vectors for semantic search
 * - PostgreSQL: Stores text for BM25 keyword search <- THIS FILE
 */

import prisma from '../config/database';

/**
 * Store document embeddings to PostgreSQL for BM25 search
 *
 * @param documentId - Document ID
 * @param chunks - Array of chunks with text, embeddings, and metadata
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
    console.log(`[VectorEmbedding] No chunks to store for document ${documentId}`);
    return;
  }

  try {
    console.log(`[VectorEmbedding] Storing ${chunks.length} chunks to PostgreSQL for document ${documentId}`);

    // Delete existing embeddings for this document (if any)
    await prisma.documentEmbedding.deleteMany({
      where: { documentId }
    });

    // Store chunks to PostgreSQL for BM25 search
    const data = chunks.map((chunk, index) => {
      const chunkIndex = chunk.chunkIndex ?? chunk.pageNumber ?? index;
      const content = chunk.content || chunk.text || '';
      const embedding = chunk.embedding || [];
      const metadata = chunk.metadata || {};

      return {
        documentId,
        chunkIndex,
        content,
        embedding: JSON.stringify(embedding),
        metadata: JSON.stringify(metadata),
      };
    });

    await prisma.documentEmbedding.createMany({
      data,
      skipDuplicates: true,
    });

    console.log(`[VectorEmbedding] Stored ${chunks.length} chunks to PostgreSQL for BM25 search`);
  } catch (error) {
    console.error('[VectorEmbedding] Failed to store embeddings:', error);
    throw error;
  }
};

/**
 * Delete document embeddings from PostgreSQL
 *
 * @param documentId - Document ID
 */
export const deleteDocumentEmbeddings = async (documentId: string): Promise<void> => {
  try {
    console.log(`[VectorEmbedding] Deleting embeddings for document ${documentId}`);

    const result = await prisma.documentEmbedding.deleteMany({
      where: { documentId }
    });

    console.log(`[VectorEmbedding] Deleted ${result.count} embeddings from PostgreSQL`);
  } catch (error) {
    console.error('[VectorEmbedding] Failed to delete embeddings:', error);
    throw error;
  }
};

/**
 * Generate embeddings (placeholder - actual generation done in embedding.service.ts)
 */
export const generateEmbeddings = async (texts: string[]): Promise<number[][]> => {
  console.warn('[VectorEmbedding] generateEmbeddings called but should use embedding.service.ts');
  return [];
};

/**
 * Search similar chunks (placeholder - actual search done in pinecone.service.ts)
 */
export const searchSimilar = async (
  queryEmbedding: number[],
  topK: number = 5
): Promise<any[]> => {
  console.warn('[VectorEmbedding] searchSimilar called but should use pinecone.service.ts');
  return [];
};

export default {
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
  generateEmbeddings,
  searchSimilar,
};
