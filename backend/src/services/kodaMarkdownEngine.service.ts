/**
 * ============================================================================
 * KODA MARKDOWN ENGINE - SINGLE SOURCE OF TRUTH FOR ALL MARKDOWN
 * ============================================================================
 *
 * PURPOSE: Centralize ALL markdown generation in one place
 *
 * CRITICAL RULE: NO DOCUMENT IDs IN OUTPUT
 * - Document names appear as **bold text** only
 * - Frontend matches bold names to document IDs using a name→ID map
 * - IDs are NEVER visible to users in any form
 *
 * RULES:
 * 1. ALL markdown in Koda comes from this engine
 * 2. Document names use pattern: **Name** (bold only, NO links with IDs)
 * 3. Consistent headings, spacing, and formatting everywhere
 * 4. No hand-written markdown elsewhere in the codebase
 *
 * USAGE:
 * - File listings → formatFileListing()
 * - Folder listings → formatFolderListing()
 * - Standard answers → wrapFinalAnswer()
 * - Sections → formatSection()
 * - Bullets → formatBulletList()
 *
 * ============================================================================
 */

export interface KodaFile {
  id: string;
  name: string;
  sizeBytes?: number;
  folderPath?: string;   // "/Finanças/Exercícios"
  extension?: string;    // "pdf", "pptx"
  mimeType?: string;
}

export interface KodaFolder {
  id: string;
  name: string;
  path: string;
  fileCount?: number;
}

export interface KodaSource {
  label: string;
  documentId?: string;
  url?: string;
}

export type SupportedLanguage = 'pt' | 'en' | 'es';

// ============================================================================
// 1. NAME CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up file names - fix encoding issues and duplicates
 */
function prettifyFileName(raw: string): string {
  if (!raw) return 'Documento';

  let cleaned = raw;

  // Fix common UTF-8 encoding issues
  const encodingFixes: Record<string, string> = {
    'Ã¡': 'á', 'Ã ': 'à', 'Ã£': 'ã', 'Ã¢': 'â',
    'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê',
    'Ã­': 'í', 'Ã¬': 'ì',
    'Ã³': 'ó', 'Ã²': 'ò', 'Ãµ': 'õ', 'Ã´': 'ô',
    'Ãº': 'ú', 'Ã¹': 'ù',
    'Ã§': 'ç',
    'Ã': 'Á', 'Ã€': 'À', 'Ãƒ': 'Ã', 'Ã‚': 'Â',
    'Ã‰': 'É', 'Ãˆ': 'È', 'ÃŠ': 'Ê',
    'ÃŒ': 'Ì',
    'Ãš': 'Ú', 'Ã™': 'Ù',
    'Ã‡': 'Ç',
    'Â°': '°', 'Â²': '²', 'Â³': '³',
    'CapiÌ': 'Capí', // Common issue with "Capítulo"
  };

  for (const [wrong, correct] of Object.entries(encodingFixes)) {
    cleaned = cleaned.split(wrong).join(correct);
  }

  // Remove duplicate extensions (e.g., ".pdf.pdf" → ".pdf")
  cleaned = cleaned.replace(/(\.pdf)+$/i, '.pdf');
  cleaned = cleaned.replace(/(\.docx)+$/i, '.docx');
  cleaned = cleaned.replace(/(\.xlsx)+$/i, '.xlsx');
  cleaned = cleaned.replace(/(\.pptx)+$/i, '.pptx');

  // Replace underscores with spaces (optional, makes names more readable)
  // cleaned = cleaned.replace(/_/g, ' ');

  return cleaned.trim();
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return `${value.toFixed(1)} ${units[i]}`;
}

/**
 * Get file extension from name or mimeType
 */
function getExtension(file: KodaFile): string {
  if (file.extension) {
    return file.extension.toUpperCase();
  }

  // Try to extract from name
  const match = file.name?.match(/\.([a-zA-Z0-9]+)$/);
  if (match) {
    return match[1].toUpperCase();
  }

  // Try to infer from mimeType
  if (file.mimeType) {
    const mimeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      'image/jpeg': 'JPG',
      'image/png': 'PNG',
      'text/plain': 'TXT',
    };
    return mimeMap[file.mimeType] || '';
  }

  return '';
}

// ============================================================================
// 2. LANGUAGE-AWARE LABELS
// ============================================================================

interface LanguageLabels {
  foundFiles: (count: number) => string;
  foundFolders: (count: number) => string;
  folder: string;
  files: string;
  sources: string;
  seeMore: string;
}

