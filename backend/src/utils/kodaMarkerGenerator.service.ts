/**
 * ============================================================================
 * KODA MARKER GENERATOR SERVICE - LAYER 1
 * ============================================================================
 *
 * PURPOSE: Single source of truth for all inline marker generation
 *
 * MARKER FORMATS:
 * - Document: {{DOC::id=...::name="..."::type=...::size=...::language=...::topics=[...]::folder="..."::created=...::updated=...::pages=...}}
 * - LoadMore: {{LOADMORE::total=...::shown=...::context=...}}
 *
 * KEY PRINCIPLE:
 * - Markers contain ALL metadata
 * - But only filename is visible in markdown
 * - Frontend parses marker and renders button with filename
 */

// ============================================================================
// TYPE DEFINITIONS
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
// MARKER GENERATION FUNCTIONS
// ============================================================================

/**
 * Create inline document marker with FULL metadata
 *
 * Format: {{DOC::id=...::name="..."::type=...::size=...::language=...::topics=[...]::folder="..."::created=...::updated=...::pages=...}}
 *
 * Visual output: **filename.pdf** {{DOC::...}}
 * User sees: **filename.pdf**
 * Frontend parses: All metadata from marker
 *
 * @param doc - Document data with all metadata
 * @returns Formatted marker string
 */
export function createInlineDocumentMarker(doc: InlineDocument): string {
  if (!doc.documentId || !doc.filename) {
    throw new Error('Document ID and filename are required');
  }

  const parts: string[] = [];

  // Required fields
  parts.push(`id=${doc.documentId}`);
  parts.push(`name="${encodeURIComponent(doc.filename)}"`);

  // Extension/type
  if (doc.extension) {
    parts.push(`type=${doc.extension}`);
  } else if (doc.mimeType) {
    const ext = mimeTypeToExtension(doc.mimeType);
    parts.push(`type=${ext}`);
  }

  // File size
  if (doc.fileSize) {
    parts.push(`size=${doc.fileSize}`);
  }

  // Language
  if (doc.language) {
    parts.push(`language=${doc.language}`);
  }

  // Topics (array)
  if (doc.topics && doc.topics.length > 0) {
    const topicsStr = JSON.stringify(doc.topics);
    parts.push(`topics=${encodeURIComponent(topicsStr)}`);
  }

  // Folder path
  if (doc.folderPath) {
    parts.push(`folder="${encodeURIComponent(doc.folderPath)}"`);
  }

  // Created date
  if (doc.createdAt) {
    parts.push(`created=${doc.createdAt}`);
  }

  // Updated date
  if (doc.updatedAt) {
    parts.push(`updated=${doc.updatedAt}`);
  }

  // Page/slide count
  if (doc.pageCount) {
    parts.push(`pages=${doc.pageCount}`);
  } else if (doc.slideCount) {
    parts.push(`slides=${doc.slideCount}`);
  }

  return `{{DOC::${parts.join('::')}}}`;
}

/**
 * Create load more marker
 *
 * Format: {{LOADMORE::total=...::shown=...::context=...}}
 *
 * @param data - Load more data
 * @returns Formatted marker string
 */
export function createLoadMoreMarker(data: LoadMoreData): string {
  if (data.totalCount < 0 || data.shownCount < 0) {
    throw new Error('Counts must be non-negative');
  }

  if (data.shownCount > data.totalCount) {
    throw new Error('shownCount cannot exceed totalCount');
  }

  const parts = [
    `total=${data.totalCount}`,
    `shown=${data.shownCount}`,
    `context=${data.contextId}`
  ];

  return `{{LOADMORE::${parts.join('::')}}}`;
}

/**
 * Inject inline documents into text with prefix and suffix
 *
 * @param documents - Array of documents to inject
 * @param maxInline - Maximum number of documents to show inline (default: 10)
 * @param prefix - Text to show before documents (default: empty)
 * @param suffix - Text to show after documents (default: empty)
 * @param contextId - Context ID for load more marker
 * @returns Formatted text with document markers
 */
