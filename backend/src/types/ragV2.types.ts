/**
 * Koda V2 - Extended Type System
 *
 * Extends V1 types with all 25 categories:
 * - Categories 1-16: Intent types
 * - Categories 17-25: Classification dimensions
 */

import type {
  IntentClassification,
  QueryScope,
  RagStatus as RagStatusV1,
  ConversationContext,
  Citation,
  AnswerType as AnswerTypeV1,
  ConversationTurn,
  SourceDocument,
  RetrievedChunk,
  RagContext as RagContextV1,
} from './ragV1.types';

// Re-export V1 types that are unchanged
export type {
  QueryScope,
  ConversationContext,
  Citation,
  ConversationTurn,
  SourceDocument,
  RetrievedChunk,
};

// ============================================================================
// Extended Domain Types (Categories 1-16)
// ============================================================================

export type QueryDomain =
  | 'analytics'           // Category 2: DOC_ANALYTICS
  | 'doc_content'         // Category 1: DOC_QA
  | 'doc_search'          // Category 3: DOC_SEARCH
  | 'doc_management'      // Category 4: DOC_MANAGEMENT
  | 'chitchat'            // Category 13: CHITCHAT
  | 'meta_ai'             // Category 14: META_AI
  | 'preference_update'   // Category 5: PREFERENCE_UPDATE
  | 'answer_rewrite'      // Category 6: ANSWER_REWRITE
  | 'feedback'            // Category 7: FEEDBACK
  | 'product_help'        // Category 8: PRODUCT_HELP
  | 'onboarding'          // Category 9: ONBOARDING
  | 'generic_knowledge'   // Category 10: GENERIC_KNOWLEDGE
  | 'reasoning_task'      // Category 11: REASONING_TASK
  | 'text_transform'      // Category 12: TEXT_TRANSFORM
  | 'out_of_scope'        // Category 15: OUT_OF_SCOPE
  | 'ambiguous';          // Category 16: AMBIGUOUS

export type QuestionType =
  // Analytics (Category 2)
  | 'doc_count'
  | 'doc_list'
  | 'type_distribution'
  | 'recent_docs'
  | 'folder_stats'
  // Doc Content (Category 1)
  | 'simple_factual'
  | 'multi_point_extraction'
  | 'comparison'
  | 'follow_up'
  | 'summary_request'
  | 'definition_lookup'
  // Search (Category 3)
  | 'document_filter'
  | 'keyword_search'
  | 'semantic_search'
  // Social (Categories 13-14)
  | 'greeting'
  | 'capability'
  | 'generic_chat'
  | 'thanks'
  | 'goodbye'
  // Other
  | 'calculation'
  | 'translation'
  | 'rewrite';

// ============================================================================
// Category 17: KNOWLEDGE_SOURCE
// ============================================================================

export type KnowledgeSource =
  | 'DOCUMENTS_ONLY'      // Answer from user's documents
  | 'PRODUCT_KB'          // Answer from Koda knowledge base
  | 'INTERNAL_RULES_ONLY' // Answer from internal rules (e.g., formatting)
  | 'NONE';               // No external knowledge needed

// ============================================================================
// Category 18: RAG_MODE
// ============================================================================

export type RagMode =
  | 'NO_RAG'              // Skip RAG (chitchat, meta, analytics)
  | 'SINGLE_DOC_RAG'      // Single document retrieval
  | 'MULTI_DOC_RAG';      // Multiple document retrieval

// ============================================================================
// Category 19: ANSWER_STYLE
// ============================================================================

export type AnswerStyle =
  | 'CONVERSATIONAL'      // Natural language response
  | 'BULLET_LIST'         // Bulleted list
  | 'STRUCTURED_DATA'     // Structured data (tables, JSON-like)
  | 'COMPARATIVE'         // Side-by-side comparison
  | 'STEP_BY_STEP'        // Sequential steps
  | 'TECHNICAL';          // Technical/formal style

// ============================================================================
// Category 20: TARGET_DOCUMENTS
// ============================================================================

export type TargetDocuments =
  | 'EXPLICIT_SINGLE'     // User specified one document by name
  | 'EXPLICIT_MULTI'      // User specified multiple documents by name
  | 'ALL_USER_DOCS'       // Search all user's documents
  | 'FOLDER_SCOPED'       // Scoped to a folder
  | 'TAG_FILTERED'        // Filtered by tags
  | 'DATE_RANGE'          // Filtered by date range
  | 'CONTEXT_INFERRED';   // Inferred from conversation context

// ============================================================================
// Category 21: REASONING_FLAGS
// ============================================================================

export interface ReasoningFlags {
  needsCalculation: boolean;   // Math operations needed
  needsComparison: boolean;    // Comparing values/docs
  needsAggregation: boolean;   // Aggregating data (counts, sums)
  needsInference: boolean;     // Logical inference needed
  needsMultiStep: boolean;     // Multi-step reasoning
}

// ============================================================================
// Category 22: FALLBACK_TYPES (Extended)
// ============================================================================

export type FallbackType =
  | 'NO_DOCUMENTS'         // User has no documents
  | 'NO_MATCH'             // No matching content found
  | 'NO_MATCH_SINGLE_DOC'  // No match in specific document
  | 'DOC_NOT_FOUND_BY_NAME'// Document name not resolved
  | 'PROCESSING'           // Document still processing
  | 'AMBIGUOUS_QUERY'      // Query too vague
  | 'ERROR_GENERIC';       // Generic error

