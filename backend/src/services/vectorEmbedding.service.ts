/**
 * Vector Embedding Service V1
 *
 * Stub for vector operations - actual embeddings handled by Pinecone service directly
 */

import embeddingService from './embedding.service';

export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingService.generateEmbedding(text);
  return result.embedding;
}

export async function storeDocumentEmbeddings(
  documentId: string,
  chunks: any[]
): Promise<void> {
  // No-op stub - Pinecone handles this via document processing
  console.log(`[VectorEmbedding] Would store ${chunks.length} embeddings for doc ${documentId}`);
}

export async function deleteDocumentEmbeddings(documentId: string): Promise<void> {
  // No-op stub
  console.log(`[VectorEmbedding] Would delete embeddings for doc ${documentId}`);
}

export async function deleteChunkEmbeddings(chunkIds: string[]): Promise<void> {
  // No-op stub
  console.log(`[VectorEmbedding] Would delete ${chunkIds.length} chunk embeddings`);
}

export const vectorEmbeddingService = {
  generateEmbedding,
  storeDocumentEmbeddings,
  deleteDocumentEmbeddings,
  deleteChunkEmbeddings,
};

export default vectorEmbeddingService;
