/**
 * Enhanced RAG Types for Issue Fixes
 * Addresses:
 * - Issue #1: documents Reference & Source Extraction
 * - Issue #2: documents Question Comprehension
 * - Issue #3: Navigation & Button Redirection
 * - Issue #4: Context Retention
 * - Issue #5: Relevance & Document Selection
 */

// ==========================================
// ISSUE #1: Source Reference Types
// ==========================================

export interface SourceReference {
  documentId: string;
  filename: string;
  originalName?: string;
  mimeType: string;

  // Location information
  location: string; // Formatted: "Page 5" or "Slide 3" or "Sheet1, B5"
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  cellReference?: string;
  section?: string;

  // Hierarchy information
  categoryId?: string;
  categoryName?: string;
  categoryEmoji?: string;
  folderId?: string;
  folderName?: string;
  folderPath?: string; // Full path: "Finance > Reports > 2025"

  // Access URLs
  viewUrl: string; // URL to view in app
  downloadUrl: string; // URL to download

  // Content reference
  chunkContent: string; // The actual text used
  chunkIndex: number;

  // Relevance (for Issue #5)
  relevanceScore?: number;
  relevanceExplanation?: string;
}

export interface EnhancedChunkMetadata {
  // Document identification
  documentId: string;
  filename: string;
  originalName?: string;
  mimeType: string;

  // Location information
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  cellReference?: string;
  section?: string;
  paragraph?: number;

  // Hierarchy information
  categoryId?: string;
  categoryName?: string;
  categoryEmoji?: string;
  folderId?: string;
  folderName?: string;
  folderPath?: string;

  // Content metadata
  startChar: number;
  endChar: number;
  chunkIndex: number;
  totalChunks?: number;

  // User context
  userId: string;
  createdAt: string;

  // Access information
  documentUrl: string;
  viewUrl: string;
}

// ==========================================
// ISSUE #2: Intent Classification Types
// ==========================================

export enum QueryIntent {
  LOCATION_QUERY = 'location_query',        // "where is X"
  FOLDER_CONTENTS_QUERY = 'folder_contents_query', // "what's in Y"
  HIERARCHY_QUERY = 'hierarchy_query',      // "show me structure"
  DOCUMENT_SEARCH = 'document_search',      // "find document X"
  CONTENT_QUERY = 'content_query',          // "what does X say about Y"
  GENERAL_QUESTION = 'general_question'     // Other questions
}

export interface ClassifiedQuery {
  intent: QueryIntent;
  entities: {
    documentName?: string;
    folderName?: string;
    categoryName?: string;
    documentId?: string;
  };
  confidence: number;
}

// ==========================================
// ISSUE #3: Action Button Types
// ==========================================

export enum ActionType {
  OPEN_FOLDER = 'open_folder',
  OPEN_DOCUMENT = 'open_document',
  OPEN_CATEGORY = 'open_category',
  DOWNLOAD_DOCUMENT = 'download_document',
  LIST_DOCUMENTS = 'list_documents',
  SEARCH_IN_FOLDER = 'search_in_folder'
}

export interface ActionButton {
  label: string;
  action: ActionType;

  // Optional parameters based on action type
  folderId?: string;
  documentId?: string;
  categoryId?: string;
  query?: string;

  // UI styling
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: string;
}

// ==========================================
// ISSUE #4: Context Tracking Types
// ==========================================

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;

  // Context metadata
  topic?: string;
  documentReferences?: string[]; // documentIds
  folderReferences?: string[]; // folderIds
  categoryReferences?: string[]; // categoryIds
}

export interface ConversationContext {
  currentTopic: string | null;
  activeDocuments: string[]; // documentIds currently being discussed
  recentMessages: ConversationMessage[];
  relevantHistory: ConversationMessage[];
}

// ==========================================
// ISSUE #5: Relevance Scoring Types
// ==========================================

export interface RelevanceFactors {
  semanticSimilarity: number;  // 0-1 from vector search
  keywordMatch: number;        // 0-1 from BM25F
  titleMatch: number;          // 0-1 from filename similarity
  recency: number;             // 0-1 based on document age
  folderPathMatch?: number;    // 0-1 from folder/category relevance (Task #8)
  tagMatch?: number;           // 0-1 from tag matching (Task #8)
  userEngagement: number;      // 0-1 based on access frequency
  completeness: number;        // 0-1 based on how fully it answers
}

export interface ScoredChunk {
  chunk: {
    content: string;
    metadata: Partial<EnhancedChunkMetadata>;
    score?: number;
    [key: string]: any;
  };
  relevanceScore: number; // 0-100 scale
  relevanceFactors: RelevanceFactors;
  relevanceExplanation: string;
}

// ==========================================
// RAG Response Types
// ==========================================

export interface RAGResponse {
  answer: string;
  sources: SourceReference[];
  expandedQuery?: string;
  contextId?: string;
  actions?: ActionButton[];
  conversationContext?: {
    activeDocuments: string[];
    currentTopic: string | null;
  };
}

// ==========================================
// Search Options
// ==========================================

export interface EnhancedSearchOptions {
  topK?: number;
  enableReranking?: boolean;
  enableMMR?: boolean;
  mmrLambda?: number;
  queryType?: string;
  documentId?: string;
  documentIds?: string[]; // For conversation context
  minSimilarity?: number;
}
