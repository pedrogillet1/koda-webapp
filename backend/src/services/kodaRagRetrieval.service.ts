/**
 * =============================================================================
 * KODA RAG RETRIEVAL SERVICE - Unified Document Retrieval
 * =============================================================================
 *
 * Centralizes all document retrieval logic:
 * - Vector search (Pinecone)
 * - BM25 keyword search
 * - Hybrid retrieval
 * - Result ranking and fusion
 * - Context building
 *
 * LAYER ARCHITECTURE:
 * 1. EmbeddingService - Generates embeddings (OpenAI)
 * 2. PineconeService - Vector storage and search
 * 3. BM25Service - Keyword-based search
 * 4. KodaRagRetrieval (this) - Combines and orchestrates retrieval
 *
 * =============================================================================
 */

import { classifyQuestion, type QuestionType, type RagMode, type ClassifiedQuestion } from './simpleIntentDetection.service';
import embeddingService from './embedding.service';

// =============================================================================
// TYPES
// =============================================================================

export interface RetrievalRequest {
  query: string;
  userId: string;
  documentIds?: string[];
  topK?: number;
  ragMode?: RagMode;
  questionType?: QuestionType;
  filters?: {
    minScore?: number;
    documentType?: string;
    dateRange?: { start: Date; end: Date };
  };
}

export interface RetrievedChunk {
  id: string;
  text: string;
  documentId: string;
  documentName: string;
  score: number;
  source: 'vector' | 'bm25' | 'hybrid';
  metadata?: {
    chunkIndex?: number;
    pageNumber?: number;
    section?: string;
    documentType?: string;
  };
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  context: string;
  totalRetrieved: number;
  questionType: QuestionType;
  ragMode: RagMode;
  retrievalTimeMs: number;
  sources: string[];
}

export interface RetrievalStats {
  totalQueries: number;
  avgChunksReturned: number;
  avgRetrievalTimeMs: number;
  vectorQueries: number;
  bm25Queries: number;
  hybridQueries: number;
}

// =============================================================================
// RAG MODE CONFIGURATIONS
// =============================================================================

const RAG_MODE_CONFIGS: Record<RagMode, {
  topK: number;
  minScore: number;
  useVector: boolean;
  useBM25: boolean;
  fusionWeight: number; // Weight for vector vs BM25 (0-1, higher = more vector)
}> = {
  no_rag: {
    topK: 0,
    minScore: 0,
    useVector: false,
    useBM25: false,
    fusionWeight: 0.5,
  },
  light_rag: {
    topK: 3,
    minScore: 0.7,
    useVector: true,
    useBM25: false,
    fusionWeight: 0.8,
  },
  full_rag: {
    topK: 15,
    minScore: 0.5,
    useVector: true,
    useBM25: true,
    fusionWeight: 0.6,
  },
};

// =============================================================================
// KODA RAG RETRIEVAL SERVICE CLASS
// =============================================================================

class KodaRagRetrievalService {
  private static instance: KodaRagRetrievalService;
  private stats: RetrievalStats = {
    totalQueries: 0,
    avgChunksReturned: 0,
    avgRetrievalTimeMs: 0,
    vectorQueries: 0,
    bm25Queries: 0,
    hybridQueries: 0,
  };
  private totalChunksReturned = 0;
  private totalRetrievalTime = 0;

  private constructor() {
    console.log('✅ [KODA-RAG-RETRIEVAL] Service initialized');
  }

  public static getInstance(): KodaRagRetrievalService {
    if (!KodaRagRetrievalService.instance) {
      KodaRagRetrievalService.instance = new KodaRagRetrievalService();
    }
    return KodaRagRetrievalService.instance;
  }

  /**
   * =============================================================================
   * MAIN API: Retrieve Documents
   * =============================================================================
   */
  public async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const startTime = Date.now();

    // Classify question if not provided
    const classification = request.questionType
      ? { type: request.questionType, ragMode: request.ragMode || 'full_rag' as RagMode }
      : classifyQuestion(request.query);

    const questionType = classification.type;
    const ragMode = request.ragMode || classification.ragMode;

    console.log(`🔍 [KODA-RAG-RETRIEVAL] Query: "${request.query.slice(0, 50)}..."`);
    console.log(`📊 [KODA-RAG-RETRIEVAL] Type: ${questionType}, RAG Mode: ${ragMode}`);

    // Check if RAG should be skipped
    if (ragMode === 'no_rag') {
      console.log(`⏭️ [KODA-RAG-RETRIEVAL] Skipping RAG (mode: ${ragMode})`);
      return this.buildEmptyResult(questionType, ragMode, Date.now() - startTime);
    }

    const config = RAG_MODE_CONFIGS[ragMode];
    const topK = request.topK || config.topK;

