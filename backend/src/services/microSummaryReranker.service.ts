/**
 * Micro-Summary Reranker Service
 * 
 * Reranks chunks using micro-summary relevance after RRF merge.
 * Computes similarity between query and chunk.microSummary to boost
 * chunks that match the query PURPOSE, not just keywords.
 * 
 * Integration points:
 * - Called in hybridSearch.service.ts AFTER RRF merge
 * - BEFORE chunk-type reranking
 * - Combines RRF score with micro-summary similarity score
 * 
 * Expected impact: +10-20% retrieval accuracy for explanation queries
 */

import embeddingService from './embedding.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkText: string;
  microSummary?: string;
  chunkType?: string;
  sectionName?: string;
  pageNumber?: number;
  
  // Scores
  bm25Score?: number;
  vectorScore?: number;
  combinedScore: number;  // From RRF
  microScore?: number;    // From micro-summary reranking
  finalScore?: number;    // Combined final score
  
  metadata?: Record<string, unknown>;
}

export interface RerankOptions {
  query: string;
  queryIntent?: string;
  microWeight?: number;   // Weight for micro-summary score
  rrfWeight?: number;     // Weight for RRF score
  minMicroScore?: number; // Minimum micro-summary score to apply boost
}

// ═══════════════════════════════════════════════════════════════════════════
// Intent-Based Weight Tuning
// ═══════════════════════════════════════════════════════════════════════════

const INTENT_WEIGHTS: Record<string, { microWeight: number; rrfWeight: number }> = {
  // High micro-weight for explanation/summary queries
  'explanation': { microWeight: 0.4, rrfWeight: 0.6 },
  'summary': { microWeight: 0.4, rrfWeight: 0.6 },
  'overview': { microWeight: 0.4, rrfWeight: 0.6 },
  'what_is': { microWeight: 0.4, rrfWeight: 0.6 },
  
  // Medium micro-weight for information retrieval
  'information_retrieval': { microWeight: 0.3, rrfWeight: 0.7 },
  'comparison': { microWeight: 0.3, rrfWeight: 0.7 },
  'analysis': { microWeight: 0.3, rrfWeight: 0.7 },
  
  // Low micro-weight for exact ID/keyword queries
  'exact_match': { microWeight: 0.1, rrfWeight: 0.9 },
  'id_lookup': { microWeight: 0.1, rrfWeight: 0.9 },
  'keyword_search': { microWeight: 0.2, rrfWeight: 0.8 },
  
  // Default
  'default': { microWeight: 0.3, rrfWeight: 0.7 }
};

// ═══════════════════════════════════════════════════════════════════════════
// Micro-Summary Reranker Service
// ═══════════════════════════════════════════════════════════════════════════

class MicroSummaryRerankerService {
  /**
   * Rerank chunks using micro-summary relevance
   */
  async rerankWithMicroSummaries(
    candidates: SearchResult[],
    options: RerankOptions
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const { query, queryIntent, minMicroScore = 0.3 } = options;

    console.log(`🔄 [MICRO-RERANK] Reranking ${candidates.length} chunks with micro-summaries...`);

    // Get intent-based weights
    const weights = this.getWeights(queryIntent, options);
    const { microWeight, rrfWeight } = weights;

    console.log(`[MICRO-RERANK] Using weights: micro=${microWeight}, rrf=${rrfWeight}`);

    // Generate query embedding once
    const queryEmbeddingResult = await embeddingService.generateEmbedding(query);
    const queryEmbedding = queryEmbeddingResult.embedding;

    // Rerank each candidate
    const reranked = await Promise.all(
      candidates.map(async (chunk) => {
        // Skip if no micro-summary
        if (!chunk.microSummary) {
          return {
            ...chunk,
            microScore: 0,
            finalScore: chunk.combinedScore
          };
        }

        try {
          // Compute micro-summary similarity
          const summaryResult = await embeddingService.generateEmbedding(chunk.microSummary);
          const summaryEmbedding = summaryResult.embedding;
          const microScore = this.cosineSimilarity(queryEmbedding, summaryEmbedding);

          // Only apply boost if micro-score is above threshold
          const effectiveMicroScore = microScore >= minMicroScore ? microScore : 0;

          // Combine scores
          const finalScore = rrfWeight * chunk.combinedScore + microWeight * effectiveMicroScore;

          return {
            ...chunk,
            microScore,
            finalScore
          };

        } catch (error: any) {
          console.error(`❌ [MICRO-RERANK] Failed to compute micro-score for chunk ${chunk.chunkId}:`, error.message);
          
          // Fallback: use RRF score only
          return {
            ...chunk,
            microScore: 0,
            finalScore: chunk.combinedScore
          };
        }
      })
    );

    // Sort by finalScore (descending)
    const sorted = reranked.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    const latency = Date.now() - startTime;
    console.log(`✅ [MICRO-RERANK] Reranking complete in ${latency}ms`);

    // Log top 3 for debugging
    console.log('[MICRO-RERANK] Top 3 chunks:');
    sorted.slice(0, 3).forEach((chunk, i) => {
      console.log(`  ${i + 1}. Score: ${chunk.finalScore?.toFixed(3)} (RRF: ${chunk.combinedScore.toFixed(3)}, Micro: ${chunk.microScore?.toFixed(3)})`);
      console.log(`     Summary: "${chunk.microSummary?.slice(0, 60)}..."`);
    });

    return sorted;
  }

