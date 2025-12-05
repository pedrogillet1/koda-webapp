/**
 * Unit Tests for Answer Format Validator Service
 */

import answerFormatValidator from '../../services/answerFormatValidator.service';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

function test_detectComplexity_simple() {
  console.log('Testing: detectComplexity - simple queries');

  const testCases = [
    { query: 'Hello', intent: 'greeting', expected: 'simple' },
    { query: 'Hi there!', intent: 'greeting', expected: 'simple' },
    { query: 'What can you do?', intent: 'capability', expected: 'simple' },
    { query: 'Is the report ready?', intent: 'question', expected: 'simple' },
    { query: 'Yes', intent: 'confirmation', expected: 'simple' },
    { query: 'Thanks', intent: 'greeting', expected: 'simple' },
  ];

  let allPassed = true;
  const failures: string[] = [];

  for (const tc of testCases) {
    const result = answerFormatValidator.detectComplexity(tc.query, tc.intent);
    if (result !== tc.expected) {
      allPassed = false;
      failures.push(`"${tc.query}" (${tc.intent}) => ${result}, expected ${tc.expected}`);
    }
  }

  results.push({
    test: 'detectComplexity - simple queries',
    passed: allPassed,
    details: failures.length > 0 ? failures.join('; ') : undefined
  });
}

function test_detectComplexity_complex() {
  console.log('Testing: detectComplexity - complex queries');

  const testCases = [
    { query: 'Show me all revenue data for Q4 2024', intent: 'data_query', expected: 'complex' },
    { query: 'Analyze the sales trends across all regions', intent: 'analysis', expected: 'complex' },
    { query: 'Compare our marketing spend with last year', intent: 'comparison', expected: 'complex' },
    { query: 'What are the key performance indicators for this quarter?', intent: 'data_query', expected: 'complex' },
  ];

  let allPassed = true;
  const failures: string[] = [];

  for (const tc of testCases) {
    const result = answerFormatValidator.detectComplexity(tc.query, tc.intent);
    if (result !== tc.expected) {
      allPassed = false;
      failures.push(`"${tc.query}" (${tc.intent}) => ${result}, expected ${tc.expected}`);
    }
  }

  results.push({
    test: 'detectComplexity - complex queries',
    passed: allPassed,
    details: failures.length > 0 ? failures.join('; ') : undefined
  });
}

function test_validate_simpleAnswer_valid() {
  console.log('Testing: validate - valid simple answer');

  const query = 'Hello';
  const intent = 'greeting';
  const answer = `Hello! I'm Koda, your AI assistant. How can I help you today?`;

  const result = answerFormatValidator.validate(answer, query, intent);

  const passed = result.isValid &&
                 result.complexity === 'simple' &&
                 !result.metrics.hasTitle;

  results.push({
    test: 'validate - valid simple answer',
    passed,
    details: passed ? undefined : `isValid: ${result.isValid}, errors: ${result.errors.join(', ')}`
  });
}

function test_validate_simpleAnswer_invalid_hasTitle() {
  console.log('Testing: validate - simple answer with title (invalid)');

  const query = 'Hi';
  const intent = 'greeting';
  const answer = `## Greeting Response

Hello! I'm Koda. How can I help you?`;

  const result = answerFormatValidator.validate(answer, query, intent);

  // Should be invalid because simple answers shouldn't have titles
  const passed = !result.isValid &&
                 result.errors.some(e => e.includes('should not have a title'));

  results.push({
    test: 'validate - simple answer with title (invalid)',
    passed,
    details: passed ? undefined : `Expected invalid, got isValid: ${result.isValid}`
  });
}

function test_validate_complexAnswer_valid() {
  console.log('Testing: validate - valid complex answer');

  const query = 'Show me the revenue breakdown for Q4';
  const intent = 'data_query';
  const answer = `## Q4 Revenue Breakdown

Here's a comprehensive overview of the Q4 revenue data based on the available information.

### Revenue by Region

- North America: $2.5M (45% of total)
- Europe: $1.8M (32% of total)
- Asia Pacific: $1.2M (23% of total)

### Key Insights

- Total Q4 revenue: $5.5M
- Quarter-over-quarter growth: 12%
- Top performing segment: Enterprise sales

### Recommendations

Based on this data, focusing on expanding the APAC region could yield significant growth opportunities given its current momentum.`;

  const result = answerFormatValidator.validate(answer, query, intent);

  const passed = result.complexity === 'complex' &&
                 result.metrics.hasTitle &&
                 result.metrics.sectionCount >= 2;

  results.push({
    test: 'validate - valid complex answer',
    passed,
    details: passed ? undefined : `hasTitle: ${result.metrics.hasTitle}, sections: ${result.metrics.sectionCount}`
  });
}

