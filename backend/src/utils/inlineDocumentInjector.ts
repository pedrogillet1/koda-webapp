/**
 * Inline Document Injector
 * Injects special markers into LLM responses that will be replaced with document buttons on frontend
 *
 * Usage:
 * 1. Backend: Inject markers like {{DOC:::documentId:::filename:::mimeType:::size:::folder}} into response
 * 2. Frontend: Parse markers and replace with InlineDocumentButton components
 *
 * Example:
 * Input: "Found 3 files:\n\n{{DOC:::abc123:::report.pdf:::application/pdf:::1024:::Finance}}"
 * Output: Frontend renders document buttons inline
 */

export interface InlineDocument {
  documentId: string;
  filename: string;
  mimeType: string;
  fileSize?: number;
  folderPath?: string;
}

/**
 * Generate inline document marker for backend responses
 */
export function createInlineDocumentMarker(doc: InlineDocument): string {
  // Format: {{DOC:::id:::filename:::mimeType:::fileSize:::folderPath}}
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
 * Inject inline document markers into file listing responses
 *
 * @param documents - Array of documents to inject
 * @param maxInline - Maximum number of documents to show inline (default: 15)
 * @param responsePrefix - Text to show before document buttons
 * @param responseSuffix - Text to show after document buttons
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

  // Limit to maxInline documents
  const displayDocs = documents.slice(0, maxInline);
  const remaining = documents.length - displayDocs.length;

  // Build response with inline markers
  let response = responsePrefix;

  if (responsePrefix) {
    response += '\n\n';
  }

  // Add document markers
  displayDocs.forEach(doc => {
    response += createInlineDocumentMarker(doc) + '\n';
  });

  // Add "showing X of Y" message if truncated
  if (remaining > 0) {
    response += `\n_Showing ${displayDocs.length} of ${documents.length} files. ${remaining} more not displayed._`;
  }

  if (responseSuffix) {
    response += '\n\n' + responseSuffix;
  }

  return response;
}

/**
 * Parse inline document markers from response text
 * Used by frontend to extract document data
 */
export function parseInlineDocuments(text: string): {
  cleanText: string;
  documents: InlineDocument[];
} {
  const documents: InlineDocument[] = [];

  // Regex to match {{DOC:::id:::filename:::mimeType:::fileSize:::folderPath}}
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

  // Remove markers from text
  const cleanText = text.replace(markerRegex, '').trim();

  return { cleanText, documents };
}

/**
 * Check if response contains inline document markers
 */
export function hasInlineDocuments(text: string): boolean {
  return /\{\{DOC:::/g.test(text);
}

/**
 * Format file listing response with inline documents
 * This is the main function to use in file action handlers
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

export default {
  createInlineDocumentMarker,
  injectInlineDocuments,
  parseInlineDocuments,
  hasInlineDocuments,
  formatFileListingResponse
};
