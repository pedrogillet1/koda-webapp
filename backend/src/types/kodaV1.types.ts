/**
 * Koda V1 - Complete Type System
 *
 * All types needed for the 8 flows and 5 themes from the notes.
 * Production-ready, no placeholders.
 */

// ============================================================================
// Domain & Intent Types
// ============================================================================

export type QueryDomain =
  | 'analytics'        // Flow 1: metadata queries
  | 'doc_content'      // Flows 2-6: RAG from doc chunks
  | 'doc_search'       // Flow 4: find docs by title/tags
  | 'generic';         // Flow 8: non-document chat

export type QuestionTypeV1 =
  // Analytics
  | 'doc_count'
  | 'type_distribution'
  | 'recent_docs'
  | 'search_by_title'
  // Doc content
  | 'simple_factual'
  | 'multi_point_extraction'
  | 'comparison'
  | 'follow_up'
  // Search
  | 'document_filter'
  // Generic
  | 'greeting'
  | 'capability'
  | 'generic_chat';

export type QueryScope =
  | 'single_document'
  | 'multiple_documents'
  | 'all_documents'
  | 'no_documents';

export interface IntentClassificationV1 {
  domain: QueryDomain;
  questionType: QuestionTypeV1;
  scope: QueryScope;
  confidence: number;
  targetDocId?: string;  // For single-doc queries
  targetDocIds?: string[];  // For multi-doc queries
  requiresRAG: boolean;
  metadata?: Record<string, any>;
}

// ============================================================================
// RAG Configuration & Context
// ============================================================================

export interface RagConfigV1 {
  // Document filtering
  docsFilter?: string[];  // Specific doc IDs to search
  maxDocs?: number;       // Max documents to retrieve from
  maxChunks?: number;     // Max chunks total

  // Chunk preferences
  chunkTypes?: ChunkTypeV1[];  // Preferred chunk types
  boostFactors?: Record<ChunkTypeV1, number>;

  // Search strategy
  useVectorSearch?: boolean;
  useBM25?: boolean;
  useReranking?: boolean;

  // Context window
  maxTokens?: number;

  // Metadata
  userId: string;
  sessionId?: string;
}

export type ChunkTypeV1 =
  | 'paragraph'
  | 'table'
  | 'list'
  | 'heading'
  | 'kpi'
  | 'definition'
  | 'risk_section'
  | 'conclusion';

export interface RetrievedChunkV1 {
  chunkId: string;
  documentId: string;
  content: string;
  chunkType: ChunkTypeV1;
  score: number;
  metadata: {
    page?: number;
    slide?: number;
    row?: number;
    section?: string;
  };
}

export interface RagContextV1 {
  chunks: RetrievedChunkV1[];
  totalChunks: number;
  documentsUsed: string[];
  retrievalTimeMs: number;
  rawSourceData: SourceDocumentV1[];
}

export type RagStatusV1 =
  | 'SUCCESS'
  | 'NO_DOCUMENTS'
  | 'NO_MATCH'
  | 'NO_MATCH_SINGLE_DOC'
  | 'PROCESSING'
  | 'ERROR';

// ============================================================================
// Source Documents & Citations
// ============================================================================

export interface SourceDocumentV1 {
  documentId: string;
  title: string;
  filename: string;
  mimeType: string;
  folder?: string;
  uploadedAt: Date;
  metadata?: {
    pageCount?: number;
    size?: number;
    tags?: string[];
  };
}

export interface CitationV1 {
  id: string;  // Citation index (1, 2, 3...)
  documentId: string;
  title: string;  // Real filename, not "Document"
  filename: string;
  location?: string;  // "Pagina 2 - tabela de custos"
  type: 'inline' | 'list';
  occurrences: number;
}

export interface CitationMetadataV1 {
  citations: CitationV1[];
  documentsUsed: string[];
  totalCitations: number;
}

// ============================================================================
// Answer Generation
// ============================================================================

export interface AnswerRequestV1 {
  query: string;
  userId: string;
  sessionId?: string;
  conversationContext?: ConversationContextV1;
  intent?: IntentClassificationV1;
}

export interface AnswerResponseV1 {
  text: string;  // Final markdown
  answerType: AnswerTypeV1;
  citations: CitationV1[];
  docsUsed: string[];
  conversationContext: ConversationContextV1;
  metadata: {
    ragStatus: RagStatusV1;
    retrievalTimeMs?: number;
    generationTimeMs?: number;
    totalTimeMs: number;
  };
}

export type AnswerTypeV1 =
  | 'analytics'
  | 'doc_factual_single'
  | 'doc_multi_extract'
  | 'doc_comparison'
  | 'doc_search_results'
  | 'follow_up'
  | 'fallback_no_docs'
  | 'fallback_no_match'
  | 'fallback_processing'
  | 'fallback_error'
  | 'generic_chat';

// ============================================================================
// Conversation Context & Memory
// ============================================================================

