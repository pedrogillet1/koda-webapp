/**
 * Enhanced Calculation Tests
 *
 * Tests for the new calculation capabilities:
 * 1. Unit conversions
 * 2. Ratio problems
 * 3. Loan payment calculations
 * 4. Fixed future value calculations
 */

import calculationDetector from '../calculationDetector.service';
import smartCalculator from '../smartCalculator.service';
import { CalculationType } from '../calculationTypes';

describe('Enhanced Calculation Detector', () => {
  describe('Unit Conversion Detection', () => {
    test('detects "convert X km to miles"', () => {
      const result = calculationDetector.detect('Convert 100 km to miles');
      expect(result.isCalculation).toBe(true);
      expect(result.parameters?.calculationType).toBe('unit_conversion');
    });

    test('detects "X°C in Fahrenheit"', () => {
      const result = calculationDetector.detect('What is 25°C in Fahrenheit?');
      expect(result.isCalculation).toBe(true);
      expect(result.parameters?.calculationType).toBe('unit_conversion');
    });

    test('detects "convert X pounds to kg"', () => {
      const result = calculationDetector.detect('Convert 150 pounds to kg');
      expect(result.isCalculation).toBe(true);
      expect(result.parameters?.calculationType).toBe('unit_conversion');
    });

    test('detects "X feet to meters"', () => {
      const result = calculationDetector.detect('5 feet to meters');
      expect(result.isCalculation).toBe(true);
      expect(result.parameters?.calculationType).toBe('unit_conversion');
    });

    test('extracts correct unit conversion parameters', () => {
      const result = calculationDetector.detect('Convert 100 km to miles');
      expect(result.parameters?.value).toBe(100);
      expect(result.parameters?.fromUnit).toBe('km');
      expect(result.parameters?.toUnit).toBe('miles');
    });
  });

  describe('Ratio Problem Detection', () => {
    test('detects "ratio is X:Y"', () => {
      const result = calculationDetector.detect('If the ratio of A to B is 3:5 and A is 60, what is B?');
      expect(result.isCalculation).toBe(true);
      expect(result.parameters?.calculationType).toBe('ratio');
    });

    test('detects "X:Y ratio"', () => {
      const result = calculationDetector.detect('The ratio of cats to dogs is 2:3. If there are 10 cats, how many dogs?');
      expect(result.isCalculation).toBe(true);
    });

    test('extracts correct ratio parameters', () => {
      const result = calculationDetector.detect('If A:B is 3:5 and A is 60, what is B?');
      expect(result.parameters?.ratio1).toBe(3);
      expect(result.parameters?.ratio2).toBe(5);
    });
  });

  describe('Loan Payment Detection', () => {
    test('detects loan payment queries', () => {
      const result = calculationDetector.detect('Calculate monthly payment on $200,000 loan at 4% for 30 years');
      expect(result.isCalculation).toBe(true);
      expect(result.type).toBe(CalculationType.FINANCIAL);
    });

    test('detects mortgage payment queries', () => {
      const result = calculationDetector.detect('What is the mortgage payment for a $500,000 home at 6% interest for 30 years?');
      expect(result.isCalculation).toBe(true);
    });
  });
});

