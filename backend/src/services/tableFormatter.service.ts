/**
 * TABLE FORMATTER SERVICE - KODA PHASE 5
 *
 * FEATURE IMPLEMENTED:
 * - Proper Markdown table formatting
 * - Auto-detection and fixing of malformed tables
 * - Consistent table borders and alignment
 *
 * CAPABILITIES:
 * - Detect tables in text
 * - Add missing borders and separators
 * - Fix incomplete table formatting
 * - Ensure consistent Markdown table structure
 */

export interface TableFormatResult {
  formatted: string;
  tablesFixed: number;
  originalTables: number;
}

class TableFormatterService {
  /**
   * Format all tables in a Markdown text
   */
  formatTables(text: string): TableFormatResult {
    let formatted = text;
    let tablesFixed = 0;
    let originalTables = 0;

    // Detect and fix tables
    const tableRegex = /(?:^|\n)((?:[|\s]*[^\n|]+[|\s]*)+(?:\n[|\s]*[-:|\s]+[|\s]*\n(?:[|\s]*[^\n|]+[|\s]*\n?)+))/gm;
    const matches = text.matchAll(tableRegex);

    for (const match of matches) {
      originalTables++;
      const originalTable = match[0];
      const fixedTable = this.fixTable(originalTable);

      if (fixedTable !== originalTable) {
        tablesFixed++;
        formatted = formatted.replace(originalTable, fixedTable);
      }
    }

    // Also detect and fix incomplete tables (tables without proper separators)
    formatted = this.detectAndFixIncompleteTables(formatted);

    return {
      formatted,
      tablesFixed,
      originalTables,
    };
  }

  /**
   * Fix a single table
   */
  private fixTable(tableText: string): string {
    const lines = tableText.trim().split('\n');

    if (lines.length < 2) {
      return tableText; // Not a valid table
    }

    // Parse header
    const headerLine = lines[0].trim();
    const headers = this.parseTableRow(headerLine);

    if (headers.length === 0) {
      return tableText;
    }

    // Check for separator line
    let separatorIndex = 1;
    let hasSeparator = false;

    if (lines.length > 1) {
      const secondLine = lines[1].trim();
      if (this.isSeparatorLine(secondLine)) {
        hasSeparator = true;
        separatorIndex = 1;
      }
    }

    // Parse data rows
    const dataRows: string[][] = [];
    const startIndex = hasSeparator ? 2 : 1;

    for (let i = startIndex; i < lines.length; i++) {
      const row = this.parseTableRow(lines[i].trim());
      if (row.length > 0) {
        dataRows.push(row);
      }
    }

    // Build properly formatted table
    return this.buildFormattedTable(headers, dataRows);
  }

  /**
   * Parse a table row into cells
   */
  private parseTableRow(line: string): string[] {
    // Remove leading/trailing pipes
    let cleaned = line.trim();
    if (cleaned.startsWith('|')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.endsWith('|')) {
      cleaned = cleaned.substring(0, cleaned.length - 1);
    }

    // Split by pipe and trim each cell
    const cells = cleaned.split('|').map(cell => cell.trim());

    // Filter out empty cells (but keep cells with actual content)
    return cells.filter(cell => cell.length > 0 || cells.length > 1);
  }

  /**
   * Check if a line is a separator line
   */
  private isSeparatorLine(line: string): boolean {
    // Separator lines contain mostly dashes, pipes, colons, and spaces
    const cleanedLine = line.replace(/[\s|:\-]/g, '');
    return cleanedLine.length === 0 && line.includes('-');
  }

  /**
   * Build a properly formatted Markdown table
   */
  private buildFormattedTable(headers: string[], dataRows: string[][]): string {
    const numColumns = headers.length;

    // Calculate column widths
    const columnWidths = headers.map(h => h.length);

    for (const row of dataRows) {
      for (let i = 0; i < Math.min(row.length, numColumns); i++) {
        columnWidths[i] = Math.max(columnWidths[i], row[i].length);
      }
    }

    // Build header
    const headerCells = headers.map((h, i) => this.padCell(h, columnWidths[i]));
    const headerLine = `| ${headerCells.join(' | ')} |`;

    // Build separator
    const separatorCells = columnWidths.map(width => '-'.repeat(width));
    const separatorLine = `| ${separatorCells.join(' | ')} |`;

    // Build data rows
    const dataLines = dataRows.map(row => {
      const cells = [];
      for (let i = 0; i < numColumns; i++) {
        const cellContent = i < row.length ? row[i] : '';
        cells.push(this.padCell(cellContent, columnWidths[i]));
      }
      return `| ${cells.join(' | ')} |`;
    });

    // Combine all parts
    return '\n' + [headerLine, separatorLine, ...dataLines].join('\n') + '\n';
  }

