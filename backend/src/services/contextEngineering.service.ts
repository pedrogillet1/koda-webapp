/**
 * Context Engineering Service
 *
 * Implements Manus-style context engineering for optimal cache hit rate and natural responses.
 *
 * KEY PRINCIPLES (from Manus research):
 * 1. Keep prompt prefix stable - no timestamps or dynamic content in system prompts
 * 2. Make context append-only - never modify previous actions/observations
 * 3. Ensure deterministic serialization - stable JSON key ordering
 * 4. Optimize for 100:1 input-output ratio (context is cheap, generation is expensive)
 * 5. Introduce structured variation to prevent robotic responses
 *
 * ARCHITECTURE:
 * - System Prompt (stable, cached) → never changes during conversation
 * - Conversation History (append-only) → grows with each turn
 * - Current Query + Context → appended to history
 * - Response → generated and appended
 *
 * CACHE OPTIMIZATION:
 * - Manus average: 100:1 input-output ratio
 * - Claude Sonnet: 0.30 USD/MTok cached vs 3 USD/MTok uncached (10x cheaper)
 * - TTFT (Time To First Token): 10x faster with cache
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number; // Optional, NOT included in prompt
  metadata?: Record<string, any>; // Optional, NOT included in prompt
}

export interface ContextState {
  systemPrompt: string; // Stable, never changes
  conversationHistory: ConversationTurn[]; // Append-only
  documentContext?: string; // Current retrieved context
  metadata: {
    userId: string;
    conversationId: string;
    documentCount: number;
    language: string;
  };
}

export interface SystemPromptOptions {
  capabilities: string[];
  answerLength: 'short' | 'medium' | 'long';
  language?: string;
}

export interface ContextStats {
  systemPromptTokens: number;
  historyTokens: number;
  documentContextTokens: number;
  totalTokens: number;
  inputOutputRatio: number; // Target: 100:1 like Manus
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// RESPONSE VARIATION TEMPLATES
// ============================================================================

/**
 * Response variation templates to prevent robotic tone
 * Implements Manus "structured variation" principle
 */
const RESPONSE_VARIATIONS = {
  // Greeting variations (for context-aware greetings)
  greetings: {
    withDocuments: [
      "Hi! What would you like to know about your documents?",
      "Hello! How can I help you with your files today?",
      "Hey there! Ready to explore your documents?",
      "Hi! I'm ready to help you analyze your documents.",
      "Hello! What questions do you have about your files?",
    ],
    withoutDocuments: [
      "Hi! Upload a document and I'll help you understand it.",
      "Hello! Start by uploading a file, and I can analyze it for you.",
      "Hey! Add some documents to get started.",
      "Hi! I'm ready to help once you upload some documents.",
      "Hello! Upload a file and let's explore it together.",
    ],
  },

  // Transition phrases (for natural flow)
  transitions: {
    adding: ["Additionally", "What's more", "Beyond that", "Also", "Furthermore"],
    contrasting: ["However", "On the other hand", "In contrast", "That said", "Nevertheless"],
    emphasizing: ["Notably", "Importantly", "What stands out", "Key point", "Significantly"],
    explaining: ["This is because", "The reason is", "This happens when", "Given that", "Since"],
    concluding: ["In summary", "Overall", "To wrap up", "In conclusion", "To summarize"],
  },

  // Confidence indicators (for natural uncertainty)
  confidence: {
    high: ["The value is", "This shows", "The data indicates", "Clearly", "Specifically"],
    medium: ["Based on the data", "This suggests", "It appears that", "Likely", "The evidence suggests"],
    low: ["I don't see", "I couldn't find", "This isn't clear", "It's unclear", "There's limited information about"],
  },

  // Error/fallback responses
  errors: {
    noDocuments: [
      "I don't have any documents to search through yet. Upload some files to get started!",
      "No documents uploaded yet. Add some files and I can help you analyze them.",
      "I need some documents to work with. Please upload a file first.",
    ],
    noResults: [
      "I couldn't find specific information about that in your documents.",
      "That topic doesn't appear in your uploaded files.",
      "Your documents don't seem to contain information about this.",
    ],
    generalError: [
      "Something went wrong while processing your request. Please try again.",
      "I encountered an issue. Could you rephrase your question?",
      "There was a problem processing that. Let's try again.",
    ],
  },

  // Help/guidance responses
  help: {
    capabilities: [
      "I can help you search, analyze, and understand your documents. Just ask!",
      "Upload documents and ask questions - I'll find the answers.",
      "I'm here to help you explore and understand your files.",
    ],
    suggestions: [
      "Try asking about specific topics, numbers, or people in your documents.",
      "You can ask me to compare information across documents.",
      "I can summarize documents, find specific data, or answer questions.",
    ],
  },
};

