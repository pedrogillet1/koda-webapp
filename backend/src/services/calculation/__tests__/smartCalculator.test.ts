/**
 * Smart Calculator Validation Tests
 */
import smartCalculator from '../smartCalculator.service';
import calculationDetector from '../calculationDetector.service';
import { CalculationType } from '../calculationTypes';

describe('Smart Calculator - Layer 1 Validation', () => {
  describe('Simple Math', () => {
    test('Basic arithmetic: 2 + 2', () => {
      const result = smartCalculator.evaluateExpression('2 + 2');
      expect(result.success).toBe(true);
      expect(result.result).toBe(4);
      expect(result.executionTime).toBeLessThan(10);
    });

    test('Percentage: 15% of 8500', () => {
      const result = smartCalculator.evaluateExpression('15% of 8500');
      expect(result.success).toBe(true);
      expect(result.result).toBe(1275);
      expect(result.formatted).toBe('$1,275.00');
    });

    test('Complex expression: sqrt(25) + log(100)', () => {
      const result = smartCalculator.evaluateExpression('sqrt(25) + log(100)');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(7, 1);
    });
  });

  describe('Financial Functions', () => {
    test('IRR calculation', () => {
      const result = smartCalculator.calculateFinancial('IRR', {
        cashFlows: [-100000, 30000, 40000, 50000, 60000]
      });
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(0.2809, 2);
      expect(result.formatted).toBe('28.09%');
    });

    test('PMT calculation (mortgage)', () => {
      const result = smartCalculator.calculateFinancial('PMT', {
        rate: 0.05 / 12,
        nper: 360,
        pv: 200000
      });
      expect(result.success).toBe(true);
      expect(Math.abs(result.result as number)).toBeCloseTo(1073.64, 2);
    });

    test('NPV calculation', () => {
      const result = smartCalculator.calculateFinancial('NPV', {
        rate: 0.10,
        cashFlows: [30000, 40000, 50000, 60000]
      });
      expect(result.success).toBe(true);
      expect(result.result).toBeGreaterThan(0);
    });
  });

  describe('Statistical Functions', () => {
    test('AVERAGE calculation', () => {
      const result = smartCalculator.calculateStatistical('AVERAGE', [10, 20, 30, 40, 50]);
      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
    });

    test('MEDIAN calculation', () => {
      const result = smartCalculator.calculateStatistical('MEDIAN', [10, 20, 30, 40, 50]);
      expect(result.success).toBe(true);
      expect(result.result).toBe(30);
    });

    test('STDEV calculation', () => {
      const result = smartCalculator.calculateStatistical('STDEV', [10, 20, 30, 40, 50]);
      expect(result.success).toBe(true);
      expect(result.result).toBeGreaterThan(0);
    });
  });

  describe('Calculation Detection', () => {
    test('Detect simple math', () => {
      const detection = calculationDetector.detect("What's 15% of $8,500?");
      expect(detection.isCalculation).toBe(true);
      expect(detection.type).toBe(CalculationType.SIMPLE_MATH);
      expect(detection.confidence).toBeGreaterThan(0.8);
    });

    test('Detect financial calculation', () => {
      const detection = calculationDetector.detect(
        'Calculate IRR for -100000, 30000, 40000, 50000, 60000'
      );
      expect(detection.isCalculation).toBe(true);
      expect(detection.type).toBe(CalculationType.FINANCIAL);
    });

    test('Detect non-calculation', () => {
      const detection = calculationDetector.detect(
        'What are the titles of my documents?'
      );
      expect(detection.isCalculation).toBe(false);
    });
  });

  describe('Performance', () => {
    test('Simple math should complete in <10ms', () => {
      const result = smartCalculator.evaluateExpression('2547 * 38');
      expect(result.executionTime).toBeLessThan(10);
    });

    test('Financial calculation should complete in <50ms', () => {
      const result = smartCalculator.calculateFinancial('IRR', {
        cashFlows: [-100000, 30000, 40000, 50000, 60000]
      });
      expect(result.executionTime).toBeLessThan(50);
    });
  });
});
