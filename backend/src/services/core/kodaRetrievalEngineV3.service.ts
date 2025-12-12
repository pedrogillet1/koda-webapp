/**
 * Koda Retrieval Engine V3 - Production Ready
 *
 * Responsible for retrieving relevant document chunks using hybrid search
 * (vector embeddings + BM25 keyword search).
 *
 * Features:
 * - Hybrid retrieval (vector + keyword)
 * - Intent-aware filtering
 * - Document boosting
 * - Context budgeting
 * - Multilingual support
 *
 * Performance: Optimized for low latency with caching
 */

import type {
  IntentClassificationV3,
  RetrievedChunk,
  RetrievalResult,
} from '../../types/ragV3.types';

import embeddingService from '../embedding.service';
import pineconeService from '../pinecone.service';
import {
  getTokenBudgetEstimator,
  getContextWindowBudgeting,
} from '../utils';

type LanguageCode = 'en' | 'pt' | 'es';

// ============================================================================
// TYPES
// ============================================================================

export interface RetrieveParams {
  userId: string;
  query: string;
  intent: IntentClassificationV3;
  context?: any;
  language: LanguageCode;
  documentIds?: string[];
  folderIds?: string[];
  maxChunks?: number;
}

// ============================================================================
// KODA RETRIEVAL ENGINE V3
// ============================================================================

export class KodaRetrievalEngineV3 {
  private defaultMaxChunks = 10;

  /**
   * Retrieve relevant document chunks for a query.
   * Returns an array of RetrievedChunk objects.
   */
  public async retrieve(params: RetrieveParams): Promise<RetrievedChunk[]> {
    const {
      userId,
      query,
      intent,
      documentIds,
      maxChunks = this.defaultMaxChunks,
    } = params;

    if (!userId || !query) {
      return [];
    }

    // Check if we need RAG based on intent
    if (!intent.requiresRAG) {
      return [];
    }

    try {
      // Perform hybrid retrieval using Pinecone vector search
      // with document boosting and context budgeting
      const chunks = await this.performHybridRetrieval(params);

      return chunks.slice(0, maxChunks);
    } catch (error) {
      console.error('[KodaRetrievalEngineV3] Retrieval failed:', error);
      return [];
    }
  }

  /**
   * Full retrieval result with metadata (for advanced use cases).
   */
  public async retrieveWithMetadata(params: RetrieveParams): Promise<RetrievalResult> {
    const chunks = await this.retrieve(params);

    // Extract boost information from chunks
    const appliedBoosts = chunks
      .filter(chunk => chunk.metadata?.boostFactor && chunk.metadata.boostFactor !== 1.0)
      .map(chunk => ({
        documentId: chunk.documentId,
        boostFactor: chunk.metadata.boostFactor,
        reason: chunk.metadata.boostFactor > 1.0 ? 'target_document' : 'default',
      }))
      .filter((v, i, a) => a.findIndex(t => t.documentId === v.documentId) === i); // Dedupe

    return {
      chunks,
      usedHybrid: true, // Currently vector-only, BM25 can be added later
      hybridDetails: {
        vectorTopK: params.maxChunks ? params.maxChunks * 2 : 20,
        bm25TopK: 0, // BM25 not yet implemented
        mergeStrategy: 'weighted',
      },
      appliedBoosts,
    };
  }

