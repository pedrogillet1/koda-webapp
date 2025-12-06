/**
 * ============================================================================
 * ENHANCED INLINE DOCUMENT INJECTOR
 * ============================================================================
 *
 * PURPOSE: Generate inline document/folder/load-more markers for all query types
 *
 * MARKER FORMATS:
 * - Document: {{DOC:::id:::filename:::mimeType:::fileSize:::folderPath}}
 * - Folder: {{FOLDER:::id:::folderName:::fileCount:::folderPath}}
 * - Load More: {{LOADMORE:::remainingCount:::totalCount:::loadedCount}}
 *
 * QUERY TYPES:
 * - show_file: "show me trabalho projeto"
 * - list_by_format: "what format are my documents"
 * - file_location: "where is trabalho projeto"
 * - folder_search: "which folder has presentations"
 * - list_all: "list all my files"
 */

export interface InlineDocument {
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize?: number;
  folderPath?: string;
}

export interface InlineFolder {
  folderId: string;
  folderName: string;
  fileCount: number;
  folderPath: string;
}

export interface LoadMoreData {
  remainingCount: number;
  totalCount: number;
  loadedCount: number;
}

export type QueryType =
  | 'show_file'        // "show me trabalho projeto"
  | 'list_by_format'   // "what format are my documents"
  | 'file_location'    // "where is trabalho projeto"
  | 'folder_search'    // "which folder has presentations"
  | 'list_all'         // "list all my files"
  | 'unknown';

/**
 * ============================================================================
 * QUERY TYPE DETECTION
 * ============================================================================
 */

/**
 * Detect query type from user message
 */
export function detectQueryType(query: string): QueryType {
  const lowerQuery = query.toLowerCase().trim();

  // "Show me" queries - user wants to see/open specific file
  if (
    lowerQuery.includes('show me') ||
    lowerQuery.includes('open') ||
    lowerQuery.includes('display') ||
    lowerQuery.includes('view')
  ) {
    return 'show_file';
  }

  // Format queries - user wants to know file types
  if (
    lowerQuery.includes('what format') ||
    lowerQuery.includes('which format') ||
    lowerQuery.includes('what type') ||
    lowerQuery.includes('file types')
  ) {
    return 'list_by_format';
  }

  // Location queries - user wants to know where file is
  if (
    lowerQuery.includes('where is') ||
    lowerQuery.includes('where are') ||
    lowerQuery.includes('location of') ||
    lowerQuery.includes('find file')
  ) {
    return 'file_location';
  }

  // Folder queries - user wants to know which folder
  if (
    lowerQuery.includes('which folder') ||
    lowerQuery.includes('what folder') ||
    lowerQuery.includes('in which folder') ||
    lowerQuery.includes('folder contains')
  ) {
    return 'folder_search';
  }

  // List all queries - user wants to see all files
  if (
    lowerQuery.includes('list all') ||
    lowerQuery.includes('show all') ||
    lowerQuery.includes('all files') ||
    lowerQuery.includes('all documents') ||
    lowerQuery.includes('every file')
  ) {
    return 'list_all';
  }

  return 'unknown';
}

/**
 * ============================================================================
 * MARKER GENERATION
 * ============================================================================
 */

/**
 * Generate inline document marker
 * Format: {{DOC:::id:::filename:::mimeType:::fileSize:::folderPath}}
 */
export function createInlineDocumentMarker(doc: InlineDocument): string {
  const parts = [
    'DOC',
    doc.documentId,
    encodeURIComponent(doc.filename),
    doc.mimeType || 'application/octet-stream',
    doc.fileSize?.toString() || '',
    doc.folderPath ? encodeURIComponent(doc.folderPath) : ''
  ];

  return `{{${parts.join(':::')}}}`;
}

/**
 * Generate inline folder marker (NEW)
 * Format: {{FOLDER:::id:::folderName:::fileCount:::folderPath}}
 */
export function createInlineFolderMarker(folder: InlineFolder): string {
  const parts = [
    'FOLDER',
    folder.folderId,
    encodeURIComponent(folder.folderName),
    folder.fileCount.toString(),
    encodeURIComponent(folder.folderPath)
  ];

  return `{{${parts.join(':::')}}}`;
}

/**
 * Generate load more marker (NEW)
 * Format: {{LOADMORE:::remainingCount:::totalCount:::loadedCount}}
 */
export function createLoadMoreMarker(data: LoadMoreData): string {
  const parts = [
    'LOADMORE',
    data.remainingCount.toString(),
    data.totalCount.toString(),
    data.loadedCount.toString()
  ];

  return `{{${parts.join(':::')}}}`;
}

