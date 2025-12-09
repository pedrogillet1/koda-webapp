/**
 * Retrieval Merger Service - A+ Implementation
 * Merges vector and BM25 results using Reciprocal Rank Fusion (RRF)
 *
 * Features:
 * - Pure function, fully testable
 * - Configurable RRF constant (k)
 * - Detailed stats for observability
 */

import { Chunk } from "../types/rag.types";
import { BM25Result, MergedChunk, MergeOptions, VectorResult } from "../types/retrieval.types";

interface ScoreMapEntry {
  chunk: Partial<Chunk>;
  vectorRank?: number;
  bm25Rank?: number;
  content?: string;
}

class RetrievalMergerService {
  /**
   * Merge vector and BM25 results using Reciprocal Rank Fusion (RRF)
   */
  public merge(
    vectorResults: VectorResult[],
    bm25Results: BM25Result[],
    options: MergeOptions = {}
  ): MergedChunk[] {
    const { rrf_k = 60 } = options;
    const scoreMap = new Map<string, ScoreMapEntry>();

    // Process vector results
    vectorResults.forEach((result, rank) => {
      scoreMap.set(result.id, {
        chunk: {
          id: result.id,
          metadata: result.metadata,
          content: "",
        },
        vectorRank: rank + 1,
      });
    });

    // Process BM25 results
    bm25Results.forEach((result, rank) => {
      const existing = scoreMap.get(result.id);
      if (existing) {
        existing.bm25Rank = rank + 1;
        existing.content = result.content;
      } else {
        scoreMap.set(result.id, {
          chunk: {
            id: result.id,
            content: result.content,
            metadata: result.metadata,
          },
          bm25Rank: rank + 1,
          content: result.content,
        });
      }
    });

    // Calculate RRF scores and sort
    const merged = Array.from(scoreMap.values()).map(entry => {
      const vectorScore = entry.vectorRank ? 1 / (rrf_k + entry.vectorRank) : 0;
      const bm25Score = entry.bm25Rank ? 1 / (rrf_k + entry.bm25Rank) : 0;
      const hybridScore = vectorScore + bm25Score;

      return {
        id: entry.chunk.id || "",
        documentId: (entry.chunk.metadata as any)?.documentId || "",
        content: entry.content || entry.chunk.content || "",
        metadata: entry.chunk.metadata || {
          filename: "",
          chunkType: "text" as const,
        },
        vectorScore,
        bm25Score,
        hybridScore,
      } as MergedChunk;
    });

    return merged.sort((a, b) => b.hybridScore - a.hybridScore);
  }
}

export const retrievalMergerService = new RetrievalMergerService();