const LABELS: Record<SupportedLanguage, LanguageLabels> = {
  pt: {
    foundFiles: (n) => `Encontrei ${n} arquivo${n === 1 ? '' : 's'}:`,
    foundFolders: (n) => `Encontrei ${n} pasta${n === 1 ? '' : 's'}:`,
    folder: 'Pasta',
    files: 'arquivos',
    sources: 'Fontes',
    seeMore: 'Ver mais',
  },
  en: {
    foundFiles: (n) => `Found ${n} file${n === 1 ? '' : 's'}:`,
    foundFolders: (n) => `Found ${n} folder${n === 1 ? '' : 's'}:`,
    folder: 'Folder',
    files: 'files',
    sources: 'Sources',
    seeMore: 'See more',
  },
  es: {
    foundFiles: (n) => `Encontré ${n} archivo${n === 1 ? '' : 's'}:`,
    foundFolders: (n) => `Encontré ${n} carpeta${n === 1 ? '' : 's'}:`,
    folder: 'Carpeta',
    files: 'archivos',
    sources: 'Fuentes',
    seeMore: 'Ver más',
  },
};

function getLabels(lang: SupportedLanguage): LanguageLabels {
  return LABELS[lang] || LABELS.pt;
}

// ============================================================================
// 3. FILE & FOLDER LISTING FORMATTERS
// ============================================================================

/**
 * Format a list of files as markdown
 *
 * OUTPUT FORMAT:
 * Encontrei 3 arquivos:
 *
 * 1. **Relatório Financeiro 2024.pdf** (PDF · 2.5 MB · Pasta: `/Finanças`)
 * 2. **Contrato de Serviços.docx** (DOCX · 150 KB · Pasta: `/Contratos`)
 * 3. **Planilha de Custos.xlsx** (XLSX · 85 KB · Pasta: `/Finanças`)
 *
 * IMPORTANT:
 * - Document names are **bold** only (NO IDs, NO links)
 * - Frontend matches bold names to IDs using document map
 * - Clean, readable format for users
 */
export function formatFileListing(
  files: KodaFile[],
  language: SupportedLanguage = 'pt'
): string {
  if (!files || files.length === 0) {
    return language === 'pt'
      ? 'Não encontrei arquivos correspondentes.'
      : language === 'es'
      ? 'No encontré archivos correspondientes.'
      : 'No matching files found.';
  }

  const labels = getLabels(language);
  const prefix = labels.foundFiles(files.length);

  const lines = files.map((file, idx) => {
    const name = prettifyFileName(file.name);
    const ext = getExtension(file);
    const size = formatFileSize(file.sizeBytes);
    const path = file.folderPath || '/';

    // Build metadata string
    const metadata: string[] = [];
    if (ext) metadata.push(ext);
    if (size) metadata.push(size);
    metadata.push(`${labels.folder}: \`${path}\``);

    // Clean format: just bold name, NO ID anywhere
    return `${idx + 1}. **${name}** (${metadata.join(' · ')})`;
  });

  return `${prefix}\n\n${lines.join('\n')}`;
}

/**
 * Format a list of folders as markdown
 *
 * OUTPUT FORMAT:
 * Encontrei 3 pastas:
 *
 * 1. **Finanças** (5 arquivos) - `/Finanças`
 * 2. **Contratos** (3 arquivos) - `/Contratos`
 *
 * IMPORTANT:
 * - Folder names are **bold** only (NO IDs, NO links)
 * - Frontend matches bold names to IDs using folder map
 */
export function formatFolderListing(
  folders: KodaFolder[],
  language: SupportedLanguage = 'pt'
): string {
  if (!folders || folders.length === 0) {
    return language === 'pt'
      ? 'Não encontrei pastas correspondentes.'
      : language === 'es'
      ? 'No encontré carpetas correspondientes.'
      : 'No matching folders found.';
  }

  const labels = getLabels(language);
  const prefix = labels.foundFolders(folders.length);

  const lines = folders.map((folder, idx) => {
    const fileCountStr = folder.fileCount !== undefined
      ? ` (${folder.fileCount} ${labels.files})`
      : '';

    // Clean format: just bold name, NO ID anywhere
    return `${idx + 1}. **${folder.name}**${fileCountStr} - \`${folder.path}\``;
  });

  return `${prefix}\n\n${lines.join('\n')}`;
}

// ============================================================================
// 4. GENERIC MARKDOWN HELPERS
// ============================================================================

/**
 * Format a title (H2 heading)
 */
