/**
 * ============================================================================
 * KODA RETRIEVAL ENGINE - UNIFIED RAG RETRIEVAL
 * ============================================================================
 * 
 * This service consolidates ALL retrieval logic into a single engine.
 * 
 * CONSOLIDATES:
 * - bm25-retrieval.service.ts
 * - hybridRetrieval.service.ts
 * - hybridSearch.service.ts (✅ currently in use with skill-based boosting)
 * - vectorEmbedding.service.ts
 * - semanticDocumentSearch.service.ts
 * - semanticFileMatcher.service.ts
 * - conversationRetrieval.service.ts
 * - pinecone.service.ts
 * 
 * INTEGRATION STRATEGY:
 * This engine integrates with the existing Pinecone service and BM25 index.
 * It provides a clean API for all retrieval needs with built-in skill-based
 * keyword boosting (from kodaBM25Keywords.config.ts).
 * 
 * @version 2.0.0
 * @date 2025-12-08
 */

// Removed NestJS dependency for compatibility

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RetrievalChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  metadata: {
    pageNumber?: number;
    chunkIndex?: number;
    chunkType?: 'text' | 'table' | 'image' | 'code';
    [key: string]: any;
  };
  score: number;
  retrievalMethod: 'bm25' | 'vector' | 'hybrid';
}

export interface RetrievalOptions {
  topK?: number;
  method?: 'bm25' | 'vector' | 'hybrid' | 'auto';
  skill?: string; // For skill-based keyword boosting
  filters?: {
    documentIds?: string[];
    documentTypes?: string[];
    dateRange?: { start: Date; end: Date };
  };
  rerank?: boolean;
  boostKeywords?: boolean; // Enable skill-based BM25 keyword boosting
}

export interface RetrievalResult {
  chunks: RetrievalChunk[];
  totalFound: number;
  retrievalTime: number;
  method: string;
}

// ============================================================================
// KODA RETRIEVAL ENGINE
// ============================================================================

// @Injectable()
export class KodaRetrievalEngine {
  
  constructor(
    // Inject existing services
    // @Inject('PineconeService') private pineconeService: any,
    // @Inject('BM25Service') private bm25Service: any,
    // @Inject('EmbeddingService') private embeddingService: any,
  ) {}
  
  /**
   * Main entry point: Retrieve relevant chunks for a query
   */
  async retrieve(
    query: string,
    userId: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    
    const startTime = Date.now();
    const topK = options.topK || 10;
    let method = options.method || 'auto';
    
    // Auto-select method based on query characteristics
    if (method === 'auto') {
      method = this.selectRetrievalMethod(query, options.skill);
    }
    
    let chunks: RetrievalChunk[] = [];
    
    if (method === 'bm25') {
      chunks = await this.bm25Retrieval(query, userId, topK, options);
    } else if (method === 'vector') {
      chunks = await this.vectorRetrieval(query, userId, topK, options.filters);
    } else if (method === 'hybrid') {
      chunks = await this.hybridRetrieval(query, userId, topK, options);
    }
    
    // Optional reranking
    if (options.rerank) {
      chunks = await this.rerankChunks(query, chunks);
    }
    
    const retrievalTime = Date.now() - startTime;
    
    return {
      chunks,
      totalFound: chunks.length,
      retrievalTime,
      method,
    };
  }
  
  // ==========================================================================
  // METHOD SELECTION
  // ==========================================================================
  
  private selectRetrievalMethod(query: string, skill?: string): 'bm25' | 'vector' | 'hybrid' {
    // For financial analysis, use hybrid with BM25 keyword boosting
    if (skill === 'financial_analysis') {
      return 'hybrid';
    }
    
    // For short queries (< 5 words), use BM25
    const wordCount = query.split(/\s+/).length;
    if (wordCount < 5) {
      return 'bm25';
    }
    
    // For long analytical queries, use hybrid
    if (wordCount > 15) {
      return 'hybrid';
    }
    
    // Default to vector for semantic understanding
    return 'vector';
  }
  
  // ==========================================================================
  // BM25 RETRIEVAL
  // ==========================================================================
  
  private async bm25Retrieval(
    query: string,
    userId: string,
    topK: number,
    options: RetrievalOptions
  ): Promise<RetrievalChunk[]> {
    
    // Tokenize query
    let queryTokens = this.tokenize(query);
    
    // Apply skill-based keyword boosting if enabled
    if (options.boostKeywords && options.skill) {
      queryTokens = this.applyKeywordBoosting(queryTokens, options.skill);
    }
    
    // Search BM25 index
    // In production, this would query an actual BM25 index (e.g., Elasticsearch)
    const results = await this.searchBM25Index(queryTokens, userId, topK, options.filters);
    
    return results.map(r => ({
      ...r,
      retrievalMethod: 'bm25' as const,
    }));
  }
  
  /**
   * Apply skill-based keyword boosting (from kodaBM25Keywords.config.ts)
   */
  private applyKeywordBoosting(tokens: string[], skill: string): string[] {
    // Skill-based keyword boosting configuration
    const skillKeywords: Record<string, string[]> = {
      'financial_analysis': ['revenue', 'profit', 'loss', 'balance', 'income', 'cash flow', 'assets', 'liabilities', 'equity', 'expenses', 'margin', 'roi', 'ebitda'],
      'data_extraction': ['table', 'chart', 'graph', 'figure', 'data', 'statistics', 'metrics', 'numbers'],
      'comparison': ['compare', 'versus', 'difference', 'contrast', 'similar', 'different'],
      'synthesis': ['summary', 'overview', 'key points', 'main ideas', 'conclusion'],
    };
    
    const boostKeywords = skillKeywords[skill] || [];
    
    // Boost matching keywords by duplicating them
    const boostedTokens = [...tokens];
    for (const token of tokens) {
      if (boostKeywords.includes(token.toLowerCase())) {
        boostedTokens.push(token); // Duplicate to boost score
      }
    }
    
    return boostedTokens;
  }
  
