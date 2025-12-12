/**
 * Koda Hybrid Search Service
 * Combines vector search (Pinecone) and BM25 (DB full-text) for optimal retrieval
 */

import { PrismaClient } from '@prisma/client';
import pineconeService from '../pinecone.service';
import embeddingService from '../embedding.service';

const prisma = new PrismaClient();
import { RetrievedChunk, RetrievalFilters } from '../../types/ragV3.types';

interface HybridSearchParams {
  userId: string;
  query: string;
  filters: RetrievalFilters;
  vectorTopK: number;
  bm25TopK: number;
}

type HybridSearchResult = RetrievedChunk[];

/**
 * Service to perform hybrid search combining vector search (Pinecone) and BM25 (DB full-text).
 * Normalizes and merges scores from both sources, deduplicates, and returns unified RetrievedChunk[].
 */
export class KodaHybridSearchService {
  private embeddingService: typeof embeddingService;
  private pineconeService: typeof pineconeService;

  constructor() {
    this.embeddingService = embeddingService;
    this.pineconeService = pineconeService;
  }

  /**
   * Perform hybrid search combining vector and BM25 retrieval.
   * @param params HybridSearchParams including userId, query, filters, and topK counts.
   * @returns Promise resolving to merged and scored RetrievedChunk[] sorted by descending score.
   */
  public async search(params: HybridSearchParams): Promise<HybridSearchResult> {
    const { userId, query, filters, vectorTopK, bm25TopK } = params;

    // Defensive: if no query or userId, return empty
    if (!userId || !query.trim()) {
      return [];
    }

    // Step 1: Vector search via Pinecone
    const vectorChunks = await this.vectorSearch(userId, query, filters, vectorTopK);

    // Step 2: BM25 search via DB full-text
    const bm25Chunks = await this.bm25Search(userId, query, filters, bm25TopK);

    // Step 3: Normalize scores to [0,1]
    const normalizedVector = this.normalizeScores(vectorChunks, 'vector');
    const normalizedBM25 = this.normalizeScores(bm25Chunks, 'bm25');

    // Step 4: Merge results keyed by chunkId
    const mergedMap = new Map<string, RetrievedChunk>();

    // Insert vector results with 0.6 weight
    for (const chunk of normalizedVector) {
      mergedMap.set(chunk.chunkId, { ...chunk, score: chunk.score * 0.6 });
    }

    // Merge BM25 results with 0.4 weight
    for (const bmChunk of normalizedBM25) {
      const existing = mergedMap.get(bmChunk.chunkId);
      if (existing) {
        // Combine scores
        const combinedScore = existing.score + bmChunk.score * 0.4;
        mergedMap.set(bmChunk.chunkId, { ...existing, score: combinedScore });
      } else {
        mergedMap.set(bmChunk.chunkId, { ...bmChunk, score: bmChunk.score * 0.4 });
      }
    }

    // Step 5: Convert map to array and sort descending by final score
    const mergedChunks = Array.from(mergedMap.values());
    mergedChunks.sort((a, b) => b.score - a.score);

    return mergedChunks;
  }

  /**
   * Perform vector search using embedding + Pinecone.
   */
  private async vectorSearch(
    userId: string,
    query: string,
    filters: RetrievalFilters,
    topK: number
  ): Promise<RetrievedChunk[]> {
    try {
      // Embed query text to vector
      const embeddingResult = await this.embeddingService.generateQueryEmbedding(query);
      const queryEmbedding = embeddingResult.embedding;

      // Query Pinecone using the service's query method
      const documentId = filters.documentIds && filters.documentIds.length === 1
        ? filters.documentIds[0]
        : undefined;

      const pineconeResults = await this.pineconeService.query(queryEmbedding, {
        userId,
        topK,
        documentId,
      });

      // Map Pinecone results to RetrievedChunk[]
      const chunks: RetrievedChunk[] = pineconeResults.map((result: any) => ({
        chunkId: `${result.documentId}-${result.chunkIndex}`,
        documentId: result.documentId || '',
        documentName: result.filename || '',
        content: result.content ?? '',
        pageNumber: result.metadata?.pageNumber,
        score: result.similarity || 0,
        metadata: { ...result.metadata },
      }));

      return chunks;
    } catch (error) {
      console.error('[KodaHybridSearch] Error in vectorSearch:', error);
      return [];
    }
  }

  /**
   * Perform BM25 full-text search on document_chunks table using Postgres full-text search.
   * FIXED: Uses correct table name (document_chunks), columns (text, page), and JOINs with documents for userId.
   */
  private async bm25Search(
    userId: string,
    query: string,
    filters: RetrievalFilters,
    topK: number
  ): Promise<RetrievedChunk[]> {
    try {
      const sanitizedQuery = query.trim().replace(/'/g, "''");

      // Build document filter
      let docFilter = '';
      if (filters.documentIds && filters.documentIds.length > 0) {
        const docIdList = filters.documentIds.map(id => `'${id}'`).join(',');
        docFilter = `AND dc."documentId" IN (${docIdList})`;
      }

      // FIXED SQL: Uses document_chunks table, text column, page column, JOIN with documents
      const rawQuery = `
        SELECT
          dc.id as "chunkId",
          dc."documentId",
          dc.text as content,
          dc.page as "pageNumber",
          d.filename as "documentName",
          ts_rank_cd(to_tsvector('simple', dc.text), plainto_tsquery('simple', $1)) AS bm25_score
        FROM document_chunks dc
        INNER JOIN documents d ON dc."documentId" = d.id
        WHERE d."userId" = $2
          ${docFilter}
          AND to_tsvector('simple', dc.text) @@ plainto_tsquery('simple', $1)
        ORDER BY bm25_score DESC
        LIMIT $3
      `;

      const results: any[] = await prisma.$queryRawUnsafe(rawQuery, sanitizedQuery, userId, topK);

      // Map results to RetrievedChunk[]
      const chunks: RetrievedChunk[] = results.map((row) => ({
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentName: row.documentName || '',
        content: row.content,
        pageNumber: row.pageNumber ?? undefined,
        score: parseFloat(row.bm25_score) || 0,
        metadata: {},
      }));

      return chunks;
    } catch (error) {
      console.error('[KodaHybridSearch] Error in bm25Search:', error);
      return [];
    }
  }

  /**
   * Normalize scores of chunks to [0,1] range using min-max normalization.
   */
  private normalizeScores(chunks: RetrievedChunk[], _source: 'vector' | 'bm25'): RetrievedChunk[] {
    if (chunks.length === 0) return [];

    const scores = chunks.map((c) => c.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // If all scores equal, normalize all to 1
    if (maxScore === minScore) {
      return chunks.map((chunk) => ({ ...chunk, score: 1 }));
    }

    // Min-max normalization
    return chunks.map((chunk) => ({
      ...chunk,
      score: (chunk.score - minScore) / (maxScore - minScore),
    }));
  }
}

export const kodaHybridSearchService = new KodaHybridSearchService();
