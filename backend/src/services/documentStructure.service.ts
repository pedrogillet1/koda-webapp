/**
 * Document Structure Service
 *
 * Analyzes and extracts structural elements from documents including:
 * - Headers and sections
 * - Tables and lists
 * - Paragraphs and text blocks
 * - Page breaks and footnotes
 * - Document hierarchy and outline
 */

import { retryWithBackoff } from '../utils/retryUtils';

export interface DocumentSection {
  id: string;
  type: 'header' | 'paragraph' | 'list' | 'table' | 'footnote' | 'caption' | 'blockquote';
  level?: number; // For headers: h1=1, h2=2, etc.
  content: string;
  startOffset: number;
  endOffset: number;
  parent?: string; // Parent section ID for hierarchy
  children?: string[]; // Child section IDs
  metadata?: Record<string, any>;
}

export interface TableStructure {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  startOffset: number;
  endOffset: number;
}

export interface ListStructure {
  id: string;
  type: 'ordered' | 'unordered' | 'definition';
  items: Array<{
    content: string;
    level: number;
    index?: number;
  }>;
  startOffset: number;
  endOffset: number;
}

export interface DocumentOutline {
  title?: string;
  sections: Array<{
    id: string;
    title: string;
    level: number;
    children: DocumentOutline['sections'];
  }>;
}

export interface DocumentStructureResult {
  sections: DocumentSection[];
  tables: TableStructure[];
  lists: ListStructure[];
  outline: DocumentOutline;
  metadata: {
    totalSections: number;
    totalTables: number;
    totalLists: number;
    maxHeaderDepth: number;
    wordCount: number;
    characterCount: number;
  };
}

// Regular expressions for structure detection
const HEADER_PATTERNS = [
  // Markdown-style headers
  /^(#{1,6})\s+(.+)$/gm,
  // Numbered headers (1. Introduction, 1.1 Background)
  /^(\d+(?:\.\d+)*)\s+([A-Z][^\n]+)$/gm,
  // ALL CAPS headers
  /^([A-Z][A-Z\s]{2,})$/gm,
  // Headers with colons (Section: Title)
  /^([A-Za-z\s]+):\s*(.+)$/gm,
];

const TABLE_PATTERNS = [
  // Markdown tables
  /\|[^\n]+\|\n\|[-:|\s]+\|\n(?:\|[^\n]+\|\n?)+/g,
  // Tab-separated tables (simple detection)
  /(?:^[^\t\n]+(?:\t[^\t\n]+)+$\n?){3,}/gm,
];

const LIST_PATTERNS = [
  // Markdown unordered lists
  /^[\s]*[-*+]\s+.+$/gm,
  // Markdown ordered lists
  /^[\s]*\d+[.)]\s+.+$/gm,
  // Letter lists (a), b), etc.)
  /^[\s]*[a-z][.)]\s+.+$/gim,
];

/**
 * Generate a unique ID for sections
 */
function generateId(): string {
  return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract headers from document text
 */
function extractHeaders(text: string): DocumentSection[] {
  const headers: DocumentSection[] = [];
  const lines = text.split('\n');
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for markdown headers
    const mdMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (mdMatch) {
      headers.push({
        id: generateId(),
        type: 'header',
        level: mdMatch[1].length,
        content: mdMatch[2].trim(),
        startOffset: offset,
        endOffset: offset + line.length,
      });
    }

    // Check for numbered headers (1. Introduction)
    const numMatch = trimmedLine.match(/^(\d+(?:\.\d+)*)\s+([A-Z][^\n]+)$/);
    if (numMatch) {
      const level = numMatch[1].split('.').length;
      headers.push({
        id: generateId(),
        type: 'header',
        level,
        content: `${numMatch[1]} ${numMatch[2]}`.trim(),
        startOffset: offset,
        endOffset: offset + line.length,
        metadata: { numbering: numMatch[1] }
      });
    }

    // Check for ALL CAPS headers (minimum 3 chars, not just acronyms)
    if (trimmedLine.length > 3 &&
        trimmedLine === trimmedLine.toUpperCase() &&
        /[A-Z]/.test(trimmedLine) &&
        !/^\d/.test(trimmedLine) &&
        !trimmedLine.includes('|') &&
        trimmedLine.split(' ').length <= 10) {
      headers.push({
        id: generateId(),
        type: 'header',
        level: 1,
        content: trimmedLine,
        startOffset: offset,
        endOffset: offset + line.length,
      });
    }

    offset += line.length + 1; // +1 for newline
  }

  return headers;
}

