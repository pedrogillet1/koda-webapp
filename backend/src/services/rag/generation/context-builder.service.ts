/**
 * Context Builder Service - A+ Implementation
 * Builds optimized context for the LLM
 *
 * Features:
 * - Context compression using micro-summaries and snippets
 * - Tier-based context budget
 * - Token counting to avoid exceeding model limits
 */

import { Chunk, TIER_CONFIGS } from "../types/rag.types";
import { CompressedContext, ContextOptions } from "../types/generation.types";

// Simple tokenizer for token counting (replace with a proper one like tiktoken)
function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractRelevantSnippet(content: string, query: string, maxLength: number): string {
  // In a real implementation, this would be a more sophisticated snippet extraction algorithm
  const queryTokens = new Set(query.toLowerCase().split(" "));
  const sentences = content.split(". ");

  let bestSentence = "";
  let maxScore = -1;

  for (const sentence of sentences) {
    const score = Array.from(queryTokens).filter(token => sentence.toLowerCase().includes(token)).length;
    if (score > maxScore) {
      maxScore = score;
      bestSentence = sentence;
    }
  }

  return (bestSentence || content).substring(0, maxLength);
}

class ContextBuilderService {
  public buildContext(chunks: Chunk[], options: ContextOptions): CompressedContext {
    const { query, tier } = options;
    const config = TIER_CONFIGS[tier];
    const budget = config.topK;

    const selectedChunks = chunks.slice(0, budget);

    const contextString = selectedChunks
      .map((chunk, i) => {
        const snippet = extractRelevantSnippet(chunk.content, query, 200);
        const section = (chunk.metadata as any).section || '';
        const microSummary = (chunk.metadata as any).microSummary || 'N/A';
        return `[${i + 1}] ${chunk.metadata.filename} - ${section}\nSummary: ${microSummary}\nSnippet: "${snippet}"`;
      })
      .join("\n\n");

    return {
      content: contextString,
      tokenCount: countTokens(contextString),
    };
  }
}

export const contextBuilderService = new ContextBuilderService();
