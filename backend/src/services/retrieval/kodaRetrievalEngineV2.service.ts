/**
 * Koda Retrieval Engine V2
 *
 * Enhanced retrieval with multi-document support and V2 intent types.
 * Based on V1 but compatible with 25-category classification.
 */

import type {
  RagConfig,
  RagStatus,
  RetrievedChunk,
  SourceDocument,
  ChunkType,
} from '../../types/ragV1.types';

import type {
  IntentClassificationV2,
  RagContext,
} from '../../types/ragV2.types';

// Import existing services
import pineconeService from '../pinecone.service';
import embeddingService from '../embedding.service';
import prisma from '../../config/database';

// ============================================================================
// Retrieval Engine Class V2
// ============================================================================

class KodaRetrievalEngineV2 {
  /**
   * Main retrieval function with V2 intent support
   */
  async retrieve(
    query: string,
    userId: string,
    intent: IntentClassificationV2,
    config?: Partial<RagConfig>
  ): Promise<{ context: RagContext; status: RagStatus }> {
    const startTime = Date.now();

    try {
      // Check if RAG is needed
      if (intent.ragMode === 'NO_RAG') {
        return {
          context: this.buildEmptyContext(startTime),
          status: 'SUCCESS',
        };
      }

      // Build RAG config from V2 intent
      const ragConfig = this.buildRagConfigV2(intent, userId, config);

      // Check if user has documents
      const docsCount = await this.getDocumentCount(userId, ragConfig.docsFilter);

      if (docsCount === 0) {
        return {
          context: this.buildEmptyContext(startTime),
          status: 'NO_DOCUMENTS',
        };
      }

      // Perform retrieval
      const chunks = await this.performRetrieval(query, ragConfig);

      // Check if we found anything
      if (chunks.length === 0) {
        const status = intent.targetDocuments === 'EXPLICIT_SINGLE'
          ? 'NO_MATCH_SINGLE_DOC'
          : 'NO_MATCH';

        return {
          context: this.buildEmptyContext(startTime),
          status,
        };
      }

      // Build RAG context
      const context = await this.buildRagContext(chunks, userId, startTime);

      return {
        context,
        status: 'SUCCESS',
      };

    } catch (error) {
      console.error('[KodaRetrievalEngineV2] Error:', error);
      return {
        context: this.buildEmptyContext(startTime),
        status: 'ERROR',
      };
    }
  }

  /**
   * Build RAG config from V2 intent
   */
  private buildRagConfigV2(
    intent: IntentClassificationV2,
    userId: string,
    overrides?: Partial<RagConfig>
  ): RagConfig {
    const baseConfig: RagConfig = {
      userId,
      maxChunks: 10,
      maxDocs: 5,
      useVectorSearch: true,
      useBM25: false,
      useReranking: false,
    };

    // Adjust based on RAG mode
    if (intent.ragMode === 'MULTI_DOC_RAG') {
      baseConfig.maxChunks = 15;
      baseConfig.maxDocs = 10;
      baseConfig.useBM25 = true;
    }

    // Adjust based on question type
    if (intent.questionType === 'comparison') {
      baseConfig.maxChunks = 20;
      baseConfig.maxDocs = 10;
      baseConfig.useBM25 = true;
    }

    if (intent.questionType === 'multi_point_extraction') {
      baseConfig.maxChunks = 20;
      baseConfig.chunkTypes = ['list', 'paragraph', 'table'];
    }

    if (intent.questionType === 'simple_factual') {
      baseConfig.maxChunks = 5;
      baseConfig.chunkTypes = ['kpi', 'table', 'paragraph'];
    }

    // Adjust based on target documents
    if (intent.targetDocuments === 'EXPLICIT_SINGLE' && intent.targetDocId) {
      baseConfig.docsFilter = [intent.targetDocId];
      baseConfig.maxDocs = 1;
    }

    if (intent.targetDocuments === 'EXPLICIT_MULTI' && intent.targetDocIds) {
      baseConfig.docsFilter = intent.targetDocIds;
      baseConfig.maxDocs = intent.targetDocIds.length;
    }

    // Adjust based on reasoning flags
    if (intent.reasoningFlags?.needsAggregation) {
      baseConfig.maxChunks = 25;
    }

    if (intent.reasoningFlags?.needsComparison) {
      baseConfig.maxDocs = 10;
    }

    // Apply overrides
    return { ...baseConfig, ...overrides };
  }

  /**
   * Perform actual retrieval (vector + BM25)
   */
  private async performRetrieval(
    query: string,
    config: RagConfig
  ): Promise<RetrievedChunk[]> {
    let allChunks: RetrievedChunk[] = [];

    // Vector search
    if (config.useVectorSearch) {
      const vectorChunks = await this.vectorSearch(query, config);
      allChunks.push(...vectorChunks);
    }

    // BM25 search
    if (config.useBM25) {
      const bm25Chunks = await this.bm25Search(query, config);
      allChunks.push(...bm25Chunks);
    }

    // Merge and deduplicate
    const mergedChunks = this.mergeResults(allChunks);

    // Optional reranking
    if (config.useReranking && mergedChunks.length > 0) {
      return await this.rerank(query, mergedChunks, config.maxChunks!);
    }

    // Limit to maxChunks
    return mergedChunks.slice(0, config.maxChunks);
  }

