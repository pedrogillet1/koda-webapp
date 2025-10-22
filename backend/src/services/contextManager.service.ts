/**
 * Context Manager Service
 * Intelligently manages context to fit within AI model token limits
 * Handles: token estimation, budget allocation, chat history compression, chunk selection
 */

interface Message {
  role: string;
  content: string;
}

interface Chunk {
  text_content?: string;
  content?: string;
  relevance_score?: number;
  similarity?: number;
  [key: string]: any;
}

interface ManagedContext {
  systemPrompt: string;
  chatHistory: Message[];
  chunks: Chunk[];
  userQuestion: string;
  totalTokens: number;
  budgetBreakdown: {
    systemTokens: number;
    questionTokens: number;
    historyTokens: number;
    chunksTokens: number;
    bufferTokens: number;
  };
}

class ContextManagerService {
  private maxTokens: number;
  private tokenBuffer: number;

  constructor(maxTokens: number = 100000, tokenBuffer: number = 10000) {
    this.maxTokens = maxTokens;
    this.tokenBuffer = tokenBuffer;
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   * More accurate for English text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    // More accurate estimation considering:
    // - Whitespace (tokens are usually longer than 4 chars)
    // - Punctuation (often separate tokens)
    // - Common words (might be single tokens)

    const words = text.split(/\s+/).filter(w => w.length > 0);
    const punctuation = (text.match(/[.,!?;:()[\]{}'"]/g) || []).length;

    // Approximate: words / 0.75 (most words are < 1 token) + punctuation
    return Math.ceil(words.length / 0.75) + punctuation;
  }

  /**
   * Intelligently manage context to fit within token limits
   * Allocates tokens: 20% chat history, 80% retrieved chunks
   */
  async manageContext(
    userQuestion: string,
    retrievedChunks: Chunk[],
    chatHistory: Message[],
    systemPrompt: string
  ): Promise<ManagedContext> {
    console.log(`🧠 [Context Manager] Managing context for token limit: ${this.maxTokens}`);

    // Calculate token budgets
    const systemTokens = this.estimateTokens(systemPrompt);
    const questionTokens = this.estimateTokens(userQuestion);

    const availableTokens = this.maxTokens - this.tokenBuffer - systemTokens - questionTokens;

    console.log(`   System: ${systemTokens} tokens`);
    console.log(`   Question: ${questionTokens} tokens`);
    console.log(`   Available: ${availableTokens} tokens`);
    console.log(`   Buffer: ${this.tokenBuffer} tokens`);

    // Allocate tokens
    const chatHistoryBudget = Math.floor(availableTokens * 0.2); // 20% for history
    const chunksBudget = Math.floor(availableTokens * 0.8); // 80% for chunks

    console.log(`   Chat history budget: ${chatHistoryBudget} tokens`);
    console.log(`   Chunks budget: ${chunksBudget} tokens`);

    // Compress chat history
    const compressedHistory = this.compressChatHistory(chatHistory, chatHistoryBudget);
    const historyTokens = this.estimateTokens(JSON.stringify(compressedHistory));

    // Select and compress chunks
    const selectedChunks = this.selectChunks(retrievedChunks, chunksBudget);
    const chunksTokens = this.estimateTokens(JSON.stringify(selectedChunks));

    const totalTokens = systemTokens + questionTokens + historyTokens + chunksTokens;

    console.log(`✅ [Context Manager] Final allocation:`);
    console.log(`   History: ${compressedHistory.length} messages (${historyTokens} tokens)`);
    console.log(`   Chunks: ${selectedChunks.length} selected (${chunksTokens} tokens)`);
    console.log(`   Total: ${totalTokens} / ${this.maxTokens} tokens (${((totalTokens / this.maxTokens) * 100).toFixed(1)}%)`);

    return {
      systemPrompt,
      chatHistory: compressedHistory,
      chunks: selectedChunks,
      userQuestion,
      totalTokens,
      budgetBreakdown: {
        systemTokens,
        questionTokens,
        historyTokens,
        chunksTokens,
        bufferTokens: this.tokenBuffer
      }
    };
  }

  /**
   * Compress chat history to fit budget
   * Strategy: Keep most recent messages, summarize or drop older ones
   */
  private compressChatHistory(history: Message[], tokenBudget: number): Message[] {
    if (!history || history.length === 0) {
      return [];
    }

    console.log(`💬 [Context Manager] Compressing ${history.length} messages to ${tokenBudget} tokens...`);

    // Always keep last 3 message pairs (6 messages) if possible
    const recentCount = Math.min(6, history.length);
    const recentMessages = history.slice(-recentCount);
    const olderMessages = history.slice(0, -recentCount);

    const recentTokens = recentMessages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg.content),
      0
    );

    console.log(`   Recent ${recentCount} messages: ${recentTokens} tokens`);

    if (recentTokens >= tokenBudget) {
      // Even recent messages exceed budget, keep only last 4 messages
      const minimalRecent = history.slice(-4);
      console.log(`   ⚠️ Budget exceeded, keeping only last 4 messages`);
      return minimalRecent;
    }

    // Add older messages if budget allows
    const compressedHistory: Message[] = [];
    let remainingBudget = tokenBudget - recentTokens;

    for (let i = olderMessages.length - 1; i >= 0; i--) {
      const msg = olderMessages[i];
      const msgTokens = this.estimateTokens(msg.content);

      if (msgTokens <= remainingBudget) {
        compressedHistory.unshift(msg);
        remainingBudget -= msgTokens;
      } else {
        // Try to include a truncated version
        if (remainingBudget > 50) {
          const truncatedContent = msg.content.substring(0, remainingBudget * 4) + '... [truncated]';
          compressedHistory.unshift({
            ...msg,
            content: truncatedContent
          });
        }
        break;
      }
    }

    const finalHistory = [...compressedHistory, ...recentMessages];
    console.log(`   ✅ Compressed to ${finalHistory.length} messages`);

    return finalHistory;
  }

  /**
   * Select chunks to fit within token budget
   * Prioritize by relevance score
   */
  private selectChunks(chunks: Chunk[], tokenBudget: number): Chunk[] {
    if (!chunks || chunks.length === 0) {
      return [];
    }

    console.log(`📦 [Context Manager] Selecting from ${chunks.length} chunks with ${tokenBudget} token budget...`);

    const selected: Chunk[] = [];
    let currentTokens = 0;

    // Sort by relevance (highest first)
    const sortedChunks = [...chunks].sort((a, b) => {
      const scoreA = a.relevance_score ?? a.similarity ?? 0;
      const scoreB = b.relevance_score ?? b.similarity ?? 0;
      return scoreB - scoreA;
    });

    for (const chunk of sortedChunks) {
      const content = chunk.text_content || chunk.content || '';
      const chunkTokens = this.estimateTokens(content);

      if (currentTokens + chunkTokens <= tokenBudget) {
        selected.push(chunk);
        currentTokens += chunkTokens;
      } else {
        // Try to fit a truncated version
        const remainingBudget = tokenBudget - currentTokens;

        if (remainingBudget > 200) {
          // Minimum useful size
          const maxChars = remainingBudget * 4;
          const truncatedContent = content.substring(0, maxChars) + '... [truncated]';

          selected.push({
            ...chunk,
            text_content: truncatedContent,
            content: truncatedContent,
            truncated: true
          });

          console.log(`   📄 Truncated last chunk to fit budget`);
        }
        break;
      }
    }

    console.log(`   ✅ Selected ${selected.length} chunks (${currentTokens} tokens)`);

    return selected;
  }

  /**
   * Analyze token usage and provide recommendations
   */
  analyzeTokenUsage(managedContext: ManagedContext): {
    efficiency: number;
    warnings: string[];
    recommendations: string[];
  } {
    const { totalTokens, budgetBreakdown } = managedContext;
    const usagePercent = (totalTokens / this.maxTokens) * 100;
    const efficiency = 100 - ((this.tokenBuffer / this.maxTokens) * 100);

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Warnings
    if (usagePercent > 90) {
      warnings.push('Context is near token limit (>90%)');
      recommendations.push('Consider reducing chunk count or chat history');
    }

    if (budgetBreakdown.historyTokens > budgetBreakdown.chunksTokens * 0.5) {
      warnings.push('Chat history is using >50% of chunk budget');
      recommendations.push('Consider clearing older chat history');
    }

    if (managedContext.chunks.some((c: any) => c.truncated)) {
      warnings.push('Some chunks were truncated to fit budget');
      recommendations.push('Increase token limit or reduce context');
    }

    // Recommendations for optimization
    if (usagePercent < 50) {
      recommendations.push('Context usage is low, you can retrieve more chunks');
    }

    return {
      efficiency,
      warnings,
      recommendations
    };
  }

  /**
   * Set custom token limits
   */
  setTokenLimits(maxTokens: number, buffer?: number) {
    this.maxTokens = maxTokens;
    if (buffer !== undefined) {
      this.tokenBuffer = buffer;
    }
    console.log(`📊 [Context Manager] Token limits updated: ${this.maxTokens} (buffer: ${this.tokenBuffer})`);
  }
}

// Export singleton with default Gemini limits
export default new ContextManagerService(100000, 10000); // Gemini 1.5 Pro: 128K context

// Export class for custom instances
export { ContextManagerService };
