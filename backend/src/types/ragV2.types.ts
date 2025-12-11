/**
 * RAG V2 Types
 *
 * Types for the RAG service V2 implementation
 */

// ============================================================================
// Request Types
// ============================================================================

export interface ConversationContext {
  sessionId: string;
  userId: string;
  lastNTurns: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  activeDocIds: string[];
  lastCitations: Citation[];
}

export interface AnswerRequest {
  query: string;
  userId: string;
  sessionId?: string;
  conversationContext?: ConversationContext;
  attachedDocumentIds?: string[];
  answerLength?: 'short' | 'medium' | 'long';
}

// ============================================================================
// Response Types
// ============================================================================

export interface Citation {
  id: string;
  documentId: string;
  title: string;
  filename: string;
  location?: string;
  type: 'inline' | 'list';
  occurrences: number;
}

export interface AnswerResponse {
  text: string;
  answerType: 'rag' | 'analytics' | 'generic' | 'chitchat' | 'product_help' | 'no_documents';
  citations: Citation[];
  metadata: {
    ragStatus: RagStatus;
    totalTimeMs: number;
    tokensUsed?: number;
    model?: string;
    retrievedChunks?: number;
    retrievalTimeMs?: number;
    generationTimeMs?: number;
  };
  docsUsed?: string[];
}

// ============================================================================
// Internal Types
// ============================================================================

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  metadata: {
    page?: number;
    slide?: number;
    section?: string;
    filename?: string;
    displayTitle?: string;
  };
}

export type RagStatus =
  | 'SUCCESS'
  | 'NO_DOCUMENTS'
  | 'NO_MATCH'
  | 'NO_MATCH_SINGLE_DOC'
  | 'PROCESSING'
  | 'ERROR'
  | 'GENERIC';
