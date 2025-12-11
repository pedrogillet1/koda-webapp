/**
 * KODA INTENT CLASSIFICATION SYSTEM V2
 * Production-Ready Intent Types with Complete Pattern-Based Classification
 * 
 * This replaces the old intent system with a ChatGPT-level classification engine
 * that uses pattern matching FIRST, LLM classification ONLY when necessary.
 * 
 * Generated from comprehensive keyword and pattern database
 * Languages: EN, PT-BR, ES
 */

// ============================================================================
// PRIMARY INTENT TYPES
// ============================================================================

export enum PrimaryIntent {
  // Document-Related Intents
  DOC_QA = 'DOC_QA',                           // Questions about document content
  DOC_ANALYTICS = 'DOC_ANALYTICS',             // Counts, lists, statistics
  DOC_MANAGEMENT = 'DOC_MANAGEMENT',           // File actions (delete, rename, move, tag)
  
  // User Interaction Intents
  PREFERENCE_UPDATE = 'PREFERENCE_UPDATE',     // Update user settings/preferences
  ANSWER_REWRITE = 'ANSWER_REWRITE',           // Meta-control of previous answer
  FEEDBACK_POSITIVE = 'FEEDBACK_POSITIVE',     // Positive feedback
  FEEDBACK_NEGATIVE = 'FEEDBACK_NEGATIVE',     // Negative feedback
  
  // Product & Help Intents
  PRODUCT_HELP = 'PRODUCT_HELP',               // How to use Koda
  ONBOARDING_HELP = 'ONBOARDING_HELP',         // Getting started with Koda
  
  // General Knowledge Intents
  GENERIC_KNOWLEDGE = 'GENERIC_KNOWLEDGE',     // World facts, general knowledge
  REASONING_TASK = 'REASONING_TASK',           // Math, logic, calculations
  TEXT_TRANSFORM = 'TEXT_TRANSFORM',           // Rewrite, translate, transform text
  
  // Conversation Intents
  CHITCHAT = 'CHITCHAT',                       // Greetings, small talk
  META_AI = 'META_AI',                         // Questions about the AI itself
  
  // Fallback Intents
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',               // Harmful, illegal, or inappropriate
  AMBIGUOUS = 'AMBIGUOUS'                      // Too vague to classify
}

// ============================================================================
// KNOWLEDGE SOURCE TYPES
// ============================================================================

export enum KnowledgeSource {
  DOCUMENTS_ONLY = 'DOCUMENTS_ONLY',           // Use only user documents
  PRODUCT_KB = 'PRODUCT_KB',                   // Use Koda product knowledge base
  INTERNAL_RULES_ONLY = 'INTERNAL_RULES_ONLY', // Use only internal rules/logic
  NONE = 'NONE'                                // No knowledge source needed
}

// ============================================================================
// RAG MODE TYPES
// ============================================================================

export enum RAGMode {
  NO_RAG = 'NO_RAG',                           // No RAG needed
  LIGHT_RAG = 'LIGHT_RAG',                     // Light RAG (few chunks)
  FULL_RAG = 'FULL_RAG'                        // Full RAG (many chunks)
}

// ============================================================================
// ANSWER STYLE TYPES
// ============================================================================

export enum AnswerStyle {
  FACTUAL_SHORT = 'FACTUAL_SHORT',             // Brief factual answer
  INSTRUCTIONAL_STEPS = 'INSTRUCTIONAL_STEPS', // Step-by-step instructions
  EXPLANATORY_PARAGRAPH = 'EXPLANATORY_PARAGRAPH', // Detailed explanation
  ANALYTICAL_DETAILED = 'ANALYTICAL_DETAILED', // Deep analytical answer
  DIALOGUE_CHITCHAT = 'DIALOGUE_CHITCHAT',     // Conversational response
  STRUCTURED_LIST = 'STRUCTURED_LIST'          // Structured list/table
}

// ============================================================================
// TARGET DOCUMENT SCOPE
// ============================================================================

export enum TargetDocumentScope {
  BY_NAME = 'BY_NAME',                         // Specific document by name
  BY_FOLDER = 'BY_FOLDER',                     // Documents in specific folder
  BY_TAG = 'BY_TAG',                           // Documents with specific tag
  BY_TYPE = 'BY_TYPE',                         // Documents of specific type
  BY_DATE = 'BY_DATE',                         // Documents by date range
  BY_CONTENT = 'BY_CONTENT',                   // Documents containing specific content
  ALL_DOCUMENTS = 'ALL_DOCUMENTS'              // All user documents
}

