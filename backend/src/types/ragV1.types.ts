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

export type QuestionType =
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

export interface IntentClassification {
  domain: QueryDomain;
  questionType: QuestionType;
  scope: QueryScope;
  confidence?: number;
  complexity?: 'simple' | 'complex';
  targetDocId?: string;  // For single-doc queries
  targetDocIds?: string[];  // For multi-doc queries
  requiresRAG?: boolean;
  isFollowUp?: boolean;
  metadata?: Record<string, any>;
}

// ============================================================================
// RAG Configuration & Context
// ============================================================================

export interface RagConfig {
  // Document filtering
  docsFilter?: string[];  // Specific doc IDs to search
  maxDocs?: number;       // Max documents to retrieve from
  maxChunks?: number;     // Max chunks total
  
  // Chunk preferences
  chunkTypes?: ChunkType[];  // Preferred chunk types
  boostFactors?: Record<ChunkType, number>;
  
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

export type ChunkType = 
  | 'paragraph'
  | 'table'
  | 'list'
  | 'heading'
  | 'kpi'
  | 'definition'
  | 'risk_section'
  | 'conclusion';

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  chunkType: ChunkType;
  score: number;
  metadata: {
    page?: number;
    slide?: number;
    row?: number;
    section?: string;
  };
}

export interface RagContext {
  chunks: RetrievedChunk[];
  totalChunks: number;
  documentsUsed: string[];
  retrievalTimeMs: number;
  rawSourceData: SourceDocument[];
}

export type RagStatus = 
  | 'SUCCESS'
  | 'NO_DOCUMENTS'
  | 'NO_MATCH'
  | 'NO_MATCH_SINGLE_DOC'
  | 'PROCESSING'
  | 'ERROR';

// ============================================================================
// Source Documents & Citations
// ============================================================================

export interface SourceDocument {
  documentId: string;
  title: string;           // Display title (displayTitle || filename)
  filename: string;        // Original filename
  displayTitle?: string | null;  // KODA FIX: AI-generated display title
  mimeType: string;
  fileSize?: number;       // KODA FIX: File size for citation markers
  folder?: string;
  uploadedAt: Date;
  metadata?: {
    pageCount?: number;
    size?: number;
    tags?: string[];
  };
}

export interface Citation {
  id: string;  // Citation index (1, 2, 3...)
  documentId: string;
  title: string;  // Real filename, not "Document"
  filename: string;
  location?: string;  // "Página 2 – tabela de custos"
  type: 'inline' | 'list';
  occurrences: number;
}

export interface CitationMetadata {
  citations: Citation[];
  documentsUsed: string[];
  totalCitations: number;
}

// ============================================================================
// Answer Generation
// ============================================================================

export interface AnswerRequest {
  query: string;
  userId: string;
  sessionId?: string;
  conversationContext?: ConversationContext;
  intent?: IntentClassification;
  attachedDocumentIds?: string[];
  answerLength?: 'short' | 'medium' | 'long' | 'summary';
}

export interface AnswerResponse {
  text: string;  // Final markdown
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

export type AnswerType =
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

export interface ConversationContext {
  sessionId: string;
  userId: string;
  lastNTurns: ConversationTurn[];
  activeDocIds?: string[];  // Docs from last answer
  lastCitations?: Citation[];
  lastQuery?: string;
  lastAnswerType?: AnswerType;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  metadata?: {
    intent?: IntentClassification;
    docsUsed?: string[];
    citations?: Citation[];
  };
}

// ============================================================================
// Fallback Types
// ============================================================================

export type FallbackType = 
  | 'NO_DOCUMENTS'
  | 'NO_MATCH'
  | 'PROCESSING'
  | 'ERROR_GENERIC';

export interface FallbackResult {
  type: FallbackType;
  message: string;
  suggestedAction?: string;
}

// ============================================================================
// Formatting Pipeline Types
// ============================================================================

export interface FormattingContext {
  intent: IntentClassification;
  ragStatus: RagStatus;
  citations: Citation[];
  answerType: AnswerType;
}

export interface FormattedOutput {
  text: string;
  citations: Citation[];
  metadata: {
    wasValidated: boolean;
    hadFallback: boolean;
    appliedRules: string[];
  };
}

// ============================================================================
// Document Analytics Types
// ============================================================================

export interface DocumentStats {
  total: number;
  byType: Record<string, number>;  // { 'PDF': 10, 'DOCX': 5 }
  byFolder: Record<string, number>;
  recentDocs: SourceDocument[];
}

export interface DocumentSearchResult {
  documents: SourceDocument[];
  totalFound: number;
  searchTimeMs: number;
}

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMResponse {
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

export interface KodaConfig {
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

export class KodaError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'KodaError';
  }
}

export class RAGError extends KodaError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'RAG_ERROR', 500, metadata);
    this.name = 'RAGError';
  }
}

export class ValidationError extends KodaError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export interface TimeMetrics {
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export function startTimer(): TimeMetrics {
  return { startTime: Date.now() };
}

export function endTimer(metrics: TimeMetrics): TimeMetrics {
  metrics.endTime = Date.now();
  metrics.durationMs = metrics.endTime - metrics.startTime;
  return metrics;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Re-export everything for convenience
  KodaError,
  RAGError,
  ValidationError,
  startTimer,
  endTimer,
};