export function injectInlineDocuments(
  documents: InlineDocument[],
  maxInline: number = 10,
  prefix: string = '',
  suffix: string = '',
  contextId: string = 'default'
): string {
  if (!documents || documents.length === 0) {
    return '';
  }

  const displayDocs = documents.slice(0, maxInline);
  const markers = displayDocs.map(doc => {
    // Visual: **filename** {{DOC::...}}
    return `**${doc.filename}** ${createInlineDocumentMarker(doc)}`;
  });

  let result = prefix + markers.join('\n');

  // Add load more marker if there are remaining documents
  if (documents.length > maxInline) {
    const loadMoreData: LoadMoreData = {
      totalCount: documents.length,
      shownCount: maxInline,
      contextId: contextId
    };
    result += '\n\n' + createLoadMoreMarker(loadMoreData);
  }

  result += suffix;

  return result;
}

// ============================================================================
// DOCUMENT NAME NORMALIZATION
// ============================================================================

/**
 * Normalize document name for matching
 *
 * Converts: "My Document.pdf" -> "my document pdf"
 *
 * @param name - Document name to normalize
 * @returns Normalized name
 */
export function normalizeDocumentName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two document names match (case-insensitive, ignoring separators)
 *
 * @param name1 - First document name
 * @param name2 - Second document name
 * @returns True if names match
 */
export function documentsMatch(name1: string, name2: string): boolean {
  return normalizeDocumentName(name1) === normalizeDocumentName(name2);
}

// ============================================================================
// MARKER VALIDATION
// ============================================================================

/**
 * Validate document marker format
 *
 * @param marker - Marker string to validate
 * @returns True if valid document marker
 */
export function isValidDocumentMarker(marker: string): boolean {
  if (!marker || typeof marker !== 'string') return false;

  const pattern = /^\{\{DOC::(id=[^:]+)::(name="[^"]+")(::.+)?\}\}$/;
  return pattern.test(marker);
}

/**
 * Validate load more marker format
 *
 * @param marker - Marker string to validate
 * @returns True if valid load more marker
 */
export function isValidLoadMoreMarker(marker: string): boolean {
  if (!marker || typeof marker !== 'string') return false;

  const pattern = /^\{\{LOADMORE::total=\d+::shown=\d+::context=.+\}\}$/;
  return pattern.test(marker);
}

/**
 * Check if text contains any markers
 *
 * @param text - Text to check
 * @returns True if text contains markers
 */
export function hasMarkers(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /\{\{(DOC|LOADMORE)::/.test(text);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract all document markers from text
 *
 * @param text - Text containing markers
 * @returns Array of document marker strings
 */
export function extractDocumentMarkers(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const pattern = /\{\{DOC::[^\}]+\}\}/g;
  return text.match(pattern) || [];
}

/**
 * Extract all load more markers from text
 *
 * @param text - Text containing markers
 * @returns Array of load more marker strings
 */
export function extractLoadMoreMarkers(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const pattern = /\{\{LOADMORE::[^\}]+\}\}/g;
  return text.match(pattern) || [];
}

/**
 * Count markers in text
 *
 * @param text - Text to analyze
 * @returns Object with counts of each marker type
 */
export function countMarkers(text: string): { documents: number; loadMore: number } {
  return {
    documents: extractDocumentMarkers(text).length,
    loadMore: extractLoadMoreMarkers(text).length
  };
}

/**
 * Convert MIME type to file extension
 *
 * @param mimeType - MIME type string
 * @returns File extension
 */
function mimeTypeToExtension(mimeType: string): string {
  const mimeMap: { [key: string]: string } = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'text/markdown': 'md',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg'
  };

  return mimeMap[mimeType] || 'file';
}

/**
 * Humanize file size
 *
 * @param bytes - File size in bytes
 * @returns Human-readable size string
 */
export function humanizeFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createInlineDocumentMarker,
  createLoadMoreMarker,
  injectInlineDocuments,
  normalizeDocumentName,
  documentsMatch,
  isValidDocumentMarker,
  isValidLoadMoreMarker,
  hasMarkers,
  extractDocumentMarkers,
  extractLoadMoreMarkers,
  countMarkers,
  humanizeFileSize
};
