/**
 * Enhanced Retrieval Service
 * Orchestrates the complete Phase 1 retrieval pipeline:
 * Multi-Strategy → RRF Fusion → Re-Ranking → MMR Diversity
 */

import vectorEmbeddingService from './vectorEmbedding.service';
import pineconeService from './pinecone.service';
import rrfFusionService from './rrfFusion.service';
import rerankerService from './reranker.service';
import selectiveRerankerService from './selectiveReranker.service';
import dynamicRRFWeightsService from './dynamicRRFWeights.service';
import mmrService from './mmr.service';
import { RerankResult } from './reranker.service';

interface EnhancedRetrievalOptions {
  topK?: number;
  enableReranking?: boolean;
  enableMMR?: boolean;
  mmrLambda?: number;
  queryType?: string;
  documentId?: string; // Optional document filter for document-scoped queries
  documentIds?: string[]; // Optional multiple document filter for conversation context
  folderId?: string; // Optional folder filter for folder-scoped queries
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
      queryType = 'general',
      documentId,
      documentIds,
      folderId
    } = options;

    // FIX: Handle both documentId (singular) and documentIds (array)
    // When a single document is attached, rag.service sets documentIds=[id]
    // We need to extract that and pass it as attachedDocumentId to Pinecone
    const attachedDocumentId = documentId || (documentIds && documentIds.length === 1 ? documentIds[0] : undefined);
    const isMultiDocContext = documentIds && documentIds.length > 1;

    const startTime = Date.now();

    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║ ENHANCED RETRIEVAL PIPELINE                                ║`);
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    console.log(`║ User: ${userId.substring(0, 20)}`);
    console.log(`║ Options: topK=${topK}, rerank=${enableReranking}, mmr=${enableMMR}`);
    if (attachedDocumentId) {
      console.log(`║ 🎯 ATTACHED DOCUMENT FILTER: ${attachedDocumentId.substring(0, 30)}...`);
    }
    if (isMultiDocContext) {
      console.log(`║ 🎯 Context Documents: ${documentIds!.length} documents`);
    }
    if (folderId) {
      console.log(`║ 📁 Folder-Scoped: ${folderId.substring(0, 20)}...`);
    }
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);

    try {
      // ═══════════════════════════════════════════════════════════════
      // STAGE 1: SIMPLE Hybrid Retrieval (What Actually Worked)
      // Just vector search - simple and effective
      // ═══════════════════════════════════════════════════════════════

      console.log(`┌─ STAGE 1: Vector Search${attachedDocumentId ? ' (ATTACHED DOCUMENT FILTER)' : folderId ? ' (Folder-Scoped)' : isMultiDocContext ? ' (Multi-Doc Context)' : ''}`);
      const stage1Start = Date.now();

      // Generate query embedding
      const queryEmbedding = await vectorEmbeddingService.generateEmbedding(query);

      // Search Pinecone for chunks - this is what worked before
      const vectorResults = await pineconeService.searchSimilarChunks(
        queryEmbedding,
        userId,
        Math.min(topK * 3, 100), // Get more candidates for reranking
        0.3, // Lowered threshold from 0.5 to get more results
        attachedDocumentId, // Pass document filter (FIX: now using the correct variable)
        folderId // Pass folder filter
      );

      console.log(`   🔍 Found ${vectorResults.length} chunks`);

      // FIX: For multi-document context, post-filter to only include chunks from context documents
      let filteredResults = vectorResults;
      if (isMultiDocContext && documentIds) {
        const beforeCount = vectorResults.length;
        filteredResults = vectorResults.filter((r: any) =>
          documentIds.includes(r.metadata?.documentId)
        );
        console.log(`   🎯 Multi-doc context filter: ${beforeCount} → ${filteredResults.length} chunks (from ${documentIds.length} docs)`);
      }

      // Just use vector results directly - no complex fusion
      const results = filteredResults.map((r: any) => ({
        documentId: r.metadata?.documentId || '',
        filename: r.metadata?.filename || 'Unknown',
        content: r.metadata?.content || r.content || '',
        score: r.score || 0,
        fusedScore: r.score || 0, // Use vector score as fused score
        rankSources: ['vector'], // Required by FusedResult type
        source: 'vector' as const,
        metadata: r.metadata,
        pageNumber: r.metadata?.pageNumber || 1,
        chunkIndex: r.metadata?.chunkIndex || 0
      }));

      const stage1Time = Date.now() - stage1Start;
      console.log(`└─ ✅ Stage 1 complete (${stage1Time}ms)\n`);

      // ═══════════════════════════════════════════════════════════════
      // STAGE 2: SKIP RRF (Not Needed With Single Strategy)
      // Going straight to reranking with vector results
      // ═══════════════════════════════════════════════════════════════

      console.log(`┌─ STAGE 2: Skip Fusion (single strategy)`);

      // ═══════════════════════════════════════════════════════════════
      // STAGE 3: Re-Ranking (Optional)
      // Use learned cross-encoder to reorder by relevance
      // ═══════════════════════════════════════════════════════════════

      let reranked: RerankResult[];

      if (enableReranking && results.length > 0) {
        console.log(`┌─ STAGE 3: Re-Ranking (Cohere)`);
        const stage3Start = Date.now();

        // Rerank the vector results
        reranked = await selectiveRerankerService.rerank(
          query,
          results,
          queryType as any,
          {
            maxCandidates: Math.min(results.length, 10),
            minCandidates: 3,
            costThreshold: 0.01,
          }
        );

        const stage3Time = Date.now() - stage3Start;
        console.log(`└─ ✅ Stage 3 complete (${stage3Time}ms)\n`);
      } else {
        console.log(`┌─ STAGE 3: Re-Ranking (SKIPPED)`);
        reranked = results.map((doc, index) => ({
          ...doc,
          rerankScore: doc.fusedScore,
          originalRank: index,
          rankSources: doc.rankSources // Preserve rankSources
        }));
        console.log(`└─ Using vector scores\n`);
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
   * Fast retrieval - just calls the main retrieve method with MMR/reranking disabled
   * Kept for backwards compatibility
   */
  async retrieveFast(
    query: string,
    userId: string,
    topK: number = 5
  ): Promise<RerankResult[]> {
    console.log(`⚡ Fast retrieval (vector only, no reranking/MMR)`);

    return this.retrieve(query, userId, {
      topK,
      enableReranking: false,
      enableMMR: false
    });
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