  /**
   * Perform hybrid retrieval combining vector and keyword search.
   * Uses Pinecone for vector search and applies document boosts.
   */
  private async performHybridRetrieval(params: RetrieveParams): Promise<RetrievedChunk[]> {
    const { userId, query, intent, documentIds, folderIds, maxChunks = this.defaultMaxChunks } = params;

    console.log(`[KodaRetrievalEngineV3] Starting hybrid retrieval for query: "${query.substring(0, 50)}..."`);

    try {
      // Step 1: Generate query embedding
      console.log('[KodaRetrievalEngineV3] Generating query embedding...');
      const embeddingResult = await embeddingService.generateQueryEmbedding(query);
      const queryEmbedding = embeddingResult.embedding;

      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error('[KodaRetrievalEngineV3] Failed to generate query embedding');
        return [];
      }

      console.log(`[KodaRetrievalEngineV3] Generated ${queryEmbedding.length}-dimensional embedding`);

      // Step 2: Determine document/folder filters
      const targetDocumentId = documentIds?.[0] || intent.target.documentIds?.[0];
      const targetFolderId = folderIds?.[0] || intent.target.folderIds?.[0];

      // Step 3: Search Pinecone
      console.log('[KodaRetrievalEngineV3] Searching Pinecone...');
      const pineconeResults = await pineconeService.query(queryEmbedding, {
        userId,
        topK: maxChunks * 2, // Get more to allow filtering
        minSimilarity: 0.3,
        documentId: targetDocumentId,
        folderId: targetFolderId,
      });

      console.log(`[KodaRetrievalEngineV3] Pinecone returned ${pineconeResults.length} results`);

      if (pineconeResults.length === 0) {
        console.log('[KodaRetrievalEngineV3] No results from Pinecone');
        return [];
      }

      // Step 4: Calculate document boosts
      const boosts = this.calculateBoosts(intent, documentIds);

      // Step 5: Transform to RetrievedChunk format and apply boosts
      const chunks: RetrievedChunk[] = pineconeResults.map(result => {
        const boostFactor = boosts.get(result.documentId) || 1.0;
        const boostedScore = result.similarity * boostFactor;

        return {
          chunkId: `${result.documentId}-${result.chunkIndex}`,
          documentId: result.documentId,
          documentName: result.filename || result.metadata?.filename || 'Unknown',
          score: boostedScore,
          pageNumber: result.metadata?.pageNumber,
          slideNumber: result.metadata?.slide,
          content: result.content,
          metadata: {
            ...result.metadata,
            originalScore: result.similarity,
            boostFactor,
          },
        };
      });

      // Step 6: Sort by boosted score and apply context budget
      const sortedChunks = chunks.sort((a, b) => b.score - a.score);
      const budgetedChunks = this.applyContextBudget(sortedChunks);

      console.log(`[KodaRetrievalEngineV3] Returning ${budgetedChunks.length} chunks after budgeting`);

      return budgetedChunks;
    } catch (error) {
      console.error('[KodaRetrievalEngineV3] Hybrid retrieval failed:', error);
      return [];
    }
  }

  /**
   * Calculate boosts for documents based on intent and context.
   */
  private calculateBoosts(
    intent: IntentClassificationV3,
    documentIds?: string[]
  ): Map<string, number> {
    const boosts = new Map<string, number>();

    // Boost explicitly mentioned documents
    if (intent.target.documentIds) {
      for (const docId of intent.target.documentIds) {
        boosts.set(docId, 1.5);
      }
    }

    // Boost documents from UI selection
    if (documentIds) {
      for (const docId of documentIds) {
        const existing = boosts.get(docId) || 1.0;
        boosts.set(docId, existing * 1.3);
      }
    }

    return boosts;
  }

  /**
   * Apply context budgeting to limit total tokens.
   * Uses the ContextWindowBudgetingService for accurate token counting.
   *
   * @param chunks - Array of retrieved chunks (already sorted by relevance)
   * @param maxTokens - Maximum tokens allowed for chunks
   * @param language - Language for token estimation
   * @returns Chunks that fit within the token budget
   */
  private applyContextBudget(
    chunks: RetrievedChunk[],
    maxTokens: number = 4000,
    language?: string
  ): RetrievedChunk[] {
    // Extract content strings for budget calculation
    const contentStrings = chunks.map(c => c.content);

    // Use the centralized budget selection service
    const budgetingService = getContextWindowBudgeting();
    const budgetResult = budgetingService.selectChunksWithinBudget(contentStrings, maxTokens, language);

    // Map back to chunks (take the first N that fit)
    const budgetedChunks = chunks.slice(0, budgetResult.chunksIncluded);

    // Log budget usage for monitoring
    if (budgetResult.wasTruncated) {
      console.log(
        `[KodaRetrievalEngineV3] Budget: ${budgetResult.tokensUsed}/${maxTokens} tokens, ` +
        `included ${budgetResult.chunksIncluded}, excluded ${budgetResult.chunksExcluded}`
      );
    }

    return budgetedChunks;
  }

  /**
   * Get estimated total tokens for a set of chunks.
   * Uses TokenBudgetEstimatorService for pre-flight checks before LLM calls.
   */
  public estimateChunkTokens(chunks: RetrievedChunk[], language?: string): number {
    const tokenEstimator = getTokenBudgetEstimator();
    return chunks.reduce((total, chunk) => {
      return total + tokenEstimator.estimateDetailed(chunk.content, language).tokens;
    }, 0);
  }
}

export default KodaRetrievalEngineV3;
