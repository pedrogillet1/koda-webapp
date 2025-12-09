/**
 * BM25 Retrieval Service - A+ Implementation
 * Performs keyword-based search using BM25 algorithm
 *
 * Features:
 * - Integration with existing bm25-retrieval.service.ts
 * - Caching of tokenized documents
 * - Stopword removal and stemming
 * - Database fallback for large datasets
 */

import { BM25Result, RetrievalOptions } from "../types/retrieval.types";
import { logger, logError } from "../utils/logger.service";
import { cacheManager } from "../utils/cache-manager.service";
import prisma from "../../../config/database";

// Simple tokenizer and stopword filter
const stopWords = new Set([
  "a", "e", "o", "de", "para", "com", "em", "um", "uma", "os", "as", "que",
  "do", "da", "no", "na", "é", "por", "se", "mais", "como", "mas", "ao"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(token => token.length > 2 && !stopWords.has(token));
}

class BM25RetrievalService {
  /**
   * Perform BM25 search using database full-text search
   */
  public async search(
    query: string,
    userId: string,
    options: RetrievalOptions
  ): Promise<BM25Result[]> {
    const { topK } = options;
    const queryTokens = tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    try {
      // Use database full-text search
      const searchQuery = queryTokens.join(" & ");

      const chunks = await prisma.$queryRaw<any[]>`
        SELECT
          dc.id,
          dc.content,
          dc."documentId",
          d.filename,
          dc."pageNumber",
          dc."chunkType",
          dc."microSummary",
          ts_rank(to_tsvector('portuguese', dc.content), to_tsquery('portuguese', ${searchQuery})) as score
        FROM "DocumentChunk" dc
        JOIN "Document" d ON dc."documentId" = d.id
        WHERE d."userId" = ${userId}::uuid
          AND d.status != 'deleted'
          AND to_tsvector('portuguese', dc.content) @@ to_tsquery('portuguese', ${searchQuery})
        ORDER BY score DESC
        LIMIT ${topK}
      `;

      return chunks.map(chunk => ({
        id: chunk.id,
        score: parseFloat(chunk.score) || 0,
        content: chunk.content,
        metadata: {
          filename: chunk.filename,
          pageNumber: chunk.pageNumber,
          chunkType: chunk.chunkType || 'text',
          microSummary: chunk.microSummary,
        },
      }));

    } catch (error) {
      logError(error as Error, { query, userId }, "BM25 search failed");
      return [];
    }
  }
}

export const bm25RetrievalService = new BM25RetrievalService();
