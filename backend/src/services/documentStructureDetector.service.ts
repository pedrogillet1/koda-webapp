/**
 * Document Structure Detector Service
 * Detects structure in document text: headings, tables, lists, figures
 * Enables semantic chunking that preserves document organization
 */

interface Heading {
  text: string;
  level: number; // 1 = main heading, 2 = subheading, etc.
  position: number;
  lineNumber: number;
}

interface Table {
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
  caption?: string;
  rows: number;
  columns: number;
  content: string;
}

interface List {
  start: number;
  end: number;
  lineStart: number;
  lineEnd: number;
  items: number;
  ordered: boolean;
}

interface Figure {
  start: number;
  end: number;
  caption?: string;
  type: 'image' | 'chart' | 'diagram';
}

interface Paragraph {
  start: number;
  end: number;
  lineNumber: number;
}

export interface DocumentStructure {
  headings: Heading[];
  tables: Table[];
  lists: List[];
  figures: Figure[];
  paragraphs: Paragraph[];
}

class DocumentStructureDetectorService {
  /**
   * Detects structure in document text
   */
  detectStructure(content: string): DocumentStructure {
    const lines = content.split('\n');

    const structure: DocumentStructure = {
      headings: [],
      tables: [],
      lists: [],
      figures: [],
      paragraphs: []
    };

    let currentPosition = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        currentPosition += lines[i].length + 1;
        i++;
        continue;
      }

      // Detect headings
      if (this.isHeading(line, lines[i + 1])) {
        structure.headings.push({
          text: line,
          level: this.getHeadingLevel(line, lines[i + 1]),
          position: currentPosition,
          lineNumber: i
        });
        currentPosition += lines[i].length + 1;
        i++;
        continue;
      }

      // Detect tables
      if (this.isTableStart(line, lines.slice(i, i + 5))) {
        const tableEnd = this.findTableEnd(lines, i);
        const tableLines = lines.slice(i, tableEnd);

        structure.tables.push({
          start: currentPosition,
          end: currentPosition + tableLines.join('\n').length,
          lineStart: i,
          lineEnd: tableEnd,
          caption: this.findTableCaption(lines, i, tableEnd),
          rows: tableLines.length,
          columns: this.detectColumns(tableLines),
          content: tableLines.join('\n')
        });

        // Move position forward
        for (let j = i; j < tableEnd; j++) {
          currentPosition += lines[j].length + 1;
        }
        i = tableEnd;
        continue;
      }

      // Detect lists
      if (this.isListItem(line)) {
        const listEnd = this.findListEnd(lines, i);
        const listLines = lines.slice(i, listEnd);

        structure.lists.push({
          start: currentPosition,
          end: currentPosition + listLines.join('\n').length,
          lineStart: i,
          lineEnd: listEnd,
          items: listLines.filter(l => this.isListItem(l.trim())).length,
          ordered: /^\d+\./.test(line)
        });

        for (let j = i; j < listEnd; j++) {
          currentPosition += lines[j].length + 1;
        }
        i = listEnd;
        continue;
      }

      // Detect figures/images
      if (this.isFigureCaption(line)) {
        structure.figures.push({
          start: currentPosition,
          end: currentPosition + line.length,
          caption: line,
          type: this.detectFigureType(line)
        });
        currentPosition += lines[i].length + 1;
        i++;
        continue;
      }

      // Regular paragraph
      structure.paragraphs.push({
        start: currentPosition,
        end: currentPosition + line.length,
        lineNumber: i
      });

