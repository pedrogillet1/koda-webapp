/**
 * ============================================================================
 * DOCUMENT NAME FORMATTER SERVICE
 * ============================================================================
 *
 * Formats document names in answers to be:
 * 1. **Bold** for emphasis
 * 2. Clickable (with markers for frontend parsing)
 * 3. Linked to preview modal
 *
 * Backend adds markers: [[DOC:documentId:documentName]]
 * Frontend parses markers and renders as clickable bold links
 *
 * ============================================================================
 */

export interface Source {
  documentId?: string;
  documentName?: string;
  filename?: string;
  title?: string;
  pageNumber?: number;
  chunkId?: string;
}

export interface FormattedDocument {
  documentId: string;
  documentName: string;
  occurrences: number;
}

// ============================================================================
// MAIN FORMATTING FUNCTION
// ============================================================================

/**
 * Format document names in answer text with clickable markers
 *
 * @param answer - The answer text to format
 * @param sources - Array of sources with document information
 * @returns Formatted answer with document name markers
 */
export function formatDocumentNamesForFrontend(
  answer: string,
  sources: Source[]
): string {
  if (!sources || sources.length === 0) {
    return answer;
  }

  let formatted = answer;

  // Extract unique document names with their IDs
  const documentMap = extractUniqueDocuments(sources);

  // Sort by name length (longest first) to avoid partial matches
  const sortedDocuments = Array.from(documentMap.values())
    .sort((a, b) => b.documentName.length - a.documentName.length);

  // Replace each document name with marker
  for (const doc of sortedDocuments) {
    formatted = replaceDocumentNameWithMarker(formatted, doc);
  }

  return formatted;
}

/**
 * Extract unique documents from sources
 */
function extractUniqueDocuments(sources: Source[]): Map<string, FormattedDocument> {
  const documentMap = new Map<string, FormattedDocument>();

  for (const source of sources) {
    const documentName = source.documentName || source.filename || source.title;
    const documentId = source.documentId;

    if (!documentName || !documentId) continue;

    if (documentMap.has(documentId)) {
      // Increment occurrence count
      const existing = documentMap.get(documentId)!;
      existing.occurrences++;
    } else {
      // Add new document
      documentMap.set(documentId, {
        documentId,
        documentName,
        occurrences: 1
      });
    }
  }

  return documentMap;
}

/**
 * Replace document name with clickable marker
 */
