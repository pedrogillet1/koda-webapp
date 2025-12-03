/**
 * Direct Output Generation Test
 *
 * Tests the AI-generated outputs directly without needing the full backend API.
 * This validates that the unified formatting system works correctly with Gemini.
 */

import 'dotenv/config';
import { outputIntegration } from '../src/services/outputIntegration.service';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  output: string;
  issues: string[];
}

const results: TestResult[] = [];

function validateOutput(output: string, rules: {
  mustNotContain?: string[];
  maxLength?: number;
  minLength?: number;
}): string[] {
  const issues: string[] = [];

  if (rules.mustNotContain) {
    rules.mustNotContain.forEach(phrase => {
      if (output.toLowerCase().includes(phrase.toLowerCase())) {
        issues.push(`Contains forbidden: "${phrase}"`);
      }
    });
  }

  if (rules.maxLength && output.length > rules.maxLength) {
    issues.push(`Too long: ${output.length} chars (max ${rules.maxLength})`);
  }

  if (rules.minLength && output.length < rules.minLength) {
    issues.push(`Too short: ${output.length} chars (min ${rules.minLength})`);
  }

  return issues;
}

async function runTests() {
  console.log('');
  console.log('='.repeat(70));
  console.log('DIRECT OUTPUT GENERATION TEST');
  console.log('Testing AI-generated outputs with Gemini API');
  console.log('='.repeat(70));
  console.log('');

  // Test 1: English greeting with documents
  console.log('Test 1: GREETING (English, 5 docs)');
  try {
    const output = await outputIntegration.generateGreeting('en', 5);
    const issues = validateOutput(output, {
      mustNotContain: ["I'm KODA, your AI document assistant", 'based on the provided context'],
      maxLength: 200,
    });
    results.push({ name: 'Greeting EN (5 docs)', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Greeting EN (5 docs)', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 2: Portuguese greeting without documents
  console.log('Test 2: GREETING (Portuguese, 0 docs)');
  try {
    const output = await outputIntegration.generateGreeting('pt', 0);
    const issues = validateOutput(output, {
      mustNotContain: ['Hello', "I'm KODA", 'How can I help'],
      maxLength: 200,
    });
    results.push({ name: 'Greeting PT (0 docs)', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Greeting PT (0 docs)', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 3: Spanish greeting
  console.log('Test 3: GREETING (Spanish, 3 docs)');
  try {
    const output = await outputIntegration.generateGreeting('es', 3);
    const issues = validateOutput(output, {
      mustNotContain: ['Hello', 'Hi!', "I'm KODA"],
      maxLength: 200,
    });
    results.push({ name: 'Greeting ES (3 docs)', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Greeting ES (3 docs)', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 4: French greeting
  console.log('Test 4: GREETING (French, 10 docs)');
  try {
    const output = await outputIntegration.generateGreeting('fr', 10);
    const issues = validateOutput(output, {
      mustNotContain: ['Hello', 'Hi!', "I'm KODA"],
      maxLength: 200,
    });
    results.push({ name: 'Greeting FR (10 docs)', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Greeting FR (10 docs)', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 5: Capabilities
  console.log('Test 5: CAPABILITIES (English, 10 docs)');
  try {
    const output = await outputIntegration.generateCapabilities('en', 10);
    const issues = validateOutput(output, {
      mustNotContain: ["I'm KODA, your AI document assistant. I can help you:", 'Ask Questions —', 'Search & Find —'],
      minLength: 50,
      maxLength: 500,
    });
    results.push({ name: 'Capabilities EN', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output (first 200 chars): "${output.substring(0, 200)}..."`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Capabilities EN', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 6: No documents error
  console.log('Test 6: NO DOCUMENTS ERROR (Spanish)');
  try {
    const output = await outputIntegration.generateNoDocumentsError('es');
    const issues = validateOutput(output, {
      mustNotContain: ['You have no documents', 'Upload some files'],
      maxLength: 200,
    });
    results.push({ name: 'No Docs Error ES', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'No Docs Error ES', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 7: Farewell
  console.log('Test 7: FAREWELL (French)');
  try {
    const output = await outputIntegration.generateFarewell('fr');
    const issues = validateOutput(output, {
      mustNotContain: ['Goodbye', 'Bye'],
      maxLength: 150,
    });
    results.push({ name: 'Farewell FR', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Farewell FR', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Test 8: Processing error
  console.log('Test 8: PROCESSING ERROR (Portuguese)');
  try {
    const output = await outputIntegration.generateProcessingError('pt', 'timeout');
    const issues = validateOutput(output, {
      mustNotContain: ['Something went wrong', 'An error occurred', 'Error 500'],
      maxLength: 200,
    });
    results.push({ name: 'Processing Error PT', status: issues.length === 0 ? 'PASS' : 'FAIL', output, issues });
    console.log(`  Output: "${output}"`);
    console.log(`  Status: ${issues.length === 0 ? '[PASS]' : '[FAIL] ' + issues.join(', ')}`);
  } catch (e: any) {
    results.push({ name: 'Processing Error PT', status: 'FAIL', output: '', issues: [e.message] });
    console.log(`  Status: [FAIL] ${e.message}`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed} (${passRate}%)`);
  console.log(`Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.issues.join(', ')}`);
    });
    console.log('');
  }

  console.log('='.repeat(70));
  if (parseFloat(passRate) >= 90) {
    console.log('[EXCELLENT] AI output generation is working correctly!');
  } else if (parseFloat(passRate) >= 70) {
    console.log('[GOOD] Most outputs are correct, some need adjustment.');
  } else {
    console.log('[NEEDS WORK] Output generation has issues.');
  }
  console.log('='.repeat(70));
  console.log('');
}

runTests().catch(console.error);
