import * as XLSX from 'xlsx';

/**
 * Enhanced Excel Processor
 * Extracts data from Excel with cell-level precision for deep linking
 * Creates semantic chunks for better RAG understanding
 */

interface CellData {
  cell: string;
  value: string;
  formula?: string;
}

interface ExcelChunk {
  content: string;
  metadata: {
    sheetName: string;
    sheetNumber: number;
    rowNumber: number;
    cells: string[];
    emptyCells?: string[];
    chunkIndex: number;
    sourceType: string;
    tableHeaders?: string[];
    // ✅ Formula metadata for better RAG retrieval (Issue #2 fix)
    hasFormula?: boolean;
    formulas?: string[];  // Array of formulas in the row (e.g., ["=SUM(B2:B4)", "=A1*B1"])
  };
}

class ExcelProcessorService {
  /**
   * Process Excel file comprehensively
   * Reads ALL sheets, ALL rows, ALL cells with formulas and coordinates
   * @param buffer - Excel file buffer
   * @returns Array of chunks with metadata for vector embedding
   */
  async processExcel(buffer: Buffer): Promise<ExcelChunk[]> {
    try {
      console.log('📊 Enhanced Excel processing started...');

      // Load workbook with formulas
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,
        cellStyles: true,
        cellDates: true,
        cellNF: true
      });

