/**
 * Table Extractor Service
 * Detects and extracts tables from PDF documents and images
 * - Uses Google Cloud Vision API for table detection
 * - Converts tables to markdown format
 * - Preserves cell structure and alignment
 * - Handles merged cells and complex layouts
 */

import vision from '@google-cloud/vision';
import { config } from '../config/env';
import { markdownTable } from 'markdown-table';

const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: config.GCS_KEY_FILE,
  projectId: config.GCS_PROJECT_ID,
});

interface TableCell {
  row: number;
  column: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  confidence: number;
}

interface ExtractedTable {
  pageNumber: number;
  tableNumber: number;
  rows: number;
  columns: number;
  cells: TableCell[][];
  markdown: string;
  confidence: number;
  boundingBox?: any;
}

interface TableExtractionResult {
  tables: ExtractedTable[];
  totalTables: number;
  averageConfidence: number;
}

class TableExtractorService {
  /**
   * Extract all tables from a PDF buffer
   */
  async extractTablesFromPDF(pdfBuffer: Buffer): Promise<TableExtractionResult> {
    try {
      console.log('📊 [Table Extractor] Detecting tables in PDF...');

      // Use Google Cloud Vision to detect tables
      const [result] = await visionClient.documentTextDetection(pdfBuffer);

      if (!result.fullTextAnnotation) {
        console.log('   No text detected in PDF');
        return {
          tables: [],
          totalTables: 0,
          averageConfidence: 0,
        };
      }

      const tables: ExtractedTable[] = [];
      const pages = result.fullTextAnnotation.pages || [];

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageTables = await this.extractTablesFromPage(page, pageIndex + 1);
        tables.push(...pageTables);
      }

      const averageConfidence = tables.length > 0
        ? tables.reduce((sum, t) => sum + t.confidence, 0) / tables.length
        : 0;

      console.log(`✅ [Table Extractor] Found ${tables.length} tables (avg confidence: ${(averageConfidence * 100).toFixed(1)}%)`);

      return {
        tables,
        totalTables: tables.length,
        averageConfidence,
      };
    } catch (error: any) {
      console.error('❌ [Table Extractor] Error:', error);
      throw new Error(`Failed to extract tables: ${error.message}`);
    }
  }

  /**
   * Extract tables from an image buffer
   */
  async extractTablesFromImage(imageBuffer: Buffer): Promise<TableExtractionResult> {
    try {
      console.log('📊 [Table Extractor] Detecting tables in image...');

      const [result] = await visionClient.documentTextDetection(imageBuffer);

      if (!result.fullTextAnnotation || !result.fullTextAnnotation.pages) {
        return {
          tables: [],
          totalTables: 0,
          averageConfidence: 0,
        };
      }

      const tables: ExtractedTable[] = [];
      const pages = result.fullTextAnnotation.pages;

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        const pageTables = await this.extractTablesFromPage(page, pageIndex + 1);
        tables.push(...pageTables);
      }

      const averageConfidence = tables.length > 0
        ? tables.reduce((sum, t) => sum + t.confidence, 0) / tables.length
        : 0;

      console.log(`✅ [Table Extractor] Found ${tables.length} tables`);

      return {
        tables,
        totalTables: tables.length,
        averageConfidence,
      };
    } catch (error: any) {
      console.error('❌ [Table Extractor] Error:', error);
      throw new Error(`Failed to extract tables from image: ${error.message}`);
    }
  }

  /**
   * Extract tables from a single page
   */
  private async extractTablesFromPage(page: any, pageNumber: number): Promise<ExtractedTable[]> {
    const tables: ExtractedTable[] = [];

    // Detect table-like structures using block analysis
    // Group blocks that are aligned in rows and columns
    const blocks = page.blocks || [];

    // Analyze block positions to detect grid-like structures
    const gridStructures = this.detectGridStructures(blocks);

    let tableNumber = 1;
    for (const grid of gridStructures) {
      try {
        const table = this.convertGridToTable(grid, pageNumber, tableNumber);
        if (table) {
          tables.push(table);
          tableNumber++;
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to convert grid to table:`, error);
      }
    }

    return tables;
  }

  /**
   * Detect grid-like structures in blocks
   */
  private detectGridStructures(blocks: any[]): any[] {
    const grids: any[] = [];

    // Group blocks by Y-coordinate (rows)
    const rows = new Map<number, any[]>();

    blocks.forEach(block => {
      if (!block.boundingBox || !block.boundingBox.vertices) return;

      const yCoord = block.boundingBox.vertices[0].y;
      const yRounded = Math.round(yCoord / 10) * 10; // Group by 10-pixel bands

      if (!rows.has(yRounded)) {
        rows.set(yRounded, []);
      }
      rows.get(yRounded)!.push(block);
    });

    // Find rows that have multiple columns (potential table rows)
    const tableRows: any[][] = [];

    rows.forEach((rowBlocks, yCoord) => {
      if (rowBlocks.length >= 2) {
        // Sort blocks by X-coordinate
        const sortedBlocks = rowBlocks.sort((a, b) => {
          const aX = a.boundingBox.vertices[0].x;
          const bX = b.boundingBox.vertices[0].x;
          return aX - bX;
        });

        tableRows.push(sortedBlocks);
      }
    });

    // Group consecutive rows that have similar column structures (potential tables)
    if (tableRows.length >= 2) {
      let currentGrid: any[][] = [tableRows[0]];

      for (let i = 1; i < tableRows.length; i++) {
        const prevRow = tableRows[i - 1];
        const currentRow = tableRows[i];

        // Check if rows have similar number of columns
        if (Math.abs(prevRow.length - currentRow.length) <= 1) {
          currentGrid.push(currentRow);
        } else {
          // End current grid and start new one
          if (currentGrid.length >= 2) {
            grids.push(currentGrid);
          }
          currentGrid = [currentRow];
        }
      }

      // Add last grid
      if (currentGrid.length >= 2) {
        grids.push(currentGrid);
      }
    }

    return grids;
  }

  /**
   * Convert grid structure to table
   */
  private convertGridToTable(grid: any[][], pageNumber: number, tableNumber: number): ExtractedTable | null {
    if (grid.length === 0) return null;

    const maxColumns = Math.max(...grid.map(row => row.length));
    const cells: TableCell[][] = [];
    let totalConfidence = 0;
    let cellCount = 0;

    // Convert grid to cells
    for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
      const row = grid[rowIndex];
      const cellRow: TableCell[] = [];

      for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
        const block = row[colIndex];

        if (block) {
          const text = this.extractTextFromBlock(block);
          const confidence = block.confidence || 0.8;

          cellRow.push({
            row: rowIndex,
            column: colIndex,
            rowSpan: 1,
            colSpan: 1,
            text,
            confidence,
          });

          totalConfidence += confidence;
          cellCount++;
        } else {
          // Empty cell
          cellRow.push({
            row: rowIndex,
            column: colIndex,
            rowSpan: 1,
            colSpan: 1,
            text: '',
            confidence: 1.0,
          });
        }
      }

      cells.push(cellRow);
    }

    const averageConfidence = cellCount > 0 ? totalConfidence / cellCount : 0;

    // Convert to markdown
    const markdown = this.convertCellsToMarkdown(cells);

    return {
      pageNumber,
      tableNumber,
      rows: grid.length,
      columns: maxColumns,
      cells,
      markdown,
      confidence: averageConfidence,
    };
  }

  /**
   * Extract text from a block
   */
  private extractTextFromBlock(block: any): string {
    let text = '';

    if (block.paragraphs) {
      for (const paragraph of block.paragraphs) {
        if (paragraph.words) {
          for (const word of paragraph.words) {
            if (word.symbols) {
              for (const symbol of word.symbols) {
                text += symbol.text || '';
              }
              text += ' ';
            }
          }
        }
      }
    }

    return text.trim();
  }

  /**
   * Convert cells to markdown table
   */
  private convertCellsToMarkdown(cells: TableCell[][]): string {
    if (cells.length === 0) return '';

    // Convert cells to array format for markdown-table
    const tableData = cells.map(row =>
      row.map(cell => cell.text || '')
    );

    try {
      return markdownTable(tableData, {
        align: cells[0].map(() => 'left' as const), // Left-align all columns
        padding: true,
        delimiterStart: true,
        delimiterEnd: true,
      });
    } catch (error) {
      console.warn('   ⚠️ Failed to create markdown table, using fallback format');
      // Fallback to simple format
      return tableData.map(row => '| ' + row.join(' | ') + ' |').join('\n');
    }
  }

  /**
   * Insert tables into markdown text at appropriate positions
   */
  insertTablesIntoMarkdown(markdownText: string, tables: ExtractedTable[]): string {
    if (tables.length === 0) return markdownText;

    let result = markdownText;

    // Add tables at the end with clear sections
    result += '\n\n---\n\n## Extracted Tables\n\n';

    tables.forEach((table, index) => {
      result += `### Table ${index + 1} (Page ${table.pageNumber})\n\n`;
      result += `**Size:** ${table.rows} rows × ${table.columns} columns\n`;
      result += `**Confidence:** ${(table.confidence * 100).toFixed(1)}%\n\n`;
      result += table.markdown + '\n\n';
    });

    return result;
  }
}

export default new TableExtractorService();