export interface ConversationContextV1 {
  sessionId: string;
  userId: string;
  lastNTurns: ConversationTurnV1[];
  activeDocIds?: string[];  // Docs from last answer
  lastCitations?: CitationV1[];
  lastQuery?: string;
  lastAnswerType?: AnswerTypeV1;
}

export interface ConversationTurnV1 {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: IntentClassificationV1;
    docsUsed?: string[];
  };
}

// ============================================================================
// Fallback Types
// ============================================================================

export type FallbackTypeV1 =
  | 'NO_DOCUMENTS'
  | 'NO_MATCH'
  | 'PROCESSING'
  | 'ERROR_GENERIC';

export interface FallbackResultV1 {
  type: FallbackTypeV1;
  message: string;
  suggestedAction?: string;
}

// ============================================================================
// Formatting Pipeline Types
// ============================================================================

export interface FormattingContextV1 {
  intent: IntentClassificationV1;
  ragStatus: RagStatusV1;
  citations: CitationV1[];
  answerType: AnswerTypeV1;
}

export interface FormattedOutputV1 {
  text: string;
  citations: CitationV1[];
  metadata: {
    wasValidated: boolean;
    hadFallback: boolean;
    appliedRules: string[];
  };
}

// ============================================================================
// Document Analytics Types
// ============================================================================

export interface DocumentStatsV1 {
  total: number;
  byType: Record<string, number>;  // { 'PDF': 10, 'DOCX': 5 }
  byFolder: Record<string, number>;
  recentDocs: SourceDocumentV1[];
}

export interface DocumentSearchResultV1 {
  documents: SourceDocumentV1[];
  totalFound: number;
  searchTimeMs: number;
}

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMRequestV1 {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMResponseV1 {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface KodaConfigV1 {
  // RAG settings
  rag: {
    defaultMaxChunks: number;
    defaultMaxDocs: number;
    useVectorSearch: boolean;
    useBM25: boolean;
    useReranking: boolean;
  };

  // LLM settings
  llm: {
    model: string;
    temperature: number;
    maxTokens: number;
  };

  // Formatting settings
  formatting: {
    enableSmartBolding: boolean;
    enableCitationPills: boolean;
    maxAnswerLength: number;
  };

  // Fallback settings
  fallback: {
    enableGenericChat: boolean;
    shortTemplates: boolean;
  };

  // Memory settings
  memory: {
    maxTurns: number;
    enableLongTermMemory: boolean;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class KodaErrorV1 extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'KodaErrorV1';
  }
}

export class RAGErrorV1 extends KodaErrorV1 {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'RAG_ERROR', 500, metadata);
    this.name = 'RAGErrorV1';
  }
}

export class ValidationErrorV1 extends KodaErrorV1 {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
    this.name = 'ValidationErrorV1';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export interface TimeMetricsV1 {
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export function startTimerV1(): TimeMetricsV1 {
  return { startTime: Date.now() };
}

export function endTimerV1(metrics: TimeMetricsV1): TimeMetricsV1 {
  metrics.endTime = Date.now();
  metrics.durationMs = metrics.endTime - metrics.startTime;
  return metrics;
}

// ============================================================================
// 8 Flows Definition (for reference)
// ============================================================================

/**
 * Flow 1: Analytics/Metadata (NO RAG)
 * - "Quantos documentos tenho?"
 * - "Quais tipos de arquivo?"
 * - Domain: analytics, QuestionType: doc_count/type_distribution/recent_docs
 *
 * Flow 2: Simple Factual (Light RAG)
 * - "Qual o custo por m²?"
 * - Domain: doc_content, QuestionType: simple_factual
 *
 * Flow 3: Multi-Point Extraction (Full RAG)
 * - "Liste todos os riscos do projeto"
 * - Domain: doc_content, QuestionType: multi_point_extraction
 *
 * Flow 4: Document Search (DB Query)
 * - "Encontre documentos sobre orçamento"
 * - Domain: doc_search, QuestionType: search_by_title
 *
 * Flow 5: Single-Doc Query (Scoped RAG)
 * - "No arquivo projeto.pdf, qual a data de entrega?"
 * - Domain: doc_content, Scope: single_document
 *
 * Flow 6: Comparison (Multi-doc RAG)
 * - "Compare os custos entre projeto A e B"
 * - Domain: doc_content, QuestionType: comparison
 *
 * Flow 7: Follow-up (Context RAG)
 * - "Explica melhor isso" / "E o prazo?"
 * - Domain: doc_content, QuestionType: follow_up
 *
 * Flow 8: Generic Chat (NO RAG)
 * - "Olá" / "O que você pode fazer?"
 * - Domain: generic, QuestionType: greeting/capability
 */

// ============================================================================
// Exports
// ============================================================================

export default {
  // Re-export everything for convenience
  KodaErrorV1,
  RAGErrorV1,
  ValidationErrorV1,
  startTimerV1,
  endTimerV1,
};