  /**
   * Get weights based on query intent
   */
  private getWeights(
    queryIntent: string | undefined,
    options: RerankOptions
  ): { microWeight: number; rrfWeight: number } {
    // Use explicit weights if provided
    if (options.microWeight !== undefined && options.rrfWeight !== undefined) {
      return {
        microWeight: options.microWeight,
        rrfWeight: options.rrfWeight
      };
    }

    // Use intent-based weights
    const intentKey = queryIntent?.toLowerCase() || 'default';
    return INTENT_WEIGHTS[intentKey] || INTENT_WEIGHTS.default;
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Analyze reranking impact (for debugging/monitoring)
   */
  analyzeRerankingImpact(
    before: SearchResult[],
    after: SearchResult[]
  ): {
    topKChanged: number;
    avgScoreChange: number;
    maxScoreChange: number;
    reorderedChunks: number;
  } {
    const topK = Math.min(10, before.length);
    const beforeTop = before.slice(0, topK).map(c => c.chunkId);
    const afterTop = after.slice(0, topK).map(c => c.chunkId);

    // Count how many chunks in top-K changed
    const topKChanged = beforeTop.filter(id => !afterTop.includes(id)).length;

    // Count total reordered chunks
    const reorderedChunks = before.filter((chunk, i) => 
      after[i]?.chunkId !== chunk.chunkId
    ).length;

    // Calculate score changes
    const scoreChanges = before.map((chunk, i) => {
      const afterChunk = after.find(c => c.chunkId === chunk.chunkId);
      if (!afterChunk) return 0;
      return (afterChunk.finalScore || afterChunk.combinedScore) - chunk.combinedScore;
    });

    const avgScoreChange = scoreChanges.reduce((sum, val) => sum + val, 0) / scoreChanges.length;
    const maxScoreChange = Math.max(...scoreChanges.map(Math.abs));

    return {
      topKChanged,
      avgScoreChange,
      maxScoreChange,
      reorderedChunks
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export singleton instance
// ═══════════════════════════════════════════════════════════════════════════

export const microSummaryRerankerService = new MicroSummaryRerankerService();
export default microSummaryRerankerService;

// ═══════════════════════════════════════════════════════════════════════════
// Usage Examples
// ═══════════════════════════════════════════════════════════════════════════

/*
// Example 1: Rerank with default weights
const reranked = await microSummaryRerankerService.rerankWithMicroSummaries(
  rrfResults,
  {
    query: "What is my salary?",
    queryIntent: "information_retrieval"
  }
);

// Example 2: Rerank with custom weights (explanation query)
const reranked = await microSummaryRerankerService.rerankWithMicroSummaries(
  rrfResults,
  {
    query: "Explain the termination clause",
    queryIntent: "explanation",
    microWeight: 0.5,  // High weight for explanation queries
    rrfWeight: 0.5
  }
);

// Example 3: Rerank with minimum score threshold
const reranked = await microSummaryRerankerService.rerankWithMicroSummaries(
  rrfResults,
  {
    query: "Show me invoice totals",
    queryIntent: "exact_match",
    microWeight: 0.1,  // Low weight for exact match
    rrfWeight: 0.9,
    minMicroScore: 0.5  // Only boost if micro-score > 0.5
  }
);

// Example 4: Analyze reranking impact
const impact = microSummaryRerankerService.analyzeRerankingImpact(
  rrfResults,
  reranked
);
console.log(`Reranking changed ${impact.topKChanged} chunks in top-10`);
console.log(`Avg score change: ${impact.avgScoreChange.toFixed(3)}`);
*/
