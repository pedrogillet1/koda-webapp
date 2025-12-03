/**
 * Smart Calculator Service (Layer 1)
 *
 * Combines Math.js for complex mathematical expressions
 * and Formula.js for Excel-compatible financial/statistical functions.
 *
 * Performance: 10-50ms response time
 * Coverage: 300+ functions
 */

import {
  CalculationResult,
  FinancialCalculationParams,
  StatisticalCalculationParams
} from './calculationTypes';

// Dynamic imports for optional dependencies
let mathjs: any = null;
let formulajs: any = null;

// Try to load math.js
try {
  mathjs = require('mathjs');
} catch {
  console.warn('⚠️ mathjs not installed. Install with: npm install mathjs');
}

// Try to load formula.js
try {
  formulajs = require('@formulajs/formulajs');
} catch {
  console.warn('⚠️ formulajs not installed. Install with: npm install @formulajs/formulajs');
}

class SmartCalculatorService {
  private mathParser: any = null;

  constructor() {
    if (mathjs) {
      // Create a restricted math.js parser for security
      this.mathParser = mathjs.create(mathjs.all);

      // Disable potentially dangerous functions
      // Note: Don't delete 'parse' as 'simplify' and 'derivative' depend on it
      // Instead, we just don't expose these dangerous functions to users
      const dangerousFunctions = ['import', 'createUnit'];
      dangerousFunctions.forEach(func => {
        if (this.mathParser[func]) {
          delete this.mathParser[func];
        }
      });
    }
  }

  /**
   * Evaluate a mathematical expression using Math.js
   */
  async evaluateMath(expression: string): Promise<CalculationResult> {
    const startTime = Date.now();

    if (!mathjs) {
      return this.fallbackEvaluate(expression, startTime);
    }

    try {
      // Clean and sanitize the expression
      const sanitized = this.sanitizeExpression(expression);

      // Evaluate using math.js
      const result = mathjs.evaluate(sanitized);

      // Format the result
      const formatted = this.formatResult(result);

      return {
        success: true,
        result: typeof result === 'object' ? mathjs.number(result) : result,
        formatted,
        executionTime: Date.now() - startTime,
        method: 'mathjs',
        steps: [`Expression: ${sanitized}`, `Result: ${formatted}`]
      };
    } catch (error: any) {
      // Try fallback evaluation
      return this.fallbackEvaluate(expression, startTime);
    }
  }

