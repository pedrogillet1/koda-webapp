/**
 * ============================================================================
 * KODA DOCUMENT LISTING FORMATTER SERVICE - LAYER 2A
 * ============================================================================
 *
 * PURPOSE: Format rich document listings with metadata
 *
 * FEATURES:
 * - Rich metadata: dates, size, format, language, topics, folders
 * - Adaptive summary lines based on query type
 * - Stats blocks (file types, avg size, languages)
 * - Load more markers when needed
 *
 * OUTPUT FORMAT:
 * ```
 * You currently have **25 documents** in your workspace.
 *
 * Here's an overview of the **10 most recent**:
 *
 * - **Trabalho_projeto.pdf** {{DOC::...}}
 *   - Folder: /university/projects
 *   - Type: PDF · 14 pages · 1.2 MB
 *   - Language: pt-BR
 *   - Topics: project management, PMI
 *
 * {{LOADMORE::total=25::shown=10::context=workspace_all}}
 * ```
 */

import {
  InlineDocument,
  createInlineDocumentMarker,
  createLoadMoreMarker,
  humanizeFileSize
} from '../utils/kodaMarkerGenerator.service';

// ============================================================================
// TYPE DEFINITIONS
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
// LOCALIZED STRINGS
// ============================================================================

const STRINGS = {
  en: {
    you_have: 'You currently have',
    documents: 'documents',
    document: 'document',
    in_workspace: 'in your workspace',
    most_recent: 'most recent',
    matching: 'matching',
    found: 'I found',
    in_folder: 'in folder',
    about_topic: 'about',
    overview: "Here's an overview of the",
    folder: 'Folder',
    type: 'Type',
    language: 'Language',
    topics: 'Topics',
    not_specified: 'not specified',
    pages: 'pages',
    slides: 'slides',
    created: 'Created',
    updated: 'Updated'
  },
  pt: {
    you_have: 'Você tem atualmente',
    documents: 'documentos',
    document: 'documento',
    in_workspace: 'no seu workspace',
    most_recent: 'mais recentes',
    matching: 'correspondentes a',
    found: 'Encontrei',
    in_folder: 'na pasta',
    about_topic: 'sobre',
    overview: 'Aqui está uma visão geral dos',
    folder: 'Pasta',
    type: 'Tipo',
    language: 'Idioma',
    topics: 'Tópicos',
    not_specified: 'não especificado',
    pages: 'páginas',
    slides: 'slides',
    created: 'Criado',
    updated: 'Atualizado'
  },
  es: {
    you_have: 'Actualmente tienes',
    documents: 'documentos',
    document: 'documento',
    in_workspace: 'en tu espacio de trabajo',
    most_recent: 'más recientes',
    matching: 'que coinciden con',
    found: 'Encontré',
    in_folder: 'en la carpeta',
    about_topic: 'sobre',
    overview: 'Aquí hay una descripción general de los',
    folder: 'Carpeta',
    type: 'Tipo',
    language: 'Idioma',
    topics: 'Temas',
    not_specified: 'no especificado',
    pages: 'páginas',
    slides: 'diapositivas',
    created: 'Creado',
    updated: 'Actualizado'
  }
};

function getStrings(language: string) {
  return STRINGS[language as keyof typeof STRINGS] || STRINGS.en;
}

// ============================================================================
// MAIN FORMATTING FUNCTION
// ============================================================================

/**
 * Format document listing with rich metadata
 *
 * @param options - Document listing options
 * @returns Formatted markdown string
 */
export function formatDocumentListing(options: DocumentListingOptions): string {
  const {
    docs,
    language,
    queryType,
    limit,
    totalCount,
    contextId,
    searchQuery,
    folderPath,
    topic
  } = options;

  const strings = getStrings(language);
  const sections: string[] = [];

  // 1. Summary line
  sections.push(buildSummaryLine(queryType, totalCount, strings, searchQuery, folderPath, topic));

  // 2. Overview line (if showing list)
  if (docs.length > 0 && queryType !== 'COUNT_ONLY') {
    sections.push(buildOverviewLine(queryType, docs.length, totalCount, strings));
  }

  // 3. Document detail blocks
  if (docs.length > 0 && queryType !== 'COUNT_ONLY') {
    const docBlocks = docs.slice(0, limit).map(doc => buildDocDetailBlock(doc, strings));
    sections.push(docBlocks.join('\n\n'));
  }

  // 4. Load more marker (if needed)
  if (docs.length > limit) {
    const loadMoreMarker = createLoadMoreMarker({
      totalCount: totalCount,
      shownCount: limit,
      contextId: contextId
    });
    sections.push(loadMoreMarker);
  }

  return sections.join('\n\n');
}

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================

/**
 * Build summary line based on query type
 */
