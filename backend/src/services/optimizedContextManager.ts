import { encode } from 'gpt-tokenizer';

/**
 * Optimized Context Manager for GPT-4o-mini (128K context window)
 *
 * Token Budget Allocation:
 * - System Prompt: ~500 tokens
 * - Document Context: Up to 40,000 tokens
 * - Conversation History: ~71,000 tokens (flexible based on remaining space)
 * - Output Buffer: 16,000 tokens (max_tokens setting)
 * - Safety Buffer: ~500 tokens
 *
 * Total: ~128,000 tokens
 */

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ContextOptions {
  systemPrompt: string;
  documentContext: string;
  conversationHistory: Message[];
  maxContextTokens?: number;
  maxOutputTokens?: number;
}

interface OptimizedContext {
  messages: Message[];
  tokenUsage: {
    systemPrompt: number;
    documentContext: number;
    conversationHistory: number;
    total: number;
    available: number;
    utilizationPercentage: number;
  };
}

export class OptimizedContextManager {
  // GPT-4o-mini limits
  private readonly MAX_CONTEXT_WINDOW = 128000;
  private readonly MAX_OUTPUT_TOKENS = 16000;
  private readonly SAFETY_BUFFER = 500;

  // Dynamic allocation targets
  private readonly SYSTEM_PROMPT_TARGET = 500;
  private readonly DOCUMENT_CONTEXT_MAX = 40000;