  /**
   * Fallback evaluation using native JavaScript
   */
  private fallbackEvaluate(expression: string, startTime: number): CalculationResult {
    try {
      // Only allow safe characters
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '').trim();

      if (!sanitized || sanitized.length === 0) {
        return {
          success: false,
          error: 'Invalid expression',
          executionTime: Date.now() - startTime,
          method: 'native'
        };
      }

      // Validate parentheses
      let parenCount = 0;
      for (const char of sanitized) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) throw new Error('Unbalanced parentheses');
      }
      if (parenCount !== 0) throw new Error('Unbalanced parentheses');

      // Safe evaluation using Function constructor
      const result = Function(`'use strict'; return (${sanitized})`)();

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return {
          success: false,
          error: 'Invalid result',
          executionTime: Date.now() - startTime,
          method: 'native'
        };
      }

      return {
        success: true,
        result,
        formatted: this.formatResult(result),
        executionTime: Date.now() - startTime,
        method: 'native',
        steps: [`Expression: ${sanitized}`, `Result: ${result}`]
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Evaluation failed',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }
  }

  /**
   * Calculate percentage
   */
  async calculatePercentage(percentage: number, total: number): Promise<CalculationResult> {
    const startTime = Date.now();
    const result = (percentage / 100) * total;

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Percentage: ${percentage}%`,
        `Total: ${total}`,
        `Calculation: (${percentage} / 100) × ${total}`,
        `Result: ${result}`
      ]
    };
  }

  // ==================== FINANCIAL FUNCTIONS ====================

  /**
   * PMT - Calculate payment for a loan
   */
  async calculatePMT(params: FinancialCalculationParams): Promise<CalculationResult> {
    const startTime = Date.now();

    if (formulajs) {
      try {
        const { rate = 0, nper = 0, pv = 0, fv = 0, type = 0 } = params;
        const monthlyRate = rate / 12;
        const result = formulajs.PMT(monthlyRate, nper, -pv, fv, type);

        return {
          success: true,
          result,
          formatted: this.formatCurrency(result),
          executionTime: Date.now() - startTime,
          method: 'formulajs',
          steps: [
            `Rate: ${(rate * 100).toFixed(2)}% annual (${(monthlyRate * 100).toFixed(4)}% monthly)`,
            `Periods: ${nper} months`,
            `Present Value: ${this.formatCurrency(pv)}`,
            `Monthly Payment: ${this.formatCurrency(result)}`
          ]
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      }
    }

    // Fallback calculation
    const { rate = 0, nper = 0, pv = 0 } = params;
    const monthlyRate = rate / 12;

    if (monthlyRate === 0) {
      const result = pv / nper;
      return {
        success: true,
        result,
        formatted: this.formatCurrency(result),
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const result = (pv * monthlyRate * Math.pow(1 + monthlyRate, nper)) /
                   (Math.pow(1 + monthlyRate, nper) - 1);

    return {
      success: true,
      result,
      formatted: this.formatCurrency(result),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * NPV - Net Present Value
   */
  async calculateNPV(rate: number, cashFlows: number[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (formulajs) {
      try {
        const result = formulajs.NPV(rate, ...cashFlows);
        return {
          success: true,
          result,
          formatted: this.formatCurrency(result),
          executionTime: Date.now() - startTime,
          method: 'formulajs',
          steps: [
            `Discount Rate: ${(rate * 100).toFixed(2)}%`,
            `Cash Flows: [${cashFlows.map(cf => this.formatCurrency(cf)).join(', ')}]`,
            `NPV: ${this.formatCurrency(result)}`
          ]
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      }
    }

    // Fallback calculation
    let npv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + rate, i + 1);
    }

    return {
      success: true,
      result: npv,
      formatted: this.formatCurrency(npv),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * IRR - Internal Rate of Return
   */
  async calculateIRR(cashFlows: number[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (formulajs) {
      try {
        const result = formulajs.IRR(cashFlows);
        return {
          success: true,
          result,
          formatted: `${(result * 100).toFixed(2)}%`,
          executionTime: Date.now() - startTime,
          method: 'formulajs',
          steps: [
            `Cash Flows: [${cashFlows.map(cf => this.formatCurrency(cf)).join(', ')}]`,
            `IRR: ${(result * 100).toFixed(2)}%`
          ]
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      }
    }

    // Fallback: Newton-Raphson method
    const result = this.calculateIRRNewtonRaphson(cashFlows);

    return {
      success: result !== null,
      result,
      formatted: result !== null ? `${(result * 100).toFixed(2)}%` : undefined,
      error: result === null ? 'Could not calculate IRR' : undefined,
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  private calculateIRRNewtonRaphson(cashFlows: number[]): number | null {
    let rate = 0.1; // Initial guess
    const maxIterations = 100;
    const tolerance = 1e-10;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        npv += cashFlows[j] / Math.pow(1 + rate, j);
        dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
      }

      const newRate = rate - npv / dnpv;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;
    }

    return null;
  }

  /**
   * FV - Future Value
   */
  async calculateFV(params: FinancialCalculationParams): Promise<CalculationResult> {
    const startTime = Date.now();

    if (formulajs) {
      try {
        const { rate = 0, nper = 0, pmt = 0, pv = 0, type = 0 } = params;
        const result = formulajs.FV(rate, nper, pmt, pv, type);

        return {
          success: true,
          result: Math.abs(result),
          formatted: this.formatCurrency(Math.abs(result)),
          executionTime: Date.now() - startTime,
          method: 'formulajs',
          steps: [
            `Rate: ${(rate * 100).toFixed(2)}%`,
            `Periods: ${nper}`,
            `Payment: ${this.formatCurrency(pmt)}`,
            `Present Value: ${this.formatCurrency(pv)}`,
            `Future Value: ${this.formatCurrency(Math.abs(result))}`
          ]
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      }
    }

    // Fallback calculation
    const { rate = 0, nper = 0, pmt = 0, pv = 0 } = params;
    const fv = pv * Math.pow(1 + rate, nper) + pmt * ((Math.pow(1 + rate, nper) - 1) / rate);

    return {
      success: true,
      result: Math.abs(fv),
      formatted: this.formatCurrency(Math.abs(fv)),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * PV - Present Value
   */
  async calculatePV(params: FinancialCalculationParams): Promise<CalculationResult> {
    const startTime = Date.now();

    if (formulajs) {
      try {
        const { rate = 0, nper = 0, pmt = 0, fv = 0, type = 0 } = params;
        const result = formulajs.PV(rate, nper, pmt, fv, type);

        return {
          success: true,
          result: Math.abs(result),
          formatted: this.formatCurrency(Math.abs(result)),
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      }
    }

    // Fallback
    const { rate = 0, nper = 0, fv = 0 } = params;
    const pv = fv / Math.pow(1 + rate, nper);

    return {
      success: true,
      result: pv,
      formatted: this.formatCurrency(pv),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  // ==================== STATISTICAL FUNCTIONS ====================

  /**
   * AVERAGE - Calculate mean of values
   */
  async calculateAverage(values: number[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (values.length === 0) {
      return {
        success: false,
        error: 'No values provided',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const result = sum / values.length;

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Values: [${values.join(', ')}]`,
        `Sum: ${sum}`,
        `Count: ${values.length}`,
        `Average: ${result}`
      ]
    };
  }

  /**
   * MEDIAN - Calculate median of values
   */
  async calculateMedian(values: number[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (values.length === 0) {
      return {
        success: false,
        error: 'No values provided',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const result = sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Sorted values: [${sorted.join(', ')}]`,
        `Median: ${result}`
      ]
    };
  }

  /**
   * STDEV - Standard Deviation
   */
  async calculateStdev(values: number[], population: boolean = false): Promise<CalculationResult> {
    const startTime = Date.now();

    if (formulajs) {
      try {
        const result = population
          ? formulajs.STDEV.P(values)
          : formulajs.STDEV.S(values);

        return {
          success: true,
          result,
          formatted: this.formatResult(result),
          executionTime: Date.now() - startTime,
          method: 'formulajs'
        };
      } catch (error: any) {
        // Fall through to native calculation
      }
    }

    // Native calculation
    const n = values.length;
    if (n < 2) {
      return {
        success: false,
        error: 'Need at least 2 values',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (population ? n : n - 1);
    const result = Math.sqrt(variance);

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Values: [${values.join(', ')}]`,
        `Mean: ${mean}`,
        `Variance: ${variance}`,
        `Standard Deviation: ${result}`
      ]
    };
  }

  /**
   * VAR - Variance
   */
  async calculateVariance(values: number[], population: boolean = false): Promise<CalculationResult> {
    const startTime = Date.now();

    const n = values.length;
    if (n < 2) {
      return {
        success: false,
        error: 'Need at least 2 values',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const result = squaredDiffs.reduce((a, b) => a + b, 0) / (population ? n : n - 1);

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * SUM - Sum of values
   */
  async calculateSum(values: number[]): Promise<CalculationResult> {
    const startTime = Date.now();
    const result = values.reduce((a, b) => a + b, 0);

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Values: [${values.join(', ')}]`,
        `Sum: ${result}`
      ]
    };
  }

  /**
   * COUNT - Count of values
   */
  async calculateCount(values: any[]): Promise<CalculationResult> {
    const startTime = Date.now();
    const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));

    return {
      success: true,
      result: numericValues.length,
      formatted: numericValues.length.toString(),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * MIN - Minimum value
   */
  async calculateMin(values: number[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (values.length === 0) {
      return {
        success: false,
        error: 'No values provided',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const result = Math.min(...values);

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * MAX - Maximum value
   */
  async calculateMax(values: number[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (values.length === 0) {
      return {
        success: false,
        error: 'No values provided',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const result = Math.max(...values);

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  /**
   * PERCENTILE - Calculate percentile
   */
  async calculatePercentile(values: number[], k: number): Promise<CalculationResult> {
    const startTime = Date.now();

    if (k < 0 || k > 1) {
      return {
        success: false,
        error: 'Percentile k must be between 0 and 1',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = k * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    const result = lower === upper
      ? sorted[lower]
      : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);

    return {
      success: true,
      result,
      formatted: this.formatResult(result),
      executionTime: Date.now() - startTime,
      method: 'native'
    };
  }

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Sanitize expression for safe evaluation
   */
  private sanitizeExpression(expression: string): string {
    // Replace common alternatives
    let sanitized = expression
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '^')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/√/g, 'sqrt')
      .replace(/π/g, 'pi')
      .trim();

    return sanitized;
  }

  /**
   * Format number result
   */
  private formatResult(value: any): string {
    if (typeof value !== 'number') {
      return String(value);
    }

    if (!isFinite(value)) {
      return 'Infinity';
    }

    // Large numbers
    if (Math.abs(value) >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(value) >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1e3) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    // Small decimals
    if (Math.abs(value) < 0.01 && value !== 0) {
      return value.toExponential(4);
    }

    // Regular numbers
    if (Number.isInteger(value)) {
      return value.toString();
    }

    return value.toFixed(4).replace(/\.?0+$/, '');
  }

  /**
   * Format as currency
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Execute a formula.js function by name
   */
  async executeFormulaFunction(functionName: string, ...args: any[]): Promise<CalculationResult> {
    const startTime = Date.now();

    if (!formulajs) {
      return {
        success: false,
        error: 'Formula.js not installed',
        executionTime: Date.now() - startTime,
        method: 'formulajs'
      };
    }

    const upperName = functionName.toUpperCase();

    // Handle nested function names like STDEV.S
    let func = formulajs;
    const parts = upperName.split('.');
    for (const part of parts) {
      func = func?.[part];
    }

    if (typeof func !== 'function') {
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
        executionTime: Date.now() - startTime,
        method: 'formulajs'
      };
    }

    try {
      const result = func(...args);
      return {
        success: true,
        result,
        formatted: this.formatResult(result),
        executionTime: Date.now() - startTime,
        method: 'formulajs'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Function execution failed',
        executionTime: Date.now() - startTime,
        method: 'formulajs'
      };
    }
  }

  // ==================== WRAPPER METHODS FOR TESTS ====================

  /**
   * Evaluate expression (synchronous wrapper for evaluateMath)
   * Handles natural language expressions like "15% of 8500"
   */
  evaluateExpression(expression: string): CalculationResult {
    const startTime = Date.now();

    try {
      // Handle percentage expressions: "15% of 8500"
      const percentMatch = expression.match(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
      if (percentMatch) {
        const percentage = parseFloat(percentMatch[1]);
        const total = parseFloat(percentMatch[2].replace(/,/g, ''));
        const result = (percentage / 100) * total;
        return {
          success: true,
          result,
          formatted: this.formatCurrency(result),
          executionTime: Date.now() - startTime,
          method: 'native'
        };
      }

      // Use math.js if available
      if (mathjs) {
        const sanitized = this.sanitizeExpression(expression);
        const result = mathjs.evaluate(sanitized);
        return {
          success: true,
          result: typeof result === 'object' ? mathjs.number(result) : result,
          formatted: this.formatResult(result),
          executionTime: Date.now() - startTime,
          method: 'mathjs'
        };
      }

      // Fallback to native evaluation
      const sanitized = expression.replace(/[^0-9+\-*/().]/g, '').trim();
      const result = Function(`'use strict'; return (${sanitized})`)();

      return {
        success: true,
        result,
        formatted: this.formatResult(result),
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Evaluation failed',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }
  }

  /**
   * Calculate financial function by name
   */
  calculateFinancial(functionName: string, params: Record<string, any>): CalculationResult {
    const startTime = Date.now();
    const upperName = functionName.toUpperCase();

    try {
      let result: number;
      let formatted: string;

      switch (upperName) {
        case 'IRR': {
          const cashFlows = params.cashFlows || [];
          if (formulajs) {
            result = formulajs.IRR(cashFlows);
          } else {
            // Newton-Raphson fallback
            result = this.calculateIRRSync(cashFlows);
          }
          formatted = `${(result * 100).toFixed(2)}%`;
          break;
        }

        case 'NPV': {
          const rate = params.rate || 0;
          const cashFlows = params.cashFlows || [];
          if (formulajs) {
            result = formulajs.NPV(rate, ...cashFlows);
          } else {
            result = cashFlows.reduce((npv: number, cf: number, i: number) =>
              npv + cf / Math.pow(1 + rate, i + 1), 0);
          }
          formatted = this.formatCurrency(result);
          break;
        }

        case 'PMT': {
          const rate = params.rate || 0;
          const nper = params.nper || 0;
          const pv = params.pv || 0;
          const fv = params.fv || 0;
          const type = params.type || 0;
          if (formulajs) {
            result = formulajs.PMT(rate, nper, -pv, fv, type);
          } else {
            if (rate === 0) {
              result = pv / nper;
            } else {
              result = (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
            }
          }
          formatted = this.formatCurrency(Math.abs(result));
          break;
        }

        case 'FV': {
          const rate = params.rate || 0;
          const nper = params.nper || 0;
          const pmt = params.pmt || 0;
          const pv = params.pv || 0;
          if (formulajs) {
            result = formulajs.FV(rate, nper, pmt, -pv);
          } else {
            result = pv * Math.pow(1 + rate, nper) + pmt * ((Math.pow(1 + rate, nper) - 1) / rate);
          }
          formatted = this.formatCurrency(Math.abs(result));
          break;
        }

        case 'PV': {
          const rate = params.rate || 0;
          const nper = params.nper || 0;
          const pmt = params.pmt || 0;
          const fv = params.fv || 0;
          if (formulajs) {
            result = formulajs.PV(rate, nper, pmt, -fv);
          } else {
            result = fv / Math.pow(1 + rate, nper);
          }
          formatted = this.formatCurrency(Math.abs(result));
          break;
        }

        default:
          return {
            success: false,
            error: `Unknown financial function: ${functionName}`,
            executionTime: Date.now() - startTime,
            method: 'formulajs'
          };
      }

      return {
        success: true,
        result,
        formatted,
        executionTime: Date.now() - startTime,
        method: formulajs ? 'formulajs' : 'native'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Financial calculation failed',
        executionTime: Date.now() - startTime,
        method: 'formulajs'
      };
    }
  }

  /**
   * Calculate statistical function by name
   */
  calculateStatistical(functionName: string, values: number[]): CalculationResult {
    const startTime = Date.now();
    const upperName = functionName.toUpperCase();

    try {
      let result: number;

      switch (upperName) {
        case 'AVERAGE':
        case 'MEAN':
        case 'AVG':
          result = values.reduce((a, b) => a + b, 0) / values.length;
          break;

        case 'MEDIAN': {
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          result = sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
          break;
        }

        case 'MODE': {
          const counts = new Map<number, number>();
          values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
          let maxCount = 0;
          result = values[0];
          counts.forEach((count, value) => {
            if (count > maxCount) {
              maxCount = count;
              result = value;
            }
          });
          break;
        }

        case 'STDEV':
        case 'STDEV.S': {
          const n = values.length;
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
          result = Math.sqrt(variance);
          break;
        }

        case 'STDEV.P':
        case 'STDEVP': {
          const n = values.length;
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
          result = Math.sqrt(variance);
          break;
        }

        case 'VAR':
        case 'VAR.S': {
          const n = values.length;
          const mean = values.reduce((a, b) => a + b, 0) / n;
          result = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
          break;
        }

        case 'VAR.P':
        case 'VARP': {
          const n = values.length;
          const mean = values.reduce((a, b) => a + b, 0) / n;
          result = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
          break;
        }

        case 'SUM':
          result = values.reduce((a, b) => a + b, 0);
          break;

        case 'MIN':
          result = Math.min(...values);
          break;

        case 'MAX':
          result = Math.max(...values);
          break;

        case 'COUNT':
          result = values.filter(v => typeof v === 'number' && !isNaN(v)).length;
          break;

        default:
          return {
            success: false,
            error: `Unknown statistical function: ${functionName}`,
            executionTime: Date.now() - startTime,
            method: 'native'
          };
      }

      return {
        success: true,
        result,
        formatted: this.formatResult(result),
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Statistical calculation failed',
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }
  }

  /**
   * Synchronous IRR calculation using Newton-Raphson method
   */
  private calculateIRRSync(cashFlows: number[]): number {
    let rate = 0.1; // Initial guess
    const maxIterations = 100;
    const tolerance = 1e-10;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        npv += cashFlows[j] / Math.pow(1 + rate, j);
        dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
      }

      const newRate = rate - npv / dnpv;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;
    }

    return rate;
  }
}

export default new SmartCalculatorService();