function buildSummaryLine(
  queryType: QueryType,
  totalCount: number,
  strings: any,
  searchQuery?: string,
  folderPath?: string,
  topic?: string
): string {
  const docWord = totalCount === 1 ? strings.document : strings.documents;

  switch (queryType) {
    case 'COUNT_ONLY':
      return `${strings.you_have} **${totalCount} ${docWord}** ${strings.in_workspace}.`;

    case 'LIST_RECENT':
      return `${strings.you_have} **${totalCount} ${docWord}** ${strings.in_workspace}.`;

    case 'LIST_MATCHING_TITLE':
      if (searchQuery) {
        return `${strings.found} **${totalCount} ${docWord}** ${strings.matching} "${searchQuery}".`;
      }
      return `${strings.found} **${totalCount} ${docWord}**.`;

    case 'LIST_ALL':
      return `${strings.you_have} **${totalCount} ${docWord}** ${strings.in_workspace}.`;

    case 'LIST_BY_FOLDER':
      if (folderPath) {
        return `${strings.found} **${totalCount} ${docWord}** ${strings.in_folder} \`${folderPath}\`.`;
      }
      return `${strings.found} **${totalCount} ${docWord}**.`;

    case 'LIST_BY_TOPIC':
      if (topic) {
        return `${strings.found} **${totalCount} ${docWord}** ${strings.about_topic} "${topic}".`;
      }
      return `${strings.found} **${totalCount} ${docWord}**.`;

    default:
      return `${strings.you_have} **${totalCount} ${docWord}** ${strings.in_workspace}.`;
  }
}

/**
 * Build overview line
 */
function buildOverviewLine(
  queryType: QueryType,
  shownCount: number,
  totalCount: number,
  strings: any
): string {
  const docWord = shownCount === 1 ? strings.document : strings.documents;

  switch (queryType) {
    case 'LIST_RECENT':
      if (shownCount < totalCount) {
        return `${strings.overview} **${shownCount} ${strings.most_recent}** (out of ${totalCount}):`;
      }
      return `${strings.overview} **${shownCount} ${strings.most_recent}**:`;

    case 'LIST_MATCHING_TITLE':
    case 'LIST_BY_FOLDER':
    case 'LIST_BY_TOPIC':
      if (shownCount < totalCount) {
        return `${strings.overview} **${shownCount} ${docWord}** (out of ${totalCount}):`;
      }
      return `${strings.overview} **${shownCount} ${docWord}**:`;

    case 'LIST_ALL':
      return `${strings.overview} **${shownCount} ${docWord}**:`;

    default:
      return `${strings.overview} **${shownCount} ${docWord}**:`;
  }
}

/**
 * Build document detail block with all metadata
 */
function buildDocDetailBlock(doc: InlineDocument, strings: any): string {
  const lines: string[] = [];

  // First line: **filename** {{DOC::...}}
  const marker = createInlineDocumentMarker(doc);
  lines.push(`- **${doc.filename}** ${marker}`);

  // Folder path
  if (doc.folderPath) {
    lines.push(`  - ${strings.folder}: \`${doc.folderPath}\``);
  }

  // Type, pages/slides, size
  const typeLine = buildTypeLine(doc, strings);
  if (typeLine) {
    lines.push(`  - ${strings.type}: ${typeLine}`);
  }

  // Language
  if (doc.language) {
    lines.push(`  - ${strings.language}: ${doc.language}`);
  } else {
    lines.push(`  - ${strings.language}: ${strings.not_specified}`);
  }

  // Topics
  if (doc.topics && doc.topics.length > 0) {
    lines.push(`  - ${strings.topics}: ${doc.topics.join(', ')}`);
  }

  // Created/Updated dates (optional)
  if (doc.createdAt) {
    const createdDate = formatDate(doc.createdAt);
    lines.push(`  - ${strings.created}: ${createdDate}`);
  }

  if (doc.updatedAt && doc.updatedAt !== doc.createdAt) {
    const updatedDate = formatDate(doc.updatedAt);
    lines.push(`  - ${strings.updated}: ${updatedDate}`);
  }

  return lines.join('\n');
}

/**
 * Build type line with extension, pages/slides, and size
 */
function buildTypeLine(doc: InlineDocument, strings: any): string {
  const parts: string[] = [];

  // Extension
  if (doc.extension) {
    parts.push(doc.extension.toUpperCase());
  }

  // Pages or slides
  if (doc.pageCount) {
    parts.push(`${doc.pageCount} ${strings.pages}`);
  } else if (doc.slideCount) {
    parts.push(`${doc.slideCount} ${strings.slides}`);
  }

  // File size
  if (doc.fileSize) {
    parts.push(humanizeFileSize(doc.fileSize));
  }

  return parts.join(' · ');
}

/**
 * Format date string
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// ============================================================================
// STATS BLOCK (OPTIONAL FEATURE)
// ============================================================================

/**
 * Build stats block with file types, avg size, languages
 *
 * This is an optional feature that can be added to document listings
 * to provide high-level statistics about the documents.
 */
export function buildStatsBlock(docs: InlineDocument[], strings: any): string {
  if (docs.length === 0) return '';

  const stats: string[] = [];

  // File types distribution
  const typeCount: { [key: string]: number } = {};
  docs.forEach(doc => {
    const type = doc.extension || 'unknown';
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  const topTypes = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${type.toUpperCase()} (${count})`)
    .join(', ');

  if (topTypes) {
    stats.push(`**File types:** ${topTypes}`);
  }

  // Average size
  const sizes = docs.filter(d => d.fileSize).map(d => d.fileSize!);
  if (sizes.length > 0) {
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    stats.push(`**Average size:** ${humanizeFileSize(avgSize)}`);
  }

  // Languages
  const languages = new Set(docs.filter(d => d.language).map(d => d.language!));
  if (languages.size > 0) {
    stats.push(`**Languages:** ${Array.from(languages).join(', ')}`);
  }

  return stats.join(' · ');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  formatDocumentListing,
  buildStatsBlock
};
