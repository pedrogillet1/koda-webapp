/**
 * Excel Cell Reader Service
 * Reads specific cells from Excel files with proper formula handling
 *
 * ✅ FIX: Properly handles Excel formulas - returns calculated result, not formula text
 */

import ExcelJS from 'exceljs';
import prisma from '../config/database';
import path from 'path';
import fs from 'fs/promises';

interface CellReadResult {
  success: boolean;
  value: any;
  formattedValue: string;
  cellAddress: string;
  sheetName: string;
  documentName: string;
  hasFormula: boolean;
  formula?: string;
  error?: string;
  message: string;  // Human-readable message for the response
}

interface CellReadParams {
  documentId: string;
  sheetName?: string;
  cellAddress: string;
  userId: string;
}

class ExcelCellReaderService {
  /**
   * Read a specific cell from an Excel document
   * ✅ FIX: Returns calculated formula result, not formula text
   */
  async readCell(params: CellReadParams): Promise<CellReadResult> {
    try {
      const { documentId, sheetName, cellAddress, userId } = params;

      // Get document from database
      const document = await prisma.document.findFirst({
        where: {
          id: documentId,
          userId,
        },
      });

      if (!document) {
        return {
          success: false,
          value: null,
          formattedValue: '',
          cellAddress,
          sheetName: sheetName || '',
          documentName: '',
          hasFormula: false,
          error: 'Document not found',
          message: 'Document not found',
        };
      }

      // Check if it's an Excel file
      const isExcel = document.mimeType?.includes('spreadsheet') ||
                      document.mimeType?.includes('excel') ||
                      document.name?.endsWith('.xlsx') ||
                      document.name?.endsWith('.xls');

      if (!isExcel) {
        return {
          success: false,
          value: null,
          formattedValue: '',
          cellAddress,
          sheetName: sheetName || '',
          documentName: document.name,
          hasFormula: false,
          error: 'Document is not an Excel file',
          message: 'Document is not an Excel file',
        };
      }

      // Get file path
      const filePath = document.path;
      if (!filePath) {
        return {
          success: false,
          value: null,
          formattedValue: '',
          cellAddress,
          sheetName: sheetName || '',
          documentName: document.name,
          hasFormula: false,
          error: 'Document file path not found',
          message: 'Document file path not found',
        };
      }

      // Read the Excel file
      const workbook = new ExcelJS.Workbook();
      const fileBuffer = await fs.readFile(filePath);
      await workbook.xlsx.load(fileBuffer);

      // Get the worksheet
      let worksheet: ExcelJS.Worksheet | undefined;
      if (sheetName) {
        worksheet = workbook.getWorksheet(sheetName);
      } else {
        // Use first worksheet if no sheet name specified
        worksheet = workbook.worksheets[0];
      }

      if (!worksheet) {
        return {
          success: false,
          value: null,
          formattedValue: '',
          cellAddress,
          sheetName: sheetName || 'Sheet1',
          documentName: document.name,
          hasFormula: false,
          error: `Worksheet "${sheetName || 'Sheet1'}" not found`,
          message: `Worksheet "${sheetName || 'Sheet1'}" not found`,
        };
      }

      // Get the cell
      const cell = worksheet.getCell(cellAddress);

      // Extract cell value with proper formula handling
      const result = this.getCellValue(cell);

      // Build success message with formula info if present
      let message = `Cell ${cellAddress} in "${worksheet.name}" contains: ${result.formattedValue}`;
      if (result.hasFormula && result.formula) {
        message += ` (calculated from formula ${result.formula})`;
      }

      return {
        success: true,
        value: result.value,
        formattedValue: result.formattedValue,
        cellAddress,
        sheetName: worksheet.name,
        documentName: document.name,
        hasFormula: result.hasFormula,
        formula: result.formula,
        message,
      };

    } catch (error) {
      console.error('[ExcelCellReader] Error reading cell:', error);
      const errorMessage = `Failed to read cell: ${(error as Error).message}`;
      return {
        success: false,
        value: null,
        formattedValue: '',
        cellAddress: params.cellAddress,
        sheetName: params.sheetName || '',
        documentName: '',
        hasFormula: false,
        error: errorMessage,
        message: errorMessage,
      };
    }
  }

