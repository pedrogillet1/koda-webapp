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

  // ==================== WORD PROBLEM FUNCTIONS ====================

  /**
   * Solve discount word problems
   * Pattern: "A product costs $X. If there's a Y% discount, what's the final price?"
   */
  async solveDiscountProblem(originalPrice: number, discountPercent: number): Promise<CalculationResult> {
    const startTime = Date.now();

    const discountAmount = originalPrice * (discountPercent / 100);
    const finalPrice = originalPrice - discountAmount;

    return {
      success: true,
      result: finalPrice,
      formatted: this.formatCurrency(finalPrice),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Original Price: ${this.formatCurrency(originalPrice)}`,
        `Discount: ${discountPercent}%`,
        `Discount Amount: ${this.formatCurrency(originalPrice)} × ${discountPercent}% = ${this.formatCurrency(discountAmount)}`,
        `Final Price: ${this.formatCurrency(originalPrice)} - ${this.formatCurrency(discountAmount)} = ${this.formatCurrency(finalPrice)}`
      ]
    };
  }

  /**
   * Solve profit margin problems
   * Pattern: "Revenue is $X and costs are $Y. What's the profit?"
   */
  async solveProfitProblem(revenue: number, costs: number): Promise<CalculationResult> {
    const startTime = Date.now();

    const profit = revenue - costs;
    const profitMarginPercent = (profit / revenue) * 100;

    return {
      success: true,
      result: profit,
      formatted: this.formatCurrency(profit),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Revenue: ${this.formatCurrency(revenue)}`,
        `Costs: ${this.formatCurrency(costs)}`,
        `Profit: ${this.formatCurrency(revenue)} - ${this.formatCurrency(costs)} = ${this.formatCurrency(profit)}`,
        `Profit Margin: ${profitMarginPercent.toFixed(2)}%`
      ]
    };
  }

  /**
   * Solve percentage change problems
   * Pattern: "Value changed from X to Y. What's the percentage change?"
   */
  async solvePercentageChange(oldValue: number, newValue: number): Promise<CalculationResult> {
    const startTime = Date.now();

    const change = newValue - oldValue;
    const percentChange = (change / oldValue) * 100;

    return {
      success: true,
      result: percentChange,
      formatted: `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%`,
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Old Value: ${this.formatResult(oldValue)}`,
        `New Value: ${this.formatResult(newValue)}`,
        `Change: ${this.formatResult(newValue)} - ${this.formatResult(oldValue)} = ${this.formatResult(change)}`,
        `Percentage Change: (${this.formatResult(change)} / ${this.formatResult(oldValue)}) × 100 = ${percentChange.toFixed(2)}%`
      ]
    };
  }

  /**
   * Solve tax calculation problems
   * Pattern: "Price is $X with Y% tax"
   */
  async solveTaxProblem(basePrice: number, taxPercent: number): Promise<CalculationResult> {
    const startTime = Date.now();

    const taxAmount = basePrice * (taxPercent / 100);
    const totalPrice = basePrice + taxAmount;

    return {
      success: true,
      result: totalPrice,
      formatted: this.formatCurrency(totalPrice),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Base Price: ${this.formatCurrency(basePrice)}`,
        `Tax Rate: ${taxPercent}%`,
        `Tax Amount: ${this.formatCurrency(basePrice)} × ${taxPercent}% = ${this.formatCurrency(taxAmount)}`,
        `Total Price: ${this.formatCurrency(basePrice)} + ${this.formatCurrency(taxAmount)} = ${this.formatCurrency(totalPrice)}`
      ]
    };
  }

  /**
   * Parse and solve a word problem from natural language
   */
  async solveWordProblem(query: string): Promise<CalculationResult> {
    const startTime = Date.now();
    const lowerQuery = query.toLowerCase();

    // Extract numbers from the query
    const numbers = query.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/g)?.map(n =>
      parseFloat(n.replace(/[$,\s]/g, ''))
    ) || [];

    // Discount problem detection
    const discountMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*(?:discount|off)/i);
    const priceMatch = query.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);

    if (discountMatch && priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      const discount = parseFloat(discountMatch[1]);
      return this.solveDiscountProblem(price, discount);
    }

    // Profit problem detection
    if (/revenue|sales/i.test(lowerQuery) && /cost|expense/i.test(lowerQuery)) {
      if (numbers.length >= 2) {
        const revenue = Math.max(...numbers);
        const costs = Math.min(...numbers);
        return this.solveProfitProblem(revenue, costs);
      }
    }

    // Tax problem detection
    const taxMatch = query.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tax|vat|gst)/i);
    if (taxMatch && priceMatch) {
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      const tax = parseFloat(taxMatch[1]);
      return this.solveTaxProblem(price, tax);
    }

    // Percentage change detection
    if (/change|increase|decrease|grew|fell|from.*to/i.test(lowerQuery)) {
      if (numbers.length >= 2) {
        return this.solvePercentageChange(numbers[0], numbers[1]);
      }
    }

    return {
      success: false,
      error: 'Could not parse the word problem',
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

  // ============================================================================
  // ✅ NEW: UNIT CONVERSION FUNCTIONS
  // ============================================================================

  /**
   * Execute unit conversion
   */
  executeUnitConversion(value: number, fromUnit: string, toUnit: string): CalculationResult {
    const startTime = Date.now();

    // Normalize units
    const from = fromUnit.toLowerCase().replace(/[°\s]/g, '');
    const to = toUnit.toLowerCase().replace(/[°\s]/g, '');

    // Temperature conversions (special case)
    if (this.isTemperatureUnit(from) && this.isTemperatureUnit(to)) {
      return this.convertTemperature(value, from, to, startTime);
    }

    // Standard conversions
    const result = this.convertUnits(value, from, to);

    if (result === null) {
      return {
        success: false,
        error: `Conversion from ${fromUnit} to ${toUnit} not supported`,
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    return {
      success: true,
      result,
      formatted: `${value} ${fromUnit} = ${result.toFixed(4)} ${toUnit}`,
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Value: ${value} ${fromUnit}`,
        `Conversion factor: 1 ${fromUnit} = ${(result / value).toFixed(6)} ${toUnit}`,
        `Result: ${result.toFixed(4)} ${toUnit}`
      ]
    };
  }

  /**
   * Check if unit is temperature
   */
  private isTemperatureUnit(unit: string): boolean {
    return ['c', 'celsius', 'f', 'fahrenheit', 'k', 'kelvin'].includes(unit);
  }

  /**
   * Convert temperature units
   */
  private convertTemperature(value: number, from: string, to: string, startTime: number): CalculationResult {
    let result: number;
    let formula: string;

    // Celsius to Fahrenheit
    if ((from === 'c' || from === 'celsius') && (to === 'f' || to === 'fahrenheit')) {
      result = (value * 9/5) + 32;
      formula = '(°C × 9/5) + 32';
    }
    // Fahrenheit to Celsius
    else if ((from === 'f' || from === 'fahrenheit') && (to === 'c' || to === 'celsius')) {
      result = (value - 32) * 5/9;
      formula = '(°F - 32) × 5/9';
    }
    // Celsius to Kelvin
    else if ((from === 'c' || from === 'celsius') && (to === 'k' || to === 'kelvin')) {
      result = value + 273.15;
      formula = '°C + 273.15';
    }
    // Kelvin to Celsius
    else if ((from === 'k' || from === 'kelvin') && (to === 'c' || to === 'celsius')) {
      result = value - 273.15;
      formula = 'K - 273.15';
    }
    // Fahrenheit to Kelvin
    else if ((from === 'f' || from === 'fahrenheit') && (to === 'k' || to === 'kelvin')) {
      result = (value - 32) * 5/9 + 273.15;
      formula = '(°F - 32) × 5/9 + 273.15';
    }
    // Kelvin to Fahrenheit
    else if ((from === 'k' || from === 'kelvin') && (to === 'f' || to === 'fahrenheit')) {
      result = (value - 273.15) * 9/5 + 32;
      formula = '(K - 273.15) × 9/5 + 32';
    }
    else {
      return {
        success: false,
        error: `Temperature conversion from ${from} to ${to} not supported`,
        executionTime: Date.now() - startTime,
        method: 'native'
      };
    }

    return {
      success: true,
      result,
      formatted: `${value}°${from.charAt(0).toUpperCase()} = ${result.toFixed(2)}°${to.charAt(0).toUpperCase()}`,
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Input: ${value}°${from.charAt(0).toUpperCase()}`,
        `Formula: ${formula}`,
        `Result: ${result.toFixed(2)}°${to.charAt(0).toUpperCase()}`
      ]
    };
  }

  /**
   * Convert standard units
   */
  private convertUnits(value: number, from: string, to: string): number | null {
    // Conversion factors (to base unit)
    const conversions: { [key: string]: { base: string; factor: number } } = {
      // Distance (base: meters)
      'km': { base: 'meters', factor: 1000 },
      'kilometers': { base: 'meters', factor: 1000 },
      'miles': { base: 'meters', factor: 1609.34 },
      'mi': { base: 'meters', factor: 1609.34 },
      'meters': { base: 'meters', factor: 1 },
      'm': { base: 'meters', factor: 1 },
      'feet': { base: 'meters', factor: 0.3048 },
      'ft': { base: 'meters', factor: 0.3048 },
      'inches': { base: 'meters', factor: 0.0254 },
      'in': { base: 'meters', factor: 0.0254 },
      'cm': { base: 'meters', factor: 0.01 },
      'centimeters': { base: 'meters', factor: 0.01 },
      'yards': { base: 'meters', factor: 0.9144 },
      'yd': { base: 'meters', factor: 0.9144 },

      // Weight (base: kg)
      'kg': { base: 'kg', factor: 1 },
      'kilograms': { base: 'kg', factor: 1 },
      'pounds': { base: 'kg', factor: 0.453592 },
      'lbs': { base: 'kg', factor: 0.453592 },
      'lb': { base: 'kg', factor: 0.453592 },
      'grams': { base: 'kg', factor: 0.001 },
      'g': { base: 'kg', factor: 0.001 },
      'ounces': { base: 'kg', factor: 0.0283495 },
      'oz': { base: 'kg', factor: 0.0283495 },

      // Volume (base: liters)
      'liters': { base: 'liters', factor: 1 },
      'l': { base: 'liters', factor: 1 },
      'gallons': { base: 'liters', factor: 3.78541 },
      'gal': { base: 'liters', factor: 3.78541 },
      'ml': { base: 'liters', factor: 0.001 },
      'milliliters': { base: 'liters', factor: 0.001 },
      'cups': { base: 'liters', factor: 0.236588 },
      'pints': { base: 'liters', factor: 0.473176 },
      'quarts': { base: 'liters', factor: 0.946353 },
    };

    const fromConversion = conversions[from];
    const toConversion = conversions[to];

    if (!fromConversion || !toConversion) {
      return null; // Unsupported unit
    }

    if (fromConversion.base !== toConversion.base) {
      return null; // Different measurement types
    }

    // Convert: value → base unit → target unit
    const baseValue = value * fromConversion.factor;
    const result = baseValue / toConversion.factor;

    return result;
  }

  // ============================================================================
  // ✅ NEW: RATIO PROBLEM SOLVER
  // ============================================================================

  /**
   * Solve ratio problems
   */
  solveRatioProblem(ratio1: number, ratio2: number, knownValue: number, isFirstKnown: boolean): CalculationResult {
    const startTime = Date.now();

    let result: number;
    let explanation: string;

    if (isFirstKnown) {
      // ratio1 : ratio2 = knownValue : result
      result = (knownValue * ratio2) / ratio1;
      explanation = `If the ratio is ${ratio1}:${ratio2} and the first value is ${knownValue}, then:\n` +
        `${knownValue} ÷ ${ratio1} = ${(knownValue / ratio1).toFixed(2)} (unit value)\n` +
        `${(knownValue / ratio1).toFixed(2)} × ${ratio2} = ${result.toFixed(2)}`;
    } else {
      // ratio1 : ratio2 = result : knownValue
      result = (knownValue * ratio1) / ratio2;
      explanation = `If the ratio is ${ratio1}:${ratio2} and the second value is ${knownValue}, then:\n` +
        `${knownValue} ÷ ${ratio2} = ${(knownValue / ratio2).toFixed(2)} (unit value)\n` +
        `${(knownValue / ratio2).toFixed(2)} × ${ratio1} = ${result.toFixed(2)}`;
    }

    return {
      success: true,
      result,
      formatted: result.toFixed(2),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Ratio: ${ratio1}:${ratio2}`,
        `Known Value: ${knownValue}`,
        explanation,
        `Result: ${result.toFixed(2)}`,
        `Verification: ${ratio1}:${ratio2} = ${isFirstKnown ? knownValue : result.toFixed(2)}:${isFirstKnown ? result.toFixed(2) : knownValue}`
      ]
    };
  }

  // ============================================================================
  // ✅ NEW: ENHANCED LOAN PAYMENT CALCULATION
  // ============================================================================

  /**
   * Calculate loan payment with detailed breakdown
   */
  calculateLoanPaymentDetailed(principal: number, annualRate: number, years: number): CalculationResult {
    const startTime = Date.now();

    const monthlyRate = annualRate / 12 / 100;  // Convert annual % to monthly decimal
    const numPayments = years * 12;

    let monthlyPayment: number;

    if (monthlyRate === 0) {
      monthlyPayment = principal / numPayments;
    } else {
      monthlyPayment = principal *
        (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1);
    }

    const totalPaid = monthlyPayment * numPayments;
    const totalInterest = totalPaid - principal;

    return {
      success: true,
      result: monthlyPayment,
      formatted: this.formatCurrency(monthlyPayment),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Principal: ${this.formatCurrency(principal)}`,
        `Interest Rate: ${annualRate}% per year`,
        `Loan Term: ${years} years (${numPayments} monthly payments)`,
        `Monthly Payment: ${this.formatCurrency(monthlyPayment)}`,
        `Total Amount Paid: ${this.formatCurrency(totalPaid)}`,
        `Total Interest: ${this.formatCurrency(totalInterest)}`,
        `Interest as % of Principal: ${((totalInterest / principal) * 100).toFixed(1)}%`
      ]
    };
  }

  // ============================================================================
  // ✅ NEW: FIXED FUTURE VALUE CALCULATION
  // ============================================================================

  /**
   * Calculate future value with correct compounding period detection
   */
  calculateFutureValueEnhanced(principal: number, ratePercent: number, years: number, query: string = ''): CalculationResult {
    const startTime = Date.now();

    const lowerQuery = query.toLowerCase();
    let periodsPerYear = 1;  // Default: annual compounding
    let compoundingType = 'Annual';

    // Detect compounding frequency from query
    if (lowerQuery.includes('monthly') || lowerQuery.includes('per month')) {
      periodsPerYear = 12;
      compoundingType = 'Monthly';
    } else if (lowerQuery.includes('quarterly')) {
      periodsPerYear = 4;
      compoundingType = 'Quarterly';
    } else if (lowerQuery.includes('semi-annual') || lowerQuery.includes('twice a year')) {
      periodsPerYear = 2;
      compoundingType = 'Semi-Annual';
    } else if (lowerQuery.includes('daily')) {
      periodsPerYear = 365;
      compoundingType = 'Daily';
    } else if (lowerQuery.includes('continuous')) {
      // Continuous compounding: FV = P * e^(rt)
      const rate = ratePercent / 100;
      const futureValue = principal * Math.exp(rate * years);
      const interest = futureValue - principal;

      return {
        success: true,
        result: futureValue,
        formatted: this.formatCurrency(futureValue),
        executionTime: Date.now() - startTime,
        method: 'native',
        steps: [
          `Principal: ${this.formatCurrency(principal)}`,
          `Interest Rate: ${ratePercent}% per year`,
          `Time Period: ${years} years`,
          `Compounding: Continuous`,
          `Future Value: ${this.formatCurrency(futureValue)}`,
          `Interest Earned: ${this.formatCurrency(interest)}`,
          `Total Return: ${((interest / principal) * 100).toFixed(2)}%`,
          `Formula: FV = P × e^(rt)`
        ]
      };
    }

    // Standard compounding: FV = P * (1 + r/n)^(nt)
    const rate = ratePercent / 100;
    const ratePerPeriod = rate / periodsPerYear;
    const totalPeriods = years * periodsPerYear;
    const futureValue = principal * Math.pow(1 + ratePerPeriod, totalPeriods);
    const interest = futureValue - principal;

    return {
      success: true,
      result: futureValue,
      formatted: this.formatCurrency(futureValue),
      executionTime: Date.now() - startTime,
      method: 'native',
      steps: [
        `Principal: ${this.formatCurrency(principal)}`,
        `Interest Rate: ${ratePercent}% per year`,
        `Time Period: ${years} years`,
        `Compounding: ${compoundingType} (${periodsPerYear}x/year)`,
        `Future Value: ${this.formatCurrency(futureValue)}`,
        `Interest Earned: ${this.formatCurrency(interest)}`,
        `Total Return: ${((interest / principal) * 100).toFixed(2)}%`,
        `Formula: FV = P × (1 + r/n)^(nt)`
      ]
    };
  }
}

export default new SmartCalculatorService();
