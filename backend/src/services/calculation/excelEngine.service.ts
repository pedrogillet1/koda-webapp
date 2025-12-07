/**
 * Excel Formula Engine (Layer 3)
 *
 * Uses HyperFormula for full Excel formula compatibility.
 * Handles cell references, ranges, and all Excel functions.
 *
 * Performance: 20-100ms
 * Coverage: 400+ Excel functions
 */

import { CalculationResult, ExcelFormulaParams } from './calculationTypes';

// Dynamic import for HyperFormula
let HyperFormula: any = null;
let hfInstance: any = null;

try {
  HyperFormula = require('hyperformula').HyperFormula;
} catch {
  console.warn('⚠️ HyperFormula not installed. Install with: npm install hyperformula');
}

// Excel column letters helper
const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

class ExcelEngineService {
  private sheetName: string = 'Sheet1';

  constructor() {
    this.initHyperFormula();
  }

  /**
   * Initialize HyperFormula instance
   */
  private initHyperFormula(): void {
    if (!HyperFormula) {
      console.warn('⚠️ HyperFormula not available');
      return;
    }

    try {
      hfInstance = HyperFormula.buildEmpty({
        licenseKey: 'gpl-v3',
        // Enable all Excel-like functionality
        useColumnIndex: true,
        useRowIndex: true,
        maxRows: 10000,
        maxColumns: 1000,
      });

      console.log('✅ HyperFormula engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize HyperFormula:', error);
    }
  }

  /**
   * Evaluate an Excel formula
   */
  async evaluateFormula(params: ExcelFormulaParams): Promise<CalculationResult> {
    const startTime = Date.now();
    const { formula, cellData, sheetData } = params;

    // If HyperFormula not available, try fallback
    if (!hfInstance) {
      return this.fallbackEvaluate(formula, startTime);
    }

    try {
      // Create a new sheet with data
      const sheetId = hfInstance.addSheet(this.sheetName);

      // If sheet data provided, load it
      if (sheetData && Array.isArray(sheetData)) {
        hfInstance.setSheetContent(sheetId, sheetData);
      } else if (cellData && typeof cellData === 'object') {
        // Load individual cell data
        this.loadCellData(sheetId, cellData);
      }

      // Clean the formula (ensure it starts with =)
      const cleanFormula = formula.trim().startsWith('=') ? formula.trim() : '=' + formula.trim();

      // Evaluate formula in a temporary cell
      const tempCell = { sheet: sheetId, row: 9999, col: 0 };
      hfInstance.setCellContents(tempCell, cleanFormula);

      const result = hfInstance.getCellValue(tempCell);

      // Clean up
      hfInstance.removeSheet(sheetId);

      // Handle different result types
      if (result instanceof Error || (result && result.type === 'ERROR')) {
        return {
          success: false,
          error: result.message || result.value || 'Formula error',
          executionTime: Date.now() - startTime,
          method: 'hyperformula'
        };
      }

      return {
        success: true,
        result: this.normalizeResult(result),
        formatted: this.formatExcelResult(result),
        executionTime: Date.now() - startTime,
        method: 'hyperformula',
        steps: [`Formula: ${cleanFormula}`, `Result: ${result}`]
      };
    } catch (error: any) {
      // Try fallback on error
      return this.fallbackEvaluate(formula, startTime);
    }
  }

  /**
   * Load cell data into a sheet
   */
  private loadCellData(sheetId: number, cellData: Record<string, any>): void {
    for (const [cellRef, value] of Object.entries(cellData)) {
      const { row, col } = this.parseCellRef(cellRef);
      hfInstance.setCellContents({ sheet: sheetId, row, col }, value);
    }
  }

  /**
   * Parse Excel cell reference (e.g., "A1" -> {row: 0, col: 0})
   */
  private parseCellRef(ref: string): { row: number; col: number } {
    const match = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!match) {
      throw new Error(`Invalid cell reference: ${ref}`);
    }

    const colStr = match[1].toUpperCase();
    const rowNum = parseInt(match[2], 10) - 1; // 0-indexed

    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col -= 1; // 0-indexed

