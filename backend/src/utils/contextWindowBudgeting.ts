/**
 * Context Window Budgeting
 *
 * Manages token allocation across different parts of the LLM prompt:
 * - System prompt
 * - User query
 * - Retrieved chunks
 * - Conversation history
 * - Reserved space for response
 *
 * Prevents truncation by proactively managing context size.
 *
 * Used by: kodaRetrievalEngineV3.service.ts, kodaAnswerEngineV3.service.ts
 */

import {
  estimateTokens,
  estimateChunksTokens,
  getModelContextLimit,
  getSafeTokenBudget,
  truncateToTokenBudget,
  SAFETY_MARGINS,
} from './tokenBudgetEstimator';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default token allocations (percentages of total budget)
 */
export const DEFAULT_ALLOCATIONS = {
  systemPrompt: 0.10,      // 10% for system instructions
  userQuery: 0.05,         // 5% for user's question
  conversationHistory: 0.15, // 15% for chat history
  retrievedChunks: 0.50,   // 50% for document chunks
  responseBuffer: 0.20,    // 20% reserved for LLM response
} as const;

/**
 * Minimum token allocations (absolute minimums)
 */
export const MIN_ALLOCATIONS = {
  systemPrompt: 500,
  userQuery: 100,
  conversationHistory: 200,
  retrievedChunks: 1000,
  responseBuffer: 500,
} as const;

/**
 * Maximum chunks to include (hard limit)
 */
export const MAX_CHUNKS = 50;

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetAllocation {
  systemPrompt: number;
  userQuery: number;
  conversationHistory: number;
  retrievedChunks: number;
  responseBuffer: number;
  total: number;
}

export interface BudgetUsage {
  systemPrompt: { allocated: number; used: number; remaining: number };
  userQuery: { allocated: number; used: number; remaining: number };
  conversationHistory: { allocated: number; used: number; remaining: number };
  retrievedChunks: { allocated: number; used: number; remaining: number };
  responseBuffer: { allocated: number; used: number; remaining: number };
  total: { allocated: number; used: number; remaining: number };
  withinBudget: boolean;
  utilizationPercent: number;
}

export interface ChunkBudgetResult {
  selectedChunks: string[];
  tokensUsed: number;
  chunksIncluded: number;
  chunksExcluded: number;
  wasTruncated: boolean;
}

export interface ContextBudgetInput {
  model: string;
  systemPrompt: string;
  userQuery: string;
  conversationHistory?: string;
  chunks: string[];
  language?: string;
  safetyLevel?: keyof typeof SAFETY_MARGINS;
}