/**
 * Extract tables from document text
 */
function extractTables(text: string): TableStructure[] {
  const tables: TableStructure[] = [];

  // Markdown table extraction
  const mdTableRegex = /\|[^\n]+\|\n\|[-:|\s]+\|\n(?:\|[^\n]+\|\n?)+/g;
  let match;

  while ((match = mdTableRegex.exec(text)) !== null) {
    const tableText = match[0];
    const lines = tableText.trim().split('\n');

    if (lines.length >= 2) {
      // Parse header row
      const headerRow = lines[0];
      const headers = headerRow
        .split('|')
        .filter(cell => cell.trim())
        .map(cell => cell.trim());

      // Parse data rows (skip separator row at index 1)
      const rows: string[][] = [];
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i]
          .split('|')
          .filter(cell => cell.trim())
          .map(cell => cell.trim());
        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      tables.push({
        id: generateId(),
        headers,
        rows,
        startOffset: match.index,
        endOffset: match.index + tableText.length,
      });
    }
  }

  return tables;
}

/**
 * Extract lists from document text
 */
function extractLists(text: string): ListStructure[] {
  const lists: ListStructure[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let currentList: ListStructure | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for unordered list items
    const unorderedMatch = line.match(/^([\s]*)[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      const level = Math.floor(unorderedMatch[1].length / 2);
      const content = unorderedMatch[2];

      if (!currentList || currentList.type !== 'unordered') {
        if (currentList) lists.push(currentList);
        currentList = {
          id: generateId(),
          type: 'unordered',
          items: [],
          startOffset: offset,
          endOffset: offset + line.length,
        };
      }

      currentList.items.push({ content, level });
      currentList.endOffset = offset + line.length;
    }
    // Check for ordered list items
    else if (line.match(/^([\s]*)\d+[.)]\s+(.+)$/)) {
      const orderedMatch = line.match(/^([\s]*)(\d+)[.)]\s+(.+)$/);
      if (orderedMatch) {
        const level = Math.floor(orderedMatch[1].length / 2);
        const index = parseInt(orderedMatch[2]);
        const content = orderedMatch[3];

        if (!currentList || currentList.type !== 'ordered') {
          if (currentList) lists.push(currentList);
          currentList = {
            id: generateId(),
            type: 'ordered',
            items: [],
            startOffset: offset,
            endOffset: offset + line.length,
          };
        }

        currentList.items.push({ content, level, index });
        currentList.endOffset = offset + line.length;
      }
    }
    // Non-list line
    else if (currentList && line.trim() === '') {
      // Empty line might end the list
    } else if (currentList && !line.match(/^\s/)) {
      // Non-indented, non-list line ends the list
      lists.push(currentList);
      currentList = null;
    }

    offset += line.length + 1;
  }

  if (currentList) {
    lists.push(currentList);
  }

  return lists;
}

/**
 * Extract paragraphs from document text
 */