    return { row: rowNum, col };
  }

  /**
   * Convert row/col to cell reference
   */
  private toCellRef(row: number, col: number): string {
    let colStr = '';
    let c = col + 1;
    while (c > 0) {
      colStr = COLUMN_LETTERS[(c - 1) % 26] + colStr;
      c = Math.floor((c - 1) / 26);
    }
    return colStr + (row + 1);
  }

  /**
   * Fallback evaluation without HyperFormula
   */
  private fallbackEvaluate(formula: string, startTime: number): CalculationResult {
    try {
      // Remove leading = and try to evaluate simple formulas
      let expression = formula.trim();
      if (expression.startsWith('=')) {
        expression = expression.slice(1);
      }

      // Handle common Excel functions with native implementations
      const result = this.evaluateSimpleFormula(expression);

      if (result !== null) {
        return {
          success: true,
          result,
          formatted: this.formatExcelResult(result),
          executionTime: Date.now() - startTime,
          method: 'hyperformula'
        };
      }

      return {
        success: false,
        error: 'HyperFormula not available and formula not supported by fallback',
        executionTime: Date.now() - startTime,
        method: 'hyperformula'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        method: 'hyperformula'
      };
    }
  }

  /**
   * Evaluate simple Excel formulas without HyperFormula
   */
  private evaluateSimpleFormula(expression: string): number | string | null {
    const upper = expression.toUpperCase();

    // SUM(1, 2, 3) or SUM(1:3)
    const sumMatch = upper.match(/^SUM\s*\(\s*(.+)\s*\)$/i);
    if (sumMatch) {
      const args = this.parseArguments(sumMatch[1]);
      return args.reduce((a: number, b: number) => a + b, 0);
    }

    // AVERAGE(1, 2, 3)
    const avgMatch = upper.match(/^AVERAGE\s*\(\s*(.+)\s*\)$/i);
    if (avgMatch) {
      const args = this.parseArguments(avgMatch[1]);
      return args.reduce((a: number, b: number) => a + b, 0) / args.length;
    }

    // COUNT(1, 2, 3)
    const countMatch = upper.match(/^COUNT\s*\(\s*(.+)\s*\)$/i);
    if (countMatch) {
      const args = this.parseArguments(countMatch[1]);
      return args.filter((a: any) => typeof a === 'number' && !isNaN(a)).length;
    }

    // MIN(1, 2, 3)
    const minMatch = upper.match(/^MIN\s*\(\s*(.+)\s*\)$/i);
    if (minMatch) {
      const args = this.parseArguments(minMatch[1]);
      return Math.min(...args);
    }

    // MAX(1, 2, 3)
    const maxMatch = upper.match(/^MAX\s*\(\s*(.+)\s*\)$/i);
    if (maxMatch) {
      const args = this.parseArguments(maxMatch[1]);
      return Math.max(...args);
    }

    // ROUND(1.234, 2)
    const roundMatch = upper.match(/^ROUND\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)$/i);
    if (roundMatch) {
      const value = parseFloat(roundMatch[1]);
      const decimals = parseInt(roundMatch[2]);
      return parseFloat(value.toFixed(decimals));
    }

    // ABS(-5)
    const absMatch = upper.match(/^ABS\s*\(\s*(.+)\s*\)$/i);
    if (absMatch) {
      return Math.abs(parseFloat(absMatch[1]));
    }

    // SQRT(16)
    const sqrtMatch = upper.match(/^SQRT\s*\(\s*(.+)\s*\)$/i);
    if (sqrtMatch) {
      return Math.sqrt(parseFloat(sqrtMatch[1]));
    }

    // POWER(2, 3)
    const powerMatch = upper.match(/^POWER\s*\(\s*(.+?)\s*,\s*(.+)\s*\)$/i);
    if (powerMatch) {
      return Math.pow(parseFloat(powerMatch[1]), parseFloat(powerMatch[2]));
    }

    // IF(condition, true_value, false_value)
    const ifMatch = expression.match(/^IF\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+)\s*\)$/i);
    if (ifMatch) {
      const condition = this.evaluateCondition(ifMatch[1]);
      return condition ? this.parseValue(ifMatch[2]) : this.parseValue(ifMatch[3]);
    }

    // Try direct numeric evaluation
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
      if (sanitized.length > 0) {
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
          return result;
        }
      }
    } catch {
      // Continue to return null
    }

    return null;
  }

  /**
   * Parse function arguments
   */
  private parseArguments(argsString: string): number[] {
    const parts = argsString.split(',');
    const result: number[] = [];

    for (const part of parts) {
      const trimmed = part.trim();

      // Check for range like 1:10
      const rangeMatch = trimmed.match(/^(\d+):(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        for (let i = start; i <= end; i++) {
          result.push(i);
        }
        continue;
      }

      // Regular number
      const num = parseFloat(trimmed);
      if (!isNaN(num)) {
        result.push(num);
      }
    }

    return result;
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateCondition(condition: string): boolean {
    try {
      // Handle comparisons
      const comparisons = [
        { op: '>=', fn: (a: number, b: number) => a >= b },
        { op: '<=', fn: (a: number, b: number) => a <= b },
        { op: '<>', fn: (a: number, b: number) => a !== b },
        { op: '=', fn: (a: number, b: number) => a === b },
        { op: '>', fn: (a: number, b: number) => a > b },
        { op: '<', fn: (a: number, b: number) => a < b },
      ];

      for (const { op, fn } of comparisons) {
        if (condition.includes(op)) {
          const [left, right] = condition.split(op);
          return fn(parseFloat(left.trim()), parseFloat(right.trim()));
        }
      }

      // Boolean values
      if (condition.toUpperCase() === 'TRUE') return true;
      if (condition.toUpperCase() === 'FALSE') return false;

      return Boolean(parseFloat(condition));
    } catch {
      return false;
    }
  }

  /**
   * Parse a value (number or string)
   */
  private parseValue(value: string): number | string {
    const trimmed = value.trim();

    // Check for quoted string
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    const num = parseFloat(trimmed);
    return isNaN(num) ? trimmed : num;
  }

  /**
   * Normalize result to a standard format
   */
  private normalizeResult(result: any): any {
    if (typeof result === 'number') {
      return result;
    }

    if (Array.isArray(result)) {
      return result.map(row =>
        Array.isArray(row) ? row.map(cell => this.normalizeResult(cell)) : this.normalizeResult(row)
      );
    }

    return result;
  }

  /**
   * Format Excel result for display
   */
  private formatExcelResult(result: any): string {
    if (typeof result === 'number') {
      // Format large numbers
      if (Math.abs(result) >= 1e9) {
        return `${(result / 1e9).toFixed(2)}B`;
      }
      if (Math.abs(result) >= 1e6) {
        return `${(result / 1e6).toFixed(2)}M`;
      }
      if (Math.abs(result) >= 1000) {
        return result.toLocaleString('en-US', { maximumFractionDigits: 2 });
      }
      if (Number.isInteger(result)) {
        return result.toString();
      }
      return result.toFixed(4).replace(/\.?0+$/, '');
    }

    if (Array.isArray(result)) {
      return JSON.stringify(result);
    }

    return String(result);
  }

  /**
   * Process a full spreadsheet with formulas
   */
  async processSpreadsheet(data: (string | number)[][]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (!hfInstance) {
      return {
        success: false,
        error: 'HyperFormula not available',
        executionTime: Date.now() - startTime,
        method: 'hyperformula'
      };
    }

    try {
      const sheetId = hfInstance.addSheet(this.sheetName);
      hfInstance.setSheetContent(sheetId, data);

      // Get all calculated values
      const result: any[][] = [];
      const dimensions = hfInstance.getSheetDimensions(sheetId);

      for (let row = 0; row < dimensions.height; row++) {
        const rowData: any[] = [];
        for (let col = 0; col < dimensions.width; col++) {
          rowData.push(hfInstance.getCellValue({ sheet: sheetId, row, col }));
        }
        result.push(rowData);
      }

      hfInstance.removeSheet(sheetId);

      return {
        success: true,
        result,
        formatted: 'Spreadsheet processed',
        executionTime: Date.now() - startTime,
        method: 'hyperformula'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
        method: 'hyperformula'
      };
    }
  }

  /**
   * Get list of supported functions
   */
  getSupportedFunctions(): string[] {
    if (hfInstance) {
      try {
        return Object.keys(hfInstance.getFunctionPlugin());
      } catch {
        // Return common functions
      }
    }

    // Return commonly supported functions
    return [
      'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTBLANK', 'MIN', 'MAX',
      'IF', 'AND', 'OR', 'NOT', 'IFERROR', 'IFNA',
      'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'XLOOKUP',
      'LEFT', 'RIGHT', 'MID', 'LEN', 'CONCATENATE', 'CONCAT',
      'DATE', 'TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY',
      'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'ABS', 'SQRT', 'POWER',
      'PMT', 'PV', 'FV', 'NPV', 'IRR', 'RATE', 'NPER',
      'STDEV', 'VAR', 'MEDIAN', 'MODE', 'PERCENTILE'
    ];
  }

  /**
   * Check if HyperFormula is available
   */
  isAvailable(): boolean {
    return hfInstance !== null;
  }
}

export default new ExcelEngineService();
