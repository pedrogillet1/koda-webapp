/**
 * Hybrid Retrieval Service
 * Combines Vector + BM25 search with Reciprocal Rank Fusion (RRF)
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { bm25RetrievalService } from './bm25-retrieval.service';

// Pinecone client reference (will be initialized from rag.service)
let pineconeIndex: any = null;

export interface HybridRetrievalResult {
  matches: Array<{
    id: string;
    score: number;
    metadata: any;
    content?: string;
    source: 'vector' | 'bm25' | 'both';
    vectorScore?: number;
    bm25Score?: number;
  }>;
  stats: {
    vectorCount: number;
    bm25Count: number;
    mergedCount: number;
    executionTimeMs: number;
  };
}

export interface HybridRetrievalOptions {
  vectorWeight?: number;  // Weight for vector results (default 0.6)
  bm25Weight?: number;    // Weight for BM25 results (default 0.4)
  rrf_k?: number;         // RRF constant (default 60)
  skipBm25?: boolean;     // Skip BM25 search (default false)
}

/**
 * Initialize the Pinecone index reference
 */
export function initializePineconeIndex(index: any): void {
  pineconeIndex = index;
}

/**
 * Centralized hybrid retrieval function that combines Vector + BM25 search
 * Uses Reciprocal Rank Fusion (RRF) for result merging
 *
 * @param query - Search query
 * @param queryEmbedding - Pre-computed embedding vector
 * @param userId - User ID for filtering
 * @param topK - Number of results to return (default 20)
 * @param filter - Optional Pinecone filter
 * @param options - Additional options for tuning
 * @returns HybridRetrievalResult with merged matches and stats
 */