function extractParagraphs(
  text: string,
  existingSections: DocumentSection[]
): DocumentSection[] {
  const paragraphs: DocumentSection[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let currentParagraph = '';
  let paragraphStart = 0;

  // Build a set of offsets that are already covered by headers/tables/lists
  const coveredRanges: Array<[number, number]> = existingSections.map(s => [s.startOffset, s.endOffset]);

  function isOffsetCovered(start: number, end: number): boolean {
    return coveredRanges.some(([rangeStart, rangeEnd]) =>
      (start >= rangeStart && start < rangeEnd) ||
      (end > rangeStart && end <= rangeEnd)
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      // End of paragraph
      if (currentParagraph.trim() && !isOffsetCovered(paragraphStart, offset)) {
        paragraphs.push({
          id: generateId(),
          type: 'paragraph',
          content: currentParagraph.trim(),
          startOffset: paragraphStart,
          endOffset: offset - 1,
        });
      }
      currentParagraph = '';
      paragraphStart = offset + line.length + 1;
    } else {
      if (currentParagraph === '') {
        paragraphStart = offset;
      }
      currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
    }

    offset += line.length + 1;
  }

  // Don't forget the last paragraph
  if (currentParagraph.trim() && !isOffsetCovered(paragraphStart, offset)) {
    paragraphs.push({
      id: generateId(),
      type: 'paragraph',
      content: currentParagraph.trim(),
      startOffset: paragraphStart,
      endOffset: offset,
    });
  }

  return paragraphs;
}

/**
 * Build document outline from headers
 */
function buildOutline(headers: DocumentSection[]): DocumentOutline {
  const outline: DocumentOutline = {
    sections: []
  };

  const stack: Array<{ level: number; sections: DocumentOutline['sections'] }> = [
    { level: 0, sections: outline.sections }
  ];

  for (const header of headers) {
    const level = header.level || 1;
    const section = {
      id: header.id,
      title: header.content,
      level,
      children: []
    };

    // Find parent level
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    // Add to parent
    stack[stack.length - 1].sections.push(section);

    // Push this section for potential children
    stack.push({ level, sections: section.children });
  }

  // Extract title from first h1
  const h1 = headers.find(h => h.level === 1);
  if (h1) {
    outline.title = h1.content;
  }

  return outline;
}

/**
 * Build section hierarchy from headers
 */
function buildHierarchy(sections: DocumentSection[]): DocumentSection[] {
  const headers = sections.filter(s => s.type === 'header');
  const nonHeaders = sections.filter(s => s.type !== 'header');

  // Sort by offset
  headers.sort((a, b) => a.startOffset - b.startOffset);

  // Assign parent-child relationships
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    header.children = [];

    // Find parent (previous header with lower level number = higher in hierarchy)
    for (let j = i - 1; j >= 0; j--) {
      if ((headers[j].level || 1) < (header.level || 1)) {
        header.parent = headers[j].id;
        if (!headers[j].children) headers[j].children = [];
        headers[j].children!.push(header.id);
        break;
      }
    }
  }

  // Assign non-headers to their containing header
  for (const section of nonHeaders) {
    // Find the header that contains this section
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].startOffset < section.startOffset) {
        section.parent = headers[i].id;
        if (!headers[i].children) headers[i].children = [];
        headers[i].children!.push(section.id);
        break;
      }
    }
  }

  return [...headers, ...nonHeaders];
}

/**
 * Main function to analyze document structure
 */
export async function analyzeDocumentStructure(
  text: string,
  options: {
    extractTables?: boolean;
    extractLists?: boolean;
    extractParagraphs?: boolean;
    buildHierarchy?: boolean;
  } = {}
): Promise<DocumentStructureResult> {
  const {
    extractTables: shouldExtractTables = true,
    extractLists: shouldExtractLists = true,
    extractParagraphs: shouldExtractParagraphs = true,
    buildHierarchy: shouldBuildHierarchy = true
  } = options;

  // Extract all structural elements
  let sections: DocumentSection[] = [];
  const headers = extractHeaders(text);
  sections.push(...headers);

  const tables = shouldExtractTables ? extractTables(text) : [];
  const lists = shouldExtractLists ? extractLists(text) : [];

  // Convert tables and lists to sections
  tables.forEach(table => {
    sections.push({
      id: table.id,
      type: 'table',
      content: `Table: ${table.headers.join(', ')}`,
      startOffset: table.startOffset,
      endOffset: table.endOffset,
      metadata: { headers: table.headers, rowCount: table.rows.length }
    });
  });

  lists.forEach(list => {
    sections.push({
      id: list.id,
      type: 'list',
      content: `${list.type} list with ${list.items.length} items`,
      startOffset: list.startOffset,
      endOffset: list.endOffset,
      metadata: { itemCount: list.items.length, listType: list.type }
    });
  });

  // Extract paragraphs (avoiding already-identified sections)
  if (shouldExtractParagraphs) {
    const paragraphs = extractParagraphs(text, sections);
    sections.push(...paragraphs);
  }

  // Sort by offset
  sections.sort((a, b) => a.startOffset - b.startOffset);

  // Build hierarchy
  if (shouldBuildHierarchy) {
    sections = buildHierarchy(sections);
  }

  // Build outline
  const outline = buildOutline(headers);

  // Calculate metadata
  const maxHeaderDepth = Math.max(...headers.map(h => h.level || 1), 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);

  return {
    sections,
    tables,
    lists,
    outline,
    metadata: {
      totalSections: sections.length,
      totalTables: tables.length,
      totalLists: lists.length,
      maxHeaderDepth,
      wordCount: words.length,
      characterCount: text.length
    }
  };
}