// ============================================================================
// Category 23: TEMPORAL_EXPRESSIONS
// ============================================================================

export type TemporalExpression =
  | 'ABSOLUTE_DATE'        // Specific date: "January 15, 2024"
  | 'RELATIVE_PAST'        // "last week", "yesterday"
  | 'RELATIVE_FUTURE'      // "next month", "tomorrow"
  | 'DATE_RANGE'           // "between X and Y"
  | 'RECURRING';           // "every month", "weekly"

// ============================================================================
// Category 24: CONTEXT_PATTERNS
// ============================================================================

export type ContextPattern =
  | 'NEW_TOPIC'            // New conversation topic
  | 'FOLLOW_UP'            // Follow-up question ("and also...")
  | 'CONTINUATION';        // Continuing previous topic

// ============================================================================
// Category 25: DOCUMENT_TAGS
// ============================================================================

export interface DocumentTags {
  fileType: string | null;     // PDF, DOCX, etc.
  topic: string | null;        // Detected topic
  folder: string | null;       // Folder reference
  dateRange: string | null;    // Date filter
  author: string | null;       // Author filter
  status: string | null;       // Processing status
  priority: string | null;     // Priority level
}

// ============================================================================
// Extended Intent Classification (V2)
// ============================================================================

export interface IntentClassificationV2 extends Omit<IntentClassification, 'domain' | 'questionType'> {
  // Override domain with V2 extended type
  domain: QueryDomain;
  questionType: QuestionType;

  // Categories 17-25 (New in V2)
  knowledgeSource: KnowledgeSource;
  ragMode: RagMode;
  answerStyle: AnswerStyle;
  targetDocuments: TargetDocuments;
  reasoningFlags: ReasoningFlags;
  fallbackType: FallbackType | null;
  temporalExpression: TemporalExpression | null;
  contextPattern: ContextPattern;
  documentTags: DocumentTags;

  // Metadata
  metadata?: {
    queryLength: number;
    hasContext: boolean;
    classificationTimeMs: number;
  };
}

// ============================================================================
// Extended RAG Status (V2)
// ============================================================================

export type RagStatus =
  | 'SUCCESS'
  | 'NO_DOCUMENTS'
  | 'NO_MATCH'
  | 'NO_MATCH_SINGLE_DOC'
  | 'DOC_NOT_FOUND_BY_NAME'  // New in V2
  | 'PROCESSING'
  | 'ERROR';

// ============================================================================
// Extended Answer Types (V2)
// ============================================================================

export type AnswerType =
  // Analytics
  | 'analytics'
  // Document content
  | 'doc_factual_single'
  | 'doc_multi_extract'
  | 'doc_comparison'
  | 'doc_search_results'
  // Conversation
  | 'follow_up'
  | 'chitchat'             // New in V2
  | 'meta_ai'              // New in V2
  // Fallbacks
  | 'fallback_no_docs'
  | 'fallback_no_match'
  | 'fallback_doc_not_found'  // New in V2
  | 'fallback_processing'
  | 'fallback_error'
  // Other
  | 'generic_chat';

// ============================================================================
// Extended RAG Context (V2)
// ============================================================================

export interface RagContext extends RagContextV1 {
  // Additional V2 fields
  resolvedDocumentIds?: string[];
  searchStrategy?: 'vector' | 'bm25' | 'hybrid';
}

// ============================================================================
// Request/Response Types (V2)
// ============================================================================

export interface AnswerRequest {
  query: string;
  userId: string;
  sessionId?: string;
  conversationContext?: ConversationContext;
  intent?: IntentClassificationV2;
  attachedDocumentIds?: string[];
  answerLength?: 'short' | 'medium' | 'long' | 'summary';
}

export interface AnswerResponse {
  text: string;
  answerType: AnswerType;
  citations: Citation[];
  docsUsed: string[];
  conversationContext: ConversationContext;
  metadata: {
    ragStatus: RagStatus;
    retrievalTimeMs?: number;
    generationTimeMs?: number;
    totalTimeMs: number;
  };
}

// ============================================================================
// Document Resolution Types (V2)
// ============================================================================

export interface ResolvedDocument {
  id: string;
  title: string;
  confidence: number;
}

export interface DocumentResolutionResult {
  resolvedDocs: ResolvedDocument[];
  extractedNames: string[];
}

// ============================================================================
// Document Analytics Types (V2)
// ============================================================================

export interface DocumentSummary {
  total: number;
  byType: Record<string, number>;
  byFolder: Record<string, number>;
  recentDocs: Array<{
    documentId: string;
    title: string;
    mimeType: string;
    uploadedAt: Date;
  }>;
}

export interface DocumentSearchResult {
  documents: Array<{
    documentId: string;
    title: string;
    mimeType: string;
    uploadedAt: Date;
  }>;
  totalFound: number;
  searchTimeMs: number;
}

// ============================================================================
// Fallback Response Type (V2)
// ============================================================================

export interface FallbackResponse {
  message: string;
  suggestedAction?: string;
  type: FallbackType;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Types are exported above, this default export is for compatibility
};