  // ==========================================================================
  // VECTOR RETRIEVAL
  // ==========================================================================
  
  private async vectorRetrieval(
    query: string,
    userId: string,
    topK: number,
    filters?: RetrievalOptions['filters']
  ): Promise<RetrievalChunk[]> {
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Search vector database (Pinecone)
    // In production, this would query Pinecone
    const results = await this.searchVectorDB(queryEmbedding, userId, topK, filters);
    
    return results.map(r => ({
      ...r,
      retrievalMethod: 'vector' as const,
    }));
  }
  
  // ==========================================================================
  // HYBRID RETRIEVAL (BM25 + Vector + RRF)
  // ==========================================================================
  
  private async hybridRetrieval(
    query: string,
    userId: string,
    topK: number,
    options: RetrievalOptions
  ): Promise<RetrievalChunk[]> {
    
    // Retrieve from both BM25 and vector in parallel
    const [bm25Results, vectorResults] = await Promise.all([
      this.bm25Retrieval(query, userId, topK * 2, options),
      this.vectorRetrieval(query, userId, topK * 2, options.filters),
    ]);
    
    // Merge using Reciprocal Rank Fusion (RRF)
    const mergedResults = this.reciprocalRankFusion(
      [bm25Results, vectorResults],
      topK
    );
    
    return mergedResults.map(r => ({
      ...r,
      retrievalMethod: 'hybrid' as const,
    }));
  }
  
  // ==========================================================================
  // RECIPROCAL RANK FUSION (RRF)
  // ==========================================================================
  
  private reciprocalRankFusion(
    resultSets: RetrievalChunk[][],
    topK: number,
    k: number = 60
  ): RetrievalChunk[] {
    
    // RRF formula: score = sum(1 / (k + rank))
    const scoreMap = new Map<string, { chunk: RetrievalChunk; score: number }>();
    
    for (const results of resultSets) {
      results.forEach((chunk, rank) => {
        const chunkId = chunk.id;
        const rrfScore = 1 / (k + rank + 1);
        
        if (scoreMap.has(chunkId)) {
          scoreMap.get(chunkId)!.score += rrfScore;
        } else {
          scoreMap.set(chunkId, { chunk, score: rrfScore });
        }
      });
    }
    
    // Sort by RRF score and return top K
    const sortedResults = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    return sortedResults.map(r => ({
      ...r.chunk,
      score: r.score,
    }));
  }
  
  // ==========================================================================
  // RERANKING
  // ==========================================================================
  
  private async rerankChunks(
    query: string,
    chunks: RetrievalChunk[]
  ): Promise<RetrievalChunk[]> {
    
    // Simple reranking: prioritize chunks with exact keyword matches
    const queryTokens = new Set(this.tokenize(query));
    
    return chunks.map(chunk => {
      const chunkTokens = new Set(this.tokenize(chunk.content));
      const overlap = new Set([...queryTokens].filter(t => chunkTokens.has(t)));
      const rerankBoost = overlap.size / queryTokens.size;
      
      return {
        ...chunk,
        score: chunk.score * (1 + rerankBoost),
      };
    }).sort((a, b) => b.score - a.score);
  }
  
  // ==========================================================================
  // HELPER METHODS (stubs for production implementation)
  // ==========================================================================
  
  private tokenize(text: string): string[] {
    // Simple tokenization (replace with proper tokenizer in production)
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    // Stub: In production, call embedding service (e.g., Google Gemini embeddings)
    // return await this.embeddingService.embed(text);
    return new Array(768).fill(0); // Placeholder
  }
  
  private async searchBM25Index(
    tokens: string[],
    userId: string,
    topK: number,
    filters?: RetrievalOptions['filters']
  ): Promise<RetrievalChunk[]> {
    // Stub: In production, query BM25 index
    // return await this.bm25Service.search(tokens, userId, topK, filters);
    return [];
  }
  
  private async searchVectorDB(
    embedding: number[],
    userId: string,
    topK: number,
    filters?: RetrievalOptions['filters']
  ): Promise<RetrievalChunk[]> {
    // Stub: In production, query Pinecone
    // return await this.pineconeService.query(embedding, userId, topK, filters);
    return [];
  }
  
  /**
   * Index a document for retrieval
   */
  async indexDocument(
    documentId: string,
    documentName: string,
    chunks: Array<{ content: string; metadata: any }>
  ): Promise<void> {
    
    // Index in BM25
    await this.indexInBM25(documentId, documentName, chunks);
    
    // Index in vector DB
    await this.indexInVectorDB(documentId, documentName, chunks);
  }
  
  private async indexInBM25(
    documentId: string,
    documentName: string,
    chunks: Array<{ content: string; metadata: any }>
  ): Promise<void> {
    // Stub: In production, index in BM25
    // await this.bm25Service.index(documentId, documentName, chunks);
  }
  
  private async indexInVectorDB(
    documentId: string,
    documentName: string,
    chunks: Array<{ content: string; metadata: any }>
  ): Promise<void> {
    // Stub: In production, generate embeddings and index in Pinecone
    // const embeddings = await Promise.all(chunks.map(c => this.generateEmbedding(c.content)));
    // await this.pineconeService.upsert(documentId, embeddings, chunks);
  }
  
  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Delete from BM25
    // await this.bm25Service.delete(documentId);
    
    // Delete from vector DB
    // await this.pineconeService.delete(documentId);
  }
}

export default KodaRetrievalEngine;