export function formatTitle(text: string): string {
  if (!text) return '';
  return `## ${text.trim()}\n\n`;
}

/**
 * Format a section with heading (H3) and body
 */
export function formatSection(title: string, body: string): string {
  if (!title || !body) return '';
  return `### ${title.trim()}\n\n${body.trim()}\n\n`;
}

/**
 * Format a bullet list
 */
export function formatBulletList(items: string[]): string {
  if (!items || items.length === 0) return '';
  return items.map(item => `- ${item.trim()}`).join('\n') + '\n\n';
}

/**
 * Format a numbered list
 */
export function formatNumberedList(items: string[]): string {
  if (!items || items.length === 0) return '';
  return items.map((item, idx) => `${idx + 1}. ${item.trim()}`).join('\n') + '\n\n';
}

/**
 * Format sources/references section
 * NOTE: NO document IDs in output - only clean names
 * Frontend matches names to IDs using document map
 */
export function formatSources(
  sources: KodaSource[],
  language: SupportedLanguage = 'pt'
): string {
  if (!sources || sources.length === 0) return '';

  const labels = getLabels(language);

  const lines = sources.map((source, idx) => {
    if (source.url) {
      // External URL - keep as link
      return `${idx + 1}. [${source.label}](${source.url})`;
    } else {
      // Document source - bold name only, NO ID
      // Frontend will match **name** to document ID
      return `${idx + 1}. **${prettifyFileName(source.label)}**`;
    }
  });

  return `\n\n**${labels.sources}:**\n\n${lines.join('\n')}\n`;
}

// ============================================================================
// 5. FINAL ANSWER WRAPPER
// ============================================================================

export interface WrapAnswerOptions {
  title?: string;
  body: string;
  sources?: KodaSource[];
  language?: SupportedLanguage;
}

/**
 * Wrap a complete answer with optional title and sources
 * This is the main function for standard RAG answers
 */
export function wrapFinalAnswer(opts: WrapAnswerOptions): string {
  const parts: string[] = [];
  const lang = opts.language || 'pt';

  // Add title if provided
  if (opts.title) {
    parts.push(formatTitle(opts.title));
  }

  // Add main body
  if (opts.body) {
    parts.push(opts.body.trim());
  }

  // Add sources if provided
  if (opts.sources && opts.sources.length > 0) {
    parts.push(formatSources(opts.sources, lang));
  }

  return parts.join('\n').trim();
}

// ============================================================================
// 6. DOCUMENT LISTING WITH FULL PATHS (FOR FILE_NAVIGATION/FOLDER_NAVIGATION)
// ============================================================================

import type { DocumentListItem, AnswerBlock, StructuredAnswer } from '../types/rag.types';

/**
 * Format a document listing with FULL folder paths
 *
 * THIS IS USED FOR:
 * - FILE_NAVIGATION answers ("quais arquivos tenho?")
 * - FOLDER_NAVIGATION answers ("o que tem na pasta X?")
 * - "which documents talk about X" queries
 *
 * NOT USED FOR:
 * - Inline mentions in text answers (those use **bold** only)
 * - Source citations (those don't need paths)
 *
 * OUTPUT FORMAT (each item):
 * 1. **Relatório Financeiro 2024.pdf**    Pasta: Finanças / Relatórios
 *
 * IMPORTANT:
 * - Document names are **bold** only (NO IDs)
 * - Full path shown as "Pasta: Parent / Child / Grandchild"
 * - Frontend parses this specific format to make names clickable
 */
export function formatDocumentListingMarkdown(
  docs: DocumentListItem[],
  options: {
    language?: SupportedLanguage;
    headerText?: string;
    showTotalCount?: number;  // For "See all X" link
  } = {}
): string {
  const { language = 'pt', headerText, showTotalCount } = options;
  const labels = getLabels(language);

  if (!docs || docs.length === 0) {
    return language === 'pt'
      ? 'Não encontrei arquivos correspondentes.'
      : language === 'es'
      ? 'No encontré archivos correspondientes.'
      : 'No matching files found.';
  }

  const parts: string[] = [];

  // Header (optional custom or auto-generated)
  if (headerText) {
    parts.push(headerText);
  } else {
    parts.push(labels.foundFiles(docs.length));
  }
  parts.push('');  // Empty line after header

  // Document list items
  docs.forEach((doc, idx) => {
    const name = prettifyFileName(doc.filename);
    const pathStr = doc.folderPath?.pathString || 'Root';

    // Format: "1. **Name**    Pasta: Path / Here"
    // Using spaces for alignment (frontend will handle styling)
    parts.push(`${idx + 1}. **${name}**    ${labels.folder}: ${pathStr}`);
  });

  // "See all X" indicator (frontend renders the actual link)
  if (showTotalCount && showTotalCount > docs.length) {
    parts.push('');
    parts.push(`<!-- LOAD_MORE:${showTotalCount} -->`);
  }

  return parts.join('\n');
}

