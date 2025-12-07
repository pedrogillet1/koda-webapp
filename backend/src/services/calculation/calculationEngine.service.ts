/**
 * Unified Calculation Engine
 *
 * Orchestrates all three calculation layers:
 * - Layer 1: Smart Calculator (Math.js + Formula.js) - 10-50ms
 * - Layer 2: Python Engine (numpy, pandas, scipy) - 100-500ms
 * - Layer 3: Excel Engine (HyperFormula) - 20-100ms
 *
 * Automatically routes calculations to the best engine based on detection.
 */

import {
  CalculationType,
  CalculationDetectionResult,
  CalculationResult,
  FinancialCalculationParams,
  ExcelFormulaParams
} from './calculationTypes';
import calculationDetector from './calculationDetector.service';
import smartCalculator from './smartCalculator.service';
import pythonEngine from './pythonEngine.service';
import excelEngine from './excelEngine.service';

export interface CalculationEngineOptions {
  preferredEngine?: 'mathjs' | 'formulajs' | 'python' | 'hyperformula' | 'auto';
  timeout?: number;
  fallbackEnabled?: boolean;
  contextData?: string;
  spreadsheetData?: any[][];
}

class CalculationEngineService {
  private initialized: boolean = false;
  private capabilities: {
    mathjs: boolean;
    formulajs: boolean;
    hyperformula: boolean;
    python: {
      available: boolean;
      version: string | null;
      numpy: boolean;
      pandas: boolean;
      scipy: boolean;
    };
  } = {
    mathjs: true,
    formulajs: true,
    hyperformula: true,
    python: {
      available: false,
      version: null,
      numpy: false,
      pandas: false,
      scipy: false
    }
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the calculation engine and check capabilities
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔧 Initializing Calculation Engine...');

    // Check HyperFormula availability
    this.capabilities.hyperformula = excelEngine.isAvailable();

    // Check Python capabilities
    try {
      const pyCapabilities = await pythonEngine.getCapabilities();
      this.capabilities.python = {
        available: pyCapabilities.pythonVersion !== null,
        version: pyCapabilities.pythonVersion,
        numpy: pyCapabilities.numpy,
        pandas: pyCapabilities.pandas,
        scipy: pyCapabilities.scipy
      };
    } catch {
      console.warn('⚠️ Python engine not available');
    }

    this.initialized = true;

    console.log('✅ Calculation Engine initialized');
    console.log(`   - Math.js/Formula.js: ✅`);
    console.log(`   - HyperFormula: ${this.capabilities.hyperformula ? '✅' : '❌'}`);
    console.log(`   - Python: ${this.capabilities.python.available ? `✅ (${this.capabilities.python.version})` : '❌'}`);
    if (this.capabilities.python.available) {
      console.log(`     - numpy: ${this.capabilities.python.numpy ? '✅' : '❌'}`);
      console.log(`     - pandas: ${this.capabilities.python.pandas ? '✅' : '❌'}`);
      console.log(`     - scipy: ${this.capabilities.python.scipy ? '✅' : '❌'}`);
    }
  }