// ============================================================================
// REASONING FLAGS
// ============================================================================

export interface ReasoningFlags {
  requiresNumericReasoning: boolean;           // Needs math/calculations
  requiresComparison: boolean;                 // Needs comparison logic
  requiresTimeline: boolean;                   // Needs temporal reasoning
  requiresExtraction: boolean;                 // Needs data extraction
  requiresMemoryWrite: boolean;                // Needs to remember something
}

// ============================================================================
// FALLBACK TYPES
// ============================================================================

export enum FallbackType {
  NO_DOCUMENTS = 'NO_DOCUMENTS',               // User has no documents
  DOC_NOT_FOUND = 'DOC_NOT_FOUND',             // Specific document not found
  NOT_ENOUGH_CONTEXT = 'NOT_ENOUGH_CONTEXT',   // Insufficient context in documents
  OUT_OF_SCOPE = 'OUT_OF_SCOPE',               // Query out of scope
  SAFETY_BLOCKED = 'SAFETY_BLOCKED',           // Blocked for safety reasons
  AMBIGUOUS = 'AMBIGUOUS',                     // Query too ambiguous
  FEATURE_NOT_SUPPORTED = 'FEATURE_NOT_SUPPORTED' // Feature not yet supported
}

// ============================================================================
// TEMPORAL EXPRESSION TYPES
// ============================================================================

export enum TemporalExpressionType {
  ABSOLUTE_DATE = 'ABSOLUTE_DATE',             // Specific date (e.g., "March 15, 2024")
  RELATIVE_DATE = 'RELATIVE_DATE',             // Relative date (e.g., "last week")
  DATE_RANGE = 'DATE_RANGE',                   // Date range (e.g., "January to March")
  RECURRING = 'RECURRING',                     // Recurring (e.g., "every Monday")
  DURATION = 'DURATION'                        // Duration (e.g., "for 3 months")
}

// ============================================================================
// CONTEXT PATTERN TYPES
// ============================================================================

export enum ContextPatternType {
  PRONOUN_RESOLUTION = 'PRONOUN_RESOLUTION',   // Needs pronoun resolution
  FOLLOW_UP = 'FOLLOW_UP',                     // Follow-up question
  REFERENCE_PREVIOUS = 'REFERENCE_PREVIOUS'    // References previous conversation
}

// ============================================================================
// DOCUMENT TAG DIMENSIONS
// ============================================================================

export interface DocumentTags {
  fileMetadata?: string[];                     // File type, size, date
  documentType?: string[];                     // Contract, invoice, report, etc.
  domainTopic?: string[];                      // Finance, legal, HR, etc.
  entityProject?: string[];                    // Company names, project names
  sensitivity?: string[];                      // Public, confidential, internal
  status?: string[];                           // Draft, final, approved, archived
  language?: string[];                         // EN, PT, ES, etc.
}

// ============================================================================
// COMPLETE INTENT CLASSIFICATION RESULT
// ============================================================================

export interface IntentClassification {
  // Primary classification
  primaryIntent: PrimaryIntent;
  confidence: number;                          // 0.0 to 1.0
  
  // Classification metadata
  wasClassifiedByRules: boolean;               // true if pattern-matched
  requiresLLMIntent: boolean;                  // true if LLM needed for refinement
  requiresRAG: boolean;                        // true if RAG retrieval needed
  requiresLLM: boolean;                        // true if LLM answer generation needed
  
  // Knowledge and retrieval
  knowledgeSource: KnowledgeSource;
  ragMode: RAGMode;
  targetDocumentScope: TargetDocumentScope;
  
  // Answer configuration
  answerStyle: AnswerStyle;
  reasoningFlags: ReasoningFlags;
  
  // Document targeting
  targetDocumentName?: string;                 // Specific document name mentioned
  targetDocumentId?: string;                   // Resolved document ID
  targetFolder?: string;                       // Specific folder mentioned
  targetTags?: string[];                       // Specific tags mentioned
  targetDocumentType?: string;                 // Specific file type (pdf, docx, etc.)
  
  // Temporal information
  temporalExpression?: {
    type: TemporalExpressionType;
    value: string;
    parsedDate?: Date;
    parsedDateRange?: { start: Date; end: Date };
  };
  
  // Context information
  contextPattern?: ContextPatternType;
  referencedMessageId?: string;                // ID of referenced message
  
  // Extracted entities
  entities: {
    documentNames?: string[];
    folderNames?: string[];
    tags?: string[];
    dates?: string[];
    numbers?: number[];
    keywords?: string[];
  };
  
