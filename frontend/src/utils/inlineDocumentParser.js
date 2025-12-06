/**
 * ============================================================================
 * ENHANCED INLINE DOCUMENT PARSER
 * ============================================================================
 *
 * PURPOSE: Parse all marker types from backend responses
 *
 * MARKER TYPES:
 * - {{DOC:::id:::filename:::mimeType:::fileSize:::folderPath}}
 * - {{FOLDER:::id:::folderName:::fileCount:::folderPath}}
 * - {{LOADMORE:::remainingCount:::totalCount:::loadedCount}}
 */

/**
 * ============================================================================
 * DOCUMENT MARKERS
 * ============================================================================
 */

/**
 * Check if content contains inline document markers
 */
export const hasInlineDocuments = (content) => {
  if (!content || typeof content !== 'string') return false;
  return /\{\{DOC:::[\s\S]*?\}\}/g.test(content);
};

/**
 * Parse inline document markers
 * Format: {{DOC:::id:::filename:::mimeType:::fileSize:::folderPath}}
 */
export const parseInlineDocuments = (content) => {
  if (!content || typeof content !== 'string') return [];

  const markerRegex = /\{\{DOC:::([\s\S]*?)\}\}/g;
  const documents = [];
  let match;

  while ((match = markerRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];
    const fields = innerContent.split(':::');

    const documentId = fields[0] || '';
    const filename = fields[1] ? decodeURIComponent(fields[1]) : 'Document';
    const mimeType = fields[2] || 'application/octet-stream';
    const sizeStr = fields[3] || '';
    const folderPath = fields[4] ? decodeURIComponent(fields[4]) : '';

    let size = parseInt(sizeStr, 10);
    if (isNaN(size)) size = null;

    documents.push({
      documentId,
      filename,
      mimeType,
      size,
      fileSize: size,
      folderPath: folderPath || null,
      marker: fullMatch
    });
  }

  return documents;
};

/**
 * ============================================================================
 * FOLDER MARKERS (NEW)
 * ============================================================================
 */

/**
 * Check if content contains inline folder markers
 */
export const hasInlineFolders = (content) => {
  if (!content || typeof content !== 'string') return false;
  return /\{\{FOLDER:::[\s\S]*?\}\}/g.test(content);
};

/**
 * Parse inline folder markers
 * Format: {{FOLDER:::id:::folderName:::fileCount:::folderPath}}
 */
export const parseInlineFolders = (content) => {
  if (!content || typeof content !== 'string') return [];

  const folderRegex = /\{\{FOLDER:::([^:]+):::([^:]+):::([^:]+):::([^}]+)\}\}/g;
  const folders = [];
  let match;

  while ((match = folderRegex.exec(content)) !== null) {
    try {
      folders.push({
        folderId: match[1],
        folderName: decodeURIComponent(match[2]),
        fileCount: parseInt(match[3]),
        folderPath: decodeURIComponent(match[4]),
        marker: match[0]
      });
    } catch (error) {
      console.error('Error parsing folder marker:', error, match[0]);
    }
  }

  return folders;
};

/**
 * ============================================================================
 * LOAD MORE MARKERS (NEW)
 * ============================================================================
 */

/**
 * Check if content contains load more markers
 */
export const hasLoadMoreMarkers = (content) => {
  if (!content || typeof content !== 'string') return false;
  return /\{\{LOADMORE:::[\s\S]*?\}\}/g.test(content);
};

/**
 * Parse load more markers
 * Format: {{LOADMORE:::remainingCount:::totalCount:::loadedCount}}
 */
export const parseLoadMoreMarkers = (content) => {
  if (!content || typeof content !== 'string') return [];

  const loadMoreRegex = /\{\{LOADMORE:::(\d+):::(\d+):::(\d+)\}\}/g;
  const loadMoreButtons = [];
  let match;

  while ((match = loadMoreRegex.exec(content)) !== null) {
    try {
      loadMoreButtons.push({
        remainingCount: parseInt(match[1]),
        totalCount: parseInt(match[2]),
        loadedCount: parseInt(match[3]),
        marker: match[0]
      });
    } catch (error) {
      console.error('Error parsing load more marker:', error, match[0]);
    }
  }

  return loadMoreButtons;
};