  /**
   * Pad a cell to a specific width
   */
  private padCell(content: string, width: number): string {
    return content.padEnd(width, ' ');
  }

  /**
   * Detect and fix incomplete tables (simple format detection)
   */
  private detectAndFixIncompleteTables(text: string): string {
    let result = text;

    // Look for patterns that might be tables without proper formatting
    // Example: Lines with multiple tabs or spaces separating columns
    const lines = text.split('\n');
    let inPotentialTable = false;
    let tableStartIndex = -1;
    let potentialTableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasManyDelimiters = (line.match(/\t/g) || []).length >= 2 ||
                                 (line.match(/\s{3,}/g) || []).length >= 2;

      if (hasManyDelimiters && !line.includes('|')) {
        if (!inPotentialTable) {
          inPotentialTable = true;
          tableStartIndex = i;
          potentialTableLines = [line];
        } else {
          potentialTableLines.push(line);
        }
      } else {
        if (inPotentialTable && potentialTableLines.length >= 2) {
          // Try to convert to proper table
          const formattedTable = this.convertDelimitedToTable(potentialTableLines);
          if (formattedTable) {
            // Replace in result
            const originalText = lines.slice(tableStartIndex, i).join('\n');
            result = result.replace(originalText, formattedTable);
          }
        }
        inPotentialTable = false;
        potentialTableLines = [];
      }
    }

    return result;
  }

  /**
   * Convert tab/space delimited text to a proper Markdown table
   */
  private convertDelimitedToTable(lines: string[]): string | null {
    if (lines.length < 2) return null;

    // Split by tabs or multiple spaces
    const rows = lines.map(line =>
      line.split(/\t+|\s{3,}/).map(cell => cell.trim()).filter(cell => cell.length > 0)
    );

    // Check if all rows have similar column counts
    const columnCounts = rows.map(row => row.length);
    const avgColumns = Math.round(
      columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length
    );

    const validRows = rows.filter(row => Math.abs(row.length - avgColumns) <= 1);

    if (validRows.length < 2) return null;

    // First row is header
    const headers = validRows[0];
    const dataRows = validRows.slice(1);

    return this.buildFormattedTable(headers, dataRows);
  }

  /**
   * Add borders to tables that are missing them
   */
  addTableBorders(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this looks like a table row without borders
      if (line.includes('|') && !line.startsWith('|')) {
        result.push(`| ${line}`);
      } else if (line.includes('|') && !line.endsWith('|')) {
        result.push(`${line} |`);
      } else {
        result.push(lines[i]);
      }
    }

    return result.join('\n');
  }

  /**
   * Validate and fix table alignment
   */
  fixTableAlignment(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
        // Ensure consistent spacing around pipes
        const fixed = line
          .split('|')
          .map(cell => cell.trim())
          .join(' | ');
        result.push(fixed);
      } else {
        if (inTable && line.length === 0) {
          inTable = false;
        }
        result.push(lines[i]);
      }
    }

    return result.join('\n');
  }

  /**
   * Main formatting function - applies all fixes
   */
  formatMarkdownTables(text: string): string {
    // Step 1: Format existing tables
    const { formatted: step1 } = this.formatTables(text);

    // Step 2: Add missing borders
    const step2 = this.addTableBorders(step1);

    // Step 3: Fix alignment
    const step3 = this.fixTableAlignment(step2);

    return step3;
  }

  /**
   * Check if text contains tables
   */
  hasTables(text: string): boolean {
    const tablePattern = /\|[^\n]+\|/;
    return tablePattern.test(text);
  }

  /**
   * Extract all tables from text
   */
  extractTables(text: string): string[] {
    const tables: string[] = [];
    const lines = text.split('\n');
    let currentTable: string[] = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        currentTable.push(line);
      } else {
        if (inTable && currentTable.length > 0) {
          tables.push(currentTable.join('\n'));
          currentTable = [];
        }
        inTable = false;
      }
    }

    // Add last table if exists
    if (currentTable.length > 0) {
      tables.push(currentTable.join('\n'));
    }

    return tables;
  }
}

export const tableFormatterService = new TableFormatterService();
export default tableFormatterService;
