import calculationService from '../services/calculation.service';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test_simpleCalculation() {
  const start = Date.now();
  try {
    const result = await calculationService.performCalculation('2 + 2', '');
    const passed = Boolean(result && result.result === 4);
    results.push({
      test: 'calculation: 2+2',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'calculation: 2+2',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_complexCalculation() {
  const start = Date.now();
  try {
    const result = await calculationService.performCalculation('(25 * 4) + 10 / 2', '');
    const passed = Boolean(result && result.result === 105);
    results.push({
      test: 'calculation: complex',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'calculation: complex',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

async function test_percentageCalculation() {
  const start = Date.now();
  try {
    const result = await calculationService.performCalculation('20% of 500', '');
    const passed = Boolean(result && result.result === 100);
    results.push({
      test: 'calculation: percentage',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'calculation: percentage',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

export async function runTests() {
  await test_simpleCalculation();
  await test_complexCalculation();
  await test_percentageCalculation();
  return results;
}