      // Also load with calculated values
      const workbookValues = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: false // Get calculated values
      });

      const chunks: ExcelChunk[] = [];
      let chunkIndex = 0;

      // Process each sheet
      for (let sheetIdx = 0; sheetIdx < workbook.SheetNames.length; sheetIdx++) {
        const sheetName = workbook.SheetNames[sheetIdx];
        const sheetNumber = sheetIdx + 1;
        const sheet = workbook.Sheets[sheetName];
        const sheetValues = workbookValues.Sheets[sheetName];

        console.log(`  Processing sheet ${sheetNumber}/${workbook.SheetNames.length}: "${sheetName}"`);

        // Method 1: Row-by-row processing with cell coordinates
        const rowChunks = this.processSheetByRows(sheet, sheetValues, sheetName, sheetNumber, chunkIndex);
        chunks.push(...rowChunks);
        chunkIndex += rowChunks.length;

        // Method 2: Table detection for semantic understanding
        const tableChunks = this.processSheetAsTables(sheetValues, sheetName, sheetNumber, chunkIndex);
        chunks.push(...tableChunks);
        chunkIndex += tableChunks.length;

        console.log(`  ✅ Created ${rowChunks.length + tableChunks.length} chunks from "${sheetName}"`);
      }

      console.log(`✅ Excel processing complete: ${chunks.length} total chunks from ${workbook.SheetNames.length} sheets`);
      return chunks;

    } catch (error) {
      console.error('❌ Error in enhanced Excel processing:', error);
      throw error;
    }
  }

  /**
   * Process sheet row by row, preserving exact cell coordinates
   * Creates chunks like: "Sheet 2 'Revenue', Row 5: A5: Q1 Total | B5: $1,200,000 (formula: =SUM(B2:B4))"
   */
  private processSheetByRows(
    sheet: XLSX.WorkSheet,
    sheetValues: XLSX.WorkSheet,
    sheetName: string,
    sheetNumber: number,
    startChunkIndex: number
  ): ExcelChunk[] {
    const chunks: ExcelChunk[] = [];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    let chunkIndex = startChunkIndex;

    // Iterate through all rows
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
      const rowCells: CellData[] = [];

      // Iterate through all columns in this row
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = sheet[cellAddress];
        const cellValue = sheetValues[cellAddress];

        // Include all cells within the range, even empty ones
        const cellData: CellData = {
          cell: cellAddress,
          value: this.formatCellValue(cellValue?.v ?? '')
        };

        // Check if cell has a formula
        if (cell && cell.f) {
          cellData.formula = cell.f;
        }

        rowCells.push(cellData);
      }

      // Create chunk for this row if it has data
      if (rowCells.length > 0) {
        const cellTexts = rowCells.map(cellData => {
          if (cellData.formula) {
            return `${cellData.cell}: ${cellData.value} (formula: =${cellData.formula})`;
          }
          // Don't include empty cells in chunk text to reduce noise
          if (cellData.value === '[empty]') {
            return null;
          }
          return `${cellData.cell}: ${cellData.value}`;
        }).filter(Boolean); // Remove null entries

        const rowText = cellTexts.join(' | ');

        // ✅ Issue #2 Fix: Extract formulas for searchable metadata
        const rowFormulas = rowCells
          .filter(c => c.formula)
          .map(c => `=${c.formula}`);
        const hasFormula = rowFormulas.length > 0;

        chunks.push({
          content: `Sheet ${sheetNumber} '${sheetName}', Row ${rowNum + 1}: ${rowText}`,
          metadata: {
            sheetName,
            sheetNumber,
            rowNumber: rowNum + 1,
            cells: rowCells.map(c => c.cell),
            emptyCells: rowCells.filter(c => c.value === '[empty]').map(c => c.cell),
            chunkIndex: chunkIndex++,
            sourceType: 'excel',
            // ✅ Formula metadata for better RAG retrieval
            ...(hasFormula && { hasFormula: true }),
            ...(hasFormula && { formulas: rowFormulas }),
          }
        });
      }
    }

    return chunks;
  }

  /**
   * Process sheet as tables with semantic understanding
   * Creates chunks like: "Sheet 2 'Revenue' table data: Month: February, Revenue: $450,000, Growth: 12.5%"
   */
  private processSheetAsTables(
    sheet: XLSX.WorkSheet,
    sheetName: string,
    sheetNumber: number,
    startChunkIndex: number
  ): ExcelChunk[] {
    const chunks: ExcelChunk[] = [];

    // Convert sheet to JSON array
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false
    }) as any[][];

    if (!jsonData || jsonData.length === 0) {
      return chunks;
    }

    // Check if first row looks like headers (contains strings)
    const firstRow = jsonData[0];
    const hasHeaders = firstRow && firstRow.some((cell: any) =>
      cell && typeof cell === 'string' && cell.trim().length > 0
    );

    if (!hasHeaders || jsonData.length < 2) {
      return chunks; // Need headers and at least one data row
    }

    const headers = firstRow.map((h: any) => String(h || '').trim());
    let chunkIndex = startChunkIndex;

    // Process each data row with column context
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowItems: string[] = [];

      for (let j = 0; j < Math.min(row.length, headers.length); j++) {
        const header = headers[j];
        const value = row[j];

        if (header && value !== null && value !== undefined && value !== '') {
          rowItems.push(`${header}: ${this.formatCellValue(value)}`);
        }
      }

      if (rowItems.length > 0) {
        const semanticText = rowItems.join(', ');

        chunks.push({
          content: `Sheet ${sheetNumber} '${sheetName}' table data: ${semanticText}`,
          metadata: {
            sheetName,
            sheetNumber,
            rowNumber: i + 1,
            cells: [],
            chunkIndex: chunkIndex++,
            sourceType: 'excel_table',
            tableHeaders: headers.filter(h => h.length > 0)
          }
        });
      }
    }

    return chunks;
  }

  /**
   * Format cell value for display
   */
  private formatCellValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '[empty]';
    }

    if (typeof value === 'number') {
      // Check if it's a date (Excel dates are numbers)
      if (value > 25569 && value < 50000) {
        // Likely a date
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
          return `${date.m}/${date.d}/${date.y}`;
        }
      }
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString();
    }

    // Truncate very long strings
    const str = String(value);
    return str.length > 500 ? str.substring(0, 500) + '...' : str;
  }
}

export default new ExcelProcessorService();