/**
 * Render a StructuredAnswer (array of AnswerBlocks) to markdown
 *
 * This is the main function for converting structured answers to final markdown.
 * It handles both text blocks and document_list blocks appropriately:
 * - text blocks: rendered as-is
 * - document_list blocks: rendered with full paths using formatDocumentListingMarkdown
 */
export function renderStructuredAnswer(
  blocks: StructuredAnswer,
  language: SupportedLanguage = 'pt'
): string {
  if (!blocks || blocks.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.markdown);
    } else if (block.type === 'document_list') {
      parts.push(formatDocumentListingMarkdown(block.docs, {
        language,
        headerText: block.headerText,
        showTotalCount: block.totalCount,
      }));
    }
  }

  return parts.join('\n\n');
}

/**
 * Check if markdown contains a document list (for frontend detection)
 */
export function containsDocumentList(markdown: string): boolean {
  // Look for the numbered list with bold document names pattern
  return /^\d+\.\s+\*\*[^*]+\*\*.*Pasta:/m.test(markdown);
}

// ============================================================================
// 7. SPECIALIZED FORMATTERS
// ============================================================================

/**
 * Format a calculation result
 */
export function formatCalculationResult(
  question: string,
  result: string | number,
  explanation?: string,
  language: SupportedLanguage = 'pt'
): string {
  const parts: string[] = [];

  // Result with emphasis
  parts.push(`**${result}**`);

  // Add explanation if provided
  if (explanation) {
    parts.push('\n\n' + explanation.trim());
  }

  return parts.join('');
}

/**
 * Format an error or clarification message
 */
export function formatSystemMessage(
  message: string,
  type: 'error' | 'info' | 'clarification' = 'info'
): string {
  // Keep it simple and consistent
  return message.trim();
}

/**
 * Format inline document reference (for use within text)
 * Returns: **Document Name** (bold, clickable via frontend name matching)
 * NOTE: NO document ID in output - frontend matches by name
 */
export function formatDocumentReference(
  documentName: string
): string {
  const cleanName = prettifyFileName(documentName);
  return `**${cleanName}**`;
}

/**
 * Format inline folder reference (for use within text)
 * Returns: **Folder Name** (bold, clickable via frontend name matching)
 * NOTE: NO folder ID in output - frontend matches by name
 */
export function formatFolderReference(
  folderName: string
): string {
  return `**${folderName}**`;
}

// ============================================================================
// 7. TEXT CLEANUP UTILITIES
// ============================================================================

/**
 * Fix UTF-8 encoding issues in any text
 */
export function fixUTF8Encoding(text: string): string {
  if (!text) return '';
  return prettifyFileName(text); // Reuse the same logic
}

/**
 * Normalize markdown - ensure consistent spacing and structure
 */
export function normalizeMarkdown(text: string): string {
  if (!text) return '';

  let normalized = text;

  // Remove excessive blank lines (max 2)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  // Ensure headings have proper spacing
  normalized = normalized.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');
  normalized = normalized.replace(/(#{1,6}\s+[^\n]+)\n([^#\n])/g, '$1\n\n$2');

  // Normalize list markers
  normalized = normalized.replace(/^[•\*]\s+/gm, '- ');

  // Trim
  normalized = normalized.trim();

  return normalized;
}

// ============================================================================
// 9. EXPORTS - THE PUBLIC API
// ============================================================================

export const KodaMarkdownEngine = {
  // File/Folder listings (original)
  formatFileListing,
  formatFolderListing,

  // Document listing with FULL paths (for navigation answers)
  formatDocumentListingMarkdown,
  renderStructuredAnswer,
  containsDocumentList,

  // Generic helpers
  formatTitle,
  formatSection,
  formatBulletList,
  formatNumberedList,
  formatSources,

  // Answer wrapper
  wrapFinalAnswer,

  // Specialized formatters
  formatCalculationResult,
  formatSystemMessage,
  formatDocumentReference,
  formatFolderReference,

  // Utilities
  fixUTF8Encoding,
  normalizeMarkdown,
  prettifyFileName,
  formatFileSize,
};

export default KodaMarkdownEngine;