/**
 * ============================================================================
 * RESPONSE GENERATION BY QUERY TYPE
 * ============================================================================
 */

/**
 * Generate response for "show me [filename]" queries
 * Shows single file button + location details
 */
export function generateShowMeResponse(
  document: any,
  options: {
    includeLocation?: boolean;
    includeMetadata?: boolean;
  } = {}
): string {
  const { includeLocation = true, includeMetadata = true } = options;

  const inlineDoc: InlineDocument = {
    documentId: document.id,
    filename: document.filename,
    mimeType: document.mimeType || 'application/octet-stream',
    fileSize: document.fileSize,
    folderPath: document.folder?.name || document.folderPath
  };

  const marker = createInlineDocumentMarker(inlineDoc);

  let response = `Here's what I found for **${document.filename}**:\n\n${marker}`;

  if (includeLocation && document.folderPath) {
    response += `\n\n**Location:** ${document.folderPath}`;
  }

  if (includeMetadata && document.updatedAt) {
    const date = new Date(document.updatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    response += `\n**Last modified:** ${date}`;
  }

  return response;
}

/**
 * Generate response for "what format are my documents" queries
 * Groups files by type, shows 5 per group, adds "load more" if needed
 */
export function generateFormatListingResponse(
  documents: any[],
  options: {
    maxPerGroup?: number;
    includeMetadata?: boolean;
  } = {}
): string {
  const { maxPerGroup = 5, includeMetadata = false } = options;

  if (!documents || documents.length === 0) {
    return 'No documents found.';
  }

  // Group documents by mimeType
  const grouped = groupDocumentsByMimeType(documents);

  let response = `Your documents are available in the following formats:\n\n`;

  // Sort groups by count (descending)
  const sortedGroups = Array.from(grouped.entries())
    .sort((a, b) => b[1].length - a[1].length);

  sortedGroups.forEach(([mimeType, docs]) => {
    const typeName = getFileTypeName(mimeType);
    response += `${typeName.toUpperCase()} (${docs.length} total)\n\n`;

    // Show first N documents
    const displayDocs = docs.slice(0, maxPerGroup);
    displayDocs.forEach(doc => {
      const inlineDoc: InlineDocument = {
        documentId: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        fileSize: includeMetadata ? doc.fileSize : undefined,
        folderPath: includeMetadata ? (doc.folder?.name || doc.folderPath) : undefined
      };
      response += createInlineDocumentMarker(inlineDoc) + '\n';
    });

    // Add "load more" text if needed (not button, just text)
    if (docs.length > maxPerGroup) {
      const remaining = docs.length - maxPerGroup;
      response += `\n+ ${remaining} more ${typeName.toLowerCase()}\n`;
    }

    response += '\n';
  });

  return response.trim();
}

/**
 * Generate response for "where is [filename]" queries
 * Shows file button + location details below
 */
export function generateFileLocationResponse(
  document: any,
  options: {
    includeDetails?: boolean;
  } = {}
): string {
  const { includeDetails = true } = options;

  const inlineDoc: InlineDocument = {
    documentId: document.id,
    filename: document.filename,
    mimeType: document.mimeType || 'application/octet-stream',
    fileSize: document.fileSize,
    folderPath: document.folder?.name || document.folderPath
  };

  const marker = createInlineDocumentMarker(inlineDoc);

  let response = `I found **${document.filename}**:\n\n${marker}`;

  if (includeDetails) {
    response += `\n\n**Location:** ${document.folderPath || 'Root folder'}`;

    if (document.folder?.name) {
      response += `\n**Folder:** ${document.folder.name}`;
    }

    if (document.updatedAt) {
      const date = new Date(document.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      response += `\n**Last modified:** ${date}`;
    }
  }

  return response;
}

/**
 * Generate response for "which folder" queries
 * Shows folder buttons with file counts
 */
export function generateFolderListingResponse(
  folders: any[],
  options: {
    maxFolders?: number;
    includeMetadata?: boolean;
  } = {}
): string {
  const { maxFolders = 10, includeMetadata = true } = options;

  if (!folders || folders.length === 0) {
    return 'No folders found.';
  }

  let response = `I found **${folders.length} folder${folders.length !== 1 ? 's' : ''}**:\n\n`;

  // Show first N folders
  const displayFolders = folders.slice(0, maxFolders);

  displayFolders.forEach(folder => {
    const inlineFolder: InlineFolder = {
      folderId: folder.id,
      folderName: folder.name,
      fileCount: folder.fileCount || folder._count?.documents || 0,
      folderPath: folder.path || `/${folder.name}`
    };

    const marker = createInlineFolderMarker(inlineFolder);
    response += marker;

    if (includeMetadata) {
      response += `\nContains ${inlineFolder.fileCount} file${inlineFolder.fileCount !== 1 ? 's' : ''}`;

      if (folder.updatedAt) {
        const date = new Date(folder.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        response += ` · Last updated ${date}`;
      }
    }

    response += '\n\n';
  });

  // Add "load more" if needed
  if (folders.length > maxFolders) {
    const remaining = folders.length - maxFolders;
    response += `+ ${remaining} more folder${remaining !== 1 ? 's' : ''}\n`;
  }

  return response.trim();
}

/**
 * Generate response for "list all files" queries
 * Shows first 12 files + load more button
 */
export function generateListAllResponse(
  documents: any[],
  options: {
    initialLimit?: number;
    includeMetadata?: boolean;
  } = {}
): string {
  const { initialLimit = 12, includeMetadata = false } = options;

  if (!documents || documents.length === 0) {
    return 'No files found in your library.';
  }

  let response = `You have **${documents.length} file${documents.length !== 1 ? 's' : ''}** in your library:\n\n`;
  response += `RECENT FILES\n\n`;

  // Show first N documents
  const displayDocs = documents.slice(0, initialLimit);

  displayDocs.forEach(doc => {
    const inlineDoc: InlineDocument = {
      documentId: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      fileSize: includeMetadata ? doc.fileSize : undefined,
      folderPath: includeMetadata ? (doc.folder?.name || doc.folderPath) : undefined
    };
    response += createInlineDocumentMarker(inlineDoc) + '\n';
  });

  // Add load more button if needed
  if (documents.length > initialLimit) {
    const loadMoreData: LoadMoreData = {
      remainingCount: documents.length - initialLimit,
      totalCount: documents.length,
      loadedCount: initialLimit
    };
    response += '\n' + createLoadMoreMarker(loadMoreData);
  }

  return response;
}

/**
 * ============================================================================
 * SMART RESPONSE ROUTER
 * ============================================================================
 */

/**
 * Generate appropriate response based on query type
 * This is the main function to use in RAG/chat services
 */
export function generateSmartFileResponse(
  query: string,
  documents: any[],
  folders?: any[],
  options: {
    maxPerGroup?: number;
    initialLimit?: number;
    includeMetadata?: boolean;
  } = {}
): string {
  const queryType = detectQueryType(query);

  switch (queryType) {
    case 'show_file':
      // Single file query
      if (documents.length === 1) {
        return generateShowMeResponse(documents[0], options);
      } else if (documents.length > 1) {
        // Multiple matches, show all
        return generateListAllResponse(documents, { ...options, initialLimit: 12 });
      } else {
        return `I couldn't find a file matching "${query}".`;
      }

    case 'list_by_format':
      // Group by format
      return generateFormatListingResponse(documents, options);

    case 'file_location':
      // Show location
      if (documents.length === 1) {
        return generateFileLocationResponse(documents[0], { includeDetails: options.includeMetadata });
      } else if (documents.length > 1) {
        return `I found ${documents.length} files matching "${query}":\n\n` +
               generateListAllResponse(documents, { ...options, initialLimit: 12 });
      } else {
        return `I couldn't find a file matching "${query}".`;
      }

    case 'folder_search':
      // Show folders
      if (folders && folders.length > 0) {
        return generateFolderListingResponse(folders, options);
      } else {
        return `I couldn't find any folders matching "${query}".`;
      }

    case 'list_all':
      // Show all files with pagination
      return generateListAllResponse(documents, { ...options, initialLimit: 12 });

    default:
      // Fallback to format listing
      return generateFormatListingResponse(documents, options);
  }
}

/**
 * ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Group documents by mimeType
 */
function groupDocumentsByMimeType(documents: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();

  documents.forEach(doc => {
    const mimeType = doc.mimeType || 'application/octet-stream';
    if (!grouped.has(mimeType)) {
      grouped.set(mimeType, []);
    }
    grouped.get(mimeType)!.push(doc);
  });

  return grouped;
}

/**
 * Get human-readable file type name from mimeType
 */
function getFileTypeName(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'PDF Files';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PowerPoint Files';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Word Documents';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Excel Files';
  if (mimeType.includes('image')) return 'Images';
  if (mimeType.includes('video')) return 'Videos';
  if (mimeType.includes('audio')) return 'Audio Files';
  if (mimeType.includes('text')) return 'Text Files';
  if (mimeType.includes('html')) return 'HTML Documents';
  return 'Other Files';
}

/**
 * ============================================================================
 * LEGACY COMPATIBILITY FUNCTIONS
 * ============================================================================
 * These functions maintain backward compatibility with existing code
 */

/**
 * Inject inline document markers into file listing responses (LEGACY)
 */
export function injectInlineDocuments(
  documents: InlineDocument[],
  maxInline: number = 15,
  responsePrefix: string = '',
  responseSuffix: string = ''
): string {
  if (!documents || documents.length === 0) {
    return responsePrefix + '\n\nNo documents found.' + (responseSuffix ? '\n\n' + responseSuffix : '');
  }

  const displayDocs = documents.slice(0, maxInline);
  const remaining = documents.length - displayDocs.length;

  let response = responsePrefix;

  if (responsePrefix) {
    response += '\n\n';
  }

  displayDocs.forEach(doc => {
    response += createInlineDocumentMarker(doc) + '\n';
  });

  if (remaining > 0) {
    // Use LoadMore marker instead of text - renders as "View all X files" button in frontend
    response += '\n' + createLoadMoreMarker({
      remainingCount: remaining,
      totalCount: documents.length,
      loadedCount: displayDocs.length
    });
  }

  if (responseSuffix) {
    response += '\n\n' + responseSuffix;
  }

  return response;
}

/**
 * Parse inline document markers from response text (LEGACY)
 */
export function parseInlineDocuments(text: string): {
  cleanText: string;
  documents: InlineDocument[];
} {
  const documents: InlineDocument[] = [];

  const markerRegex = /\{\{DOC:::([^:]+):::([^:]+):::([^:]+):::([^:]*?):::([^}]*?)\}\}/g;

  let match;
  while ((match = markerRegex.exec(text)) !== null) {
    documents.push({
      documentId: match[1],
      filename: decodeURIComponent(match[2]),
      mimeType: match[3],
      fileSize: match[4] ? parseInt(match[4]) : undefined,
      folderPath: match[5] ? decodeURIComponent(match[5]) : undefined
    });
  }

  const cleanText = text.replace(markerRegex, '').trim();

  return { cleanText, documents };
}

/**
 * Check if response contains inline document markers (LEGACY)
 */
export function hasInlineDocuments(text: string): boolean {
  return /\{\{DOC:::/g.test(text);
}

/**
 * Format file listing response with inline documents (LEGACY - enhanced)
 */
export function formatFileListingResponse(
  documents: any[],
  options: {
    fileType?: string;
    folderName?: string;
    maxInline?: number;
    includeMetadata?: boolean;
  } = {}
): string {
  const { fileType, folderName, maxInline = 15, includeMetadata = true } = options;

  if (!documents || documents.length === 0) {
    let message = 'No files found';
    if (fileType) message += ` of type "${fileType}"`;
    if (folderName) message += ` in folder "${folderName}"`;
    message += '.';
    return message;
  }

  // Build header
  let header = `**Found ${documents.length} file${documents.length !== 1 ? 's' : ''}**`;
  if (fileType) header += ` of type **${fileType.toUpperCase().replace('.', '')}**`;
  if (folderName) header += ` in folder **"${folderName}"**`;
  header += ':';

  // Convert documents to InlineDocument format
  const inlineDocs: InlineDocument[] = documents.map(doc => ({
    documentId: doc.id,
    filename: doc.filename,
    mimeType: doc.mimeType || 'application/octet-stream',
    fileSize: includeMetadata ? doc.fileSize : undefined,
    folderPath: includeMetadata ? (doc.folder?.name || doc.folderPath) : undefined
  }));

  // Inject inline documents
  return injectInlineDocuments(inlineDocs, maxInline, header);
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

export default {
  // Query detection
  detectQueryType,

  // Marker generation
  createInlineDocumentMarker,
  createInlineFolderMarker,
  createLoadMoreMarker,

  // Response generation
  generateShowMeResponse,
  generateFormatListingResponse,
  generateFileLocationResponse,
  generateFolderListingResponse,
  generateListAllResponse,

  // Smart router
  generateSmartFileResponse,

  // Legacy compatibility
  injectInlineDocuments,
  parseInlineDocuments,
  hasInlineDocuments,
  formatFileListingResponse
};
