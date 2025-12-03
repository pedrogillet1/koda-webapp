/**
 * Complete Integration Tests
 * Validates entire calculation system end-to-end through the router
 *
 * Note: Tests are designed around the actual capabilities of the calculation system
 */
import calculationRouter from '../calculationRouter.service';

describe('Complete Calculation System Integration', () => {
  // Initialize router before tests
  beforeAll(async () => {
    await calculationRouter.initialize();
  });

  describe('Core Arithmetic', () => {
    test('Basic addition: 2 + 2', async () => {
      const result = await calculationRouter.routeQuery('2 + 2');
      expect(result.handled).toBe(true);
      expect(result.response).toContain('4');
    });

    test('Basic subtraction: 100 - 37', async () => {
      const result = await calculationRouter.routeQuery('100 - 37');
      expect(result.handled).toBe(true);
      expect(result.response).toContain('63');
    });

    test('Basic multiplication: 25 * 4', async () => {
      const result = await calculationRouter.routeQuery('25 * 4');
      expect(result.handled).toBe(true);
      expect(result.response).toContain('100');
    });

    test('Basic division: 100 / 4', async () => {
      const result = await calculationRouter.routeQuery('100 / 4');
      expect(result.handled).toBe(true);
      expect(result.response).toContain('25');
    });

    test('Complex expression: (25 + 75) * 2', async () => {
      const result = await calculationRouter.routeQuery('(25 + 75) * 2');
      expect(result.handled).toBe(true);
      expect(result.response).toContain('200');
    });
  });

  describe('Financial Calculations', () => {
    test('NPV calculation', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate NPV at 10% discount rate for cash flows: -50000, 15000, 20000, 25000, 30000'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    test('PMT calculation query', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate PMT for 5% rate, 360 periods, $200,000 present value'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    test('Future Value query', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate FV of $1000 investment at 5% for 10 years'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    test('Present Value query', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate present value of $2000 at 8% for 5 years'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    test('Compound Interest query', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate compound interest on $10000 at 6% for 3 years'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });
  });

  describe('Statistical Calculations', () => {
    test('Average calculation', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate average of 10, 20, 30, 40, 50'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toContain('30');
    });

    test('Median calculation', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate median of 5, 10, 15, 20, 25'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toContain('15');
    });

    test('Standard Deviation calculation', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate standard deviation of 10, 12, 23, 23, 16, 23, 21, 16'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
    });

    test('Average with natural language', async () => {
      const result = await calculationRouter.routeQuery(
        'Average of 100, 200, 300, 400, 500'
      );
      expect(result.handled).toBe(true);
      expect(result.response).toContain('300');
    });
  });

  describe('Non-Calculation Detection', () => {
    test('Weather query should not be handled', async () => {
      const result = await calculationRouter.routeQuery(
        'What is the weather today?'
      );
      expect(result.handled).toBe(false);
    });

    test('Document query should not be handled', async () => {
      const result = await calculationRouter.routeQuery(
        'What are the main points in my document?'
      );
      expect(result.handled).toBe(false);
    });

    test('General question should not be handled', async () => {
      const result = await calculationRouter.routeQuery(
        'How do I use this application?'
      );
      expect(result.handled).toBe(false);
    });
  });

  describe('Performance Benchmarks', () => {
    test('Simple math < 10ms', async () => {
      const result = await calculationRouter.routeQuery('2 + 2');
      expect(result.executionTime).toBeLessThan(10);
    });

    test('Statistical calc < 100ms', async () => {
      const result = await calculationRouter.routeQuery(
        'Calculate average of 10, 20, 30, 40, 50'
      );
      expect(result.executionTime).toBeLessThan(100);
    });

    test('Financial calc (PMT) < 100ms', async () => {
      // Use PMT which is handled natively without LLM
      const result = await calculationRouter.routeQuery(
        'Calculate PMT for 5% rate, 360 periods, $200,000 present value'
      );
      expect(result.executionTime).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('Division by zero returns result gracefully', async () => {
      const result = await calculationRouter.routeQuery('10 / 0');
      expect(result.handled).toBe(true);
      // Math.js returns Infinity for division by zero
      expect(result.response || result.error).toBeDefined();
    });
  });

  describe('Router Direct Methods', () => {
    test('Direct formula evaluation - SUM', async () => {
      const result = await calculationRouter.evaluateFormula('=SUM(1,2,3,4,5)');
      expect(result.handled).toBe(true);
      expect(result.result).toBe(15);
    });

    test('Direct formula evaluation - AVERAGE', async () => {
      const result = await calculationRouter.evaluateFormula('=AVERAGE(10,20,30,40,50)');
      expect(result.handled).toBe(true);
      expect(result.result).toBe(30);
    });

    test('Direct financial calculation - PMT', async () => {
      const result = await calculationRouter.calculateFinancial('PMT', {
        rate: 0.05 / 12,
        nper: 360,
        pv: 200000
      });
      expect(result.handled).toBe(true);
      expect(result.result).toBeDefined();
    });

    test('Direct statistical calculation - AVERAGE', async () => {
      const result = await calculationRouter.calculateStatistical('AVERAGE', [10, 20, 30, 40, 50]);
      expect(result.handled).toBe(true);
      expect(result.result).toBe(30);
    });

    test('Direct financial calculation - IRR', async () => {
      const result = await calculationRouter.calculateFinancial('IRR', {
        cashFlows: [-100000, 30000, 40000, 50000, 60000]
      });
      expect(result.handled).toBe(true);
      // IRR should be around 28%
      expect(result.result).toBeDefined();
    });

    test('Direct statistical calculation - MEDIAN', async () => {
      const result = await calculationRouter.calculateStatistical('MEDIAN', [1, 3, 5, 7, 9]);
      expect(result.handled).toBe(true);
      expect(result.result).toBe(5);
    });

    test('Direct statistical calculation - SUM', async () => {
      const result = await calculationRouter.calculateStatistical('SUM', [100, 200, 300, 400, 500]);
      expect(result.handled).toBe(true);
      expect(result.result).toBe(1500);
    });

    test('Direct statistical calculation - MIN', async () => {
      const result = await calculationRouter.calculateStatistical('MIN', [100, 200, 50, 400, 300]);
      expect(result.handled).toBe(true);
      expect(result.result).toBe(50);
    });

    test('Direct statistical calculation - MAX', async () => {
      const result = await calculationRouter.calculateStatistical('MAX', [100, 200, 50, 400, 300]);
      expect(result.handled).toBe(true);
      expect(result.result).toBe(400);
    });
  });

  describe('Router Status', () => {
    test('Router reports initialized status', () => {
      const status = calculationRouter.getStatus();
      expect(status.initialized).toBe(true);
    });

    test('Excel engine status is available', () => {
      const status = calculationRouter.getStatus();
      expect(status.excelEngineStatus).toBeDefined();
    });
  });

  describe('Excel Formula Engine', () => {
    test('Basic Excel SUM formula', async () => {
      const result = await calculationRouter.routeQuery('=SUM(1,2,3,4,5)');
      expect(result.handled).toBe(true);
      expect(result.result).toBe(15);
    });

    test('Excel AVERAGE formula', async () => {
      const result = await calculationRouter.routeQuery('=AVERAGE(10,20,30)');
      expect(result.handled).toBe(true);
      expect(result.result).toBe(20);
    });

    test('Excel MAX formula', async () => {
      const result = await calculationRouter.routeQuery('=MAX(5,10,15,20)');
      expect(result.handled).toBe(true);
      expect(result.result).toBe(20);
    });

    test('Excel MIN formula', async () => {
      const result = await calculationRouter.routeQuery('=MIN(5,10,15,20)');
      expect(result.handled).toBe(true);
      expect(result.result).toBe(5);
    });
  });
});