  /**
   * Count tokens in a string using gpt-tokenizer
   */
  private countTokens(text: string): number {
    if (!text) return 0;
    try {
      return encode(text).length;
    } catch (error) {
      console.error('Error counting tokens:', error);
      // Fallback estimation: ~4 characters per token
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Count tokens in messages array
   */
  private countMessagesTokens(messages: Message[]): number {
    let total = 0;
    for (const message of messages) {
      // Add tokens for message structure (role, content formatting)
      total += 4; // Overhead per message
      total += this.countTokens(message.role);
      total += this.countTokens(message.content);
    }
    return total;
  }

  /**
   * Truncate text to fit within token limit
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const tokens = this.countTokens(text);
    if (tokens <= maxTokens) {
      return text;
    }

    // Estimate character limit and truncate
    const estimatedCharLimit = Math.floor((maxTokens / tokens) * text.length);
    const truncated = text.substring(0, estimatedCharLimit);

    // Verify and adjust if needed
    if (this.countTokens(truncated) <= maxTokens) {
      return truncated + '\n\n[Content truncated to fit token limit]';
    }

    // If still too long, binary search for exact limit
    let left = 0;
    let right = truncated.length;
    let result = '';

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const candidate = text.substring(0, mid);
      const candidateTokens = this.countTokens(candidate);

      if (candidateTokens <= maxTokens) {
        result = candidate;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result + '\n\n[Content truncated to fit token limit]';
  }

  /**
   * Optimize conversation history to fit within token budget
   * Keeps most recent messages and tries to preserve context
   */
  private optimizeConversationHistory(
    messages: Message[],
    availableTokens: number
  ): Message[] {
    if (messages.length === 0) {
      return [];
    }

    // Always try to keep the most recent messages
    const optimized: Message[] = [];
    let currentTokens = 0;

    // Start from most recent and work backwards
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.countMessagesTokens([message]);

      if (currentTokens + messageTokens <= availableTokens) {
        optimized.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Try to fit a truncated version of this message if it's important
        if (optimized.length < 2) {
          const remainingTokens = availableTokens - currentTokens;
          if (remainingTokens > 100) {
            const truncatedContent = this.truncateToTokenLimit(
              message.content,
              remainingTokens - 50 // Leave room for message overhead
            );
            optimized.unshift({
              role: message.role,
              content: truncatedContent
            });
            currentTokens += this.countMessagesTokens([{ role: message.role, content: truncatedContent }]);
          }
        }
        break;
      }
    }

    return optimized;
  }

  /**
   * Build optimized context for AI request
   * Maximizes token usage while staying within limits
   */
  public buildOptimizedContext(options: ContextOptions): OptimizedContext {
    const {
      systemPrompt,
      documentContext,
      conversationHistory,
      maxContextTokens = this.MAX_CONTEXT_WINDOW,
      maxOutputTokens = this.MAX_OUTPUT_TOKENS,
    } = options;

    // Calculate available tokens for input
    const availableInputTokens = maxContextTokens - maxOutputTokens - this.SAFETY_BUFFER;

    // Count system prompt tokens
    let systemPromptTokens = this.countTokens(systemPrompt);
    let optimizedSystemPrompt = systemPrompt;

    // If system prompt exceeds target, truncate it
    if (systemPromptTokens > this.SYSTEM_PROMPT_TARGET) {
      optimizedSystemPrompt = this.truncateToTokenLimit(systemPrompt, this.SYSTEM_PROMPT_TARGET);
      systemPromptTokens = this.countTokens(optimizedSystemPrompt);
    }

    // Count and optimize document context
    let documentContextTokens = this.countTokens(documentContext);
    let optimizedDocumentContext = documentContext;

    // If document context exceeds max, truncate it
    if (documentContextTokens > this.DOCUMENT_CONTEXT_MAX) {
      optimizedDocumentContext = this.truncateToTokenLimit(documentContext, this.DOCUMENT_CONTEXT_MAX);
      documentContextTokens = this.countTokens(optimizedDocumentContext);
    }

    // Calculate remaining tokens for conversation history
    const remainingTokens = availableInputTokens - systemPromptTokens - documentContextTokens;

    // Optimize conversation history to fit
    const optimizedHistory = this.optimizeConversationHistory(
      conversationHistory,
      remainingTokens
    );
    const conversationHistoryTokens = this.countMessagesTokens(optimizedHistory);

    // Build final messages array
    const messages: Message[] = [
      { role: 'system', content: optimizedSystemPrompt },
      ...optimizedHistory
    ];

    // Add document context as a system message if present
    if (optimizedDocumentContext) {
      messages.splice(1, 0, {
        role: 'system',
        content: `Document Context:\n\n${optimizedDocumentContext}`
      });
    }

    // Calculate final token usage
    const totalTokens = systemPromptTokens + documentContextTokens + conversationHistoryTokens;
    const utilizationPercentage = ((totalTokens + maxOutputTokens) / maxContextTokens) * 100;

    return {
      messages,
      tokenUsage: {
        systemPrompt: systemPromptTokens,
        documentContext: documentContextTokens,
        conversationHistory: conversationHistoryTokens,
        total: totalTokens,
        available: availableInputTokens - totalTokens,
        utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
      },
    };
  }

  /**
   * Analyze token distribution for debugging
   */
  public analyzeTokens(text: string): {
    tokens: number;
    characters: number;
    charactersPerToken: number;
  } {
    const tokens = this.countTokens(text);
    const characters = text.length;
    const charactersPerToken = characters / tokens;

    return {
      tokens,
      characters,
      charactersPerToken: Math.round(charactersPerToken * 100) / 100,
    };
  }

  /**
   * Split large text into chunks with overlap for better context
   */
  public chunkText(
    text: string,
    maxTokensPerChunk: number,
    overlapTokens: number = 200
  ): string[] {
    const totalTokens = this.countTokens(text);

    // If text fits in one chunk, return it
    if (totalTokens <= maxTokensPerChunk) {
      return [text];
    }

    const chunks: string[] = [];
    let startPos = 0;

    while (startPos < text.length) {
      // Estimate chunk size in characters
      const estimatedChunkChars = Math.floor(
        (maxTokensPerChunk / totalTokens) * text.length
      );

      let endPos = Math.min(startPos + estimatedChunkChars, text.length);

      // Try to break at sentence or paragraph boundary
      if (endPos < text.length) {
        const nextParagraph = text.indexOf('\n\n', endPos - 100);
        const nextSentence = text.indexOf('. ', endPos - 50);

        if (nextParagraph !== -1 && nextParagraph < endPos + 100) {
          endPos = nextParagraph + 2;
        } else if (nextSentence !== -1 && nextSentence < endPos + 50) {
          endPos = nextSentence + 2;
        }
      }

      const chunk = text.substring(startPos, endPos);
      chunks.push(chunk);

      // Calculate overlap in characters
      const overlapChars = Math.floor(
        (overlapTokens / this.countTokens(chunk)) * chunk.length
      );

      startPos = endPos - overlapChars;

      // Prevent infinite loop
      if (startPos >= endPos) {
        startPos = endPos;
      }
    }

    return chunks;
  }
}

// Export singleton instance
export const contextManager = new OptimizedContextManager();
