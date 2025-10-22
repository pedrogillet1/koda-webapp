/**
 * Document Structure Parser Service
 * Extracts hierarchical structure from documents (headings, tables, lists, paragraphs)
 * Enables structure-aware chunking that preserves semantic boundaries
 */

export interface DocumentElement {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'quote';
  content: string;
  level?: number; // For headings (h1-h6) or lists (indentation)
  metadata?: {
    startChar: number;
    endChar: number;
    parentHeading?: string;
    section?: string;
  };
}

export interface DocumentStructure {
  elements: DocumentElement[];
  outline: string[]; // Hierarchical outline (h1, h2, h3, etc.)
  hasTables: boolean;
  hasLists: boolean;
  hasCode: boolean;
}

class DocumentStructureService {
  /**
   * Parse document structure from markdown or plain text
   * Detects: headings, paragraphs, lists, tables, code blocks, quotes
   */
  parseStructure(text: string, format: 'markdown' | 'plaintext' = 'plaintext'): DocumentStructure {
    console.log(`📋 [Structure Parser] Parsing ${format} document (${text.length} chars)...`);

    if (format === 'markdown') {
      return this.parseMarkdownStructure(text);
    } else {
      return this.parsePlainTextStructure(text);
    }
  }

  /**
   * Parse markdown structure
   * Recognizes: # headings, - lists, ``` code, > quotes, | tables |
   */
  private parseMarkdownStructure(text: string): DocumentStructure {
    const lines = text.split('\n');
    const elements: DocumentElement[] = [];
    const outline: string[] = [];
    let currentChar = 0;
    let currentHeading: string | undefined;
    let currentSection: string | undefined;

    let hasTables = false;
    let hasLists = false;
    let hasCode = false;

    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockStart = 0;

    let inTable = false;
    let tableContent = '';
    let tableStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = currentChar;
      const lineEnd = currentChar + line.length + 1; // +1 for newline

      // Code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          // Start code block
          inCodeBlock = true;
          codeBlockContent = '';
          codeBlockStart = lineStart;
          hasCode = true;
        } else {
          // End code block
          elements.push({
            type: 'code',
            content: codeBlockContent.trim(),
            metadata: {
              startChar: codeBlockStart,
              endChar: lineEnd,
              parentHeading: currentHeading,
              section: currentSection
            }
          });
          inCodeBlock = false;
        }
        currentChar = lineEnd;
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        currentChar = lineEnd;
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        elements.push({
          type: 'heading',
          content: title,
          level,
          metadata: {
            startChar: lineStart,
            endChar: lineEnd,
            section: `h${level}`
          }
        });