/**
 * ============================================================================
 * UNIFIED PARSING
 * ============================================================================
 */

/**
 * Check if content has any markers
 */
export const hasMarkers = (content) => {
  if (!content || typeof content !== 'string') return false;

  return (
    content.includes('{{DOC:::') ||
    content.includes('{{FOLDER:::') ||
    content.includes('{{LOADMORE:::')
  );
};

/**
 * Parse all marker types at once
 * Returns object with all parsed markers
 */
export const parseAllMarkers = (content) => {
  return {
    documents: parseInlineDocuments(content),
    folders: parseInlineFolders(content),
    loadMore: parseLoadMoreMarkers(content)
  };
};

/**
 * Get marker count by type
 */
export const getMarkerCounts = (content) => {
  const markers = parseAllMarkers(content);

  return {
    documents: markers.documents.length,
    folders: markers.folders.length,
    loadMore: markers.loadMore.length,
    total: markers.documents.length + markers.folders.length + markers.loadMore.length
  };
};

/**
 * ============================================================================
 * STRIPPING FUNCTIONS
 * ============================================================================
 */

/**
 * Strip document markers from content
 */
export const stripDocumentMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;

  let result = content.replace(/\{\{DOC:::[\s\S]*?\}\}/g, '');
  result = result.replace(/\{\{DOC:::[^\}]*$/g, '');
  result = result.replace(/\{\{DOC:::[^}]*(?![^{]*\}\})/g, (match) => {
    if (!match.includes('}}')) {
      return '';
    }
    return match;
  });

  return result.trim();
};

/**
 * Strip folder markers from content
 */
export const stripFolderMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;
  return content.replace(/\{\{FOLDER:::([^}]+)\}\}/g, '');
};

/**
 * Strip load more markers from content
 */
export const stripLoadMoreMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;
  return content.replace(/\{\{LOADMORE:::([^}]+)\}\}/g, '');
};

/**
 * Strip ALL marker types from content
 */
export const stripAllMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;

  let cleaned = content;
  cleaned = stripDocumentMarkers(cleaned);
  cleaned = stripFolderMarkers(cleaned);
  cleaned = stripLoadMoreMarkers(cleaned);

  return cleaned.trim();
};

/**
 * Strip ALL document markers (complete or incomplete) from content
 * More aggressive than stripDocumentMarkers
 */