  // Fallback information
  fallbackType?: FallbackType;
  fallbackReason?: string;
  
  // Debug information
  matchedPatterns?: string[];                  // Which patterns matched
  matchedKeywords?: string[];                  // Which keywords matched
  classificationTimeMs?: number;               // Time taken to classify
}

// ============================================================================
// INTENT CATEGORY MAPPING
// ============================================================================

export const INTENT_REQUIRES_RAG: Record<PrimaryIntent, boolean> = {
  [PrimaryIntent.DOC_QA]: true,
  [PrimaryIntent.DOC_ANALYTICS]: false,
  [PrimaryIntent.DOC_MANAGEMENT]: false,
  [PrimaryIntent.PREFERENCE_UPDATE]: false,
  [PrimaryIntent.ANSWER_REWRITE]: false,
  [PrimaryIntent.FEEDBACK_POSITIVE]: false,
  [PrimaryIntent.FEEDBACK_NEGATIVE]: false,
  [PrimaryIntent.PRODUCT_HELP]: false,
  [PrimaryIntent.ONBOARDING_HELP]: false,
  [PrimaryIntent.GENERIC_KNOWLEDGE]: false,
  [PrimaryIntent.REASONING_TASK]: false,
  [PrimaryIntent.TEXT_TRANSFORM]: false,
  [PrimaryIntent.CHITCHAT]: false,
  [PrimaryIntent.META_AI]: false,
  [PrimaryIntent.OUT_OF_SCOPE]: false,
  [PrimaryIntent.AMBIGUOUS]: false
};

export const INTENT_REQUIRES_LLM: Record<PrimaryIntent, boolean> = {
  [PrimaryIntent.DOC_QA]: true,
  [PrimaryIntent.DOC_ANALYTICS]: false,
  [PrimaryIntent.DOC_MANAGEMENT]: false,
  [PrimaryIntent.PREFERENCE_UPDATE]: false,
  [PrimaryIntent.ANSWER_REWRITE]: true,
  [PrimaryIntent.FEEDBACK_POSITIVE]: false,
  [PrimaryIntent.FEEDBACK_NEGATIVE]: false,
  [PrimaryIntent.PRODUCT_HELP]: true,
  [PrimaryIntent.ONBOARDING_HELP]: true,
  [PrimaryIntent.GENERIC_KNOWLEDGE]: true,
  [PrimaryIntent.REASONING_TASK]: true,
  [PrimaryIntent.TEXT_TRANSFORM]: true,
  [PrimaryIntent.CHITCHAT]: true,
  [PrimaryIntent.META_AI]: true,
  [PrimaryIntent.OUT_OF_SCOPE]: false,
  [PrimaryIntent.AMBIGUOUS]: false
};

export const INTENT_KNOWLEDGE_SOURCE: Record<PrimaryIntent, KnowledgeSource> = {
  [PrimaryIntent.DOC_QA]: KnowledgeSource.DOCUMENTS_ONLY,
  [PrimaryIntent.DOC_ANALYTICS]: KnowledgeSource.INTERNAL_RULES_ONLY,
  [PrimaryIntent.DOC_MANAGEMENT]: KnowledgeSource.INTERNAL_RULES_ONLY,
  [PrimaryIntent.PREFERENCE_UPDATE]: KnowledgeSource.INTERNAL_RULES_ONLY,
  [PrimaryIntent.ANSWER_REWRITE]: KnowledgeSource.INTERNAL_RULES_ONLY,
  [PrimaryIntent.FEEDBACK_POSITIVE]: KnowledgeSource.NONE,
  [PrimaryIntent.FEEDBACK_NEGATIVE]: KnowledgeSource.NONE,
  [PrimaryIntent.PRODUCT_HELP]: KnowledgeSource.PRODUCT_KB,
  [PrimaryIntent.ONBOARDING_HELP]: KnowledgeSource.PRODUCT_KB,
  [PrimaryIntent.GENERIC_KNOWLEDGE]: KnowledgeSource.NONE,
  [PrimaryIntent.REASONING_TASK]: KnowledgeSource.NONE,
  [PrimaryIntent.TEXT_TRANSFORM]: KnowledgeSource.NONE,
  [PrimaryIntent.CHITCHAT]: KnowledgeSource.NONE,
  [PrimaryIntent.META_AI]: KnowledgeSource.PRODUCT_KB,
  [PrimaryIntent.OUT_OF_SCOPE]: KnowledgeSource.NONE,
  [PrimaryIntent.AMBIGUOUS]: KnowledgeSource.NONE
};
