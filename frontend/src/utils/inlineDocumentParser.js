/**
 * Inline Document Parser Utility
 *
 * Parses document markers from backend responses and splits content
 * into text and document segments for rendering.
 *
 * Marker Format: {{DOC:::id:::filename:::mimeType:::size:::folderPath}}
 * Supports partial markers with missing fields
 */

/**
 * Check if content contains inline document markers
 * More flexible - matches {{DOC::: followed by anything until }}
 */
export const hasInlineDocuments = (content) => {
  if (!content || typeof content !== 'string') return false;
  // Use [\s\S] to match across newlines
  return /\{\{DOC:::[\s\S]*?\}\}/g.test(content);
};

/**
 * Parse all document markers from content
 * Returns array of document objects
 * Handles variable number of fields
 */
export const parseInlineDocuments = (content) => {
  if (!content || typeof content !== 'string') return [];

  // More flexible regex - captures everything between {{DOC::: and }}, including newlines
  const markerRegex = /\{\{DOC:::([\s\S]*?)\}\}/g;
  const documents = [];
  let match;

  while ((match = markerRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];

    // Split by ::: to get fields
    const fields = innerContent.split(':::');

    // Extract fields with defaults
    const documentId = fields[0] || '';
    const filename = fields[1] ? decodeURIComponent(fields[1]) : 'Document';
    const mimeType = fields[2] || 'application/octet-stream';
    const sizeStr = fields[3] || '';
    const folderPath = fields[4] ? decodeURIComponent(fields[4]) : '';

    // Parse size, handle NaN
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
 * Helper to strip incomplete markers from text
 */
const stripIncompleteMarkers = (text) => {
  if (!text) return text;
  // Remove any {{DOC::: that doesn't have closing }}
  return text.replace(/\{\{DOC:::[^\}]*$/g, '')
             .replace(/\{\{DOC:::[^\n]*/g, '')
             .trim();
};

/**
 * Split content into text and document segments
 * Returns array of segments: { type: 'text'|'document', content: string|object }
 */
export const splitTextWithDocuments = (content) => {
  if (!content || typeof content !== 'string') {
    return [{ type: 'text', content: content || '' }];
  }

  if (!hasInlineDocuments(content)) {
    // Even if no complete markers, strip any incomplete markers
    const cleanedContent = stripIncompleteMarkers(content);
    return [{ type: 'text', content: cleanedContent }];
  }

  const documents = parseInlineDocuments(content);
  const segments = [];
  let lastIndex = 0;

  // Sort documents by their position in the content
  const sortedDocs = documents
    .map(doc => ({
      ...doc,
      index: content.indexOf(doc.marker)
    }))
    .filter(doc => doc.index !== -1)
    .sort((a, b) => a.index - b.index);

  // Split content into alternating text and document segments
  sortedDocs.forEach(doc => {
    // Add text segment before this document
    if (doc.index > lastIndex) {
      let textContent = content.substring(lastIndex, doc.index).trim();
      // Strip any incomplete markers from text
      textContent = stripIncompleteMarkers(textContent);
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent
        });
      }
    }

    // Add document segment
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

  // Add remaining text after last document
  if (lastIndex < content.length) {
    let textContent = content.substring(lastIndex).trim();
    // Strip any incomplete markers from remaining text
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
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Remove document markers from content (for fallback rendering)
 * Also removes incomplete markers that don't have closing }}
 */
export const stripDocumentMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;

  // First, remove complete markers: {{DOC:::...}}
  let result = content.replace(/\{\{DOC:::[\s\S]*?\}\}/g, '');

  // Then, remove incomplete markers that start with {{DOC::: but don't have closing }}
  // This handles cases like {{DOC:::id:::filename... that appear at end of content
  result = result.replace(/\{\{DOC:::[^\}]*$/g, '');

  // Also handle incomplete markers that might be anywhere in text (no closing }})
  // Match {{DOC::: followed by anything until newline or end, but only if no }} follows
  result = result.replace(/\{\{DOC:::[^}]*(?![^{]*\}\})/g, (match) => {
    // Only remove if there's no closing }} nearby
    if (!match.includes('}}')) {
      return '';
    }
    return match;
  });

  return result.trim();
};

/**
 * Strip ALL document markers (complete or incomplete) from content
 * More aggressive than stripDocumentMarkers - ensures no {{DOC::: text ever appears
 */
export const stripAllDocumentMarkers = (content) => {
  if (!content || typeof content !== 'string') return content;

  // Remove complete markers first
  let result = content.replace(/\{\{DOC:::[\s\S]*?\}\}/g, '');

  // Remove any remaining {{DOC::: patterns (incomplete markers)
  result = result.replace(/\{\{DOC:::[^\n]*/g, '');

  return result.trim();
};

export default {
  hasInlineDocuments,
  parseInlineDocuments,
  splitTextWithDocuments,
  formatFileSize,
  stripDocumentMarkers,
  stripAllDocumentMarkers
};
