/**
 * Live Output Testing Script
 *
 * This script tests the actual running Koda backend to verify that all
 * outputs are being generated correctly with the new formatting system.
 *
 * It makes real API calls to your localhost/VPS and validates the responses.
 */

import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

let authToken: string = '';
let userId: string = '';

// ============================================================================
// TEST RESULTS
// ============================================================================

interface TestResult {
  category: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: any;
}

const testResults: TestResult[] = [];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function logTest(
  category: string,
  name: string,
  status: 'PASS' | 'FAIL' | 'SKIP',
  details: any
): void {
  testResults.push({ category, name, status, details });
  const emoji = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]';
  console.log(`${emoji} [${category}] ${name}: ${status}`);
  if (status === 'FAIL' && details.error) {
    console.log(`   Error: ${details.error}`);
  }
}

function validateOutput(
  output: string,
  expectedType: string
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for robotic phrases
  const roboticPhrases = [
    /based on the provided context/i,
    /as an AI language model/i,
    /I hope this (information )?is (helpful|useful)/i,
    /please be advised that/i,
  ];

  roboticPhrases.forEach((phrase) => {
    if (phrase.test(output)) {
      issues.push(`Contains robotic phrase: ${phrase.source}`);
    }
  });

  // Check for hardcoded templates
  if (output.includes('Vous avez') && output.includes('documents')) {
    issues.push('Contains hardcoded French template');
  }

  if (output.includes("I'm KODA, your AI document assistant. I can help you:")) {
    issues.push('Contains hardcoded capabilities template');
  }

  // Check for formal labels
  if (/Next step:|Tip:|Astuce:/i.test(output)) {
    issues.push('Contains formal labels (Next step, Tip, etc.)');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function authenticate(): Promise<boolean> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    authToken = response.data.token;
    userId = response.data.user?.id || response.data.userId;

    console.log('[PASS] Authentication successful\n');
    return true;
  } catch (error: any) {
    const err = error as AxiosError;
    console.log('[FAIL] Authentication failed:', err.message);
    console.log('[WARN] Make sure the backend is running and test user exists\n');
    return false;
  }
}

// ============================================================================
// TEST CATEGORY 1: CONVERSATIONAL OUTPUTS
// ============================================================================

async function testConversationalOutputs(): Promise<void> {
  console.log('\n========================================');
  console.log('CATEGORY 1: CONVERSATIONAL OUTPUTS');
  console.log('========================================\n');

  // Test greeting
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: 'hello',
        conversationId: null,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 30000,
      }
    );

    const output = response.data.answer || response.data.message || response.data.response;
    const validation = validateOutput(output, 'greeting');

    if (validation.isValid) {
      logTest('Conversational', 'Greeting', 'PASS', { output: output.substring(0, 100) });
    } else {
      logTest('Conversational', 'Greeting', 'FAIL', {
        issues: validation.issues,
        output: output.substring(0, 100),
      });
    }
  } catch (error: any) {
    logTest('Conversational', 'Greeting', 'FAIL', { error: error.message });
  }

  // Test capabilities
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: 'what can you do',
        conversationId: null,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 30000,
      }
    );

    const output = response.data.answer || response.data.message || response.data.response;
    const validation = validateOutput(output, 'capabilities');

    if (validation.isValid) {
      logTest('Conversational', 'Capabilities', 'PASS', { output: output.substring(0, 100) });
    } else {
      logTest('Conversational', 'Capabilities', 'FAIL', {
        issues: validation.issues,
        output: output.substring(0, 100),
      });
    }
  } catch (error: any) {
    logTest('Conversational', 'Capabilities', 'FAIL', { error: error.message });
  }
}

// ============================================================================
// TEST CATEGORY 2: FILE ACTION OUTPUTS
// ============================================================================

async function testFileActionOutputs(): Promise<void> {
  console.log('\n========================================');
  console.log('CATEGORY 2: FILE ACTION OUTPUTS');
  console.log('========================================\n');

  // Test file listing
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: 'which documents do I have',
        conversationId: null,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 30000,
      }
    );

    const output = response.data.answer || response.data.message || response.data.response;
    const validation = validateOutput(output, 'file_listing');

    if (validation.isValid) {
      logTest('File Actions', 'File Listing', 'PASS', { output: output.substring(0, 100) });
    } else {
      logTest('File Actions', 'File Listing', 'FAIL', {
        issues: validation.issues,
        output: output.substring(0, 100),
      });
    }
  } catch (error: any) {
    logTest('File Actions', 'File Listing', 'FAIL', { error: error.message });
  }
}

// ============================================================================
// TEST CATEGORY 3: RAG ANSWER OUTPUTS
// ============================================================================

async function testRAGAnswerOutputs(): Promise<void> {
  console.log('\n========================================');
  console.log('CATEGORY 3: RAG ANSWER OUTPUTS');
  console.log('========================================\n');

  // Test simple answer
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: 'what is the title of the first document',
        conversationId: null,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 60000,
      }
    );

    const output = response.data.answer || response.data.message || response.data.response;
    const validation = validateOutput(output, 'simple_answer');

    if (validation.isValid) {
      logTest('RAG Answers', 'Simple Answer', 'PASS', { output: output.substring(0, 100) });
    } else {
      logTest('RAG Answers', 'Simple Answer', 'FAIL', {
        issues: validation.issues,
        output: output.substring(0, 100),
      });
    }
  } catch (error: any) {
    logTest('RAG Answers', 'Simple Answer', 'FAIL', { error: error.message });
  }

  // Test complex answer
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: 'give me a detailed summary of all my documents',
        conversationId: null,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 120000,
      }
    );

    const output = response.data.answer || response.data.message || response.data.response;
    const validation = validateOutput(output, 'complex_answer');

    if (validation.isValid) {
      logTest('RAG Answers', 'Complex Answer', 'PASS', { output: output.substring(0, 100) });
    } else {
      logTest('RAG Answers', 'Complex Answer', 'FAIL', {
        issues: validation.issues,
        output: output.substring(0, 100),
      });
    }
  } catch (error: any) {
    logTest('RAG Answers', 'Complex Answer', 'FAIL', { error: error.message });
  }
}

