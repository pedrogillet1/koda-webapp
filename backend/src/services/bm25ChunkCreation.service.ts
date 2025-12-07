/**
 * ============================================================================
 * BM25 Chunk Creation Service
 * ============================================================================
 *
 * ✅ FIX: DISABLED - Chunks are now stored via vectorEmbeddingService in DocumentEmbedding table
 * The DocumentChunk table was causing 88% stuck issue. BM25 search uses DocumentEmbedding.content field.
 */

/**
 * Create BM25 chunks for a document (DISABLED)
 * @returns Number of chunks created (always 0 - disabled)
 */
export async function createBM25Chunks(
  documentId: string,
  textContent: string,
  pageCount?: number | null
): Promise<number> {
  // ✅ FIX: BM25 chunks are now stored in DocumentEmbedding via vectorEmbeddingService
  // This prevents the 88% stuck issue caused by DocumentChunk table operations
  console.log(`⏭️ [BM25] Skipping chunk creation - using DocumentEmbedding for BM25 search`);
  return 0;
}

/**
 * Delete BM25 chunks for a document (DISABLED - no-op)
 */
export async function deleteBM25Chunks(documentId: string): Promise<void> {
  // No-op - chunks are managed by vectorEmbeddingService
  console.log(`⏭️ [BM25] Skipping chunk deletion - managed by vectorEmbeddingService`);
}

export default {
  createBM25Chunks,
  deleteBM25Chunks
};
