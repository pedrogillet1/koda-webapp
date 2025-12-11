/**
 * ============================================================================
 * RAG RETRIEVAL SERVICE - Unified Retrieval for Orchestrator
 * ============================================================================
 *
 * Wraps existing RAG retrieval logic for the orchestrator.
 * Uses kodaRagRetrieval.service.ts internally.
 *
 * @version 2.0.0
 * @date 2024-12-10
 */

import type { RagConfig, RagContext } from '../types/orchestrator.types';
import kodaRagRetrieval from './kodaRagRetrieval.service';

// =============================================================================
// RAG RETRIEVAL SERVICE CLASS
// =============================================================================

class RagRetrievalService {
  /**
   * Retrieve relevant chunks based on config
   */
  async retrieve(query: string, config: RagConfig): Promise<RagContext> {
    console.log(`[RAG_RETRIEVAL] Query: "${query.slice(0, 50)}..." (max ${config.maxChunks} chunks)`);

    try {
      // Use centralized kodaRagRetrieval service
      const result = await kodaRagRetrieval.retrieve({
        query,
        userId: config.userId,
        documentIds: config.scopeDocs,
        topK: config.maxChunks,
        filters: {
          minScore: config.minScore,
        },
      });

      // Map to orchestrator format
      const docsUsed = this.extractUniqueDocuments(result.chunks);
      const avgScore = result.chunks.length > 0
        ? result.chunks.reduce((sum, c) => sum + c.score, 0) / result.chunks.length
        : 0;

      const context: RagContext = {
        docsUsed: docsUsed.slice(0, config.maxDocs),
        chunks: result.chunks.slice(0, config.maxChunks).map(chunk => ({
          docId: chunk.documentId,
          text: chunk.text,
          score: chunk.score,
          chunkType: chunk.metadata?.documentType || 'text',
          location: chunk.metadata?.pageNumber
            ? { page: chunk.metadata.pageNumber }
            : undefined,
        })),
        totalRetrieved: result.totalRetrieved,
        avgScore,
      };

      console.log(`[RAG_RETRIEVAL] Retrieved ${context.chunks.length} chunks from ${context.docsUsed.length} docs (avg score: ${avgScore.toFixed(2)})`);

      return context;
    } catch (error: any) {
      console.error(`[RAG_RETRIEVAL] Error:`, error.message);

      // Return empty context on error
      return {
        docsUsed: [],
        chunks: [],
        totalRetrieved: 0,
        avgScore: 0,
      };
    }
  }

  /**
   * Extract unique documents from chunks
   */
  private extractUniqueDocuments(chunks: any[]): RagContext['docsUsed'] {
    const seen = new Set<string>();
    const docs: RagContext['docsUsed'] = [];

    for (const chunk of chunks) {
      if (!seen.has(chunk.documentId)) {
        seen.add(chunk.documentId);
        docs.push({
          id: chunk.documentId,
          title: chunk.documentName || 'Unknown',
          filename: chunk.documentName || 'Unknown',
          mimeType: chunk.metadata?.documentType || 'application/octet-stream',
        });
      }
    }

    return docs;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

const ragRetrievalService = new RagRetrievalService();
export default ragRetrievalService;
export { RagRetrievalService };