    let chunks: RetrievedChunk[] = [];
    const sources: string[] = [];

    try {
      // Vector search (Pinecone)
      if (config.useVector) {
        const vectorChunks = await this.vectorSearch(
          request.query,
          request.userId,
          topK,
          request.documentIds,
          config.minScore
        );
        chunks = [...chunks, ...vectorChunks];
        sources.push('vector');
        this.stats.vectorQueries++;
        console.log(`📊 [KODA-RAG-RETRIEVAL] Vector search: ${vectorChunks.length} chunks`);
      }

      // BM25 search
      if (config.useBM25) {
        const bm25Chunks = await this.bm25Search(
          request.query,
          request.userId,
          topK,
          request.documentIds
        );
        chunks = this.fuseResults(chunks, bm25Chunks, config.fusionWeight);
        sources.push('bm25');
        this.stats.bm25Queries++;
        console.log(`📊 [KODA-RAG-RETRIEVAL] BM25 search: ${bm25Chunks.length} chunks`);
      }

      if (config.useVector && config.useBM25) {
        this.stats.hybridQueries++;
      }

      // Apply filters
      if (request.filters?.minScore) {
        chunks = chunks.filter(c => c.score >= request.filters!.minScore!);
      }

      // Deduplicate and limit
      chunks = this.deduplicateChunks(chunks);
      chunks = chunks.slice(0, topK);

      // Build context
      const context = this.buildContext(chunks, questionType);

      // Update stats
      const retrievalTimeMs = Date.now() - startTime;
      this.updateStats(chunks.length, retrievalTimeMs);

      console.log(`✅ [KODA-RAG-RETRIEVAL] Retrieved ${chunks.length} chunks in ${retrievalTimeMs}ms`);

      return {
        chunks,
        context,
        totalRetrieved: chunks.length,
        questionType,
        ragMode,
        retrievalTimeMs,
        sources,
      };
    } catch (error: any) {
      console.error(`❌ [KODA-RAG-RETRIEVAL] Error:`, error.message);
      return this.buildEmptyResult(questionType, ragMode, Date.now() - startTime);
    }
  }

  /**
   * =============================================================================
   * VECTOR SEARCH (Pinecone)
   * =============================================================================
   */
  private async vectorSearch(
    query: string,
    userId: string,
    topK: number,
    documentIds?: string[],
    minScore: number = 0.5
  ): Promise<RetrievedChunk[]> {
    try {
      // Generate query embedding
      const embedding = await embeddingService.generateQueryEmbedding(query);

      // Import Pinecone service dynamically to avoid circular deps
      const { default: pineconeService } = await import('./pinecone.service');

      // Build filter
      const filter: Record<string, any> = { userId };
      if (documentIds && documentIds.length > 0) {
        filter.documentId = { $in: documentIds };
      }

      // Query Pinecone using the query method
      const results = await pineconeService.query(
        embedding.embedding,
        {
          userId,
          topK: topK * 2, // Get more for filtering
          documentIds: documentIds && documentIds.length > 0 ? documentIds : undefined
        }
      );

      // Transform to RetrievedChunk format
      return results
        .filter((r: any) => r.score >= minScore)
        .map((r: any) => ({
          id: r.id,
          text: r.metadata?.text || '',
          documentId: r.metadata?.documentId || '',
          documentName: r.metadata?.documentName || 'Unknown',
          score: r.score,
          source: 'vector' as const,
          metadata: {
            chunkIndex: r.metadata?.chunkIndex,
            pageNumber: r.metadata?.pageNumber,
            section: r.metadata?.section,
            documentType: r.metadata?.documentType,
          },
        }));
    } catch (error: any) {
      console.error(`❌ [KODA-RAG-RETRIEVAL] Vector search error:`, error.message);
      return [];
    }
  }

  /**
   * =============================================================================
   * BM25 SEARCH (PostgreSQL Full-Text)
   * =============================================================================
   */
  private async bm25Search(
    query: string,
    userId: string,
    topK: number,
    documentIds?: string[]
  ): Promise<RetrievedChunk[]> {
    try {
      // Import BM25 service dynamically (correct path)
      const { bm25RetrievalService } = await import('./rag/retrieval/bm25-retrieval.service');

      const results = await bm25RetrievalService.search(
        query,
        userId,
        { topK: topK * 2, documentIds }
      );

      return results.map((r: any) => ({
        id: r.id,
        text: r.text,
        documentId: r.documentId,
        documentName: r.documentName,
        score: r.score,
        source: 'bm25' as const,
        metadata: r.metadata,
      }));
    } catch (error: any) {
      console.error(`❌ [KODA-RAG-RETRIEVAL] BM25 search error:`, error.message);
      return [];
    }
  }

  /**
   * =============================================================================
   * RESULT FUSION (Reciprocal Rank Fusion)
   * =============================================================================
   */
  private fuseResults(
    vectorChunks: RetrievedChunk[],
    bm25Chunks: RetrievedChunk[],
    vectorWeight: number
  ): RetrievedChunk[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { chunk: RetrievedChunk; score: number }>();

    // Add vector results with weighted RRF score
    vectorChunks.forEach((chunk, rank) => {
      const rrfScore = vectorWeight * (1 / (k + rank + 1));
      const existing = scoreMap.get(chunk.id);
      if (existing) {
        existing.score += rrfScore;
        existing.chunk.source = 'hybrid';
      } else {
        scoreMap.set(chunk.id, { chunk: { ...chunk, source: 'hybrid' }, score: rrfScore });
      }
    });

    // Add BM25 results with weighted RRF score
    const bm25Weight = 1 - vectorWeight;
    bm25Chunks.forEach((chunk, rank) => {
      const rrfScore = bm25Weight * (1 / (k + rank + 1));
      const existing = scoreMap.get(chunk.id);
      if (existing) {
        existing.score += rrfScore;
        existing.chunk.source = 'hybrid';
      } else {
        scoreMap.set(chunk.id, { chunk: { ...chunk, source: 'hybrid' }, score: rrfScore });
      }
    });

    // Sort by fused score
    const fused = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({ ...item.chunk, score: item.score }));

    return fused;
  }

  /**
   * =============================================================================
   * DEDUPLICATION
   * =============================================================================
   */
  private deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const seen = new Set<string>();
    const result: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      // Create a fingerprint from text (first 100 chars)
      const fingerprint = chunk.text.slice(0, 100).toLowerCase().replace(/\s+/g, ' ');

      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        result.push(chunk);
      }
    }

    return result;
  }

  /**
   * =============================================================================
   * CONTEXT BUILDING
   * =============================================================================
   */
  private buildContext(chunks: RetrievedChunk[], questionType: QuestionType): string {
    if (chunks.length === 0) {
      return '';
    }

    // Group by document for better organization
    const byDocument = new Map<string, RetrievedChunk[]>();
    for (const chunk of chunks) {
      const docChunks = byDocument.get(chunk.documentId) || [];
      docChunks.push(chunk);
      byDocument.set(chunk.documentId, docChunks);
    }

    let context = '';

    // Build context with document headers
    for (const [docId, docChunks] of byDocument) {
      const docName = docChunks[0].documentName;
      context += `\n## Document: ${docName}\n\n`;

      // Sort chunks by their original position if available
      const sortedChunks = docChunks.sort((a, b) => {
        const aIndex = a.metadata?.chunkIndex ?? 0;
        const bIndex = b.metadata?.chunkIndex ?? 0;
        return aIndex - bIndex;
      });

      for (const chunk of sortedChunks) {
        context += `${chunk.text}\n\n`;
      }
    }

    // Limit context size based on question type
    const maxContextLength = questionType.includes('complex') ? 50000 : 20000;
    if (context.length > maxContextLength) {
      context = context.slice(0, maxContextLength) + '\n\n[Context truncated...]';
    }

    return context.trim();
  }

  /**
   * =============================================================================
   * UTILITIES
   * =============================================================================
   */

  private buildEmptyResult(
    questionType: QuestionType,
    ragMode: RagMode,
    retrievalTimeMs: number
  ): RetrievalResult {
    return {
      chunks: [],
      context: '',
      totalRetrieved: 0,
      questionType,
      ragMode,
      retrievalTimeMs,
      sources: [],
    };
  }

  private updateStats(chunksReturned: number, retrievalTimeMs: number): void {
    this.stats.totalQueries++;
    this.totalChunksReturned += chunksReturned;
    this.totalRetrievalTime += retrievalTimeMs;
    this.stats.avgChunksReturned = this.totalChunksReturned / this.stats.totalQueries;
    this.stats.avgRetrievalTimeMs = this.totalRetrievalTime / this.stats.totalQueries;
  }

  /**
   * Get retrieval statistics
   */
  public getStats(): RetrievalStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalQueries: 0,
      avgChunksReturned: 0,
      avgRetrievalTimeMs: 0,
      vectorQueries: 0,
      bm25Queries: 0,
      hybridQueries: 0,
    };
    this.totalChunksReturned = 0;
    this.totalRetrievalTime = 0;
  }

  /**
   * Get optimal topK for question type
   */
  public getOptimalTopK(ragMode: RagMode): number {
    return RAG_MODE_CONFIGS[ragMode].topK;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

const kodaRagRetrieval = KodaRagRetrievalService.getInstance();

export default kodaRagRetrieval;
export { KodaRagRetrievalService };