        outline.push(`${'  '.repeat(level - 1)}${title}`);
        currentHeading = title;
        currentSection = `h${level}`;
        currentChar = lineEnd;
        continue;
      }

      // Lists (ordered and unordered)
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const indentation = listMatch[1].length;
        const content = listMatch[3].trim();

        elements.push({
          type: 'list',
          content,
          level: Math.floor(indentation / 2),
          metadata: {
            startChar: lineStart,
            endChar: lineEnd,
            parentHeading: currentHeading,
            section: currentSection
          }
        });

        hasLists = true;
        currentChar = lineEnd;
        continue;
      }

      // Tables (| cell | cell |)
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableContent = '';
          tableStart = lineStart;
          hasTables = true;
        }
        tableContent += line + '\n';
        currentChar = lineEnd;

        // Check if next line is not a table (end of table)
        if (i + 1 >= lines.length || !lines[i + 1].trim().startsWith('|')) {
          elements.push({
            type: 'table',
            content: tableContent.trim(),
            metadata: {
              startChar: tableStart,
              endChar: lineEnd,
              parentHeading: currentHeading,
              section: currentSection
            }
          });
          inTable = false;
        }
        continue;
      }

      // Quotes
      if (line.trim().startsWith('>')) {
        const quoteContent = line.replace(/^>\s*/, '').trim();
        if (quoteContent) {
          elements.push({
            type: 'quote',
            content: quoteContent,
            metadata: {
              startChar: lineStart,
              endChar: lineEnd,
              parentHeading: currentHeading,
              section: currentSection
            }
          });
        }
        currentChar = lineEnd;
        continue;
      }

      // Paragraphs (non-empty lines that don't match other types)
      if (line.trim().length > 0) {
        elements.push({
          type: 'paragraph',
          content: line.trim(),
          metadata: {
            startChar: lineStart,
            endChar: lineEnd,
            parentHeading: currentHeading,
            section: currentSection
          }
        });
      }

      currentChar = lineEnd;
    }

    console.log(`✅ [Structure Parser] Found ${elements.length} elements`);
    console.log(`   Headings: ${elements.filter(e => e.type === 'heading').length}`);
    console.log(`   Paragraphs: ${elements.filter(e => e.type === 'paragraph').length}`);
    console.log(`   Lists: ${elements.filter(e => e.type === 'list').length}`);
    console.log(`   Tables: ${elements.filter(e => e.type === 'table').length}`);
    console.log(`   Code blocks: ${elements.filter(e => e.type === 'code').length}`);

    return {
      elements,
      outline,
      hasTables,
      hasLists,
      hasCode
    };
  }

  /**
   * Parse plain text structure
   * Uses heuristics to detect headings, lists, and paragraphs
   */
  private parsePlainTextStructure(text: string): DocumentStructure {
    const lines = text.split('\n');
    const elements: DocumentElement[] = [];
    const outline: string[] = [];
    let currentChar = 0;
    let currentHeading: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = currentChar;
      const lineEnd = currentChar + line.length + 1;

      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed.length === 0) {
        currentChar = lineEnd;
        continue;
      }

      // Heuristic: Detect headings
      // - All caps lines
      // - Short lines (< 60 chars) that are followed by empty line or different formatting
      // - Lines ending with colon
      const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
      const isShort = trimmed.length < 60;
      const endsWithColon = trimmed.endsWith(':');
      const nextLineEmpty = i + 1 < lines.length && lines[i + 1].trim().length === 0;

      if ((isAllCaps || (isShort && nextLineEmpty) || endsWithColon) && /[a-zA-Z]/.test(trimmed)) {
        const headingText = endsWithColon ? trimmed.slice(0, -1) : trimmed;
        elements.push({
          type: 'heading',
          content: headingText,
          level: isAllCaps ? 1 : 2,
          metadata: {
            startChar: lineStart,
            endChar: lineEnd,
            section: 'inferred'
          }
        });
        outline.push(headingText);
        currentHeading = headingText;
        currentChar = lineEnd;
        continue;
      }

      // Detect lists (lines starting with -, *, •, or numbers)
      const listMatch = trimmed.match(/^([-*•]|\d+[\.):])\s+(.+)$/);
      if (listMatch) {
        elements.push({
          type: 'list',
          content: listMatch[2].trim(),
          level: 0,
          metadata: {
            startChar: lineStart,
            endChar: lineEnd,
            parentHeading: currentHeading
          }
        });
        currentChar = lineEnd;
        continue;
      }

      // Everything else is a paragraph
      elements.push({
        type: 'paragraph',
        content: trimmed,
        metadata: {
          startChar: lineStart,
          endChar: lineEnd,
          parentHeading: currentHeading
        }
      });

      currentChar = lineEnd;
    }

    console.log(`✅ [Structure Parser] Found ${elements.length} elements (plaintext)`);
    console.log(`   Headings: ${elements.filter(e => e.type === 'heading').length}`);
    console.log(`   Paragraphs: ${elements.filter(e => e.type === 'paragraph').length}`);
    console.log(`   Lists: ${elements.filter(e => e.type === 'list').length}`);

    return {
      elements,
      outline,
      hasTables: false,
      hasLists: elements.some(e => e.type === 'list'),
      hasCode: false
    };
  }

  /**
   * Create structure-aware chunks that respect document boundaries
   * - Don't split headings from their content
   * - Keep tables and code blocks intact
   * - Group related list items
   * - Preserve section context
   */
  createStructureAwareChunks(
    structure: DocumentStructure,
    maxChunkSize: number = 1000
  ): Array<{ content: string; metadata: any }> {
    console.log(`✂️ [Structure Parser] Creating structure-aware chunks (max: ${maxChunkSize} chars)...`);

    const chunks: Array<{ content: string; metadata: any }> = [];
    let currentChunk: DocumentElement[] = [];
    let currentSize = 0;
    let currentHeading: string | undefined;
    let currentSection: string | undefined;
    let chunkIndex = 0;

    const flushChunk = () => {
      if (currentChunk.length > 0) {
        const content = currentChunk.map(e => e.content).join('\n\n');
        chunks.push({
          content,
          metadata: {
            chunkIndex,
            heading: currentHeading,
            section: currentSection,
            elementTypes: [...new Set(currentChunk.map(e => e.type))],
            elementCount: currentChunk.length,
            startChar: currentChunk[0].metadata?.startChar,
            endChar: currentChunk[currentChunk.length - 1].metadata?.endChar
          }
        });
        chunkIndex++;
        currentChunk = [];
        currentSize = 0;
      }
    };

    for (const element of structure.elements) {
      const elementSize = element.content.length;

      // Update context when we hit a heading
      if (element.type === 'heading') {
        // Flush previous chunk before starting new section
        flushChunk();
        currentHeading = element.content;
        currentSection = element.metadata?.section;
        currentChunk.push(element);
        currentSize += elementSize;
        continue;
      }

      // Tables and code blocks should not be split
      if (element.type === 'table' || element.type === 'code') {
        // If adding this would exceed limit, flush first
        if (currentSize + elementSize > maxChunkSize && currentChunk.length > 0) {
          flushChunk();
        }

        // Add as its own chunk if too large
        if (elementSize > maxChunkSize) {
          chunks.push({
            content: element.content,
            metadata: {
              chunkIndex,
              heading: currentHeading,
              section: currentSection,
              elementTypes: [element.type],
              elementCount: 1,
              startChar: element.metadata?.startChar,
              endChar: element.metadata?.endChar,
              oversized: true
            }
          });
          chunkIndex++;
        } else {
          currentChunk.push(element);
          currentSize += elementSize;
        }
        continue;
      }

      // For paragraphs and lists, add to current chunk
      if (currentSize + elementSize > maxChunkSize) {
        flushChunk();
        currentHeading = element.metadata?.parentHeading;
        currentSection = element.metadata?.section;
      }

      currentChunk.push(element);
      currentSize += elementSize;
    }

    // Flush remaining
    flushChunk();

    console.log(`✅ [Structure Parser] Created ${chunks.length} structure-aware chunks`);
    chunks.forEach((chunk, i) => {
      console.log(`   ${i + 1}. ${chunk.metadata.elementTypes.join(', ')} (${chunk.content.length} chars) - ${chunk.metadata.heading || 'No heading'}`);
    });

    return chunks;
  }
}

export default new DocumentStructureService();
