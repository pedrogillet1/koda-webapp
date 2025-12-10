/**
 * Hybrid Retrieval Service - A+ Implementation
 * Coordinates vector and BM25 retrieval in parallel
 *
 * Features:
 * - Parallel execution of vector and BM25 search
 * - Delegates merging to RetrievalMergerService
 * - Error handling and fallbacks
 * - Performance tracking
 */

import { Chunk, RetrievalResult } from "../types/rag.types";
import { RetrievalOptions } from "../types/retrieval.types";
import { logger, logError } from "../utils/logger.service";
import { PerformanceTracker } from "../utils/performance-tracker.service";
import { bm25RetrievalService } from "./bm25-retrieval.service";
import { retrievalMergerService } from "./retrieval-merger.service";
import { vectorRetrievalService } from "./vector-retrieval.service";

class HybridRetrievalService {
  public async retrieve(
    query: string,
    embedding: number[],
    userId: string,
    options: RetrievalOptions
  ): Promise<RetrievalResult> {
    const tracker = new PerformanceTracker();
    tracker.start("hybrid-retrieval");

    const { topK, filter } = options;

    try {
      // Execute vector and BM25 searches in parallel
      tracker.start("parallel-search");
      const [vectorResults, bm25Results] = await Promise.all([
        vectorRetrievalService.search(embedding, { topK: topK * 2, filter }),
        bm25RetrievalService.search(query, userId, { topK: topK * 2 }),
      ]);
      tracker.end("parallel-search");

      logger.debug({
        vectorCount: vectorResults.length,
        bm25Count: bm25Results.length,
      }, "Parallel search completed");

      // Merge results
      tracker.start("merge");
      const mergedChunks = retrievalMergerService.merge(vectorResults, bm25Results);
      tracker.end("merge");

      const finalChunks = mergedChunks.slice(0, topK);

      tracker.end("hybrid-retrieval");
      const perfMetrics = tracker.getMetrics();

      return {
        chunks: finalChunks as Chunk[],
        stats: {
          vectorCount: vectorResults.length,
          bm25Count: bm25Results.length,
          mergedCount: finalChunks.length,
          executionTimeMs: perfMetrics.totalDurationMs,
        },
      };

    } catch (error) {
      logError(error as Error, { query, userId }, "Hybrid retrieval failed");
      return {
        chunks: [],
        stats: { vectorCount: 0, bm25Count: 0, mergedCount: 0, executionTimeMs: 0 },
      };
    }
  }
}

export const hybridRetrievalService = new HybridRetrievalService();