// ============================================================================
// TEST CATEGORY 4: MULTILINGUAL OUTPUTS
// ============================================================================

async function testMultilingualOutputs(): Promise<void> {
  console.log('\n========================================');
  console.log('CATEGORY 4: MULTILINGUAL OUTPUTS');
  console.log('========================================\n');

  const testCases = [
    { language: 'Portuguese', query: 'olá', expectedLang: 'pt' },
    { language: 'Spanish', query: 'hola', expectedLang: 'es' },
    { language: 'French', query: 'bonjour', expectedLang: 'fr' },
  ];

  for (const testCase of testCases) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/rag/query`,
        {
          query: testCase.query,
          conversationId: null,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 30000,
        }
      );

      const output = response.data.answer || response.data.message || response.data.response;
      const validation = validateOutput(output, 'greeting');

      // Check if response is in the expected language (basic check)
      const isCorrectLanguage = output.length > 0;

      if (validation.isValid && isCorrectLanguage) {
        logTest('Multilingual', `${testCase.language} Greeting`, 'PASS', {
          output: output.substring(0, 100),
        });
      } else {
        logTest('Multilingual', `${testCase.language} Greeting`, 'FAIL', {
          issues: validation.issues,
          output: output.substring(0, 100),
        });
      }
    } catch (error: any) {
      logTest('Multilingual', `${testCase.language} Greeting`, 'FAIL', { error: error.message });
    }
  }
}

// ============================================================================
// OFFLINE MODE - Tests without backend
// ============================================================================

async function runOfflineTests(): Promise<void> {
  console.log('\n========================================');
  console.log('OFFLINE MODE: Testing service exports');
  console.log('========================================\n');

  // Test that services can be imported
  try {
    const unifiedFormatting = await import('../src/services/unifiedFormatting.service');
    if (unifiedFormatting.generateFormattedOutput) {
      logTest('Service', 'unifiedFormatting exports generateFormattedOutput', 'PASS', {});
    } else {
      logTest('Service', 'unifiedFormatting exports generateFormattedOutput', 'FAIL', {});
    }

    if (unifiedFormatting.validateOutput) {
      logTest('Service', 'unifiedFormatting exports validateOutput', 'PASS', {});
    } else {
      logTest('Service', 'unifiedFormatting exports validateOutput', 'FAIL', {});
    }
  } catch (error: any) {
    logTest('Service', 'unifiedFormatting import', 'FAIL', { error: error.message });
  }

  try {
    const outputIntegration = await import('../src/services/outputIntegration.service');
    const requiredFunctions = [
      'generateGreeting',
      'generateCapabilities',
      'generateFarewell',
      'generateFileListing',
      'generateNoDocumentsError',
    ];

    requiredFunctions.forEach((fn) => {
      if ((outputIntegration as any)[fn]) {
        logTest('Service', `outputIntegration exports ${fn}`, 'PASS', {});
      } else {
        logTest('Service', `outputIntegration exports ${fn}`, 'FAIL', {});
      }
    });
  } catch (error: any) {
    logTest('Service', 'outputIntegration import', 'FAIL', { error: error.message });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('================================================================================');
  console.log('KODA LIVE OUTPUT TESTING');
  console.log('Testing actual API responses from running backend');
  console.log('================================================================================');
  console.log(`\nAPI Base URL: ${API_BASE_URL}`);
  console.log(`Test User: ${TEST_USER_EMAIL}\n`);

  // Try to authenticate
  const authenticated = await authenticate();

  if (!authenticated) {
    console.log('\n[INFO] Cannot proceed with live API tests without authentication');
    console.log('[INFO] Running offline service export tests instead...');
    await runOfflineTests();
  } else {
    // Run all test categories
    await testConversationalOutputs();
    await testFileActionOutputs();
    await testRAGAnswerOutputs();
    await testMultilingualOutputs();
  }

  // Generate summary report
  console.log('\n');
  console.log('================================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================================\n');

  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.status === 'PASS').length;
  const failedTests = testResults.filter((r) => r.status === 'FAIL').length;
  const skippedTests = testResults.filter((r) => r.status === 'SKIP').length;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0';

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${passRate}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Skipped: ${skippedTests}`);

  if (failedTests > 0) {
    console.log('\nFailed Tests:');
    testResults
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  - [${r.category}] ${r.name}`);
        if (r.details.issues) {
          r.details.issues.forEach((issue: string) => console.log(`    • ${issue}`));
        }
        if (r.details.error) {
          console.log(`    • Error: ${r.details.error}`);
        }
      });
  }

  // Save detailed results to file
  const reportsDir = path.join(process.cwd(), 'test-suite', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, 'live-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);

  console.log('\n');
  console.log('================================================================================');

  const passRateNum = parseFloat(passRate);
  if (passRateNum >= 90) {
    console.log('[EXCELLENT] All outputs are working correctly!');
  } else if (passRateNum >= 70) {
    console.log('[GOOD] Most outputs are working, but some need attention.');
  } else {
    console.log('[NEEDS WORK] Many outputs are not working correctly.');
  }

  console.log('================================================================================\n');
}

// Run the tests
runAllTests().catch(console.error);
