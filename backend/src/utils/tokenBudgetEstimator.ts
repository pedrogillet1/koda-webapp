/**
 * Token Budget Estimator
 *
 * Provides fast, accurate token estimation for context window budgeting.
 * Uses word-based heuristics optimized for multilingual content.
 *
 * Key constants:
 * - 0.75 tokens per word (English average)
 * - 1.0 tokens per word (Portuguese/Spanish - more inflection)
 * - 4 chars per token fallback
 *
 * Used by: contextWindowBudgeting.ts, kodaRetrievalEngineV3.service.ts
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Tokens per word ratios by language family
 */
export const TOKENS_PER_WORD = {
  en: 0.75,      // English - shorter average words
  pt: 1.0,       // Portuguese - more inflection
  es: 1.0,       // Spanish - more inflection
  default: 0.85, // Default for unknown languages
} as const;

/**
 * Average characters per token (fallback when word count unreliable)
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Model context window limits
 */
export const MODEL_CONTEXT_LIMITS = {
  'gemini-1.5-flash': 1_000_000,
  'gemini-1.5-pro': 2_000_000,
  'gemini-2.0-flash': 1_000_000,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'claude-3-opus': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-haiku': 200_000,
  default: 128_000, // Conservative default
} as const;

/**
 * Safety margins for different use cases
 */
export const SAFETY_MARGINS = {
  strict: 0.80,   // Leave 20% buffer
  normal: 0.85,   // Leave 15% buffer
  relaxed: 0.90,  // Leave 10% buffer
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface TokenEstimate {
  tokens: number;
  method: 'word-based' | 'char-based' | 'hybrid';
  confidence: 'high' | 'medium' | 'low';
  language?: string;
}

export interface BudgetCheck {
  withinBudget: boolean;
  estimatedTokens: number;
  budgetLimit: number;
  remainingTokens: number;
  utilizationPercent: number;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Estimate token count for a text string.
 *
 * @param text - The text to estimate tokens for
 * @param language - ISO language code (en, pt, es) for better accuracy
 * @returns TokenEstimate with count and metadata
 */
export function estimateTokens(text: string, language?: string): TokenEstimate {
  if (!text || text.trim().length === 0) {
    return { tokens: 0, method: 'word-based', confidence: 'high' };
  }

  // Count words (split on whitespace)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Get language-specific ratio
  const lang = language?.toLowerCase().slice(0, 2) || 'default';
  const ratio = TOKENS_PER_WORD[lang as keyof typeof TOKENS_PER_WORD] || TOKENS_PER_WORD.default;

  // Word-based estimate
  const wordBasedTokens = Math.ceil(wordCount * ratio);

  // Character-based estimate (fallback)
  const charBasedTokens = Math.ceil(text.length / CHARS_PER_TOKEN);

  // Use hybrid approach for very short or very long texts
  let tokens: number;
  let method: TokenEstimate['method'];
  let confidence: TokenEstimate['confidence'];

  if (wordCount < 5) {
    // Very short text - use char-based
    tokens = charBasedTokens;
    method = 'char-based';
    confidence = 'medium';
  } else if (wordCount > 1000) {
    // Long text - use hybrid (average of both)
    tokens = Math.ceil((wordBasedTokens + charBasedTokens) / 2);
    method = 'hybrid';
    confidence = 'high';
  } else {
    // Normal text - use word-based
    tokens = wordBasedTokens;
    method = 'word-based';
    confidence = 'high';
  }

  return {
    tokens,
    method,
    confidence,
    language: lang !== 'default' ? lang : undefined,
  };
}

/**
 * Estimate tokens for an array of text chunks.
 *
 * @param chunks - Array of text strings
 * @param language - ISO language code
 * @returns Total token count
 */
export function estimateChunksTokens(chunks: string[], language?: string): number {
  return chunks.reduce((total, chunk) => {
    return total + estimateTokens(chunk, language).tokens;
  }, 0);
}

/**
 * Get the context window limit for a model.
 *
 * @param model - Model name or ID
 * @returns Context window size in tokens
 */
export function getModelContextLimit(model: string): number {
  // Normalize model name
  const normalizedModel = model.toLowerCase().replace(/[_-]/g, '-');

  // Check for exact match
  if (normalizedModel in MODEL_CONTEXT_LIMITS) {
    return MODEL_CONTEXT_LIMITS[normalizedModel as keyof typeof MODEL_CONTEXT_LIMITS];
  }

  // Check for partial match
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
      return limit;
    }
  }

  return MODEL_CONTEXT_LIMITS.default;
}

/**
 * Check if content fits within a token budget.
 *
 * @param text - Text to check
 * @param budgetLimit - Maximum tokens allowed
 * @param language - ISO language code
 * @returns BudgetCheck with detailed status
 */
export function checkBudget(text: string, budgetLimit: number, language?: string): BudgetCheck {
  const estimate = estimateTokens(text, language);
  const remainingTokens = budgetLimit - estimate.tokens;
  const utilizationPercent = (estimate.tokens / budgetLimit) * 100;

  return {
    withinBudget: estimate.tokens <= budgetLimit,
    estimatedTokens: estimate.tokens,
    budgetLimit,
    remainingTokens: Math.max(0, remainingTokens),
    utilizationPercent: Math.min(100, utilizationPercent),
  };
}

/**
 * Calculate safe token budget for a model with safety margin.
 *
 * @param model - Model name
 * @param safetyLevel - Safety margin level
 * @returns Safe token budget
 */
export function getSafeTokenBudget(
  model: string,
  safetyLevel: keyof typeof SAFETY_MARGINS = 'normal'
): number {
  const contextLimit = getModelContextLimit(model);
  const margin = SAFETY_MARGINS[safetyLevel];
  return Math.floor(contextLimit * margin);
}

/**
 * Truncate text to fit within token budget.
 *
 * @param text - Text to truncate
 * @param maxTokens - Maximum tokens allowed
 * @param language - ISO language code
 * @returns Truncated text
 */
export function truncateToTokenBudget(
  text: string,
  maxTokens: number,
  language?: string
): string {
  const estimate = estimateTokens(text, language);

  if (estimate.tokens <= maxTokens) {
    return text;
  }

  // Estimate how many characters we need to keep
  const ratio = maxTokens / estimate.tokens;
  const targetLength = Math.floor(text.length * ratio * 0.95); // 5% safety buffer

  // Find a good break point (end of sentence or paragraph)
  let truncated = text.slice(0, targetLength);

  // Try to end at sentence boundary
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);

  if (breakPoint > targetLength * 0.7) {
    truncated = truncated.slice(0, breakPoint + 1);
  }

  return truncated.trim();
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  estimateTokens,
  estimateChunksTokens,
  getModelContextLimit,
  checkBudget,
  getSafeTokenBudget,
  truncateToTokenBudget,
  TOKENS_PER_WORD,
  CHARS_PER_TOKEN,
  MODEL_CONTEXT_LIMITS,
  SAFETY_MARGINS,
};