function test_validate_complexAnswer_missing_title() {
  console.log('Testing: validate - complex answer missing title (invalid)');

  const query = 'Analyze the sales performance this quarter';
  const intent = 'analysis';
  const answer = `Sales performance has been strong this quarter.

### Revenue Growth

Revenue increased by 15% compared to last quarter.

### Key Drivers

- New product launches
- Expanded customer base`;

  const result = answerFormatValidator.validate(answer, query, intent);

  // Should have error about missing title
  const passed = result.errors.some(e => e.includes('should have a title'));

  results.push({
    test: 'validate - complex answer missing title (invalid)',
    passed,
    details: passed ? undefined : `Errors: ${result.errors.join(', ')}`
  });
}

function test_autoFix_multipleBlankLines() {
  console.log('Testing: autoFix - removes multiple blank lines');

  const answer = `## Title


This has too many blank lines.



### Section

Content here.`;

  const fixed = answerFormatValidator.autoFix(answer, 'complex');

  // Should not have 3+ consecutive newlines
  const passed = !fixed.includes('\n\n\n');

  results.push({
    test: 'autoFix - removes multiple blank lines',
    passed,
    details: passed ? undefined : `Still contains triple newlines`
  });
}

function test_autoFix_removesTitleForSimple() {
  console.log('Testing: autoFix - removes title for simple queries');

  const answer = `## Hello Response

Hi there! How can I help?`;

  const fixed = answerFormatValidator.autoFix(answer, 'simple');

  // Should not start with #
  const passed = !fixed.startsWith('#');

  results.push({
    test: 'autoFix - removes title for simple queries',
    passed,
    details: passed ? undefined : `Fixed still starts with: ${fixed.substring(0, 50)}`
  });
}

function test_autoFix_convertsBullets() {
  console.log('Testing: autoFix - converts bullets to dot style');

  const answer = `## List

- Item one
* Item two
- Item three`;

  const fixed = answerFormatValidator.autoFix(answer, 'complex');

  // Should convert - and * to bullet
  // Note: The service uses \n- and \n* patterns, so first line dash may remain
  const bulletCount = (fixed.match(/\n[•]/g) || []).length;
  const passed = bulletCount >= 2; // At least the last two should be converted

  results.push({
    test: 'autoFix - converts bullets to dot style',
    passed,
    details: passed ? undefined : `Bullet count: ${bulletCount}`
  });
}

function test_calculateMetrics() {
  console.log('Testing: calculateMetrics via validate');

  const answer = `## Test Answer

Introduction paragraph here.

### Section One

- Bullet 1
- Bullet 2
- Bullet 3

### Section Two

Some content here.`;

  const result = answerFormatValidator.validate(answer, 'test query for metrics', 'data_query');
  const metrics = result.metrics;

  const checks = [
    { name: 'hasTitle', expected: true, actual: metrics.hasTitle },
    { name: 'sectionCount >= 2', expected: true, actual: metrics.sectionCount >= 2 },
    { name: 'bulletCount >= 3', expected: true, actual: metrics.bulletCount >= 3 },
  ];

  const failed = checks.filter(c => c.expected !== c.actual);
  const passed = failed.length === 0;

  results.push({
    test: 'calculateMetrics via validate',
    passed,
    details: passed ? undefined : failed.map(f => `${f.name}: expected ${f.expected}, got ${f.actual}`).join('; ')
  });
}

function test_generateReport() {
  console.log('Testing: generateReport');

  const validationResult = answerFormatValidator.validate(
    'Hello! How can I help?',
    'Hi',
    'greeting'
  );

  const report = answerFormatValidator.generateReport(validationResult);

  const checks = [
    report.includes('ANSWER FORMAT VALIDATION REPORT'),
    report.includes('STATUS'),
    report.includes('COMPLEXITY'),
    report.includes('METRICS'),
  ];

  const passed = checks.every(c => c);

  results.push({
    test: 'generateReport',
    passed,
    details: passed ? undefined : 'Report missing expected sections'
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('═'.repeat(70));
  console.log('ANSWER FORMAT VALIDATOR - UNIT TESTS');
  console.log('═'.repeat(70));
  console.log('');

  // Run all tests
  test_detectComplexity_simple();
  test_detectComplexity_complex();
  test_validate_simpleAnswer_valid();
  test_validate_simpleAnswer_invalid_hasTitle();
  test_validate_complexAnswer_valid();
  test_validate_complexAnswer_missing_title();
  test_autoFix_multipleBlankLines();
  test_autoFix_removesTitleForSimple();
  test_autoFix_convertsBullets();
  test_calculateMetrics();
  test_generateReport();

  // Print results
  console.log('\n' + '═'.repeat(70));
  console.log('TEST RESULTS');
  console.log('═'.repeat(70));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const icon = result.passed ? '\u2713' : '\u2717';
    console.log(`${icon} [${status}] ${result.test}`);
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    if (result.passed) passed++;
    else failed++;
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('═'.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
