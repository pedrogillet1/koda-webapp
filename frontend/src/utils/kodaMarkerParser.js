/**
 * ============================================================================
 * KODA MARKER PARSER - LAYER 3 (FRONTEND)
 * ============================================================================
 *
 * PURPOSE: Parse all markers from backend responses
 *
 * MARKER FORMATS:
 * - Document: {{DOC::id=...::name="..."::type=...::size=...::language=...::topics=[...]::folder="..."::created=...::updated=...::pages=...}}
 * - LoadMore: {{LOADMORE::total=...::shown=...::context=...}}
 *
 * OUTPUT: Splits content into segments
 * - text segments → rendered by StreamingMarkdown
 * - document segments → rendered by InlineDocumentButton
 * - loadmore segments → rendered by LoadMoreButton
 */

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} ParsedDocument
 * @property {string} documentId
 * @property {string} filename
 * @property {string} mimeType
 * @property {number} [fileSize]
 * @property {string} [folderPath]
 * @property {string} [extension]
 * @property {string} [language]
 * @property {string[]} [topics]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 * @property {number} [pageCount]
 * @property {number} [slideCount]
 */

/**
 * @typedef {Object} ParsedLoadMore
 * @property {number} totalCount
 * @property {number} loadedCount
 * @property {number} remainingCount
 * @property {string} contextId
 */

/**
 * @typedef {Object} ContentSegment
 * @property {'text'|'document'|'loadmore'} type
 * @property {string|ParsedDocument|ParsedLoadMore} content
 */

// ============================================================================
// MARKER DETECTION
// ============================================================================

/**
 * Check if text contains any markers
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains markers
 */
export function hasMarkers(text) {
  if (!text || typeof text !== 'string') return false;
  return /\{\{(DOC|LOADMORE)::/.test(text);
}

/**
 * Count markers in text
 *
 * @param {string} text - Text to analyze
 * @returns {{documents: number, loadMore: number}} Marker counts
 */
export function countMarkers(text) {
  if (!text || typeof text !== 'string') {
    return { documents: 0, loadMore: 0 };
  }

  const docMatches = text.match(/\{\{DOC::/g);
  const loadMoreMatches = text.match(/\{\{LOADMORE::/g);

  return {
    documents: docMatches ? docMatches.length : 0,
    loadMore: loadMoreMatches ? loadMoreMatches.length : 0
  };
}

// ============================================================================
// DOCUMENT MARKER PARSING
// ============================================================================

/**
 * Parse all document markers from text
 *
 * @param {string} text - Text containing markers
 * @returns {ParsedDocument[]} Array of parsed documents
 */
export function parseDocumentMarkers(text) {
  if (!text || typeof text !== 'string') return [];

  const markers = [];
  const pattern = /\{\{DOC::([^\}]+)\}\}/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const markerContent = match[1];
    const doc = parseDocumentMarkerContent(markerContent);
    if (doc) {
      markers.push(doc);
    }
  }

  return markers;
}

/**
 * Parse document marker content
 *
 * @param {string} content - Marker content (without {{DOC:: and }})
 * @returns {ParsedDocument|null} Parsed document or null
 */
function parseDocumentMarkerContent(content) {
  try {
    const parts = content.split('::');
    const doc = {};

    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      let value = valueParts.join('=');

      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Decode URI components
      value = decodeURIComponent(value);

      // Parse specific fields
      switch (key) {
        case 'id':
          doc.documentId = value;
          break;
        case 'name':
          doc.filename = value;
          break;
        case 'type':
          doc.extension = value;
          doc.mimeType = extensionToMimeType(value);
          break;
        case 'size':
          doc.fileSize = parseInt(value);
          break;
        case 'language':
          doc.language = value;
          break;
        case 'topics':
          try {
            doc.topics = JSON.parse(value);
          } catch (e) {
            doc.topics = [];
          }
          break;
        case 'folder':
          doc.folderPath = value;
          break;
        case 'created':
          doc.createdAt = value;
          break;
        case 'updated':
          doc.updatedAt = value;
          break;
        case 'pages':
          doc.pageCount = parseInt(value);
          break;
        case 'slides':
          doc.slideCount = parseInt(value);
          break;
      }
    }

    // Validate required fields
    if (!doc.documentId || !doc.filename) {
      return null;
    }

    return doc;
  } catch (e) {
    console.error('Error parsing document marker:', e);
    return null;
  }
}

// ============================================================================
// LOADMORE MARKER PARSING
// ============================================================================

/**
 * Parse all load more markers from text
 *
 * @param {string} text - Text containing markers
 * @returns {ParsedLoadMore[]} Array of parsed load more data
 */
export function parseLoadMoreMarkers(text) {
  if (!text || typeof text !== 'string') return [];

  const markers = [];
  const pattern = /\{\{LOADMORE::([^\}]+)\}\}/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const markerContent = match[1];
    const loadMore = parseLoadMoreMarkerContent(markerContent);
    if (loadMore) {
      markers.push(loadMore);
    }
  }

  return markers;
}

/**
 * Parse load more marker content
 *
 * @param {string} content - Marker content (without {{LOADMORE:: and }})
 * @returns {ParsedLoadMore|null} Parsed load more data or null
 */
function parseLoadMoreMarkerContent(content) {
  try {
    const parts = content.split('::');
    const data = {};

    for (const part of parts) {
      const [key, value] = part.split('=');

      switch (key) {
        case 'total':
          data.totalCount = parseInt(value);
          break;
        case 'shown':
          data.loadedCount = parseInt(value);
          break;
        case 'context':
          data.contextId = value;
          break;
      }
    }

    // Calculate remaining count
    data.remainingCount = data.totalCount - data.loadedCount;

    // Validate required fields
    if (
      data.totalCount === undefined ||
      data.loadedCount === undefined ||
      !data.contextId
    ) {
      return null;
    }

    return data;
  } catch (e) {
    console.error('Error parsing load more marker:', e);
    return null;
  }
}

// ============================================================================
// CONTENT SPLITTING
// ============================================================================

/**
 * Split content into segments (text, document, loadmore)
 *
 * @param {string} text - Text containing markers
 * @returns {ContentSegment[]} Array of content segments
 */
export function splitContentWithMarkers(text) {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', content: '' }];
  }

  if (!hasMarkers(text)) {
    return [{ type: 'text', content: text }];
  }

  const segments = [];
  let currentIndex = 0;

  // Combined pattern for both marker types
  const markerPattern = /\{\{(DOC|LOADMORE)::([^\}]+)\}\}/g;
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    const markerStart = match.index;
    const markerEnd = markerStart + match[0].length;
    const markerType = match[1];
    const markerContent = match[2];

    // Add text before marker
    if (markerStart > currentIndex) {
      const textContent = text.substring(currentIndex, markerStart).trim();
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }

    // Add marker segment
    if (markerType === 'DOC') {
      const doc = parseDocumentMarkerContent(markerContent);
      if (doc) {
        segments.push({ type: 'document', content: doc });
      }
    } else if (markerType === 'LOADMORE') {
      const loadMore = parseLoadMoreMarkerContent(markerContent);
      if (loadMore) {
        segments.push({ type: 'loadmore', content: loadMore });
      }
    }

    currentIndex = markerEnd;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    const textContent = text.substring(currentIndex).trim();
    if (textContent) {
      segments.push({ type: 'text', content: textContent });
    }
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert file extension to MIME type
 *
 * @param {string} extension - File extension
 * @returns {string} MIME type
 */