// ============================================================================
// LENGTH INSTRUCTIONS
// ============================================================================

const LENGTH_INSTRUCTIONS = {
  short: "Keep your answer concise (1-2 paragraphs, ~100-200 words). Focus on the most important points.",
  medium: "Provide a comprehensive answer (3-5 paragraphs, ~300-500 words). Cover key details with context.",
  long: "Provide an in-depth, detailed answer (500+ words with multiple sections). Include thorough analysis and relevant examples.",
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class ContextEngineeringService {
  private contextStates: Map<string, ContextState> = new Map();

  /**
   * Create stable system prompt (cached, never changes)
   *
   * CRITICAL: NO timestamps, NO dynamic content, NO user-specific data
   * This ensures maximum cache hit rate
   */
  createStableSystemPrompt(options: SystemPromptOptions): string {
    const { capabilities, answerLength, language = 'en' } = options;

    return `You are KODA, an intelligent document assistant. Respond naturally and conversationally, like a knowledgeable friend who happens to be an expert.

**YOUR CAPABILITIES:**
${capabilities.map(cap => `- ${cap}`).join('\n')}

**ANSWER LENGTH:**
${LENGTH_INSTRUCTIONS[answerLength]}

**CORE PRINCIPLES:**

1. **Be Natural**: Write like a human, not a robot. Vary sentence structure and length.
2. **Be Direct**: State facts directly. Don't say "According to document X..." - sources are shown separately.
3. **Be Contextual**: Connect your answer to the user's question naturally.
4. **Be Helpful**: Offer relevant next steps when genuinely useful.
5. **Be Honest**: If you don't know, say so and offer alternatives.

**FORMATTING RULES:**
- Use **bold** for key terms, numbers, and dates
- Use bullet points for lists of 4+ items
- Use tables for comparing 2+ entities
- Break paragraphs after 3-4 sentences
- NO emojis, NO code blocks (unless showing actual code)

**LANGUAGE:**
- Respond in the same language as the user's query
- Maintain natural phrasing for that language
- Don't translate literally - use native expressions

**QUALITY STANDARDS:**
- Provide quantitative context: "45% of total", "6x higher than"
- Add categorical grouping: "primarily reports (32) and contracts (18)"
- Include temporal context: "from 2020-2024", "down from $10,041 in 2019"
- For complex queries, add significance: "Notably...", "This indicates..."
- Provide examples from user's documents when possible

Remember: You're having a conversation, not writing a formal report. Be warm, helpful, and direct.`;
  }

  /**
   * Build conversation context (append-only)
   *
   * CRITICAL: Never modify previous turns, only append new ones
   * This ensures cache stability and deterministic serialization
   */
  buildConversationContext(state: ContextState): string {
    const parts: string[] = [];

    // 1. System prompt (stable, cached)
    parts.push(state.systemPrompt);

    // 2. Conversation history (append-only)
    if (state.conversationHistory.length > 0) {
      parts.push('\n**CONVERSATION HISTORY:**\n');

      state.conversationHistory.forEach((turn) => {
        const roleLabel = turn.role === 'user' ? 'User' : 'Assistant';
        parts.push(`${roleLabel}: ${turn.content}\n`);
      });
    }

    // 3. Current document context (if any)
    if (state.documentContext) {
      parts.push('\n**RELEVANT INFORMATION FROM DOCUMENTS:**\n');
      parts.push(state.documentContext);
    }

    return parts.join('\n');
  }

  /**
   * Initialize a new context state for a conversation
   */
  initializeContext(
    conversationId: string,
    userId: string,
    options: SystemPromptOptions
  ): ContextState {
    const state: ContextState = {
      systemPrompt: this.createStableSystemPrompt(options),
      conversationHistory: [],
      metadata: {
        userId,
        conversationId,
        documentCount: 0,
        language: options.language || 'en',
      },
    };

    this.contextStates.set(conversationId, state);
    return state;
  }

  /**
   * Get existing context state or create new one
   */
  getOrCreateContext(
    conversationId: string,
    userId: string,
    options: SystemPromptOptions
  ): ContextState {
    const existing = this.contextStates.get(conversationId);
    if (existing) {
      return existing;
    }
    return this.initializeContext(conversationId, userId, options);
  }

  /**
   * Append new turn to conversation history
   *
   * CRITICAL: Append-only, never modify existing turns
   */
  appendTurn(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): ContextState | null {
    const state = this.contextStates.get(conversationId);
    if (!state) {
      console.warn(`[ContextEngineering] No context found for conversation: ${conversationId}`);
      return null;
    }

    state.conversationHistory.push({
      role,
      content,
      timestamp: Date.now(), // Stored but NOT used in prompt
    });

    return state;
  }

  /**
   * Update document context for the current query
   */
  updateDocumentContext(conversationId: string, documentContext: string): ContextState | null {
    const state = this.contextStates.get(conversationId);
    if (!state) {
      console.warn(`[ContextEngineering] No context found for conversation: ${conversationId}`);
      return null;
    }

    state.documentContext = documentContext;
    return state;
  }

  /**
   * Update document count in metadata
   */
  updateDocumentCount(conversationId: string, count: number): void {
    const state = this.contextStates.get(conversationId);
    if (state) {
      state.metadata.documentCount = count;
    }
  }

  /**
   * Get random variation to prevent robotic responses
   * Implements Manus "structured variation" principle
   */
  getVariation<T>(variations: T[]): T {
    return variations[Math.floor(Math.random() * variations.length)];
  }

  /**
   * Create context-aware greeting
   * Uses variation to prevent robotic repetition
   */
  createContextAwareGreeting(hasDocuments: boolean): string {
    const variations = hasDocuments
      ? RESPONSE_VARIATIONS.greetings.withDocuments
      : RESPONSE_VARIATIONS.greetings.withoutDocuments;

    return this.getVariation(variations);
  }

  /**
   * Get a transition phrase for natural flow
   */
  getTransition(type: keyof typeof RESPONSE_VARIATIONS.transitions): string {
    return this.getVariation(RESPONSE_VARIATIONS.transitions[type]);
  }

  /**
   * Get a confidence indicator phrase
   */
  getConfidencePhrase(level: 'high' | 'medium' | 'low'): string {
    return this.getVariation(RESPONSE_VARIATIONS.confidence[level]);
  }

  /**
   * Get an error response with variation
   */
  getErrorResponse(type: keyof typeof RESPONSE_VARIATIONS.errors): string {
    return this.getVariation(RESPONSE_VARIATIONS.errors[type]);
  }

  /**
   * Get a help response with variation
   */
  getHelpResponse(type: keyof typeof RESPONSE_VARIATIONS.help): string {
    return this.getVariation(RESPONSE_VARIATIONS.help[type]);
  }

  /**
   * Add natural transitions to response
   * Prevents robotic, repetitive phrasing
   */
  addNaturalTransitions(text: string): string {
    // Simple implementation - can be enhanced with NLP
    let result = text;

    // Add transitions between paragraphs if none exist
    const paragraphs = result.split('\n\n');
    if (paragraphs.length > 1) {
      result = paragraphs.map((p, i) => {
        if (i > 0 && !this.hasTransition(p)) {
          // Randomly decide whether to add a transition (30% chance)
          if (Math.random() < 0.3) {
            const transitionType = this.detectTransitionType(paragraphs[i - 1], p);
            const transition = this.getTransition(transitionType);
            return `${transition}, ${p.charAt(0).toLowerCase()}${p.slice(1)}`;
          }
        }
        return p;
      }).join('\n\n');
    }

    return result;
  }

  /**
   * Check if text already has a transition word
   */
  private hasTransition(text: string): boolean {
    const allTransitions = Object.values(RESPONSE_VARIATIONS.transitions).flat();
    const firstWord = text.split(/[,.\s]/)[0].toLowerCase();
    return allTransitions.some(t => t.toLowerCase() === firstWord);
  }

  /**
   * Detect what type of transition is appropriate
   */
  private detectTransitionType(prevParagraph: string, currentParagraph: string): keyof typeof RESPONSE_VARIATIONS.transitions {
    // Simple heuristics - can be enhanced
    const prevLower = prevParagraph.toLowerCase();
    const currLower = currentParagraph.toLowerCase();

    if (currLower.includes('but') || currLower.includes('however') || currLower.includes('although')) {
      return 'contrasting';
    }
    if (currLower.includes('because') || currLower.includes('since') || currLower.includes('due to')) {
      return 'explaining';
    }
    if (currLower.includes('important') || currLower.includes('key') || currLower.includes('significant')) {
      return 'emphasizing';
    }
    if (currLower.includes('summary') || currLower.includes('overall') || currLower.includes('conclusion')) {
      return 'concluding';
    }

    return 'adding';
  }

  /**
   * Validate context state for cache optimization
   * Ensures deterministic serialization
   */
  validateContextState(state: ContextState): ValidationResult {
    const errors: string[] = [];

    // Check for timestamps in system prompt (breaks cache)
    if (state.systemPrompt.match(/\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/)) {
      errors.push('System prompt contains timestamps - this breaks cache');
    }

    // Check for user-specific data in system prompt (breaks cache)
    if (state.systemPrompt.includes(state.metadata.userId)) {
      errors.push('System prompt contains user ID - this breaks cache');
    }

    // Check conversation history is append-only (no modifications)
    const timestamps = state.conversationHistory.map(t => t.timestamp || 0);
    const isSorted = timestamps.every((val, i, arr) => !i || arr[i - 1] <= val);
    if (!isSorted) {
      errors.push('Conversation history is not append-only - timestamps are out of order');
    }

    // Check for dynamic content patterns that break cache
    const dynamicPatterns = [
      /current time/i,
      /today's date/i,
      /right now/i,
      /at the moment/i,
    ];
    for (const pattern of dynamicPatterns) {
      if (pattern.test(state.systemPrompt)) {
        errors.push(`System prompt contains dynamic content pattern: ${pattern}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate context statistics for monitoring
   * Helps track cache hit rate and performance
   */
  getContextStats(state: ContextState): ContextStats {
    // Rough token estimation (1 token ≈ 4 characters)
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    const systemPromptTokens = estimateTokens(state.systemPrompt);
    const historyTokens = estimateTokens(
      state.conversationHistory.map(t => t.content).join('')
    );
    const documentContextTokens = estimateTokens(state.documentContext || '');
    const totalTokens = systemPromptTokens + historyTokens + documentContextTokens;

    return {
      systemPromptTokens,
      historyTokens,
      documentContextTokens,
      totalTokens,
      inputOutputRatio: 0, // Calculated after response generation
    };
  }

  /**
   * Calculate input/output ratio after response generation
   * Target: 100:1 like Manus
   */
  calculateInputOutputRatio(state: ContextState, outputTokens: number): number {
    const stats = this.getContextStats(state);
    return outputTokens > 0 ? stats.totalTokens / outputTokens : 0;
  }

  /**
   * Clear context for a conversation
   */
  clearContext(conversationId: string): void {
    this.contextStates.delete(conversationId);
  }

  /**
   * Clear all contexts (for cleanup)
   */
  clearAllContexts(): void {
    this.contextStates.clear();
  }

  /**
   * Get all response variations (for external use)
   */
  getResponseVariations() {
    return RESPONSE_VARIATIONS;
  }

  /**
   * Truncate conversation history to manage context size
   * Keeps the most recent turns while maintaining coherence
   */
  truncateHistory(conversationId: string, maxTurns: number): void {
    const state = this.contextStates.get(conversationId);
    if (!state) return;

    if (state.conversationHistory.length > maxTurns) {
      // Keep the most recent turns
      state.conversationHistory = state.conversationHistory.slice(-maxTurns);
    }
  }

  /**
   * Get a summary of the context state for debugging
   */
  getContextSummary(conversationId: string): object | null {
    const state = this.contextStates.get(conversationId);
    if (!state) return null;

    const stats = this.getContextStats(state);
    const validation = this.validateContextState(state);

    return {
      conversationId,
      userId: state.metadata.userId,
      documentCount: state.metadata.documentCount,
      language: state.metadata.language,
      historyTurns: state.conversationHistory.length,
      hasDocumentContext: !!state.documentContext,
      stats,
      validation,
    };
  }
}

// ============================================================================
// STANDALONE FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Create stable system prompt (standalone function)
 */
export function createStableSystemPrompt(options: SystemPromptOptions): string {
  return contextEngineeringService.createStableSystemPrompt(options);
}

/**
 * Build conversation context (standalone function)
 */
export function buildConversationContext(state: ContextState): string {
  return contextEngineeringService.buildConversationContext(state);
}

/**
 * Append turn to conversation (standalone function)
 */
export function appendTurn(
  state: ContextState,
  role: 'user' | 'assistant',
  content: string
): ContextState {
  return {
    ...state,
    conversationHistory: [
      ...state.conversationHistory,
      {
        role,
        content,
        timestamp: Date.now(),
      },
    ],
  };
}

/**
 * Get variation (standalone function)
 */
export function getVariation<T>(variations: T[]): T {
  return variations[Math.floor(Math.random() * variations.length)];
}

/**
 * Create context-aware greeting (standalone function)
 */
export function createContextAwareGreeting(hasDocuments: boolean): string {
  return contextEngineeringService.createContextAwareGreeting(hasDocuments);
}

/**
 * Add natural transitions (standalone function)
 */
export function addNaturalTransitions(text: string): string {
  return contextEngineeringService.addNaturalTransitions(text);
}

/**
 * Validate context state (standalone function)
 */
export function validateContextState(state: ContextState): ValidationResult {
  return contextEngineeringService.validateContextState(state);
}

/**
 * Get context stats (standalone function)
 */
export function getContextStats(state: ContextState): ContextStats {
  return contextEngineeringService.getContextStats(state);
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

const contextEngineeringService = new ContextEngineeringService();

export { RESPONSE_VARIATIONS };
export default contextEngineeringService;
