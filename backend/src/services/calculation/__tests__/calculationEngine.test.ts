/**
 * Calculation Engine Test Suite
 *
 * Tests for the 3-layer calculation engine:
 * - Layer 1: Smart Calculator (Math.js + Formula.js)
 * - Layer 2: Python Engine
 * - Layer 3: Excel Engine (HyperFormula)
 */

import calculationEngine from '../index';
import { CalculationType } from '../calculationTypes';

describe('Calculation Engine', () => {
  describe('Detection', () => {
    test('detects simple math expressions', () => {
      const result = calculationEngine.detectCalculation('2 + 2');
      expect(result.isCalculation).toBe(true);
      expect(result.type).toBe(CalculationType.SIMPLE_MATH);
    });

    test('detects percentage calculations', () => {
      const result = calculationEngine.detectCalculation('What is 15% of 200?');
      expect(result.isCalculation).toBe(true);
      expect(result.type).toBe(CalculationType.SIMPLE_MATH);
    });

    test('detects financial calculations', () => {
      const result = calculationEngine.detectCalculation('Calculate PMT for a $500,000 loan');
      expect(result.isCalculation).toBe(true);
      expect(result.type).toBe(CalculationType.FINANCIAL);
    });

    test('detects Excel formulas', () => {
      const result = calculationEngine.detectCalculation('=SUM(A1:A10)');
      expect(result.isCalculation).toBe(true);
      expect(result.type).toBe(CalculationType.EXCEL_FORMULA);
    });

    test('ignores document generation queries', () => {
      const result = calculationEngine.detectCalculation('Create a summary report');
      expect(result.isCalculation).toBe(false);
    });
  });

  describe('Simple Math Calculations', () => {
    test('evaluates basic arithmetic', async () => {
      const result = await calculationEngine.evaluateMath('2 + 2');
      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
    });

    test('evaluates complex expressions', async () => {
      const result = await calculationEngine.evaluateMath('(10 + 5) * 2 / 3');
      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
    });

    test('calculates percentages', async () => {
      const result = await calculationEngine.calculatePercentage(15, 200);
      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
    });
  });

  describe('Financial Calculations', () => {
    test('calculates loan payment (PMT)', async () => {
      const result = await calculationEngine.calculateLoanPayment({
        rate: 0.06,
        nper: 360,  // 30 years
        pv: 500000
      });
      expect(result.success).toBe(true);
      expect(result.result).toBeGreaterThan(2900);
      expect(result.result).toBeLessThan(3100);
    });

    test('calculates NPV', async () => {
      const result = await calculationEngine.calculateNPV(0.1, [-1000, 300, 300, 300, 300, 300]);
      expect(result.success).toBe(true);
      expect(result.result).toBeGreaterThan(100);
      expect(result.result).toBeLessThan(200);
    });

    test('calculates IRR', async () => {
      const result = await calculationEngine.calculateIRR([-1000, 300, 300, 300, 300, 300]);
      expect(result.success).toBe(true);
      expect(result.result).toBeGreaterThan(0.1);
      expect(result.result).toBeLessThan(0.2);
    });
  });

  describe('Statistical Calculations', () => {
    const testData = [10, 20, 30, 40, 50];

    test('calculates statistics', async () => {
      const stats = await calculationEngine.calculateStatistics(testData);

      expect(stats.average.success).toBe(true);
      expect(stats.average.result).toBe(30);

      expect(stats.sum.success).toBe(true);
      expect(stats.sum.result).toBe(150);

      expect(stats.min.success).toBe(true);
      expect(stats.min.result).toBe(10);

      expect(stats.max.success).toBe(true);
      expect(stats.max.result).toBe(50);

      expect(stats.median.success).toBe(true);
      expect(stats.median.result).toBe(30);
    });
  });

  describe('Excel Formula Calculations', () => {
    test('evaluates SUM formula', async () => {
      const result = await calculationEngine.evaluateExcelFormula('=SUM(1, 2, 3, 4, 5)');
      expect(result.success).toBe(true);
      expect(result.result).toBe(15);
    });

    test('evaluates AVERAGE formula', async () => {
      const result = await calculationEngine.evaluateExcelFormula('=AVERAGE(10, 20, 30)');
      expect(result.success).toBe(true);
      expect(result.result).toBe(20);
    });

    test('evaluates IF formula', async () => {
      const result = await calculationEngine.evaluateExcelFormula('=IF(10>5, 100, 0)');
      expect(result.success).toBe(true);
      expect(result.result).toBe(100);
    });
  });

  describe('Auto-detection and Routing', () => {
    test('auto-routes simple math', async () => {
      const result = await calculationEngine.calculate('5 + 10 * 2');
      expect(result.success).toBe(true);
      expect(result.result).toBe(25);
      expect(result.method).toBe('mathjs');
    });

    test('auto-routes Excel formulas', async () => {
      const result = await calculationEngine.calculate('=ROUND(3.14159, 2)');
      expect(result.success).toBe(true);
      expect(result.result).toBe(3.14);
      expect(result.method).toBe('hyperformula');
    });
  });

  describe('Regression Analysis', () => {
    test('calculates linear regression', async () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2.1, 3.9, 6.1, 7.9, 10.2];  // Roughly y = 2x

      const result = await calculationEngine.runRegression(x, y);
      expect(result.success).toBe(true);

      const regression = result.result as { slope: number; intercept: number };
      expect(regression.slope).toBeGreaterThan(1.9);
      expect(regression.slope).toBeLessThan(2.1);
    });
  });
});