function extensionToMimeType(extension) {
  const mimeMap = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    md: 'text/markdown',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml'
  };

  return mimeMap[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Extract marker data from text at specific position
 *
 * @param {string} text - Text containing marker
 * @param {number} position - Position in text
 * @returns {ParsedDocument|ParsedLoadMore|null} Extracted marker data
 */
export function extractMarkerData(text, position) {
  if (!text || typeof text !== 'string' || position < 0) return null;

  // Find marker at position
  const markerPattern = /\{\{(DOC|LOADMORE)::([^\}]+)\}\}/g;
  let match;

  while ((match = markerPattern.exec(text)) !== null) {
    const markerStart = match.index;
    const markerEnd = markerStart + match[0].length;

    if (position >= markerStart && position <= markerEnd) {
      const markerType = match[1];
      const markerContent = match[2];

      if (markerType === 'DOC') {
        return parseDocumentMarkerContent(markerContent);
      } else if (markerType === 'LOADMORE') {
        return parseLoadMoreMarkerContent(markerContent);
      }
    }
  }

  return null;
}

/**
 * Remove all markers from text
 *
 * @param {string} text - Text containing markers
 * @returns {string} Text without markers
 */
export function removeMarkers(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{\{(DOC|LOADMORE)::[^\}]+\}\}/g, '').trim();
}

/**
 * Humanize file size
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Human-readable size
 */
export function humanizeFileSize(bytes) {
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
  hasMarkers,
  countMarkers,
  parseDocumentMarkers,
  parseLoadMoreMarkers,
  splitContentWithMarkers,
  extractMarkerData,
  removeMarkers,
  humanizeFileSize
};
