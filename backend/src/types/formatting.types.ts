/**
 * ============================================================================
 * KODA FORMATTING TYPES
 * ============================================================================
 *
 * PURPOSE: Centralized TypeScript type definitions for formatting system
 */

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export interface InlineDocument {
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize?: number;
  folderPath?: string;
  extension?: string;
  language?: string;
  topics?: string[];
  createdAt?: string;
  updatedAt?: string;
  pageCount?: number;
  slideCount?: number;
}

export interface LoadMoreData {
  totalCount: number;
  shownCount: number;
  contextId: string;
}

// ============================================================================
// FORMATTING TYPES
// ============================================================================

export type AnswerType =
  | 'rag_qa_simple'
  | 'rag_qa_medium'
  | 'rag_qa_complex'
  | 'document_listing'
  | 'fallback_no_documents'
  | 'fallback_doc_not_found'
  | 'fallback_no_matching_content'
  | 'fallback_upload_processing'
  | 'fallback_feature_not_supported'
  | 'fallback_system_error'
  | 'fallback_permission'
  | 'fallback_rate_limit'
  | 'calculation'
  | 'comparison';

export interface FormattingContext {
  documentMap?: Map<string, InlineDocument>;
  answerType: AnswerType;
  language: string;
  sourceDocuments?: InlineDocument[];
  userQuestion?: string;
  fallbackKey?: FallbackKey;
  fallbackContext?: any;
}

export interface FormattedAnswer {
  text: string;
  metadata: {
    hasTitle: boolean;
    hasSections: boolean;
    documentCount: number;
    markerCount: number;
  };
}

// ============================================================================
// DOCUMENT LISTING TYPES
// ============================================================================

export type QueryType =
  | 'COUNT_ONLY'
  | 'LIST_RECENT'
  | 'LIST_MATCHING_TITLE'
  | 'LIST_ALL'
  | 'LIST_BY_FOLDER'
  | 'LIST_BY_TOPIC';

export interface DocumentListingOptions {
  docs: InlineDocument[];
  language: string;
  queryType: QueryType;
  limit: number;
  totalCount: number;
  contextId: string;
  searchQuery?: string;
  folderPath?: string;
  topic?: string;
}

// ============================================================================
// FALLBACK TYPES
// ============================================================================

export type FallbackKey =
  | 'NO_DOCUMENTS'
  | 'DOC_NOT_FOUND'
  | 'NO_MATCHING_CONTENT'
  | 'UPLOAD_STILL_PROCESSING'
  | 'FEATURE_NOT_SUPPORTED_YET'
  | 'SYSTEM_ERROR_GENERIC'
  | 'PERMISSION_OR_SCOPE'
  | 'RATE_LIMIT_OR_OVERLOAD';

export interface FallbackContext {
  docName?: string;
  folderName?: string;
  featureName?: string;
  errorMessage?: string;
  [key: string]: any;
}

export interface FallbackOptions {
  fallbackKey: FallbackKey;
  language: string;
  context?: FallbackContext;
}

// ============================================================================
// MARKER TYPES
// ============================================================================

export interface DocumentMarker {
  type: 'document';
  documentId: string;
  filename: string;
  extension?: string;
  mimeType?: string;
  fileSize?: number;
  language?: string;
  topics?: string[];
  folderPath?: string;
  createdAt?: string;
  updatedAt?: string;
  pageCount?: number;
  slideCount?: number;
}

export interface LoadMoreMarker {
  type: 'loadmore';
  totalCount: number;
  shownCount: number;
  contextId: string;
}

export type Marker = DocumentMarker | LoadMoreMarker;

// ============================================================================
// CONTENT SEGMENT TYPES
// ============================================================================

export interface TextSegment {
  type: 'text';
  content: string;
}

export interface DocumentSegment {
  type: 'document';
  content: InlineDocument;
}

export interface LoadMoreSegment {
  type: 'loadmore';
  content: LoadMoreData;
}

export type ContentSegment = TextSegment | DocumentSegment | LoadMoreSegment;

// ============================================================================
// LAYOUT TYPES
// ============================================================================

export interface LayoutDecision {
  complexityLevel: 'simple' | 'medium' | 'complex';
  useTitle: boolean;
  useSections: boolean;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Types are exported above
};
