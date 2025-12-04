/**
 * Excel Cell Utilities
 * Shared utilities for handling Excel cell values, especially formulas
 *
 * ✅ FIX: This utility ensures formulas return calculated results, not formula text
 */

/**
 * Result of extracting a cell value
 */
export interface CellValueResult {
  value: any;
  formattedValue: string;
  hasFormula: boolean;
  formula?: string;
  isError?: boolean;
  errorType?: string;
}

/**
 * Get cell value from an ExcelJS cell object
 * ✅ FIX: Returns calculated result for formula cells, not the formula text
 *
 * @param cell - ExcelJS Cell object or raw cell value
 * @returns CellValueResult with proper value extraction
 */
export function getCellValue(cell: any): CellValueResult {
  // Handle null/undefined
  if (cell === null || cell === undefined) {
    return {
      value: null,
      formattedValue: '',
      hasFormula: false,
    };
  }

  // If cell is an ExcelJS Cell object, get its value
  const cellValue = cell.value !== undefined ? cell.value : cell;

  // Handle null/undefined value
  if (cellValue === null || cellValue === undefined) {
    return {
      value: null,
      formattedValue: '',
      hasFormula: false,
    };
  }

  // ✅ FIX: Handle formula cells - return calculated result, not formula text
  if (typeof cellValue === 'object' && cellValue.formula) {
    const formula = cellValue.formula;

    // Check if we have a calculated result
    if (cellValue.result !== undefined && cellValue.result !== null) {
      return {
        value: cellValue.result,
        formattedValue: formatValue(cellValue.result),
        hasFormula: true,
        formula: `=${formula}`,
      };
    }

    // Check for shared formula result
    if (cellValue.sharedFormula && cellValue.result !== undefined) {
      return {
        value: cellValue.result,
        formattedValue: formatValue(cellValue.result),
        hasFormula: true,
        formula: `=${formula}`,
      };
    }

    // No result available - formula wasn't calculated by Excel
    console.warn(`[ExcelCellUtils] Formula not calculated: =${formula}`);
    return {
      value: null,
      formattedValue: `[Formula: =${formula}]`,
      hasFormula: true,
      formula: `=${formula}`,
    };
  }

  // Handle rich text
  if (typeof cellValue === 'object' && cellValue.richText) {
    const text = cellValue.richText.map((rt: any) => rt.text || '').join('');
    return {
      value: text,
      formattedValue: text,
      hasFormula: false,
    };
  }

  // Handle hyperlinks
  if (typeof cellValue === 'object' && cellValue.hyperlink) {
    const text = cellValue.text || cellValue.hyperlink;
    return {
      value: text,
      formattedValue: text,
      hasFormula: false,
    };
  }

  // Handle Excel error values
  if (typeof cellValue === 'object' && cellValue.error) {
    return {
      value: cellValue.error,
      formattedValue: cellValue.error,
      hasFormula: false,
      isError: true,
      errorType: cellValue.error,
    };
  }

  // Regular value
  return {
    value: cellValue,
    formattedValue: formatValue(cellValue),
    hasFormula: false,
  };
}

/**
 * Format a value for display
 */
export function formatValue(value: any): string {
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
    // Check for special values
    if (isNaN(value)) return '#NUM!';
    if (!isFinite(value)) return value > 0 ? '#DIV/0!' : '#DIV/0!';

    // Format with commas for large numbers
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    // Check if it's likely a percentage (0-1 range)
    // Note: This is a heuristic, actual format should come from cell numFmt
    return value.toString();
  }

  // String or other
  return String(value);
}

/**
 * Check if a cell contains a formula
 */
export function hasFormula(cell: any): boolean {
  if (!cell) return false;
  const cellValue = cell.value !== undefined ? cell.value : cell;
  return typeof cellValue === 'object' && !!cellValue?.formula;
}

/**
 * Get the formula text from a cell (if it has one)
 */
export function getFormula(cell: any): string | null {
  if (!cell) return null;
  const cellValue = cell.value !== undefined ? cell.value : cell;
  if (typeof cellValue === 'object' && cellValue?.formula) {
    return `=${cellValue.formula}`;
  }
  return null;
}

/**
 * Check if a cell value represents an Excel error
 */
export function isErrorValue(value: any): boolean {
  if (typeof value === 'string') {
    const errorTypes = ['#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#NULL!'];
    return errorTypes.includes(value);
  }
  if (typeof value === 'object' && value?.error) {
    return true;
  }
  return false;
}

/**
 * Get error type from a cell value
 */
export function getErrorType(value: any): string | null {
  if (typeof value === 'string') {
    const errorTypes = ['#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#NULL!'];
    if (errorTypes.includes(value)) return value;
  }
  if (typeof value === 'object' && value?.error) {
    return value.error;
  }
  return null;
}

export default {
  getCellValue,
  formatValue,
  hasFormula,
  getFormula,
  isErrorValue,
  getErrorType,
};