export async function performHybridRetrieval(
  query: string,
  queryEmbedding: number[],
  userId: string,
  topK: number = 20,
  filter?: any,
  options: HybridRetrievalOptions = {}
): Promise<HybridRetrievalResult> {
  const startTime = Date.now();
  const {
    vectorWeight = 0.6,
    bm25Weight = 0.4,
    rrf_k = 60,
    skipBm25 = false
  } = options;

  console.log(`\n🔀 [HYBRID RETRIEVAL] Starting hybrid search for: "${query.substring(0, 50)}..."`);
  console.log(`   Weights: vector=${vectorWeight}, bm25=${bm25Weight}, RRF k=${rrf_k}`);

  if (!pineconeIndex) {
    console.error('❌ [HYBRID] Pinecone index not initialized');
    return {
      matches: [],
      stats: { vectorCount: 0, bm25Count: 0, mergedCount: 0, executionTimeMs: Date.now() - startTime }
    };
  }

  try {
    // Build filter with userId
    const effectiveFilter = filter || { userId };
    if (!effectiveFilter.userId) {
      effectiveFilter.userId = userId;
    }

    // Execute Vector and BM25 searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      // Vector search via Pinecone
      pineconeIndex.query({
        vector: queryEmbedding,
        topK: topK * 2, // Fetch more to allow for effective merging
        includeMetadata: true,
        filter: effectiveFilter
      }),
      // BM25 search (skip if requested)
      skipBm25
        ? Promise.resolve([])
        : bm25RetrievalService.hybridSearch(query, [], userId, topK * 2)
    ]);

    const vectorMatches = vectorResults.matches || [];
    const bm25Matches = Array.isArray(bm25Results) ? bm25Results : [];

    console.log(`   📊 Vector results: ${vectorMatches.length}, BM25 results: ${bm25Matches.length}`);

    // If no BM25 results, return vector results directly
    if (bm25Matches.length === 0) {
      const executionTimeMs = Date.now() - startTime;
      console.log(`   ⚡ No BM25 results, returning ${vectorMatches.length} vector results (${executionTimeMs}ms)`);

      return {
        matches: vectorMatches.slice(0, topK).map((m: any) => ({
          id: m.id,
          score: m.score || 0,
          metadata: m.metadata,
          source: 'vector' as const,
          vectorScore: m.score
        })),
        stats: {
          vectorCount: vectorMatches.length,
          bm25Count: 0,
          mergedCount: Math.min(vectorMatches.length, topK),
          executionTimeMs
        }
      };
    }

    // Apply Reciprocal Rank Fusion (RRF) for merging
    const scoreMap = new Map<string, {
      id: string;
      vectorScore: number;
      bm25Score: number;
      vectorRank: number;
      bm25Rank: number;
      metadata: any;
      content?: string;
    }>();

    // Process vector results (assign ranks)
    vectorMatches.forEach((match: any, index: number) => {
      const docId = match.metadata?.documentId || match.id;
      scoreMap.set(docId, {
        id: match.id,
        vectorScore: match.score || 0,
        bm25Score: 0,
        vectorRank: index + 1,
        bm25Rank: Infinity,
        metadata: match.metadata,
        content: match.metadata?.content
      });
    });

    // Process BM25 results (merge with existing or add new)
    bm25Matches.forEach((result: any, index: number) => {
      const docId = result.metadata?.documentId || result.id;
      const existing = scoreMap.get(docId);

      if (existing) {
        // Document found in both - update BM25 info
        existing.bm25Score = result.bm25Score || result.hybridScore || 0;
        existing.bm25Rank = index + 1;
      } else {
        // New document from BM25 only
        scoreMap.set(docId, {
          id: result.id || docId,
          vectorScore: 0,
          bm25Score: result.bm25Score || result.hybridScore || 0,
          vectorRank: Infinity,
          bm25Rank: index + 1,
          metadata: result.metadata,
          content: result.content
        });
      }
    });

    // Calculate RRF scores and determine source
    const mergedResults = Array.from(scoreMap.values()).map(item => {
      // RRF formula: 1 / (k + rank) for each ranker, then weighted sum
      const vectorRRF = item.vectorRank === Infinity ? 0 : 1 / (rrf_k + item.vectorRank);
      const bm25RRF = item.bm25Rank === Infinity ? 0 : 1 / (rrf_k + item.bm25Rank);
      const hybridScore = (vectorRRF * vectorWeight) + (bm25RRF * bm25Weight);

      // Determine source
      let source: 'vector' | 'bm25' | 'both';
      if (item.vectorRank !== Infinity && item.bm25Rank !== Infinity) {
        source = 'both';
      } else if (item.vectorRank !== Infinity) {
        source = 'vector';
      } else {
        source = 'bm25';
      }

      return {
        id: item.id,
        score: hybridScore,
        metadata: item.metadata,
        content: item.content,
        source,
        vectorScore: item.vectorScore,
        bm25Score: item.bm25Score
      };
    });

    // Sort by hybrid score (descending) and take topK
    mergedResults.sort((a, b) => b.score - a.score);
    const finalResults = mergedResults.slice(0, topK);

    const executionTimeMs = Date.now() - startTime;
    const bothCount = finalResults.filter(r => r.source === 'both').length;
    const vectorOnlyCount = finalResults.filter(r => r.source === 'vector').length;
    const bm25OnlyCount = finalResults.filter(r => r.source === 'bm25').length;

    console.log(`   ✅ [HYBRID] Merged to ${finalResults.length} results in ${executionTimeMs}ms`);
    console.log(`      Sources: ${bothCount} both, ${vectorOnlyCount} vector-only, ${bm25OnlyCount} bm25-only`);

    return {
      matches: finalResults,
      stats: {
        vectorCount: vectorMatches.length,
        bm25Count: bm25Matches.length,
        mergedCount: finalResults.length,
        executionTimeMs
      }
    };

  } catch (error) {
    console.error('❌ [HYBRID RETRIEVAL] Error:', error);
    const executionTimeMs = Date.now() - startTime;

    // Fallback to vector-only if hybrid fails
    try {
      console.log('   ⚠️ [HYBRID] Attempting vector-only fallback...');
      const fallbackResults = await pineconeIndex.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: filter || { userId }
      });

      const matches = fallbackResults.matches || [];
      console.log(`   ⚠️ [HYBRID] Fallback returned ${matches.length} vector results`);

      return {
        matches: matches.map((m: any) => ({
          id: m.id,
          score: m.score || 0,
          metadata: m.metadata,
          source: 'vector' as const,
          vectorScore: m.score
        })),
        stats: {
          vectorCount: matches.length,
          bm25Count: 0,
          mergedCount: matches.length,
          executionTimeMs
        }
      };
    } catch (fallbackError) {
      console.error('❌ [HYBRID] Fallback also failed:', fallbackError);
      return {
        matches: [],
        stats: { vectorCount: 0, bm25Count: 0, mergedCount: 0, executionTimeMs }
      };
    }
  }
}

export default {
  initializePineconeIndex,
  performHybridRetrieval
};
