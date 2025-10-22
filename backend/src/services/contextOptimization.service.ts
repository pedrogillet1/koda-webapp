/**
 * Context Optimization Service
 * Limits the amount of context sent to LLM to prevent 55-second delays
 *
 * Problem: Sending 15,000 tokens (full document) → 50s processing time
 * Solution: Send 2,000 tokens (relevant chunks only) → 3-5s processing time
 */

import vectorEmbeddingService from './vectorEmbedding.service';

interface ContextChunk {
  content: string;
  relevanceScore: number;
  metadata?: any;
}

interface OptimizedContext {
  context: string;
  chunksUsed: number;
  tokensEstimated: number;
  truncated: boolean;
  originalTokens: number;
}

class ContextOptimizationService {
  private readonly MAX_CONTEXT_TOKENS = 2000;  // Limit to 2,000 tokens (vs 15,000)
  private readonly TOKENS_PER_CHAR = 0.25;     // Rough estimate: 1 token ≈ 4 chars

  /**
   * Build optimized context from document by extracting only relevant chunks
   * Uses vector search to find the most relevant sections based on the query
   */
  async buildOptimizedDocumentContext(
    documentId: string,
    userId: string,
    userQuery: string,
    fullText?: string
  ): Promise<OptimizedContext> {
    console.log('⚡ [Context Optimization] Building optimized context...');
    const startTime = Date.now();

    try {
      // Step 1: Use vector search to find relevant chunks
      console.log('🔍 [Context Optimization] Searching for relevant chunks...');

      const relevantChunks = await vectorEmbeddingService.searchSimilarChunks(
        userId,
        userQuery,
        10,  // Get top 10 most relevant chunks
        0.3  // Lower threshold to cast wider net
      );

      if (relevantChunks.length === 0) {
        console.log('⚠️ [Context Optimization] No relevant chunks found via vector search');

        // Fallback: If no vector embeddings exist, use beginning of document
        if (fullText) {
          return this.buildOptimizedContextFromFullText(fullText, userQuery);
        }

        return {
          context: '',
          chunksUsed: 0,
          tokensEstimated: 0,
          truncated: false,
          originalTokens: 0
        };
      }

      // Step 2: Sort by relevance and build context within token limit
      const sortedChunks = relevantChunks.sort((a: any, b: any) => b.similarity - a.similarity);

      let totalTokens = 0;
      const selectedChunks: ContextChunk[] = [];

      for (const chunk of sortedChunks) {
        const chunkTokens = chunk.content.length * this.TOKENS_PER_CHAR;

        // Stop if we would exceed token limit
        if (totalTokens + chunkTokens > this.MAX_CONTEXT_TOKENS) {
          console.log(`⚠️ [Context Optimization] Token limit reached (${totalTokens}/${this.MAX_CONTEXT_TOKENS})`);
          break;
        }

        selectedChunks.push({
          content: chunk.content,
          relevanceScore: chunk.similarity,
          metadata: chunk.metadata
        });

        totalTokens += chunkTokens;
      }

      // Step 3: Build formatted context string
      const contextLines: string[] = [];
      contextLines.push(`**Relevant sections from document (${selectedChunks.length} chunks, ~${Math.round(totalTokens)} tokens):**\n`);

      for (let i = 0; i < selectedChunks.length; i++) {
        const chunk = selectedChunks[i];
        contextLines.push(
          `[Chunk ${i + 1}] (Relevance: ${(chunk.relevanceScore * 100).toFixed(0)}%)\n${chunk.content}\n`
        );
      }

      const originalTokens = fullText ? Math.round(fullText.length * this.TOKENS_PER_CHAR) : 0;
      const duration = Date.now() - startTime;

      console.log(`✅ [Context Optimization] Context built in ${duration}ms`);
      console.log(`   📊 Tokens: ${Math.round(totalTokens)} / ${this.MAX_CONTEXT_TOKENS} (${originalTokens > 0 ? `${((totalTokens / originalTokens) * 100).toFixed(0)}% of original` : 'N/A'})`);
      console.log(`   📦 Chunks: ${selectedChunks.length} / ${sortedChunks.length}`);

      return {
        context: contextLines.join('\n'),
        chunksUsed: selectedChunks.length,
        tokensEstimated: Math.round(totalTokens),
        truncated: totalTokens >= this.MAX_CONTEXT_TOKENS * 0.9,
        originalTokens
      };

    } catch (error) {
      console.error('❌ [Context Optimization] Error:', error);

      // Fallback to simple truncation if vector search fails
      if (fullText) {
        return this.buildOptimizedContextFromFullText(fullText, userQuery);
      }

      throw error;
    }
  }

  /**
   * Fallback method: Build optimized context from full text when vector search unavailable
   * Uses simple keyword matching and truncation
   */
  public buildOptimizedContextFromFullText(
    fullText: string,
    userQuery: string
  ): OptimizedContext {
    console.log('⚠️ [Context Optimization] Using fallback: simple truncation');

    const originalTokens = Math.round(fullText.length * this.TOKENS_PER_CHAR);
    const maxChars = Math.round(this.MAX_CONTEXT_TOKENS / this.TOKENS_PER_CHAR);

    // If document is small enough, return it all
    if (fullText.length <= maxChars) {
      return {
        context: fullText,
        chunksUsed: 1,
        tokensEstimated: originalTokens,
        truncated: false,
        originalTokens
      };
    }

    // Try to find relevant section based on query keywords
    const queryKeywords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let bestPosition = 0;
    let bestScore = 0;

    // Search for position with most query keywords
    for (let i = 0; i < fullText.length - maxChars; i += 100) {
      const section = fullText.substring(i, i + maxChars).toLowerCase();
      const score = queryKeywords.filter(keyword => section.includes(keyword)).length;

      if (score > bestScore) {
        bestScore = score;
        bestPosition = i;
      }
    }

    // Extract section around best match
    let start = Math.max(0, bestPosition);
    let end = Math.min(fullText.length, start + maxChars);

    let context = fullText.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < fullText.length) context = context + '...';

    const tokensUsed = Math.round(context.length * this.TOKENS_PER_CHAR);

    console.log(`✅ [Context Optimization] Fallback completed`);
    console.log(`   📊 Tokens: ${tokensUsed} / ${this.MAX_CONTEXT_TOKENS} (${((tokensUsed / originalTokens) * 100).toFixed(0)}% of original)`);

    return {
      context,
      chunksUsed: 1,
      tokensEstimated: tokensUsed,
      truncated: true,
      originalTokens
    };
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    return Math.round(text.length * this.TOKENS_PER_CHAR);
  }

  /**
   * Check if text exceeds token limit
   */
  exceedsLimit(text: string): boolean {
    return this.estimateTokens(text) > this.MAX_CONTEXT_TOKENS;
  }
}

export default new ContextOptimizationService();