  /**
   * Get cell value with proper formula handling
   * ✅ FIX: Returns calculated result for formula cells, not the formula text
   */
  private getCellValue(cell: ExcelJS.Cell): {
    value: any;
    formattedValue: string;
    hasFormula: boolean;
    formula?: string;
  } {
    const cellValue = cell.value as any;

    // Handle null/undefined
    if (cellValue === null || cellValue === undefined) {
      return {
        value: null,
        formattedValue: '',
        hasFormula: false,
      };
    }

    // ✅ FIX: Handle formula cells - return calculated result
    if (cellValue.formula) {
      const formula = cellValue.formula;

      // Check if we have a calculated result
      if (cellValue.result !== undefined && cellValue.result !== null) {
        return {
          value: cellValue.result,
          formattedValue: this.formatValue(cellValue.result),
          hasFormula: true,
          formula: `=${formula}`,
        };
      }

      // No result available - formula wasn't calculated
      console.warn(`[ExcelCellReader] Formula not calculated: =${formula}`);
      return {
        value: null,
        formattedValue: `[Formula: =${formula}]`,
        hasFormula: true,
        formula: `=${formula}`,
      };
    }

    // Handle rich text
    if (cellValue.richText) {
      const text = cellValue.richText.map((rt: any) => rt.text).join('');
      return {
        value: text,
        formattedValue: text,
        hasFormula: false,
      };
    }

    // Handle hyperlinks
    if (cellValue.hyperlink) {
      return {
        value: cellValue.text || cellValue.hyperlink,
        formattedValue: cellValue.text || cellValue.hyperlink,
        hasFormula: false,
      };
    }

    // Handle error values
    if (cellValue.error) {
      return {
        value: cellValue.error,
        formattedValue: cellValue.error,
        hasFormula: false,
      };
    }

    // Regular value
    return {
      value: cellValue,
      formattedValue: this.formatValue(cellValue),
      hasFormula: false,
    };
  }

  /**
   * Format value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    // Date
    if (value instanceof Date) {
      return value.toLocaleDateString('en-US');
    }

    // Boolean
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    // Number
    if (typeof value === 'number') {
      // Format with commas for large numbers
      if (Math.abs(value) >= 1000) {
        return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
      return value.toString();
    }

    // String
    return String(value);
  }

  /**
   * Read multiple cells from an Excel document
   */
  async readCells(params: {
    documentId: string;
    sheetName?: string;
    cellAddresses: string[];
    userId: string;
  }): Promise<{ success: boolean; cells: CellReadResult[]; error?: string }> {
    const results: CellReadResult[] = [];

    for (const cellAddress of params.cellAddresses) {
      const result = await this.readCell({
        documentId: params.documentId,
        sheetName: params.sheetName,
        cellAddress,
        userId: params.userId,
      });
      results.push(result);
    }

    return {
      success: results.every(r => r.success),
      cells: results,
    };
  }

  /**
   * Read a range of cells from an Excel document
   */
  async readRange(params: {
    documentId: string;
    sheetName?: string;
    startCell: string;
    endCell: string;
    userId: string;
  }): Promise<{ success: boolean; data: any[][]; error?: string }> {
    try {
      const { documentId, sheetName, startCell, endCell, userId } = params;

      // Get document from database
      const document = await prisma.document.findFirst({
        where: { id: documentId, userId },
      });

      if (!document?.path) {
        return { success: false, data: [], error: 'Document not found' };
      }

      // Read the Excel file
      const workbook = new ExcelJS.Workbook();
      const fileBuffer = await fs.readFile(document.path);
      await workbook.xlsx.load(fileBuffer);

      // Get the worksheet
      const worksheet = sheetName
        ? workbook.getWorksheet(sheetName)
        : workbook.worksheets[0];

      if (!worksheet) {
        return { success: false, data: [], error: 'Worksheet not found' };
      }

      // Parse cell addresses
      const startMatch = startCell.match(/^([A-Z]+)(\d+)$/i);
      const endMatch = endCell.match(/^([A-Z]+)(\d+)$/i);

      if (!startMatch || !endMatch) {
        return { success: false, data: [], error: 'Invalid cell range' };
      }

      const startCol = this.columnToNumber(startMatch[1]);
      const startRow = parseInt(startMatch[2]);
      const endCol = this.columnToNumber(endMatch[1]);
      const endRow = parseInt(endMatch[2]);

      // Read the range
      const data: any[][] = [];

      for (let row = startRow; row <= endRow; row++) {
        const rowData: any[] = [];
        for (let col = startCol; col <= endCol; col++) {
          const cell = worksheet.getCell(row, col);
          const result = this.getCellValue(cell);
          rowData.push(result.value);
        }
        data.push(rowData);
      }

      return { success: true, data };

    } catch (error) {
      return {
        success: false,
        data: [],
        error: `Failed to read range: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Convert column letter to number (A=1, B=2, ... Z=26, AA=27, etc.)
   */
  private columnToNumber(column: string): number {
    let result = 0;
    for (let i = 0; i < column.length; i++) {
      result = result * 26 + (column.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result;
  }
}

export default new ExcelCellReaderService();