  /**
   * Main entry point: Process any calculation query
   */
  async calculate(
    query: string,
    options: CalculationEngineOptions = {}
  ): Promise<CalculationResult> {
    const startTime = Date.now();

    // Detect calculation type
    const detection = calculationDetector.detect(query);

    console.log(`🧮 [CALC ENGINE] Query: "${query.substring(0, 100)}..."`);
    console.log(`🧮 [CALC ENGINE] Detection: ${detection.type}, confidence: ${detection.confidence}`);

    // If not a calculation, return early
    if (!detection.isCalculation) {
      return {
        success: false,
        error: 'Not a calculation query',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    // Route to appropriate engine
    const engine = options.preferredEngine === 'auto' || !options.preferredEngine
      ? calculationDetector.getBestEngine(detection)
      : options.preferredEngine;

    console.log(`🧮 [CALC ENGINE] Using engine: ${engine}`);

    try {
      let result: CalculationResult;

      switch (engine) {
        case 'mathjs':
          result = await this.handleMathCalculation(detection, query, options);
          break;

        case 'formulajs':
          result = await this.handleFinancialStatistical(detection, query, options);
          break;

        case 'hyperformula':
          result = await this.handleExcelFormula(detection, query, options);
          break;

        case 'python':
          result = await this.handlePythonCalculation(detection, query, options);
          break;

        default:
          result = await this.handleMathCalculation(detection, query, options);
      }

      // If primary engine failed and fallback enabled, try alternatives
      if (!result.success && options.fallbackEnabled !== false) {
        result = await this.tryFallback(detection, query, options, engine);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Calculation failed',
        executionTime: Date.now() - startTime,
        method: engine
      };
    }
  }

  /**
   * Handle simple math calculations (Layer 1)
   */
  private async handleMathCalculation(
    detection: CalculationDetectionResult,
    query: string,
    options: CalculationEngineOptions
  ): Promise<CalculationResult> {
    // Check for percentage calculation
    if (detection.parameters?.percentage !== undefined) {
      return smartCalculator.calculatePercentage(
        detection.parameters.percentage,
        detection.parameters.total
      );
    }

    // Evaluate expression
    const expression = detection.expression || query;
    return smartCalculator.evaluateMath(expression);
  }

  /**
   * Handle financial and statistical calculations (Layer 1)
   */
  private async handleFinancialStatistical(
    detection: CalculationDetectionResult,
    query: string,
    options: CalculationEngineOptions
  ): Promise<CalculationResult> {
    const upperQuery = query.toUpperCase();

    // Financial functions
    if (detection.type === CalculationType.FINANCIAL) {
      const params = detection.parameters as FinancialCalculationParams || {};

      // Try to extract more parameters from context
      if (options.contextData) {
        const numbers = calculationDetector.extractNumbersFromContext(options.contextData);
        if (numbers.length > 0 && !params.cashFlows) {
          params.cashFlows = numbers;
        }
      }

      // Route to specific financial function
      if (upperQuery.includes('PMT') || upperQuery.includes('PAYMENT') || upperQuery.includes('LOAN')) {
        return smartCalculator.calculatePMT(params);
      }

      if (upperQuery.includes('NPV') || upperQuery.includes('NET PRESENT')) {
        const rate = params.rate || 0.1;
        const cashFlows = params.cashFlows || [];
        return smartCalculator.calculateNPV(rate, cashFlows);
      }

      if (upperQuery.includes('IRR') || upperQuery.includes('INTERNAL RATE')) {
        const cashFlows = params.cashFlows || [];
        return smartCalculator.calculateIRR(cashFlows);
      }

      if (upperQuery.includes('FV') || upperQuery.includes('FUTURE VALUE')) {
        return smartCalculator.calculateFV(params);
      }

      if (upperQuery.includes('PV') || upperQuery.includes('PRESENT VALUE')) {
        return smartCalculator.calculatePV(params);
      }
    }

    // Statistical functions
    if (detection.type === CalculationType.STATISTICAL) {
      // Extract numbers from query or context
      let values: number[] = [];

      if (options.contextData) {
        values = calculationDetector.extractNumbersFromContext(options.contextData);
      }

      // Also try to extract from query itself
      const queryNumbers = calculationDetector.extractNumbersFromContext(query);
      if (queryNumbers.length > values.length) {
        values = queryNumbers;
      }

      if (values.length === 0) {
        return {
          success: false,
          error: 'No numeric values found for statistical calculation',
          executionTime: 0,
          method: 'formulajs'
        };
      }

      if (upperQuery.includes('AVERAGE') || upperQuery.includes('MEAN') || upperQuery.includes('AVG')) {
        return smartCalculator.calculateAverage(values);
      }

      if (upperQuery.includes('MEDIAN')) {
        return smartCalculator.calculateMedian(values);
      }

      if (upperQuery.includes('STDEV') || upperQuery.includes('STANDARD DEV')) {
        const population = upperQuery.includes('POPULATION') || upperQuery.includes('STDEVP');
        return smartCalculator.calculateStdev(values, population);
      }

      if (upperQuery.includes('VARIANCE') || upperQuery.includes('VAR')) {
        const population = upperQuery.includes('POPULATION') || upperQuery.includes('VARP');
        return smartCalculator.calculateVariance(values, population);
      }

      if (upperQuery.includes('SUM') || upperQuery.includes('TOTAL')) {
        return smartCalculator.calculateSum(values);
      }

      if (upperQuery.includes('COUNT')) {
        return smartCalculator.calculateCount(values);
      }

      if (upperQuery.includes('MIN') || upperQuery.includes('MINIMUM')) {
        return smartCalculator.calculateMin(values);
      }

      if (upperQuery.includes('MAX') || upperQuery.includes('MAXIMUM')) {
        return smartCalculator.calculateMax(values);
      }

      // Default to average for generic statistical queries
      return smartCalculator.calculateAverage(values);
    }

    // Fallback to math evaluation
    return smartCalculator.evaluateMath(query);
  }

  /**
   * Handle Excel formulas (Layer 3)
   */
  private async handleExcelFormula(
    detection: CalculationDetectionResult,
    query: string,
    options: CalculationEngineOptions
  ): Promise<CalculationResult> {
    const params: ExcelFormulaParams = {
      formula: detection.expression || query,
      sheetData: options.spreadsheetData
    };

    return excelEngine.evaluateFormula(params);
  }

  /**
   * Handle complex calculations via Python (Layer 2)
   */
  private async handlePythonCalculation(
    detection: CalculationDetectionResult,
    query: string,
    options: CalculationEngineOptions
  ): Promise<CalculationResult> {
    const upperQuery = query.toUpperCase();

    // Extract numbers for analysis
    const numbers = calculationDetector.extractNumbersFromContext(
      options.contextData || query
    );

    // Regression analysis
    if (upperQuery.includes('REGRESSION') || upperQuery.includes('TREND')) {
      if (numbers.length >= 4) {
        // Split into x and y (assuming pairs)
        const half = Math.floor(numbers.length / 2);
        const x = numbers.slice(0, half);
        const y = numbers.slice(half);
        return pythonEngine.calculateRegression(x, y);
      }
    }

    // Descriptive statistics
    if (upperQuery.includes('DESCRIBE') || upperQuery.includes('STATISTICS') ||
        upperQuery.includes('ANALYSIS')) {
      if (numbers.length > 0) {
        return pythonEngine.calculateDescriptiveStats(numbers);
      }
    }

    // Correlation
    if (upperQuery.includes('CORRELATION') || upperQuery.includes('CORREL')) {
      if (numbers.length >= 4) {
        const half = Math.floor(numbers.length / 2);
        return pythonEngine.calculateCorrelation([
          numbers.slice(0, half),
          numbers.slice(half)
        ]);
      }
    }

    // Matrix operations
    if (upperQuery.includes('MATRIX') || upperQuery.includes('DETERMINANT') ||
        upperQuery.includes('INVERSE')) {
      // This would need structured matrix data
      return {
        success: false,
        error: 'Matrix data not provided in expected format',
        executionTime: 0,
        method: 'python'
      };
    }

    // Default: try descriptive stats if we have numbers
    if (numbers.length > 0) {
      return pythonEngine.calculateDescriptiveStats(numbers);
    }

    return {
      success: false,
      error: 'Could not determine Python calculation type',
      executionTime: 0,
      method: 'python'
    };
  }

  /**
   * Try fallback engines if primary fails
   */
  private async tryFallback(
    detection: CalculationDetectionResult,
    query: string,
    options: CalculationEngineOptions,
    failedEngine: string
  ): Promise<CalculationResult> {
    console.log(`🔄 [CALC ENGINE] Trying fallback from ${failedEngine}...`);

    const engines = ['mathjs', 'formulajs', 'hyperformula', 'python'];
    const remainingEngines = engines.filter(e => e !== failedEngine);

    for (const engine of remainingEngines) {
      try {
        let result: CalculationResult;

        switch (engine) {
          case 'mathjs':
            result = await this.handleMathCalculation(detection, query, options);
            break;
          case 'formulajs':
            result = await this.handleFinancialStatistical(detection, query, options);
            break;
          case 'hyperformula':
            result = await this.handleExcelFormula(detection, query, options);
            break;
          case 'python':
            if (this.capabilities.python.available) {
              result = await this.handlePythonCalculation(detection, query, options);
            } else {
              continue;
            }
            break;
          default:
            continue;
        }

        if (result.success) {
          console.log(`✅ [CALC ENGINE] Fallback succeeded with ${engine}`);
          return result;
        }
      } catch {
        continue;
      }
    }

    return {
      success: false,
      error: 'All calculation engines failed',
      executionTime: 0,
      method: 'native'
    };
  }

  // ==================== DIRECT API METHODS ====================

  /**
   * Evaluate a simple math expression
   */
  async evaluateMath(expression: string): Promise<CalculationResult> {
    return smartCalculator.evaluateMath(expression);
  }

  /**
   * Calculate percentage
   */
  async calculatePercentage(percentage: number, total: number): Promise<CalculationResult> {
    return smartCalculator.calculatePercentage(percentage, total);
  }

  /**
   * Calculate loan payment
   */
  async calculateLoanPayment(params: FinancialCalculationParams): Promise<CalculationResult> {
    return smartCalculator.calculatePMT(params);
  }

  /**
   * Calculate NPV
   */
  async calculateNPV(rate: number, cashFlows: number[]): Promise<CalculationResult> {
    return smartCalculator.calculateNPV(rate, cashFlows);
  }

  /**
   * Calculate IRR
   */
  async calculateIRR(cashFlows: number[]): Promise<CalculationResult> {
    return smartCalculator.calculateIRR(cashFlows);
  }

  /**
   * Calculate statistics
   */
  async calculateStatistics(values: number[]): Promise<{
    average: CalculationResult;
    median: CalculationResult;
    stdev: CalculationResult;
    min: CalculationResult;
    max: CalculationResult;
    sum: CalculationResult;
  }> {
    const [average, median, stdev, min, max, sum] = await Promise.all([
      smartCalculator.calculateAverage(values),
      smartCalculator.calculateMedian(values),
      smartCalculator.calculateStdev(values),
      smartCalculator.calculateMin(values),
      smartCalculator.calculateMax(values),
      smartCalculator.calculateSum(values)
    ]);

    return { average, median, stdev, min, max, sum };
  }

  /**
   * Evaluate Excel formula
   */
  async evaluateExcelFormula(formula: string, data?: any[][]): Promise<CalculationResult> {
    return excelEngine.evaluateFormula({ formula, sheetData: data });
  }

  /**
   * Process spreadsheet with formulas
   */
  async processSpreadsheet(data: (string | number)[][]): Promise<CalculationResult> {
    return excelEngine.processSpreadsheet(data);
  }

  /**
   * Run regression analysis
   */
  async runRegression(x: number[], y: number[]): Promise<CalculationResult> {
    if (this.capabilities.python.available && this.capabilities.python.scipy) {
      return pythonEngine.calculateRegression(x, y);
    }

    // Fallback: simple linear regression
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      success: true,
      result: {
        slope,
        intercept,
        equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`
      },
      formatted: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
      executionTime: 0,
      method: 'native'
    };
  }

  /**
   * Get engine capabilities
   */
  getCapabilities(): typeof this.capabilities {
    return { ...this.capabilities };
  }

  /**
   * Detect calculation in query
   */
  detectCalculation(query: string): CalculationDetectionResult {
    return calculationDetector.detect(query);
  }
}

// Export singleton instance
const calculationEngine = new CalculationEngineService();
export default calculationEngine;

// Also export the class for testing
export { CalculationEngineService };
