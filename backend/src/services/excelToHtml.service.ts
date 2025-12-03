/**
 * Excel to HTML Conversion Service
 * Converts Excel files (.xlsx, .xls) to HTML tables with formatting preservation
 */

import * as XLSX from 'xlsx';

interface ExcelToHtmlResult {
  html: string;
  sheetCount: number;
  sheets: SheetInfo[];
}

interface SheetInfo {
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

class ExcelToHtmlService {
  /**
   * Convert Excel buffer to HTML
   */
  async convertToHtml(buffer: Buffer): Promise<ExcelToHtmlResult> {
    try {
      // Read the Excel workbook
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: true,
        cellDates: true,
        cellStyles: true,
      });

      const sheets: SheetInfo[] = [];
      const htmlParts: string[] = [];

      // Add document wrapper
      htmlParts.push(this.getHtmlHeader());

      // Process each sheet
      workbook.SheetNames.forEach((sheetName, sheetIndex) => {
        const sheet = workbook.Sheets[sheetName];

        // Get sheet range
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        const rowCount = range.e.r - range.s.r + 1;
        const columnCount = range.e.c - range.s.c + 1;

        sheets.push({
          name: sheetName,
          index: sheetIndex,
          rowCount,
          columnCount,
        });

        // Add sheet section
        htmlParts.push(this.convertSheetToHtml(sheet, sheetName, sheetIndex));
      });

      // Close document wrapper
      htmlParts.push(this.getHtmlFooter());

      return {
        html: htmlParts.join('\n'),
        sheetCount: workbook.SheetNames.length,
        sheets,
      };
    } catch (error) {
      console.error('Error converting Excel to HTML:', error);
      throw new Error(`Failed to convert Excel to HTML: ${(error as Error).message}`);
    }
  }

  /**
   * Convert a single sheet to HTML table
   */
  private convertSheetToHtml(sheet: XLSX.WorkSheet, sheetName: string, sheetIndex: number): string {
    const htmlParts: string[] = [];

    // Add sheet container (no header - tabs are in frontend)
    htmlParts.push(`
      <div class="sheet-container" data-sheet-index="${sheetIndex}">
    `);

    // Convert to JSON to get cell data
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false,
    });

    if (jsonData && jsonData.length > 0) {
      const rows = jsonData as any[][];

      // Start table
      htmlParts.push('<div class="table-wrapper">');
      htmlParts.push('<table class="excel-table">');

      // Determine if first row is header (heuristic: check if all cells are non-empty)
      const firstRow = rows[0] || [];
      const isHeaderRow = firstRow.length > 0 && firstRow.every((cell: any) => cell !== '');

      // Process rows
      rows.forEach((row, rowIndex) => {
        const isHeader = rowIndex === 0 && isHeaderRow;
        const tag = isHeader ? 'th' : 'td';
        const rowClass = isHeader ? 'header-row' : rowIndex % 2 === 0 ? 'even-row' : 'odd-row';

        htmlParts.push(`<tr class="${rowClass}">`);

        // Ensure row has enough cells
        const maxCols = Math.max(...rows.map(r => r.length));
        for (let colIndex = 0; colIndex < maxCols; colIndex++) {
          const cellValue = row[colIndex] !== undefined ? row[colIndex] : '';
          const cellContent = this.formatCellValue(cellValue);
          const cellClass = this.getCellClass(cellValue);

          htmlParts.push(`<${tag} class="${cellClass}">${cellContent}</${tag}>`);
        }

        htmlParts.push('</tr>');
      });

      // Close table
      htmlParts.push('</table>');
      htmlParts.push('</div>');
    } else {
      htmlParts.push('<div class="empty-sheet">Empty sheet</div>');
    }

    // Close sheet container
    htmlParts.push('</div>');

    return htmlParts.join('\n');
  }

  /**
   * Format cell value with proper type detection
   */
  private formatCellValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '<span class="empty-cell">—</span>';
    }

    // Check if it's a number
    if (typeof value === 'number' || !isNaN(Number(value))) {
      const numValue = typeof value === 'number' ? value : Number(value);

      // Format large numbers with commas
      if (Math.abs(numValue) >= 1000) {
        return numValue.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        });
      }

      return numValue.toString();
    }

    // Check if it's a date string
    if (this.isDateString(value)) {
      return `<span class="date-cell">${this.escapeHtml(String(value))}</span>`;
    }

    // Regular text
    return this.escapeHtml(String(value));
  }

  /**
   * Determine cell class based on content
   */
  private getCellClass(value: any): string {
    if (value === null || value === undefined || value === '') {
      return 'cell empty';
    }

    if (typeof value === 'number' || !isNaN(Number(value))) {
      return 'cell number-cell';
    }

    if (this.isDateString(value)) {
      return 'cell date-cell';
    }

    return 'cell text-cell';
  }

  /**
   * Check if string looks like a date
   */
  private isDateString(value: any): boolean {
    if (typeof value !== 'string') return false;

    // Simple date pattern detection
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY
    ];

    return datePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Get HTML document header with embedded CSS
   */
  private getHtmlHeader(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Excel Workbook</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #FAFAFA;
      padding: 0;
      color: #32302C;
      line-height: 1.6;
    }

    .workbook-container {
      max-width: 100%;
      margin: 0 auto;
    }

    .sheet-container {
      background: white;
      margin-bottom: 0;
      overflow: visible;
    }

    .sheet-header {
      display: none;
    }

    .table-wrapper {
      overflow: visible;
      display: inline-block;
    }

    .excel-table {
      border-collapse: collapse;
      font-size: 13px;
      background: white;
    }

    .excel-table th,
    .excel-table td {
      padding: 8px 12px;
      text-align: left;
      border: 1px solid #E6E6EC;
      vertical-align: middle;
      white-space: nowrap;
    }

    .excel-table th {
      background: #F5F5F5;
      font-weight: 600;
      color: #32302C;
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .header-row th {
      background: linear-gradient(180deg, #F8F8F8 0%, #F0F0F0 100%);
      border-bottom: 2px solid #4A90E2;
    }

    .even-row {
      background: #FAFAFA;
    }

    .odd-row {
      background: white;
    }

    .excel-table tr:hover {
      background: #F0F7FF !important;
    }

    .number-cell {
      text-align: right;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-weight: 500;
      color: #1E40AF;
    }

    .date-cell {
      color: #059669;
      font-weight: 500;
    }

    .text-cell {
      color: #32302C;
    }

    .empty-cell {
      color: #9CA3AF;
      font-style: italic;
    }

    .empty-sheet {
      padding: 60px 24px;
      text-align: center;
      color: #6C6B6E;
      font-size: 16px;
      font-style: italic;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .sheet-header {
        padding: 16px;
      }

      .sheet-title {
        font-size: 16px;
      }

      .excel-table {
        font-size: 12px;
      }

      .excel-table th,
      .excel-table td {
        padding: 8px 12px;
        min-width: 80px;
      }
    }

    /* Print styles */
    @media print {
      body {
        background: white;
      }

      .sheet-container {
        box-shadow: none;
        page-break-after: always;
      }

      .table-wrapper {
        max-height: none;
      }
    }
  </style>
</head>
<body>
  <div class="workbook-container">
`;
  }

  /**
   * Get HTML document footer
   */
  private getHtmlFooter(): string {
    return `
  </div>
</body>
</html>
`;
  }
}

export default new ExcelToHtmlService();