      currentPosition += lines[i].length + 1;
      i++;
    }

    console.log(`📋 Document structure detected:`);
    console.log(`   Headings: ${structure.headings.length}`);
    console.log(`   Tables: ${structure.tables.length}`);
    console.log(`   Lists: ${structure.lists.length}`);
    console.log(`   Figures: ${structure.figures.length}`);
    console.log(`   Paragraphs: ${structure.paragraphs.length}`);

    return structure;
  }

  /**
   * Checks if line is a heading
   */
  private isHeading(line: string, nextLine?: string): boolean {
    if (!nextLine) return false;

    // Skip very long lines
    if (line.length > 150) return false;

    // Pattern 1: All caps, short, followed by content
    const allCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
    const hasContent = nextLine.trim().length > 0;
    const notTooShort = line.length > 3;

    if (allCaps && hasContent && notTooShort) {
      return true;
    }

    // Pattern 2: Markdown heading (# Header)
    if (/^#{1,6}\s+.+/.test(line)) {
      return true;
    }

    // Pattern 3: Numbered headings (1. Introduction, 1.1 Background)
    if (/^\d+(\.\d+)*\.\s+[A-Z]/.test(line) && line.length < 100) {
      return true;
    }

    // Pattern 4: Underlined heading (next line is === or ---)
    if (nextLine && /^[=\-]{3,}$/.test(nextLine.trim())) {
      return true;
    }

    return false;
  }

  /**
   * Determines heading level
   */
  private getHeadingLevel(line: string, nextLine?: string): number {
    // Markdown heading
    const mdMatch = line.match(/^(#{1,6})\s+/);
    if (mdMatch) {
      return mdMatch[1].length;
    }

    // Numbered heading (1. = level 1, 1.1 = level 2, etc.)
    const numMatch = line.match(/^(\d+(?:\.\d+)*)\.\s+/);
    if (numMatch) {
      const parts = numMatch[1].split('.');
      return parts.length;
    }

    // Underlined heading
    if (nextLine && /^[=]{3,}$/.test(nextLine.trim())) {
      return 1; // Main heading
    }
    if (nextLine && /^[-]{3,}$/.test(nextLine.trim())) {
      return 2; // Subheading
    }

    // All caps = level 1
    if (line === line.toUpperCase()) {
      return 1;
    }

    return 2; // Default to level 2
  }

  /**
   * Checks if lines form a table
   */
  private isTableStart(line: string, nextLines: string[]): boolean {
    // Pattern 1: Pipe-delimited table (| col1 | col2 |)
    if (/\|.*\|/.test(line)) {
      const pipeCount = (line.match(/\|/g) || []).length;
      if (pipeCount >= 2) {
        // Check if next line also has pipes
        const nextHasPipes = nextLines[0] && /\|.*\|/.test(nextLines[0]);
        return nextHasPipes;
      }
    }

    // Pattern 2: Tab-delimited table
    if (/\t.*\t/.test(line)) {
      const tabCount = (line.match(/\t/g) || []).length;
      if (tabCount >= 1) {
        const nextHasTabs = nextLines[0] && /\t.*\t/.test(nextLines[0]);
        return nextHasTabs;
      }
    }

    // Pattern 3: Multiple spaces (at least 2) between columns
    if (/\S+\s{2,}\S+\s{2,}\S+/.test(line)) {
      const nextHasSpaces = nextLines[0] && /\S+\s{2,}\S+/.test(nextLines[0]);
      return nextHasSpaces;
    }

    return false;
  }

  /**
   * Finds end of table
   */
  private findTableEnd(lines: string[], startIdx: number): number {
    const delimiter = this.detectDelimiter(lines[startIdx]);

    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Empty line ends table
      if (!line) {
        return i;
      }

      // Line without delimiter ends table
      if (!line.includes(delimiter)) {
        return i;
      }
    }

    return lines.length;
  }

  /**
   * Detects column delimiter
   */
  private detectDelimiter(line: string): string {
    if (line.includes('|')) return '|';
    if (line.includes('\t')) return '\t';
    return '  '; // Multiple spaces
  }

  /**
   * Detects number of columns
   */
  private detectColumns(tableLines: string[]): number {
    if (tableLines.length === 0) return 0;

    const firstLine = tableLines[0];

    // Pipe-delimited
    if (firstLine.includes('|')) {
      return (firstLine.match(/\|/g) || []).length - 1;
    }

    // Tab-delimited
    if (firstLine.includes('\t')) {
      return (firstLine.match(/\t/g) || []).length + 1;
    }

    // Space-delimited
    const parts = firstLine.split(/\s{2,}/);
    return parts.length;
  }

  /**
   * Finds table caption
   */
  private findTableCaption(lines: string[], tableStart: number, tableEnd: number): string | undefined {
    // Check line before table
    if (tableStart > 0) {
      const prevLine = lines[tableStart - 1].trim();
      if (this.isCaptionLike(prevLine)) {
        return prevLine;
      }
    }

    // Check line after table
    if (tableEnd < lines.length) {
      const nextLine = lines[tableEnd].trim();
      if (this.isCaptionLike(nextLine)) {
        return nextLine;
      }
    }

    return undefined;
  }

  /**
   * Checks if line looks like a caption
   */
  private isCaptionLike(line: string): boolean {
    const captionPatterns = [
      /^table\s+\d+/i,
      /^figura?\s+\d+/i,
      /^tabela\s+\d+/i,
      /^quadro\s+\d+/i
    ];

    return captionPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Checks if line is a list item
   */
  private isListItem(line: string): boolean {
    // Unordered list (-, *, •)
    if (/^[-*•]\s+/.test(line)) {
      return true;
    }

    // Ordered list (1., 2., etc.)
    if (/^\d+\.\s+/.test(line)) {
      return true;
    }

    // Letter list (a., b., etc.)
    if (/^[a-z]\.\s+/.test(line)) {
      return true;
    }

    return false;
  }

  /**
   * Finds end of list
   */
  private findListEnd(lines: string[], startIdx: number): number {
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Empty line might end list (but check next line)
      if (!line) {
        // If next line is also empty or not a list item, list ends
        if (i + 1 >= lines.length || !this.isListItem(lines[i + 1].trim())) {
          return i;
        }
      }

      // Non-list item ends list
      if (line && !this.isListItem(line)) {
        return i;
      }
    }

    return lines.length;
  }

  /**
   * Checks if line is a figure caption
   */
  private isFigureCaption(line: string): boolean {
    const figurePatterns = [
      /^figure\s+\d+/i,
      /^fig\.\s+\d+/i,
      /^image\s+\d+/i,
      /^chart\s+\d+/i,
      /^diagram\s+\d+/i,
      /^figura\s+\d+/i,
      /^imagem\s+\d+/i
    ];

    return figurePatterns.some(pattern => pattern.test(line));
  }

  /**
   * Detects figure type from caption
   */
  private detectFigureType(caption: string): 'image' | 'chart' | 'diagram' {
    if (/chart|graph|gráfico/i.test(caption)) {
      return 'chart';
    }
    if (/diagram|flowchart|fluxograma/i.test(caption)) {
      return 'diagram';
    }
    return 'image';
  }
}

export default new DocumentStructureDetectorService();
export { DocumentStructureDetectorService, DocumentStructure, Heading, Table, List, Figure, Paragraph };