export const stripAllDocumentMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;

  let result = content.replace(/\{\{DOC:::[\s\S]*?\}\}/g, '');
  result = result.replace(/\{\{DOC:::[^\n]*/g, '');

  return result.trim();
};

/**
 * ============================================================================
 * CONTENT SPLITTING
 * ============================================================================
 */

/**
 * Helper to strip incomplete markers from text
 */
const stripIncompleteMarkers = (text) => {
  if (!text) return text;
  return text.replace(/\{\{DOC:::[^\}]*$/g, '')
             .replace(/\{\{DOC:::[^\n]*/g, '')
             .replace(/\{\{FOLDER:::[^\}]*$/g, '')
             .replace(/\{\{LOADMORE:::[^\}]*$/g, '')
             .trim();
};

/**
 * Split content into text and marker segments
 * Returns array of segments: { type: 'text'|'document'|'folder'|'loadmore', content: string|object }
 */
export const splitContentWithMarkers = (content) => {
  if (!content || typeof content !== 'string') {
    return [{ type: 'text', content: content || '' }];
  }

  if (!hasMarkers(content)) {
    const cleanedContent = stripIncompleteMarkers(content);
    return [{ type: 'text', content: cleanedContent }];
  }

  const markers = parseAllMarkers(content);
  const segments = [];
  let lastIndex = 0;

  // Combine all markers with their types and positions
  const allMarkers = [
    ...markers.documents.map(m => ({ ...m, type: 'document', index: content.indexOf(m.marker) })),
    ...markers.folders.map(m => ({ ...m, type: 'folder', index: content.indexOf(m.marker) })),
    ...markers.loadMore.map(m => ({ ...m, type: 'loadmore', index: content.indexOf(m.marker) }))
  ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

  // Split content into alternating text and marker segments
  allMarkers.forEach((marker, idx) => {
    // Add text segment before this marker
    if (marker.index > lastIndex) {
      let textContent = content.substring(lastIndex, marker.index).trim();
      textContent = stripIncompleteMarkers(textContent);
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent
        });
      }
    }

    // Add marker segment
    if (marker.type === 'document') {
      segments.push({
        type: 'document',
        content: {
          documentId: marker.documentId,
          filename: marker.filename,
          mimeType: marker.mimeType,
          size: marker.size,
          fileSize: marker.fileSize,
          folderPath: marker.folderPath
        }
      });
    } else if (marker.type === 'folder') {
      segments.push({
        type: 'folder',
        content: {
          folderId: marker.folderId,
          folderName: marker.folderName,
          fileCount: marker.fileCount,
          folderPath: marker.folderPath
        }
      });
    } else if (marker.type === 'loadmore') {
      segments.push({
        type: 'loadmore',
        content: {
          remainingCount: marker.remainingCount,
          totalCount: marker.totalCount,
          loadedCount: marker.loadedCount
        }
      });
    }

    lastIndex = marker.index + marker.marker.length;
  });

  // Add remaining text after last marker
  if (lastIndex < content.length) {
    let textContent = content.substring(lastIndex).trim();
    textContent = stripIncompleteMarkers(textContent);
    if (textContent) {
      segments.push({
        type: 'text',
        content: textContent
      });
    }
  }

  return segments;
};

/**
 * Split content into text and document segments (LEGACY - for backward compatibility)
 */
export const splitTextWithDocuments = (content) => {
  if (!content || typeof content !== 'string') {
    return [{ type: 'text', content: content || '' }];
  }

  if (!hasInlineDocuments(content)) {
    const cleanedContent = stripIncompleteMarkers(content);
    return [{ type: 'text', content: cleanedContent }];
  }

  const documents = parseInlineDocuments(content);
  const segments = [];
  let lastIndex = 0;

  const sortedDocs = documents
    .map(doc => ({
      ...doc,
      index: content.indexOf(doc.marker)
    }))
    .filter(doc => doc.index !== -1)
    .sort((a, b) => a.index - b.index);

  sortedDocs.forEach(doc => {
    if (doc.index > lastIndex) {
      let textContent = content.substring(lastIndex, doc.index).trim();
      textContent = stripIncompleteMarkers(textContent);
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent
        });
      }
    }

    segments.push({
      type: 'document',
      content: {
        documentId: doc.documentId,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        fileSize: doc.fileSize,
        folderPath: doc.folderPath
      }
    });

    lastIndex = doc.index + doc.marker.length;
  });

  if (lastIndex < content.length) {
    let textContent = content.substring(lastIndex).trim();
    textContent = stripIncompleteMarkers(textContent);
    if (textContent) {
      segments.push({
        type: 'text',
        content: textContent
      });
    }
  }

  return segments;
};

/**
 * ============================================================================
 * UTILITIES
 * ============================================================================
 */

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

export default {
  // Document parsing
  hasInlineDocuments,
  parseInlineDocuments,
  stripDocumentMarkers,
  stripAllDocumentMarkers,

  // Folder parsing (NEW)
  hasInlineFolders,
  parseInlineFolders,
  stripFolderMarkers,

  // Load more parsing (NEW)
  hasLoadMoreMarkers,
  parseLoadMoreMarkers,
  stripLoadMoreMarkers,

  // Unified parsing (NEW)
  hasMarkers,
  parseAllMarkers,
  getMarkerCounts,
  stripAllMarkers,
  splitContentWithMarkers,

  // Legacy compatibility
  splitTextWithDocuments,

  // Utilities
  formatFileSize
};