function replaceDocumentNameWithMarker(
  text: string,
  doc: FormattedDocument
): string {
  const { documentId, documentName } = doc;

  // Escape special regex characters in document name
  const escapedName = escapeRegex(documentName);

  // Create regex to match document name (case-insensitive, whole word)
  // Check if already inside a marker [[DOC:...]]
  const regex = new RegExp(
    `(?<!\\[\\[DOC:[^\\]]*)(\\b${escapedName}\\b)(?![^\\[]*\\]\\])`,
    'gi'
  );

  // Replace with marker
  const marker = `[[DOC:${documentId}:$1]]`;
  return text.replace(regex, marker);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// "SEE ALL" LINK FORMATTING
// ============================================================================

/**
 * Add "See all" link when document list is truncated
 *
 * @param answer - The answer text
 * @param documentCount - Total number of documents
 * @param shownCount - Number of documents shown in the answer
 * @param language - User's language (pt, en, es, fr)
 * @returns Answer with "See all" link appended
 */
export function addSeeAllLink(
  answer: string,
  documentCount: number,
  shownCount: number,
  language: string = 'en'
): string {
  if (documentCount <= shownCount) {
    return answer;
  }

  const remainingCount = documentCount - shownCount;

  const seeAllTexts: Record<string, string> = {
    pt: `\n\n...e mais ${remainingCount}. [[SEE_ALL:Ver todos os documentos]]`,
    en: `\n\n...and ${remainingCount} more. [[SEE_ALL:View all documents]]`,
    es: `\n\n...y ${remainingCount} más. [[SEE_ALL:Ver todos los documentos]]`,
    fr: `\n\n...et ${remainingCount} de plus. [[SEE_ALL:Voir tous les documents]]`,
  };

  const seeAllText = seeAllTexts[language] || seeAllTexts.en;

  return answer + seeAllText;
}

// ============================================================================
// DOCUMENT LIST FORMATTING
// ============================================================================

/**
 * Format a list of documents with markers
 * Used when listing documents in answers
 *
 * @param documents - Array of documents to format
 * @param language - User's language
 * @param maxShown - Maximum number of documents to show (default: 5)
 * @returns Formatted document list with markers
 */
export function formatDocumentList(
  documents: Array<{ documentId: string; documentName: string }>,
  language: string = 'en',
  maxShown: number = 5
): string {
  if (documents.length === 0) {
    const noDocsTexts: Record<string, string> = {
      pt: 'Você não tem documentos ainda.',
      en: 'You don\'t have any documents yet.',
      es: 'No tienes documentos todavía.',
      fr: 'Vous n\'avez pas encore de documents.',
    };
    return noDocsTexts[language] || noDocsTexts.en;
  }

  const headerTexts: Record<string, string> = {
    pt: `Você tem ${documents.length} documento${documents.length > 1 ? 's' : ''}:`,
    en: `You have ${documents.length} document${documents.length > 1 ? 's' : ''}:`,
    es: `Tienes ${documents.length} documento${documents.length > 1 ? 's' : ''}:`,
    fr: `Vous avez ${documents.length} document${documents.length > 1 ? 's' : ''}:`,
  };

  const header = headerTexts[language] || headerTexts.en;

  // Show first N documents
  const shownDocs = documents.slice(0, maxShown);
  const docList = shownDocs
    .map(doc => `• [[DOC:${doc.documentId}:${doc.documentName}]]`)
    .join('\n');

  let result = `${header}\n\n${docList}`;

  // Add "See all" link if truncated
  if (documents.length > maxShown) {
    result = addSeeAllLink(result, documents.length, maxShown, language);
  }

  return result;
}

// ============================================================================
// FOLDER LINK FORMATTING
// ============================================================================

/**
 * Format folder name with clickable marker
 *
 * @param folderId - The folder ID
 * @param folderName - The folder name
 * @returns Formatted folder marker
 */
export function formatFolderLink(folderId: string, folderName: string): string {
  return `[[FOLDER:${folderId}:${folderName}]]`;
}

/**
 * Format a list of folders with markers
 *
 * @param folders - Array of folders to format
 * @param language - User's language
 * @param maxShown - Maximum number of folders to show
 * @returns Formatted folder list with markers
 */
export function formatFolderList(
  folders: Array<{ folderId: string; folderName: string; documentCount?: number }>,
  language: string = 'en',
  maxShown: number = 5
): string {
  if (folders.length === 0) {
    const noFoldersTexts: Record<string, string> = {
      pt: 'Você não tem pastas ainda.',
      en: 'You don\'t have any folders yet.',
      es: 'No tienes carpetas todavía.',
      fr: 'Vous n\'avez pas encore de dossiers.',
    };
    return noFoldersTexts[language] || noFoldersTexts.en;
  }

  const headerTexts: Record<string, string> = {
    pt: `Você tem ${folders.length} pasta${folders.length > 1 ? 's' : ''}:`,
    en: `You have ${folders.length} folder${folders.length > 1 ? 's' : ''}:`,
    es: `Tienes ${folders.length} carpeta${folders.length > 1 ? 's' : ''}:`,
    fr: `Vous avez ${folders.length} dossier${folders.length > 1 ? 's' : ''}:`,
  };

  const header = headerTexts[language] || headerTexts.en;

  // Show first N folders
  const shownFolders = folders.slice(0, maxShown);
  const folderList = shownFolders
    .map(folder => {
      const countStr = folder.documentCount !== undefined
        ? ` (${folder.documentCount} ${folder.documentCount === 1 ? 'doc' : 'docs'})`
        : '';
      return `• [[FOLDER:${folder.folderId}:${folder.folderName}]]${countStr}`;
    })
    .join('\n');

  let result = `${header}\n\n${folderList}`;

  // Add "See all" link if truncated
  if (folders.length > maxShown) {
    const remaining = folders.length - maxShown;
    const seeAllTexts: Record<string, string> = {
      pt: `\n\n...e mais ${remaining}. [[SEE_ALL:Ver todas as pastas]]`,
      en: `\n\n...and ${remaining} more. [[SEE_ALL:View all folders]]`,
      es: `\n\n...y ${remaining} más. [[SEE_ALL:Ver todas las carpetas]]`,
      fr: `\n\n...et ${remaining} de plus. [[SEE_ALL:Voir tous les dossiers]]`,
    };
    result += seeAllTexts[language] || seeAllTexts.en;
  }

  return result;
}

// ============================================================================
// INLINE DOCUMENT CITATION
// ============================================================================

/**
 * Create an inline document citation marker
 * Used when referencing a specific document within answer text
 *
 * @param documentId - The document ID
 * @param documentName - The document name
 * @returns Inline citation marker
 */
export function createInlineCitation(documentId: string, documentName: string): string {
  return `[[DOC:${documentId}:${documentName}]]`;
}

/**
 * Create an inline citation with page number
 *
 * @param documentId - The document ID
 * @param documentName - The document name
 * @param pageNumber - The page number
 * @returns Inline citation marker with page info
 */
export function createInlineCitationWithPage(
  documentId: string,
  documentName: string,
  pageNumber: number
): string {
  return `[[DOC:${documentId}:${documentName} (p. ${pageNumber})]]`;
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Test the document name formatting
 */
export function testDocumentNameFormatting(): void {
  const testSources: Source[] = [
    {
      documentId: 'doc1',
      documentName: 'analise_mezanino_guarda_moveis.pdf',
      pageNumber: 1
    },
    {
      documentId: 'doc2',
      documentName: 'contrato_locacao.pdf',
      pageNumber: 3
    },
    {
      documentId: 'doc1',
      documentName: 'analise_mezanino_guarda_moveis.pdf',
      pageNumber: 5
    }
  ];

  const testAnswer = `
O documento analise_mezanino_guarda_moveis.pdf apresenta uma análise detalhada.
No contrato_locacao.pdf, você encontra as cláusulas de rescisão.
Ambos os documentos (analise_mezanino_guarda_moveis.pdf e contrato_locacao.pdf) são importantes.
  `.trim();

  const formatted = formatDocumentNamesForFrontend(testAnswer, testSources);

  console.log('=== DOCUMENT NAME FORMATTING TEST ===');
  console.log('\nOriginal:');
  console.log(testAnswer);
  console.log('\nFormatted:');
  console.log(formatted);
  console.log('\nExpected markers:');
  console.log('[[DOC:doc1:analise_mezanino_guarda_moveis.pdf]]');
  console.log('[[DOC:doc2:contrato_locacao.pdf]]');
}

/**
 * Test the document list formatting
 */
export function testDocumentListFormatting(): void {
  const testDocuments = [
    { documentId: 'doc1', documentName: 'Project Management.pptx' },
    { documentId: 'doc2', documentName: 'OBA_marketing_servicos.pdf' },
    { documentId: 'doc3', documentName: 'Anotações Aula 2.pdf' },
    { documentId: 'doc4', documentName: 'Koda_AI_Testing_Suite.docx' },
    { documentId: 'doc5', documentName: 'Contract_v2.pdf' },
    { documentId: 'doc6', documentName: 'Financial_Analysis.xlsx' },
    { documentId: 'doc7', documentName: 'Meeting_Notes.docx' },
  ];

  console.log('\n=== DOCUMENT LIST FORMATTING TEST ===');
  console.log('\nPortuguese (showing 5 of 7):');
  console.log(formatDocumentList(testDocuments, 'pt', 5));
  console.log('\nEnglish (showing 5 of 7):');
  console.log(formatDocumentList(testDocuments, 'en', 5));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  formatDocumentNamesForFrontend,
  addSeeAllLink,
  formatDocumentList,
  formatFolderLink,
  formatFolderList,
  createInlineCitation,
  createInlineCitationWithPage,
  testDocumentNameFormatting,
  testDocumentListFormatting
};
