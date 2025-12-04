/**
 * Excel to HTML with Full Styling
 * Converts Excel files to HTML with colors, borders, formatting
 */

import ExcelJS from 'exceljs';

interface CellStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  verticalAlign?: string;
}

interface SheetInfo {
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

interface ExcelToHtmlResult {
  html: string;
  sheetCount: number;
  sheets: SheetInfo[];
}

class ExcelToHtmlStyledService {
  /**
   * Convert Excel buffer to styled HTML
   */
  async convertToHtml(buffer: Buffer): Promise<ExcelToHtmlResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheets: SheetInfo[] = [];
    let html = this.getHtmlHeader();
    html += '<div class="excel-workbook">';

    // Convert each sheet
    let sheetIndex = 0;
    workbook.eachSheet((sheet, sheetId) => {
      const rowCount = sheet.rowCount || 0;
      const columnCount = sheet.columnCount || 0;

      sheets.push({
        name: sheet.name,
        index: sheetIndex,
        rowCount,
        columnCount
      });

      html += this.convertSheetToHtml(sheet, sheetIndex);
      sheetIndex++;
    });

    html += '</div>';
    html += this.getHtmlFooter();

    return {
      html,
      sheetCount: sheets.length,
      sheets
    };
  }

  /**
   * Convert a single sheet to HTML with styling
   */
  private convertSheetToHtml(sheet: ExcelJS.Worksheet, sheetIndex: number): string {
    let html = `<div class="sheet-container" data-sheet-index="${sheetIndex}">`;
    html += '<div class="table-wrapper">';
    html += '<table class="excel-table">';

    // Add column group for widths
    html += '<colgroup>';
    const columns = sheet.columns || [];
    for (let i = 0; i < (sheet.columnCount || 10); i++) {
      const col = columns[i];
      const width = col?.width ? `${Math.max(col.width * 8, 40)}px` : '80px';
      html += `<col style="width: ${width}; min-width: ${width};">`;
    }
    html += '</colgroup>';

    // Process rows
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const height = row.height ? `${row.height * 1.33}px` : 'auto';
      html += `<tr style="height: ${height};">`;

      // Get max column count
      const maxCol = sheet.columnCount || row.cellCount || 10;

      // Process each column
      for (let colNumber = 1; colNumber <= maxCol; colNumber++) {
        const cell = row.getCell(colNumber);

        // Check if cell is merged and should be skipped
        const mergeInfo = this.getMergeInfo(sheet, rowNumber, colNumber);

        if (mergeInfo.skip) {
          continue; // Skip cells that are part of a merge
        }

        // Get cell style
        const style = this.getCellStyle(cell);
        const styleStr = this.styleToString(style);

        // Get cell value
        const value = this.formatCellValue(cell);

        // Create cell HTML
        const colspan = mergeInfo.colspan > 1 ? ` colspan="${mergeInfo.colspan}"` : '';
        const rowspan = mergeInfo.rowspan > 1 ? ` rowspan="${mergeInfo.rowspan}"` : '';
        const cellClass = rowNumber === 1 ? 'header-cell' : 'data-cell';

        html += `<td class="${cellClass}"${colspan}${rowspan} style="${styleStr}">${this.escapeHtml(value)}</td>`;
      }

      html += '</tr>';
    });

    html += '</table>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  /**
   * Get merge information for a cell
   */
  private getMergeInfo(sheet: ExcelJS.Worksheet, row: number, col: number): {
    skip: boolean;
    colspan: number;
    rowspan: number;
  } {
    // Access merged cells
    const merges = (sheet as any)._merges || {};

    for (const key of Object.keys(merges)) {
      const merge = merges[key];
      if (!merge) continue;

      const startRow = merge.top;
      const endRow = merge.bottom;
      const startCol = merge.left;
      const endCol = merge.right;

      if (row >= startRow && row <= endRow && col >= startCol && col <= endCol) {
        if (row === startRow && col === startCol) {
          // This is the top-left cell of the merge
          return {
            skip: false,
            colspan: endCol - startCol + 1,
            rowspan: endRow - startRow + 1
          };
        } else {
          // This cell should be skipped
          return { skip: true, colspan: 1, rowspan: 1 };
        }
      }
    }

    return { skip: false, colspan: 1, rowspan: 1 };
  }

  /**
   * Extract cell style
   */
  private getCellStyle(cell: ExcelJS.Cell): CellStyle {
    const style: CellStyle = {};

    if (!cell || !cell.style) return style;

    // Background color
    const fill = cell.style.fill as any;
    if (fill) {
      if (fill.type === 'pattern' && fill.pattern === 'solid') {
        if (fill.fgColor?.argb) {
          style.backgroundColor = this.argbToHex(fill.fgColor.argb);
        } else if (fill.bgColor?.argb) {
          style.backgroundColor = this.argbToHex(fill.bgColor.argb);
        }
      }
    }

    // Font styles
    const font = cell.style.font;
    if (font) {
      // Font color
      if (font.color?.argb) {
        style.color = this.argbToHex(font.color.argb);
      }

      // Font weight
      if (font.bold) {
        style.fontWeight = 'bold';
      }

      // Font style
      if (font.italic) {
        style.fontStyle = 'italic';
      }
    }

    // Text alignment
    const alignment = cell.style.alignment;
    if (alignment) {
      if (alignment.horizontal) {
        const align = alignment.horizontal;
        if (align === 'left') style.textAlign = 'left';
        else if (align === 'center') style.textAlign = 'center';
        else if (align === 'right') style.textAlign = 'right';
      }

      if (alignment.vertical) {
        const valign = alignment.vertical;
        if (valign === 'top') style.verticalAlign = 'top';
        else if (valign === 'middle') style.verticalAlign = 'middle';
        else if (valign === 'bottom') style.verticalAlign = 'bottom';
      }
    }

    // Borders
    const border = cell.style.border;
    if (border) {
      if (border.top) {
        style.borderTop = this.borderToCSS(border.top);
      }
      if (border.right) {
        style.borderRight = this.borderToCSS(border.right);
      }
      if (border.bottom) {
        style.borderBottom = this.borderToCSS(border.bottom);
      }
      if (border.left) {
        style.borderLeft = this.borderToCSS(border.left);
      }
    }

    return style;
  }

  /**
   * Convert ARGB color to hex
   */
  private argbToHex(argb: string): string {
    if (!argb) return '';

    // Handle theme colors or invalid values
    if (argb.length < 6) return '';

    // ARGB format: AARRGGBB (8 chars) or RRGGBB (6 chars)
    if (argb.length === 8) {
      const hex = argb.substring(2);
      // Skip if it's white or very light (often default)
      if (hex.toUpperCase() === 'FFFFFF') return '';
      return `#${hex}`;
    }

    if (argb.length === 6) {
      if (argb.toUpperCase() === 'FFFFFF') return '';
      return `#${argb}`;
    }

    return '';
  }

  /**
   * Convert Excel border to CSS border
   */
  private borderToCSS(border: Partial<ExcelJS.Border>): string {
    if (!border || !border.style) return '';

    const color = (border.color as any)?.argb
      ? this.argbToHex((border.color as any).argb) || '#D0D0D0'
      : '#D0D0D0';

    let width = '1px';
    if (border.style === 'medium') width = '2px';
    else if (border.style === 'thick') width = '3px';

    let cssStyle = 'solid';
    if (border.style === 'dashed') cssStyle = 'dashed';
    else if (border.style === 'dotted') cssStyle = 'dotted';
    else if (border.style === 'double') cssStyle = 'double';

    return `${width} ${cssStyle} ${color}`;
  }

  /**
   * Convert style object to CSS string
   */
  private styleToString(style: CellStyle): string {
    const parts: string[] = [];

    if (style.backgroundColor) parts.push(`background-color: ${style.backgroundColor}`);
    if (style.color) parts.push(`color: ${style.color}`);
    if (style.fontWeight) parts.push(`font-weight: ${style.fontWeight}`);
    if (style.fontStyle) parts.push(`font-style: ${style.fontStyle}`);
    if (style.textAlign) parts.push(`text-align: ${style.textAlign}`);
    if (style.verticalAlign) parts.push(`vertical-align: ${style.verticalAlign}`);
    if (style.borderTop) parts.push(`border-top: ${style.borderTop}`);
    if (style.borderRight) parts.push(`border-right: ${style.borderRight}`);
    if (style.borderBottom) parts.push(`border-bottom: ${style.borderBottom}`);
    if (style.borderLeft) parts.push(`border-left: ${style.borderLeft}`);

    return parts.join('; ');
  }

  /**
   * Format cell value
   * ✅ FIX: Properly handle Excel formulas - use calculated result when available
   */
  private formatCellValue(cell: ExcelJS.Cell): string {
    if (cell.value === null || cell.value === undefined) {
      return '';
    }

    const value = cell.value as any;

    // Handle formula cells - ✅ FIX: Show calculated result, not formula text
    if (value.formula) {
      // Check if we have a calculated result
      if (value.result !== undefined && value.result !== null) {
        return this.formatValue(value.result, cell);
      }
      // If no result, show a warning indicator (formula wasn't calculated)
      console.warn(`[EXCEL] Formula not calculated: =${value.formula}`);
      return `[Formula: =${value.formula}]`;
    }

    // Handle rich text
    if (value.richText) {
      return value.richText.map((rt: any) => rt.text).join('');
    }

    // Handle hyperlinks
    if (value.hyperlink) {
      return value.text || value.hyperlink;
    }

    // Handle error values
    if (value.error) {
      return value.error;
    }

    return this.formatValue(cell.value, cell);
  }

  /**
   * Format value based on type and number format
   */
  private formatValue(value: any, cell?: ExcelJS.Cell): string {
    if (value === null || value === undefined) return '';

    // Date
    if (value instanceof Date) {
      return value.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }

    // Boolean
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    // Number
    if (typeof value === 'number') {
      // Check number format from cell
      const numFmt = cell?.numFmt || '';

      // Percentage format
      if (numFmt.includes('%')) {
        return `${(value * 100).toFixed(2)}%`;
      }

      // Currency format
      if (numFmt.includes('$') || numFmt.includes('£') || numFmt.includes('€')) {
        return value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      // Accounting format (negative in parentheses)
      if (numFmt.includes('(') && numFmt.includes(')')) {
        if (value < 0) {
          return `(${Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })})`;
        }
      }

      // Format large numbers with commas
      if (Math.abs(value) >= 1000) {
        return value.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        });
      }

      // Small decimals
      if (value !== Math.floor(value)) {
        return value.toFixed(2);
      }

      return value.toString();
    }

    return String(value);
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: white;
      padding: 0;
      color: #333;
      line-height: 1.4;
    }

    .excel-workbook {
      width: 100%;
    }

    .sheet-container {
      background: white;
    }

    .table-wrapper {
      display: inline-block;
    }

    .excel-table {
      border-collapse: collapse;
      font-size: 12px;
      background: white;
      table-layout: fixed;
    }

    .excel-table td {
      padding: 4px 8px;
      border: 1px solid #D0D0D0;
      vertical-align: middle;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }

    .excel-table .header-cell {
      background: #F3F3F3;
      font-weight: 600;
      color: #333;
    }

    .excel-table .data-cell {
      background: white;
    }

    .excel-table tr:hover .data-cell {
      background: #F5F9FF;
    }

    /* Number cells - right align by default */
    .excel-table td[data-type="number"] {
      text-align: right;
      font-family: 'Consolas', 'Monaco', monospace;
    }
  </style>
</head>
<body>
`;
  }

  /**
   * Get HTML document footer
   */
  private getHtmlFooter(): string {
    return `
</body>
</html>
`;
  }
}

export default new ExcelToHtmlStyledService();
