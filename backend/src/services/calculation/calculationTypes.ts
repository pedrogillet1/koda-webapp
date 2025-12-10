/**
 * Calculation Types and Interfaces
 * Core type definitions for the Koda Calculation Engine
 */

export enum CalculationType {
  SIMPLE_MATH = 'simple_math',           // 2+2, 15% of 100
  FINANCIAL = 'financial',               // IRR, NPV, PMT
  STATISTICAL = 'statistical',           // AVERAGE, STDEV
  EXCEL_FORMULA = 'excel_formula',       // =SUM(A1:A10)
  COMPLEX = 'complex',                   // Multi-step, requires Python
  NONE = 'none'                          // Not a calculation
}

export interface CalculationDetectionResult {
  isCalculation: boolean;
  type: CalculationType;
  expression?: string;
  confidence: number;
  parameters?: Record<string, any>;
}

export interface CalculationResult {
  success: boolean;
  result?: any;
  formatted?: string;
  error?: string;
  executionTime: number;
  method: 'mathjs' | 'formulajs' | 'python' | 'hyperformula' | 'native';
  steps?: string[];
}

export interface FinancialCalculationParams {
  rate?: number;
  nper?: number;
  pmt?: number;
  pv?: number;
  fv?: number;
  type?: number;
  cashFlows?: number[];
  values?: number[];
  dates?: Date[];
}

export interface StatisticalCalculationParams {
  values: number[];
  population?: boolean;
}

export interface ExcelFormulaParams {
  formula: string;
  cellData?: Record<string, any>;
  sheetData?: any[][];
}

export interface PythonExecutionParams {
  code: string;
  variables?: Record<string, any>;
  timeout?: number;
}

// Function categories for detection
export const FINANCIAL_FUNCTIONS = [
  'PMT', 'FV', 'PV', 'NPV', 'IRR', 'XIRR', 'XNPV',
  'RATE', 'NPER', 'IPMT', 'PPMT', 'CUMIPMT', 'CUMPRINC',
  'SLN', 'DB', 'DDB', 'SYD', 'VDB',
  'MIRR', 'EFFECT', 'NOMINAL'
];

export const STATISTICAL_FUNCTIONS = [
  'AVERAGE', 'AVERAGEIF', 'AVERAGEIFS', 'MEDIAN', 'MODE',
  'STDEV', 'STDEVP', 'VAR', 'VARP', 'STDEV.S', 'STDEV.P',
  'CORREL', 'COVARIANCE', 'PERCENTILE', 'QUARTILE',
  'COUNT', 'COUNTA', 'COUNTIF', 'COUNTIFS', 'COUNTBLANK',
  'MIN', 'MAX', 'LARGE', 'SMALL', 'RANK', 'PERCENTRANK',
  'NORM.DIST', 'NORM.INV', 'T.DIST', 'T.INV', 'CONFIDENCE'
];

export const MATH_FUNCTIONS = [
  'SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT',
  'ABS', 'SQRT', 'POWER', 'EXP', 'LOG', 'LOG10', 'LN',
  'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'CEILING', 'FLOOR', 'TRUNC',
  'MOD', 'QUOTIENT', 'GCD', 'LCM',
  'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN',
  'PI', 'RAND', 'RANDBETWEEN', 'FACT', 'COMBIN', 'PERMUT'
];

export const LOGICAL_FUNCTIONS = [
  'IF', 'IFS', 'AND', 'OR', 'NOT', 'XOR',
  'TRUE', 'FALSE', 'IFERROR', 'IFNA'
];

export const TEXT_FUNCTIONS = [
  'CONCAT', 'CONCATENATE', 'LEFT', 'RIGHT', 'MID', 'LEN',
  'UPPER', 'LOWER', 'PROPER', 'TRIM', 'SUBSTITUTE', 'REPLACE',
  'FIND', 'SEARCH', 'TEXT', 'VALUE', 'FIXED'
];

export const DATE_FUNCTIONS = [
  'DATE', 'DATEVALUE', 'DAY', 'MONTH', 'YEAR',
  'TODAY', 'NOW', 'EDATE', 'EOMONTH', 'NETWORKDAYS',
  'DATEDIF', 'WEEKDAY', 'WEEKNUM'
];

export const LOOKUP_FUNCTIONS = [
  'VLOOKUP', 'HLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH',
  'OFFSET', 'INDIRECT', 'CHOOSE'
];

// All supported functions
export const ALL_FUNCTIONS = [
  ...FINANCIAL_FUNCTIONS,
  ...STATISTICAL_FUNCTIONS,
  ...MATH_FUNCTIONS,
  ...LOGICAL_FUNCTIONS,
  ...TEXT_FUNCTIONS,
  ...DATE_FUNCTIONS,
  ...LOOKUP_FUNCTIONS
];
