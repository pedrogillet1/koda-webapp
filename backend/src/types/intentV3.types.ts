/**
 * KODA V3 Intent Type Definitions
 *
 * Single source of truth for all intent names across the system.
 * These MUST match exactly with:
 * - JSON keys in intent_patterns.json
 * - Orchestrator switch cases
 * - Handler function names
 *
 * Based on: pasted_content_21.txt and pasted_content_22.txt specifications
 */

/**
 * All 25 supported intent types
 *
 * CRITICAL: Never add variations (e.g., DOCUMENT_QNA vs DOC_QA)
 * All caps with underscore only
 */
export type IntentName =
  // Document-related intents
  | 'DOC_QA'                    // Answer questions using uploaded documents
  | 'DOC_ANALYTICS'             // Counts, lists, statistics over documents
  | 'DOC_MANAGEMENT'            // Document actions (delete, tag, move, rename)
  | 'DOC_SEARCH'                // Search across documents
  | 'DOC_SUMMARIZE'             // Summarize documents or sections

  // User preferences and memory
  | 'PREFERENCE_UPDATE'         // User settings, language, tone, role, etc.
  | 'MEMORY_STORE'              // Store user context/information
  | 'MEMORY_RECALL'             // Recall stored user information

  // Meta-control over answers
  | 'ANSWER_REWRITE'            // Explain better, more details, simplify
  | 'ANSWER_EXPAND'             // Add more details to previous answer
  | 'ANSWER_SIMPLIFY'           // Make previous answer simpler

  // Feedback
  | 'FEEDBACK_POSITIVE'         // "Perfect", "Thanks", "That's right"
  | 'FEEDBACK_NEGATIVE'         // "Wrong", "Not in the file", "This is bad"

  // Product help and onboarding
  | 'PRODUCT_HELP'              // How to use Koda features
  | 'ONBOARDING_HELP'           // Getting started with Koda
  | 'FEATURE_REQUEST'           // User requesting new features

  // General knowledge and reasoning
  | 'GENERIC_KNOWLEDGE'         // World knowledge (non-Koda, non-user-doc)
  | 'REASONING_TASK'            // Math, logic, calculations
  | 'TEXT_TRANSFORM'            // Rewrite, translate, summarize text

  // Conversational
  | 'CHITCHAT'                  // Greetings, small talk
  | 'META_AI'                   // Questions about the AI itself

  // Edge cases and safety
  | 'OUT_OF_SCOPE'              // Harmful, illegal, or inappropriate requests
  | 'AMBIGUOUS'                 // Too vague, requires clarification
  | 'SAFETY_CONCERN'            // Safety-related content that needs careful handling
  | 'MULTI_INTENT'              // Multiple intents detected in one query
  | 'UNKNOWN';                  // Fallback when no intent matches

/**
 * Language codes supported by the system
 * MUST match JSON language keys exactly
 */
export type LanguageCode = 'en' | 'pt' | 'es';

/**
 * Confidence threshold for intent classification
 */
export const INTENT_CONFIDENCE_THRESHOLD = 0.5;
export const SECONDARY_INTENT_THRESHOLD = 0.4;

/**
 * Intent classification result
 */
export interface PredictedIntent {
  primaryIntent: IntentName;
  confidence: number;
  secondaryIntents?: Array<{
    name: IntentName;
    confidence: number;
  }>;
  language: LanguageCode;
  matchedPattern?: string;      // Which regex pattern matched (for debugging)
  matchedKeywords?: string[];   // Which keywords matched (for debugging)
  metadata?: Record<string, any>;
}

/**
 * Compiled intent pattern structure
 */
export interface CompiledIntentPattern {
  name: IntentName;
  keywordsByLang: Record<LanguageCode, string[]>;
  patternsByLang: Record<LanguageCode, RegExp[]>;
  priority: number;             // Higher priority wins in tie-breaking
  description?: string;         // Human-readable description
}

/**
 * Raw intent pattern from JSON (before compilation)
 */
export interface RawIntentPattern {
  keywords: Record<string, string[]>;
  patterns: Record<string, string[]>;
  priority?: number;
  description?: string;
}

/**
 * Intent definitions indexed by name
 */
export type IntentDefinitions = Record<IntentName, CompiledIntentPattern>;

/**
 * Intent classification request
 */
export interface IntentClassificationRequest {
  text: string;
  language?: LanguageCode;      // Auto-detected if not provided
  context?: {
    previousIntents?: IntentName[];
    conversationId?: string;
    userId?: string;
  };
}

/**
 * Intent handler response
 */
export interface IntentHandlerResponse {
  answer: string;
  formatted?: string;           // Formatted with markers
  metadata?: {
    intent?: IntentName;
    confidence?: number;
    documentsUsed?: number;
    tokensUsed?: number;
    processingTime?: number;
    // Multi-intent and override metadata
    overrideApplied?: boolean;
    multiIntent?: boolean;
    segmentCount?: number;
  };
  requiresFollowup?: boolean;
  suggestedActions?: string[];
}

/**
 * Fallback scenario keys
 * MUST match keys in fallbacks.json
 */
export type FallbackScenarioKey =
  | 'NO_DOCUMENTS'
  | 'OUT_OF_SCOPE'
  | 'AMBIGUOUS_QUESTION'
  | 'PRODUCT_HELP_ERROR'
  | 'RETRIEVAL_ERROR'
  | 'LLM_ERROR'
  | 'RATE_LIMIT'
  | 'UNSUPPORTED_INTENT';

/**
 * Fallback style IDs
 * MUST match style.id in fallbacks.json
 */
export type FallbackStyleId =
  | 'short_guidance'
  | 'one_liner'
  | 'detailed_explainer'
  | 'friendly_redirect'
  | 'technical_error';

/**
 * Answer style configuration
 */
export interface AnswerStyle {
  maxLength?: number;
  structure?: string[];         // e.g., ["statement", "actions_list", "example"]
  tone?: string;                // e.g., "friendly_concise", "professional", "casual"
  formatting?: {
    useTitles?: boolean;
    useSections?: boolean;
    useMarkers?: boolean;
  };
}

/**
 * System prompt configuration
 */
export interface SystemPromptConfig {
  base: string;
  persona?: string;
  constraints?: string[];
  examples?: Array<{
    user: string;
    assistant: string;
  }>;
}

/**
 * Intent routing configuration
 */
export interface IntentRoutingConfig {
  intent: IntentName;
  handler: string;              // Handler function name
  requiresDocuments?: boolean;
  requiresLLM?: boolean;
  requiresMemory?: boolean;
  fallbackScenario?: FallbackScenarioKey;
}