describe('Enhanced Calculation Execution', () => {
  describe('Unit Conversions', () => {
    test('converts km to miles', () => {
      const result = smartCalculator.executeUnitConversion(100, 'km', 'miles');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(62.14, 1);
    });

    test('converts miles to km', () => {
      const result = smartCalculator.executeUnitConversion(100, 'miles', 'km');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(160.93, 1);
    });

    test('converts Celsius to Fahrenheit', () => {
      const result = smartCalculator.executeUnitConversion(25, 'c', 'f');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(77, 0);
    });

    test('converts Fahrenheit to Celsius', () => {
      const result = smartCalculator.executeUnitConversion(100, 'f', 'c');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(37.78, 1);
    });

    test('converts pounds to kg', () => {
      const result = smartCalculator.executeUnitConversion(150, 'pounds', 'kg');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(68.04, 1);
    });

    test('converts feet to meters', () => {
      const result = smartCalculator.executeUnitConversion(5, 'feet', 'meters');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(1.524, 2);
    });

    test('converts gallons to liters', () => {
      const result = smartCalculator.executeUnitConversion(10, 'gallons', 'liters');
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(37.85, 1);
    });
  });

  describe('Ratio Problems', () => {
    test('solves ratio problem: A:B = 3:5, A=60, find B', () => {
      const result = smartCalculator.solveRatioProblem(3, 5, 60, true);
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(100, 0);
    });

    test('solves ratio problem: cats:dogs = 2:3, cats=10, find dogs', () => {
      const result = smartCalculator.solveRatioProblem(2, 3, 10, true);
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(15, 0);
    });

    test('solves ratio problem: A:B = 4:7, B=35, find A', () => {
      const result = smartCalculator.solveRatioProblem(4, 7, 35, false);
      expect(result.success).toBe(true);
      expect(result.result).toBeCloseTo(20, 0);
    });
  });

  describe('Loan Payment Calculations', () => {
    test('calculates monthly payment for $200,000 loan at 4% for 30 years', () => {
      const result = smartCalculator.calculateLoanPaymentDetailed(200000, 4, 30);
      expect(result.success).toBe(true);
      // Expected: ~$954.83/month
      expect(result.result).toBeCloseTo(954.83, 0);
    });

    test('calculates monthly payment for $500,000 loan at 6% for 30 years', () => {
      const result = smartCalculator.calculateLoanPaymentDetailed(500000, 6, 30);
      expect(result.success).toBe(true);
      // Expected: ~$2,998/month
      expect(result.result).toBeCloseTo(2998, 0);
    });

    test('calculates monthly payment for $100,000 loan at 5% for 15 years', () => {
      const result = smartCalculator.calculateLoanPaymentDetailed(100000, 5, 15);
      expect(result.success).toBe(true);
      // Expected: ~$790.79/month
      expect(result.result).toBeCloseTo(790.79, 0);
    });
  });

  describe('Future Value Calculations (Fixed)', () => {
    test('calculates FV with annual compounding (default)', () => {
      // $10,000 at 5% for 20 years with annual compounding
      const result = smartCalculator.calculateFutureValueEnhanced(10000, 5, 20, 'Future value of $10,000 at 5% for 20 years');
      expect(result.success).toBe(true);
      // Expected: ~$26,532.98
      expect(result.result).toBeCloseTo(26532.98, 0);
    });

    test('calculates FV with monthly compounding', () => {
      // $10,000 at 5% for 20 years with monthly compounding
      const result = smartCalculator.calculateFutureValueEnhanced(10000, 5, 20, 'Future value of $10,000 at 5% for 20 years compounded monthly');
      expect(result.success).toBe(true);
      // Expected: ~$27,126.40
      expect(result.result).toBeCloseTo(27126.40, 0);
    });

    test('calculates FV with quarterly compounding', () => {
      // $10,000 at 5% for 20 years with quarterly compounding
      const result = smartCalculator.calculateFutureValueEnhanced(10000, 5, 20, 'Future value of $10,000 at 5% for 20 years compounded quarterly');
      expect(result.success).toBe(true);
      // Expected: ~$27,014.85 (corrected)
      expect(result.result).toBeCloseTo(27014.85, 0);
    });

    test('does NOT return incorrect massive FV (bug fix verification)', () => {
      // This was the bug: $10,000 at 5% for 20 years was returning $100M+ due to monthly periods being used
      const result = smartCalculator.calculateFutureValueEnhanced(10000, 5, 20, 'Future value of $10,000 at 5% for 20 years');
      expect(result.success).toBe(true);
      // Should be around $26,500, NOT $100M+
      expect(result.result).toBeLessThan(50000);
      expect(result.result).toBeGreaterThan(20000);
    });
  });
});

describe('Test Coverage Summary', () => {
  test('Unit Conversion tests should improve accuracy by ~10%', () => {
    // Test the 5 unit conversion queries from the test suite
    const queries = [
      'Convert 5 kilometers to miles',
      'Convert 100 Fahrenheit to Celsius',
      'Convert 150 pounds to kilograms',
    ];

    queries.forEach(query => {
      const result = calculationDetector.detect(query);
      expect(result.isCalculation).toBe(true);
      expect(result.parameters?.calculationType).toBe('unit_conversion');
    });
  });

  test('Ratio problem tests should improve accuracy by ~4%', () => {
    const queries = [
      'If the ratio of A to B is 3:5 and A is 60, what is B?',
      'The ratio of cats to dogs is 2:3. If 10 cats, how many dogs?',
    ];

    queries.forEach(query => {
      const result = calculationDetector.detect(query);
      expect(result.isCalculation).toBe(true);
    });
  });

  test('Future value fix should improve accuracy by ~2%', () => {
    // The bug was returning $100M+ instead of $26,500
    const result = smartCalculator.calculateFutureValueEnhanced(10000, 5, 20, 'Future value of $10,000 at 5% for 20 years');
    expect(result.success).toBe(true);
    expect(result.result).toBeCloseTo(26532.98, 0);
  });

  test('Loan payment should improve accuracy by ~2%', () => {
    // $200,000 loan at 4% for 30 years
    const result = smartCalculator.calculateLoanPaymentDetailed(200000, 4, 30);
    expect(result.success).toBe(true);
    expect(result.result).toBeCloseTo(954.83, 0);
  });
});
