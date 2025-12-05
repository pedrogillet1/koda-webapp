import llmIntentDetectorService from '../services/llmIntentDetector.service';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * NOTE: llmIntentDetectorService is now a stub that returns { intent: 'general', confidence: 0 }
 * These tests verify the stub behavior only.
 */

async function test_stubBehavior() {
  const start = Date.now();
  try {
    const result = await llmIntentDetectorService.detectIntent();

    // Stub always returns { intent: 'general', confidence: 0 }
    const passed = result.intent === 'general' && result.confidence === 0;
    results.push({
      test: 'detectIntent: stub behavior',
      passed,
      duration: Date.now() - start
    });
  } catch (error: any) {
    results.push({
      test: 'detectIntent: stub behavior',
      passed: false,
      error: error.message,
      duration: Date.now() - start
    });
  }
}

export async function runTests() {
  await test_stubBehavior();
  return results;
}

// Run tests if executed directly
if (require.main === module) {
  runTests().then(results => {
    console.log('Intent Detection Tests:');
    results.forEach(r => {
      const status = r.passed ? '✓' : '✗';
      console.log(`${status} ${r.test} (${r.duration}ms)`);
      if (r.error) console.log(`  Error: ${r.error}`);
    });
  });
}