export interface ContextBudgetResult {
  allocation: BudgetAllocation;
  usage: BudgetUsage;
  selectedChunks: ChunkBudgetResult;
  truncatedSystemPrompt?: string;
  truncatedConversationHistory?: string;
  warnings: string[];
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Calculate token budget allocation for a given model.
 *
 * @param model - Model name
 * @param safetyLevel - Safety margin level
 * @returns BudgetAllocation with token limits per category
 */
export function calculateBudgetAllocation(
  model: string,
  safetyLevel: keyof typeof SAFETY_MARGINS = 'normal'
): BudgetAllocation {
  const totalBudget = getSafeTokenBudget(model, safetyLevel);

  // Calculate proportional allocations
  let systemPrompt = Math.floor(totalBudget * DEFAULT_ALLOCATIONS.systemPrompt);
  let userQuery = Math.floor(totalBudget * DEFAULT_ALLOCATIONS.userQuery);
  let conversationHistory = Math.floor(totalBudget * DEFAULT_ALLOCATIONS.conversationHistory);
  let retrievedChunks = Math.floor(totalBudget * DEFAULT_ALLOCATIONS.retrievedChunks);
  let responseBuffer = Math.floor(totalBudget * DEFAULT_ALLOCATIONS.responseBuffer);

  // Ensure minimums are met
  systemPrompt = Math.max(systemPrompt, MIN_ALLOCATIONS.systemPrompt);
  userQuery = Math.max(userQuery, MIN_ALLOCATIONS.userQuery);
  conversationHistory = Math.max(conversationHistory, MIN_ALLOCATIONS.conversationHistory);
  retrievedChunks = Math.max(retrievedChunks, MIN_ALLOCATIONS.retrievedChunks);
  responseBuffer = Math.max(responseBuffer, MIN_ALLOCATIONS.responseBuffer);

  return {
    systemPrompt,
    userQuery,
    conversationHistory,
    retrievedChunks,
    responseBuffer,
    total: totalBudget,
  };
}

/**
 * Select chunks that fit within the budget.
 *
 * @param chunks - Array of text chunks (ordered by relevance)
 * @param budgetTokens - Maximum tokens for chunks
 * @param language - ISO language code
 * @returns ChunkBudgetResult with selected chunks
 */
export function selectChunksWithinBudget(
  chunks: string[],
  budgetTokens: number,
  language?: string
): ChunkBudgetResult {
  const selectedChunks: string[] = [];
  let tokensUsed = 0;
  let chunksExcluded = 0;

  // Limit to MAX_CHUNKS to prevent excessive processing
  const candidateChunks = chunks.slice(0, MAX_CHUNKS);

  for (const chunk of candidateChunks) {
    const chunkTokens = estimateTokens(chunk, language).tokens;

    if (tokensUsed + chunkTokens <= budgetTokens) {
      selectedChunks.push(chunk);
      tokensUsed += chunkTokens;
    } else {
      chunksExcluded++;
    }
  }

  // Add any remaining chunks beyond MAX_CHUNKS to excluded count
  chunksExcluded += Math.max(0, chunks.length - MAX_CHUNKS);

  return {
    selectedChunks,
    tokensUsed,
    chunksIncluded: selectedChunks.length,
    chunksExcluded,
    wasTruncated: chunksExcluded > 0,
  };
}

/**
 * Calculate budget usage for all context components.
 *
 * @param allocation - Budget allocation
 * @param usage - Actual usage per category
 * @returns BudgetUsage with detailed breakdown
 */
export function calculateBudgetUsage(
  allocation: BudgetAllocation,
  usage: {
    systemPrompt: number;
    userQuery: number;
    conversationHistory: number;
    retrievedChunks: number;
  }
): BudgetUsage {
  const totalUsed =
    usage.systemPrompt +
    usage.userQuery +
    usage.conversationHistory +
    usage.retrievedChunks;

  const totalAllocated =
    allocation.systemPrompt +
    allocation.userQuery +
    allocation.conversationHistory +
    allocation.retrievedChunks;

  const withinBudget = totalUsed <= totalAllocated;
  const utilizationPercent = (totalUsed / allocation.total) * 100;

  return {
    systemPrompt: {
      allocated: allocation.systemPrompt,
      used: usage.systemPrompt,
      remaining: Math.max(0, allocation.systemPrompt - usage.systemPrompt),
    },
    userQuery: {
      allocated: allocation.userQuery,
      used: usage.userQuery,
      remaining: Math.max(0, allocation.userQuery - usage.userQuery),
    },
    conversationHistory: {
      allocated: allocation.conversationHistory,
      used: usage.conversationHistory,
      remaining: Math.max(0, allocation.conversationHistory - usage.conversationHistory),
    },
    retrievedChunks: {
      allocated: allocation.retrievedChunks,
      used: usage.retrievedChunks,
      remaining: Math.max(0, allocation.retrievedChunks - usage.retrievedChunks),
    },
    responseBuffer: {
      allocated: allocation.responseBuffer,
      used: 0, // Response hasn't been generated yet
      remaining: allocation.responseBuffer,
    },
    total: {
      allocated: allocation.total,
      used: totalUsed,
      remaining: Math.max(0, allocation.total - totalUsed),
    },
    withinBudget,
    utilizationPercent: Math.min(100, utilizationPercent),
  };
}

/**
 * Plan context window usage for an LLM call.
 *
 * This is the main function that orchestrates all budgeting logic.
 *
 * @param input - ContextBudgetInput with all context components
 * @returns ContextBudgetResult with allocations and selected content
 */
export function planContextBudget(input: ContextBudgetInput): ContextBudgetResult {
  const {
    model,
    systemPrompt,
    userQuery,
    conversationHistory = '',
    chunks,
    language,
    safetyLevel = 'normal',
  } = input;

  const warnings: string[] = [];

  // Step 1: Calculate allocation
  const allocation = calculateBudgetAllocation(model, safetyLevel);

  // Step 2: Estimate token usage for fixed components
  const systemPromptTokens = estimateTokens(systemPrompt, language).tokens;
  const userQueryTokens = estimateTokens(userQuery, language).tokens;
  const conversationHistoryTokens = estimateTokens(conversationHistory, language).tokens;

  // Step 3: Handle over-budget fixed components
  let truncatedSystemPrompt: string | undefined;
  let truncatedConversationHistory: string | undefined;

  let finalSystemPromptTokens = systemPromptTokens;
  let finalConversationHistoryTokens = conversationHistoryTokens;

  // Truncate system prompt if needed
  if (systemPromptTokens > allocation.systemPrompt) {
    truncatedSystemPrompt = truncateToTokenBudget(systemPrompt, allocation.systemPrompt, language);
    finalSystemPromptTokens = estimateTokens(truncatedSystemPrompt, language).tokens;
    warnings.push(`System prompt truncated from ${systemPromptTokens} to ${finalSystemPromptTokens} tokens`);
  }

  // Truncate conversation history if needed
  if (conversationHistoryTokens > allocation.conversationHistory) {
    truncatedConversationHistory = truncateToTokenBudget(
      conversationHistory,
      allocation.conversationHistory,
      language
    );
    finalConversationHistoryTokens = estimateTokens(truncatedConversationHistory, language).tokens;
    warnings.push(
      `Conversation history truncated from ${conversationHistoryTokens} to ${finalConversationHistoryTokens} tokens`
    );
  }

  // Warn if user query is over budget (but don't truncate - user's question is sacred)
  if (userQueryTokens > allocation.userQuery) {
    warnings.push(`User query (${userQueryTokens} tokens) exceeds allocation (${allocation.userQuery})`);
  }

  // Step 4: Calculate remaining budget for chunks
  const usedByFixed = finalSystemPromptTokens + userQueryTokens + finalConversationHistoryTokens;
  const availableForChunks = Math.max(0, allocation.retrievedChunks);

  // Step 5: Select chunks within budget
  const selectedChunks = selectChunksWithinBudget(chunks, availableForChunks, language);

  if (selectedChunks.wasTruncated) {
    warnings.push(
      `Excluded ${selectedChunks.chunksExcluded} chunks due to token budget (included ${selectedChunks.chunksIncluded})`
    );
  }

  // Step 6: Calculate final usage
  const usage = calculateBudgetUsage(allocation, {
    systemPrompt: finalSystemPromptTokens,
    userQuery: userQueryTokens,
    conversationHistory: finalConversationHistoryTokens,
    retrievedChunks: selectedChunks.tokensUsed,
  });

  return {
    allocation,
    usage,
    selectedChunks,
    truncatedSystemPrompt,
    truncatedConversationHistory,
    warnings,
  };
}

/**
 * Quick check if content will fit in context window.
 *
 * @param model - Model name
 * @param totalTokens - Estimated total tokens
 * @param safetyLevel - Safety margin level
 * @returns true if content fits
 */
export function willFitInContext(
  model: string,
  totalTokens: number,
  safetyLevel: keyof typeof SAFETY_MARGINS = 'normal'
): boolean {
  const budget = getSafeTokenBudget(model, safetyLevel);
  return totalTokens <= budget;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  calculateBudgetAllocation,
  selectChunksWithinBudget,
  calculateBudgetUsage,
  planContextBudget,
  willFitInContext,
  DEFAULT_ALLOCATIONS,
  MIN_ALLOCATIONS,
  MAX_CHUNKS,
};