  /**
   * Vector search via Pinecone
   */
  private async vectorSearch(
    query: string,
    config: RagConfig
  ): Promise<RetrievedChunk[]> {
    try {
      // Generate query embedding
      const embeddingResult = await embeddingService.generateEmbedding(query);
      const embedding = embeddingResult.embedding;

      // Query Pinecone
      const results = await pineconeService.query(embedding, {
        userId: config.userId,
        topK: config.maxChunks! * 2,
        documentId: config.docsFilter?.[0],
        minSimilarity: 0.3,
      });

      // Convert to RetrievedChunk format
      return results.map((result: any) => ({
        chunkId: `${result.documentId}_${result.chunkIndex}`,
        documentId: result.documentId,
        content: result.content || '',
        chunkType: (result.metadata?.chunkType as ChunkType) || 'paragraph',
        score: result.similarity || 0,
        metadata: {
          page: result.metadata?.pageNumber,
          section: result.metadata?.sectionName,
        },
      }));

    } catch (error) {
      console.error('[KodaRetrievalEngineV2] Vector search error:', error);
      return [];
    }
  }

  /**
   * BM25 keyword search
   */
  private async bm25Search(
    query: string,
    config: RagConfig
  ): Promise<RetrievedChunk[]> {
    try {
      // TODO: Integrate with existing BM25 service
      return [];

    } catch (error) {
      console.error('[KodaRetrievalEngineV2] BM25 search error:', error);
      return [];
    }
  }

  /**
   * Merge results from vector + BM25
   */
  private mergeResults(chunks: RetrievedChunk[]): RetrievedChunk[] {
    // Deduplicate by chunkId
    const seen = new Set<string>();
    const unique: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      if (!seen.has(chunk.chunkId)) {
        seen.add(chunk.chunkId);
        unique.push(chunk);
      }
    }

    // Sort by score (descending)
    unique.sort((a, b) => b.score - a.score);

    return unique;
  }

  /**
   * Optional reranking
   */
  private async rerank(
    query: string,
    chunks: RetrievedChunk[],
    topK: number
  ): Promise<RetrievedChunk[]> {
    try {
      // TODO: Use reranker model
      return chunks.slice(0, topK);

    } catch (error) {
      console.error('[KodaRetrievalEngineV2] Reranking error:', error);
      return chunks.slice(0, topK);
    }
  }

  /**
   * Build RAG context from chunks
   */
  private async buildRagContext(
    chunks: RetrievedChunk[],
    userId: string,
    startTime: number
  ): Promise<RagContext> {
    // Get unique document IDs
    const docIds = [...new Set(chunks.map(c => c.documentId))];

    // Fetch document metadata
    const documents = await this.getDocuments(userId, docIds);

    return {
      chunks,
      totalChunks: chunks.length,
      documentsUsed: docIds,
      retrievalTimeMs: Date.now() - startTime,
      rawSourceData: documents,
    };
  }

  /**
   * Build empty context
   */
  private buildEmptyContext(startTime: number): RagContext {
    return {
      chunks: [],
      totalChunks: 0,
      documentsUsed: [],
      retrievalTimeMs: Date.now() - startTime,
      rawSourceData: [],
    };
  }

  // ============================================================================
  // Database Helpers
  // ============================================================================

  private async getDocumentCount(
    userId: string,
    docsFilter?: string[]
  ): Promise<number> {
    try {
      const count = await prisma.document.count({
        where: {
          userId,
          status: 'completed',
          ...(docsFilter && { id: { in: docsFilter } }),
        },
      });

      return count;

    } catch (error) {
      console.error('[KodaRetrievalEngineV2] Error counting documents:', error);
      return 0;
    }
  }

  private async getDocuments(
    userId: string,
    docIds: string[]
  ): Promise<SourceDocument[]> {
    try {
      const docs = await prisma.document.findMany({
        where: {
          userId,
          id: { in: docIds },
        },
        select: {
          id: true,
          filename: true,
          displayTitle: true,
          mimeType: true,
          fileSize: true,
          folderId: true,
          createdAt: true,
        },
      });

      return docs.map(doc => ({
        documentId: doc.id,
        title: doc.displayTitle || doc.filename,
        filename: doc.filename,
        displayTitle: doc.displayTitle || null,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        folder: doc.folderId || undefined,
        uploadedAt: doc.createdAt,
      }));

    } catch (error) {
      console.error('[KodaRetrievalEngineV2] Error fetching documents:', error);
      return [];
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const kodaRetrievalEngineV2 = new KodaRetrievalEngineV2();
export default kodaRetrievalEngineV2;
