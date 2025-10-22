/**
 * Enhanced Retrieval Service
 * Orchestrates the complete Phase 1 retrieval pipeline:
 * Multi-Strategy → RRF Fusion → Re-Ranking → MMR Diversity
 */

import multiStrategyRetrievalService from './multiStrategyRetrieval.service';
import rrfFusionService from './rrfFusion.service';
import rerankerService from './reranker.service';
import mmrService from './mmr.service';
import { RerankResult } from './reranker.service';

interface EnhancedRetrievalOptions {
  topK?: number;
  enableReranking?: boolean;
  enableMMR?: boolean;
  mmrLambda?: number;
  queryType?: string;
}

class EnhancedRetrievalService {
  /**
   * Complete retrieval pipeline
   * Returns the best, most diverse documents for the query
   */
  async retrieve(
    query: string,
    userId: string,
    options: EnhancedRetrievalOptions = {}
  ): Promise<RerankResult[]> {
    const {
      topK = 5,
      enableReranking = true,
      enableMMR = true,
      mmrLambda,
      queryType = 'general'
    } = options;

    const startTime = Date.now();

    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║ ENHANCED RETRIEVAL PIPELINE                                ║`);
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    console.log(`║ User: ${userId.substring(0, 20)}`);
    console.log(`║ Options: topK=${topK}, rerank=${enableReranking}, mmr=${enableMMR}`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);

    try {
      // ═══════════════════════════════════════════════════════════════
      // STAGE 1: Multi-Strategy Retrieval
      // BM25F + Vector + Title in parallel
      // ═══════════════════════════════════════════════════════════════

      console.log(`┌─ STAGE 1: Multi-Strategy Retrieval`);
      const stage1Start = Date.now();

      const rawResults = await multiStrategyRetrievalService.retrieve(
        query,
        userId,
        20 // Get more candidates for fusion
      );

      const stage1Time = Date.now() - stage1Start;
      console.log(`└─ ✅ Stage 1 complete (${stage1Time}ms)\n`);

      // ═══════════════════════════════════════════════════════════════
      // STAGE 2: Reciprocal Rank Fusion (RRF)
      // Intelligently merge results from all strategies
      // ═══════════════════════════════════════════════════════════════

      console.log(`┌─ STAGE 2: Reciprocal Rank Fusion`);
      const stage2Start = Date.now();

      const fused = rrfFusionService.fuseResults(
        rawResults,
        {
          bm25: 1.0,    // Standard weight
          vector: 1.0,   // Standard weight
          title: 1.5     // Higher weight for title matches
        },
        Math.min(topK * 3, 15) // Get 3x candidates for re-ranking
      );

      const stage2Time = Date.now() - stage2Start;
      console.log(`└─ ✅ Stage 2 complete (${stage2Time}ms)\n`);

      // ═══════════════════════════════════════════════════════════════
      // STAGE 3: Re-Ranking (Optional)
      // Use learned cross-encoder to reorder by relevance
      // ═══════════════════════════════════════════════════════════════

      let reranked: RerankResult[];

      if (enableReranking && fused.length > 0) {
        console.log(`┌─ STAGE 3: Re-Ranking (Cohere ReRank)`);
        const stage3Start = Date.now();

        reranked = await rerankerService.rerank(
          query,
          fused,
          Math.min(topK * 2, 10) // Get 2x candidates for MMR
        );

        const stage3Time = Date.now() - stage3Start;
        console.log(`└─ ✅ Stage 3 complete (${stage3Time}ms)\n`);
      } else {
        console.log(`┌─ STAGE 3: Re-Ranking (SKIPPED)`);
        reranked = fused.map((doc, index) => ({
          ...doc,
          rerankScore: doc.fusedScore,
          originalRank: index
        }));
        console.log(`└─ Using fusion scores\n`);
      }

      // ═══════════════════════════════════════════════════════════════
      // STAGE 4: MMR Diversity Filtering (Optional)
      // Remove redundant results, maximize diversity
      // ═══════════════════════════════════════════════════════════════

      let final: RerankResult[];

      if (enableMMR && reranked.length > topK) {
        console.log(`┌─ STAGE 4: MMR Diversity Filtering`);
        const stage4Start = Date.now();

        // Use adaptive lambda based on query type
        const lambda = mmrLambda ?? mmrService.getAdaptiveLambda(queryType);

        final = await mmrService.applyMMR(
          query,
          reranked,
          topK,
          lambda
        );

        const stage4Time = Date.now() - stage4Start;
        console.log(`└─ ✅ Stage 4 complete (${stage4Time}ms)\n`);
      } else {
        console.log(`┌─ STAGE 4: MMR Diversity Filtering (SKIPPED)`);
        final = reranked.slice(0, topK);
        console.log(`└─ Using top ${topK} reranked results\n`);
      }

      // ═══════════════════════════════════════════════════════════════
      // SUMMARY
      // ═══════════════════════════════════════════════════════════════

      const totalTime = Date.now() - startTime;

      console.log(`╔════════════════════════════════════════════════════════════╗`);
      console.log(`║ RETRIEVAL COMPLETE                                         ║`);
      console.log(`╠════════════════════════════════════════════════════════════╣`);
      console.log(`║ Total documents: ${final.length.toString().padEnd(44)}║`);
      console.log(`║ Total time: ${totalTime}ms${' '.repeat(49 - totalTime.toString().length)}║`);
      console.log(`║                                                            ║`);
      console.log(`║ Top Results:                                               ║`);

      final.forEach((doc, idx) => {
        const displayName = doc.filename.length > 35
          ? doc.filename.substring(0, 32) + '...'
          : doc.filename;

        const scoreDisplay = `${doc.rerankScore.toFixed(3)}`;
        const line = `║   ${(idx + 1).toString().padStart(2)}. ${displayName.padEnd(35)} ${scoreDisplay.padStart(5)} ║`;
        console.log(line);
      });

      console.log(`╚════════════════════════════════════════════════════════════╝\n`);

      return final;

    } catch (error) {
      console.error(`\n❌ Enhanced retrieval pipeline failed:`, error);
      throw error;
    }
  }

  /**
   * Retrieves documents using only BM25 + Vector (simpler, faster)
   * Useful for real-time queries where latency is critical
   */
  async retrieveFast(
    query: string,
    userId: string,
    topK: number = 5
  ): Promise<RerankResult[]> {
    console.log(`⚡ Fast retrieval (BM25 + Vector only)`);

    const rawResults = await multiStrategyRetrievalService.retrieve(
      query,
      userId,
      topK * 2
    );

    // Simple fusion without re-ranking or MMR
    const fused = rrfFusionService.fuseResults(
      rawResults,
      { bm25: 1.0, vector: 1.0, title: 1.5 },
      topK
    );

    return fused.map((doc, index) => ({
      ...doc,
      rerankScore: doc.fusedScore,
      originalRank: index
    }));
  }

  /**
   * Test the complete pipeline
   */
  async test(): Promise<void> {
    console.log(`🧪 Testing Enhanced Retrieval Pipeline\n`);

    // Test Cohere connection
    const cohereWorks = await rerankerService.testCohereConnection();

    if (cohereWorks) {
      console.log(`✅ All systems operational\n`);
    } else {
      console.log(`⚠️ Cohere ReRank not configured - will use fallback scoring\n`);
    }
  }
}

export default new EnhancedRetrievalService();
export { EnhancedRetrievalService, EnhancedRetrievalOptions };