/**
 * Get section by ID
 */
export function getSectionById(
  result: DocumentStructureResult,
  sectionId: string
): DocumentSection | undefined {
  return result.sections.find(s => s.id === sectionId);
}

/**
 * Get all children of a section
 */
export function getSectionChildren(
  result: DocumentStructureResult,
  sectionId: string
): DocumentSection[] {
  const section = getSectionById(result, sectionId);
  if (!section || !section.children) return [];

  return section.children
    .map(childId => getSectionById(result, childId))
    .filter((s): s is DocumentSection => s !== undefined);
}

/**
 * Get the path from root to a section
 */
export function getSectionPath(
  result: DocumentStructureResult,
  sectionId: string
): DocumentSection[] {
  const path: DocumentSection[] = [];
  let current = getSectionById(result, sectionId);

  while (current) {
    path.unshift(current);
    if (current.parent) {
      current = getSectionById(result, current.parent);
    } else {
      break;
    }
  }

  return path;
}

/**
 * Extract text content for a section and its children
 */
export function getSectionText(
  originalText: string,
  section: DocumentSection,
  result: DocumentStructureResult,
  includeChildren: boolean = true
): string {
  if (!includeChildren) {
    return originalText.slice(section.startOffset, section.endOffset);
  }

  // Find the end offset (start of next sibling or parent's end)
  let endOffset = section.endOffset;

  if (section.parent) {
    const parent = getSectionById(result, section.parent);
    if (parent && parent.children) {
      const siblingIndex = parent.children.indexOf(section.id);
      if (siblingIndex < parent.children.length - 1) {
        const nextSibling = getSectionById(result, parent.children[siblingIndex + 1]);
        if (nextSibling) {
          endOffset = nextSibling.startOffset;
        }
      }
    }
  }

  return originalText.slice(section.startOffset, endOffset);
}

/**
 * Find sections containing a search term
 */
export function findSectionsContaining(
  result: DocumentStructureResult,
  originalText: string,
  searchTerm: string,
  caseSensitive: boolean = false
): DocumentSection[] {
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return result.sections.filter(section => {
    const sectionText = originalText.slice(section.startOffset, section.endOffset);
    const textToSearch = caseSensitive ? sectionText : sectionText.toLowerCase();
    return textToSearch.includes(term);
  });
}

/**
 * Get document summary based on structure
 */
export function getStructureSummary(result: DocumentStructureResult): string {
  const lines: string[] = [];

  if (result.outline.title) {
    lines.push(`Title: ${result.outline.title}`);
  }

  lines.push(`Sections: ${result.metadata.totalSections}`);
  lines.push(`Tables: ${result.metadata.totalTables}`);
  lines.push(`Lists: ${result.metadata.totalLists}`);
  lines.push(`Header Depth: ${result.metadata.maxHeaderDepth}`);
  lines.push(`Word Count: ${result.metadata.wordCount}`);

  if (result.outline.sections.length > 0) {
    lines.push('\nOutline:');
    function printOutline(sections: DocumentOutline['sections'], indent: number = 0) {
      for (const section of sections) {
        lines.push(`${'  '.repeat(indent)}- ${section.title}`);
        if (section.children.length > 0) {
          printOutline(section.children, indent + 1);
        }
      }
    }
    printOutline(result.outline.sections);
  }

  return lines.join('\n');
}

export default {
  analyzeDocumentStructure,
  getSectionById,
  getSectionChildren,
  getSectionPath,
  getSectionText,
  findSectionsContaining,
  getStructureSummary
};
