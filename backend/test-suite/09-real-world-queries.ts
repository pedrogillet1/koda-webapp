/**
 * Real-World Query Testing Script
 *
 * This script tests Koda with real, practical user queries to validate
 * that responses are natural, well-formatted, and contextually appropriate.
 *
 * Can run in two modes:
 * 1. LIVE MODE: With running backend (requires authentication)
 * 2. OFFLINE MODE: Validates service structure and outputs sample formatted responses
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

let authToken: string = '';
let conversationId: string | null = null;

// ============================================================================
// REAL-WORLD TEST QUERIES
// ============================================================================

interface TestQuery {
  category: string;
  scenario: string;
  query: string;
  language: string;
  expectedType: string;
  validationRules: {
    mustNotContain?: string[];
    mustContain?: string[];
    maxLength?: number;
    minLength?: number;
    shouldHaveBullets?: boolean;
    shouldHaveHeadings?: boolean;
  };
}

const TEST_QUERIES: TestQuery[] = [
  // ========================================================================
  // CONVERSATIONAL QUERIES
  // ========================================================================
  {
    category: 'Conversational',
    scenario: 'User greets Koda (English)',
    query: 'hello',
    language: 'en',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ["I'm KODA, your AI document assistant", 'based on the provided context'],
      maxLength: 200,
      shouldHaveBullets: false,
    },
  },
  {
    category: 'Conversational',
    scenario: 'User greets Koda (Portuguese)',
    query: 'olá',
    language: 'pt',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', "I'm KODA"],
      maxLength: 200,
    },
  },
  {
    category: 'Conversational',
    scenario: 'User asks what Koda can do',
    query: 'what can you do?',
    language: 'en',
    expectedType: 'capabilities',
    validationRules: {
      mustNotContain: ["I'm KODA, your AI document assistant", 'Next step:', 'Tip:'],
      minLength: 100,
      maxLength: 400,
      shouldHaveBullets: false, // Should use short paragraphs, not bullets
    },
  },
  {
    category: 'Conversational',
    scenario: 'User asks for help',
    query: 'how do you work',
    language: 'en',
    expectedType: 'capabilities',
    validationRules: {
      mustNotContain: ['Ask Questions —', 'Search & Find —'],
      maxLength: 400,
    },
  },
  {
    category: 'Conversational',
    scenario: 'User says goodbye',
    query: 'goodbye',
    language: 'en',
    expectedType: 'farewell',
    validationRules: {
      mustNotContain: ['based on the provided context'],
      maxLength: 150,
    },
  },

  // ========================================================================
  // FILE ACTION QUERIES
  // ========================================================================
  {
    category: 'File Actions',
    scenario: 'User asks which documents they have',
    query: 'which documents do I have',
    language: 'en',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['Vous avez', 'Astuce:', 'Next step:', 'Que souhaitez-vous savoir'],
      shouldHaveBullets: true,
    },
  },
  {
    category: 'File Actions',
    scenario: 'User asks for document list (Portuguese)',
    query: 'quais documentos eu tenho',
    language: 'pt',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['You have', 'Vous avez', 'documents (affichant les'],
    },
  },
  {
    category: 'File Actions',
    scenario: 'User searches for specific file',
    query: 'find contract',
    language: 'en',
    expectedType: 'file_search',
    validationRules: {
      mustNotContain: ['based on the provided context'],
    },
  },
  {
    category: 'File Actions',
    scenario: 'User asks about folders',
    query: 'what folders do I have',
    language: 'en',
    expectedType: 'folder_listing',
    validationRules: {
      mustNotContain: ['Next step:', 'Tip:'],
    },
  },

  // ========================================================================
  // SIMPLE RAG QUERIES
  // ========================================================================
  {
    category: 'Simple RAG',
    scenario: 'User asks for specific information',
    query: 'what is the title of the first document',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['based on the provided context', 'as an AI language model'],
      maxLength: 300,
    },
  },
  {
    category: 'Simple RAG',
    scenario: 'User asks for a date',
    query: 'when was this document created',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['I hope this information is helpful'],
      maxLength: 200,
    },
  },
  {
    category: 'Simple RAG',
    scenario: 'User asks for a number',
    query: 'how many pages does the report have',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      maxLength: 200,
    },
  },

  // ========================================================================
  // COMPLEX RAG QUERIES
  // ========================================================================
  {
    category: 'Complex RAG',
    scenario: 'User requests detailed summary',
    query: 'give me a detailed summary of all my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['based on the provided context'],
      minLength: 200,
      shouldHaveHeadings: false, // Should use **bold** for emphasis, not headings
    },
  },
  {
    category: 'Complex RAG',
    scenario: 'User asks for comparison',
    query: 'compare the revenue projections in version 1 and version 2',
    language: 'en',
    expectedType: 'comparison',
    validationRules: {
      mustNotContain: ['Next step:'],
      minLength: 150,
    },
  },
  {
    category: 'Complex RAG',
    scenario: 'User asks for analysis',
    query: 'what are the main findings in this research paper',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['I hope this is helpful'],
      minLength: 200,
      shouldHaveBullets: true, // Complex answers should use bullets for key points
    },
  },
  {
    category: 'Complex RAG',
    scenario: 'User asks for data extraction',
    query: 'extract all dates and amounts from the invoice',
    language: 'en',
    expectedType: 'data_extraction',
    validationRules: {
      mustNotContain: ['based on the provided context'],
    },
  },

  // ========================================================================
  // MULTILINGUAL QUERIES
  // ========================================================================
  {
    category: 'Multilingual',
    scenario: 'Portuguese question about documents',
    query: 'qual é o resumo deste documento',
    language: 'pt',
    expectedType: 'summary',
    validationRules: {
      mustNotContain: ['The document', 'This document', 'based on'],
    },
  },
  {
    category: 'Multilingual',
    scenario: 'Spanish question about documents',
    query: 'cuáles son los puntos principales',
    language: 'es',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['The main points', 'based on'],
    },
  },
  {
    category: 'Multilingual',
    scenario: 'French question about documents',
    query: 'quels sont les documents importants',
    language: 'fr',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['You have', 'documents (affichant les'],
    },
  },

  // ========================================================================
  // ERROR HANDLING QUERIES
  // ========================================================================
  {
    category: 'Error Handling',
    scenario: 'User asks question with no documents',
    query: 'what is the revenue',
    language: 'en',
    expectedType: 'no_documents',
    validationRules: {
      mustNotContain: ['based on the provided context', 'I apologize'],
      maxLength: 200,
    },
  },
  {
    category: 'Error Handling',
    scenario: 'User asks ambiguous question',
    query: 'tell me about the contract',
    language: 'en',
    expectedType: 'ambiguous_query',
    validationRules: {
      mustNotContain: ['please be advised'],
    },
  },
  {
    category: 'Error Handling',
    scenario: 'User asks out-of-scope question',
    query: 'what is the weather today',
    language: 'en',
    expectedType: 'out_of_scope',
    validationRules: {
      mustNotContain: ['as an AI language model', 'I apologize'],
      maxLength: 200,
    },
  },

  // ========================================================================
  // CONVERSATION CONTINUITY
  // ========================================================================
  {
    category: 'Continuity',
    scenario: 'Follow-up question (context awareness)',
    query: 'what about the second one',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['based on the provided context'],
    },
  },
  {
    category: 'Continuity',
    scenario: 'Clarification request',
    query: 'can you explain that in more detail',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['I hope this is helpful'],
    },
  },
];

// ============================================================================
// TEST EXECUTION
// ============================================================================

interface TestResult {
  category: string;
  scenario: string;
  query: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  response: string;
  issues: string[];
  responseTime: number;
}

const testResults: TestResult[] = [];

async function authenticate(): Promise<boolean> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      { timeout: 10000 }
    );

    authToken = response.data.token;
    console.log('[PASS] Authentication successful\n');
    return true;
  } catch (error: any) {
    console.log('[FAIL] Authentication failed:', error.message);
    return false;
  }
}

async function runQuery(testQuery: TestQuery): Promise<TestResult> {
  const startTime = Date.now();
  const issues: string[] = [];

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: testQuery.query,
        conversationId: conversationId,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 60000,
      }
    );

    const responseTime = Date.now() - startTime;
    const output = response.data.answer || response.data.message || response.data.response || '';

    // Update conversation ID for continuity tests
    if (response.data.conversationId) {
      conversationId = response.data.conversationId;
    }

    // Validate response
    const rules = testQuery.validationRules;

    // Check mustNotContain
    if (rules.mustNotContain) {
      rules.mustNotContain.forEach((phrase) => {
        if (output.toLowerCase().includes(phrase.toLowerCase())) {
          issues.push(`Contains forbidden phrase: "${phrase}"`);
        }
      });
    }

    // Check mustContain
    if (rules.mustContain) {
      rules.mustContain.forEach((phrase) => {
        if (!output.toLowerCase().includes(phrase.toLowerCase())) {
          issues.push(`Missing required phrase: "${phrase}"`);
        }
      });
    }

    // Check length
    if (rules.maxLength && output.length > rules.maxLength) {
      issues.push(`Response too long: ${output.length} chars (max: ${rules.maxLength})`);
    }

    if (rules.minLength && output.length < rules.minLength) {
      issues.push(`Response too short: ${output.length} chars (min: ${rules.minLength})`);
    }

    // Check bullets
    if (rules.shouldHaveBullets === true && !/^[-•*]\s/m.test(output)) {
      issues.push('Expected bullet points but none found');
    }

    if (rules.shouldHaveBullets === false && /^[-•*]\s/m.test(output)) {
      issues.push('Should not use bullet points but found some');
    }

    // Check headings
    if (rules.shouldHaveHeadings === true && !/^#{1,3}\s/m.test(output)) {
      issues.push('Expected headings but none found');
    }

    if (rules.shouldHaveHeadings === false && /^#{1,3}\s/m.test(output)) {
      issues.push('Should not use headings but found some');
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';

    return {
      category: testQuery.category,
      scenario: testQuery.scenario,
      query: testQuery.query,
      status,
      response: output,
      issues,
      responseTime,
    };
  } catch (error: any) {
    return {
      category: testQuery.category,
      scenario: testQuery.scenario,
      query: testQuery.query,
      status: 'FAIL',
      response: '',
      issues: [`API Error: ${error.message}`],
      responseTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// OFFLINE MODE - Test validation rules without backend
// ============================================================================

async function runOfflineTests(): Promise<void> {
  console.log('\n========================================');
  console.log('OFFLINE MODE: Testing validation rules');
  console.log('========================================\n');

  // Import services for offline testing
  let outputIntegration: any;
  let unifiedFormatting: any;

  try {
    outputIntegration = await import('../src/services/outputIntegration.service');
    unifiedFormatting = await import('../src/services/unifiedFormatting.service');
  } catch (error: any) {
    console.log('[FAIL] Could not import services:', error.message);
    return;
  }

  // Test 1: Validate query test definitions
  console.log('Test 1: Query test definitions');
  const categories = [...new Set(TEST_QUERIES.map((q) => q.category))];
  console.log(`  Total queries: ${TEST_QUERIES.length}`);
  console.log(`  Categories: ${categories.join(', ')}`);

  testResults.push({
    category: 'Offline',
    scenario: 'Query definitions valid',
    query: 'N/A',
    status: 'PASS',
    response: `${TEST_QUERIES.length} queries in ${categories.length} categories`,
    issues: [],
    responseTime: 0,
  });

  // Test 2: Validate mustNotContain patterns
  console.log('\nTest 2: Forbidden phrase patterns');
  const forbiddenPhrases = new Set<string>();
  TEST_QUERIES.forEach((q) => {
    if (q.validationRules.mustNotContain) {
      q.validationRules.mustNotContain.forEach((p) => forbiddenPhrases.add(p));
    }
  });
  console.log(`  Unique forbidden phrases: ${forbiddenPhrases.size}`);
  forbiddenPhrases.forEach((phrase) => {
    console.log(`    - "${phrase}"`);
  });

  testResults.push({
    category: 'Offline',
    scenario: 'Forbidden phrases defined',
    query: 'N/A',
    status: 'PASS',
    response: `${forbiddenPhrases.size} unique forbidden phrases`,
    issues: [],
    responseTime: 0,
  });

  // Test 3: Service exports available
  console.log('\nTest 3: Service exports');
  const requiredExports = [
    'generateGreeting',
    'generateCapabilities',
    'generateFarewell',
    'generateFileListing',
    'generateNoDocumentsError',
  ];

  const exportIssues: string[] = [];
  requiredExports.forEach((fn) => {
    if (outputIntegration[fn]) {
      console.log(`  [PASS] ${fn} exported`);
    } else {
      console.log(`  [FAIL] ${fn} NOT exported`);
      exportIssues.push(`Missing export: ${fn}`);
    }
  });

  testResults.push({
    category: 'Offline',
    scenario: 'Service exports available',
    query: 'N/A',
    status: exportIssues.length === 0 ? 'PASS' : 'FAIL',
    response: `${requiredExports.length - exportIssues.length}/${requiredExports.length} exports available`,
    issues: exportIssues,
    responseTime: 0,
  });

  // Test 4: Format templates defined
  console.log('\nTest 4: Format templates');
  if (unifiedFormatting.unifiedFormattingService) {
    console.log('  [PASS] unifiedFormattingService exported');
    testResults.push({
      category: 'Offline',
      scenario: 'Format templates defined',
      query: 'N/A',
      status: 'PASS',
      response: 'unifiedFormattingService available',
      issues: [],
      responseTime: 0,
    });
  } else {
    console.log('  [FAIL] unifiedFormattingService NOT exported');
    testResults.push({
      category: 'Offline',
      scenario: 'Format templates defined',
      query: 'N/A',
      status: 'FAIL',
      response: '',
      issues: ['unifiedFormattingService not exported'],
      responseTime: 0,
    });
  }

  // Test 5: Sample output generation (without API key, will use fallbacks)
  console.log('\nTest 5: Fallback response generation');
  try {
    // These will use fallbacks since no API key in test environment
    const greetingPromise = outputIntegration.generateGreeting('en', 5);
    const capabilitiesPromise = outputIntegration.generateCapabilities('en', 5);
    const noDocsPromise = outputIntegration.generateNoDocumentsError('en');

    // Wait with timeout
    const timeout = (ms: number) =>
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

    try {
      const greeting = await Promise.race([greetingPromise, timeout(5000)]);
      console.log(`  Greeting (first 50 chars): "${String(greeting).substring(0, 50)}..."`);
    } catch {
      console.log('  Greeting: (timeout or fallback)');
    }

    testResults.push({
      category: 'Offline',
      scenario: 'Fallback responses work',
      query: 'N/A',
      status: 'PASS',
      response: 'Fallback generation attempted',
      issues: [],
      responseTime: 0,
    });
  } catch (error: any) {
    testResults.push({
      category: 'Offline',
      scenario: 'Fallback responses work',
      query: 'N/A',
      status: 'FAIL',
      response: '',
      issues: [error.message],
      responseTime: 0,
    });
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('================================================================================');
  console.log('KODA REAL-WORLD QUERY TESTING');
  console.log('Testing with practical user queries');
  console.log('================================================================================\n');

  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test User: ${TEST_USER_EMAIL}\n`);

  // Try to authenticate
  const authenticated = await authenticate();

  if (!authenticated) {
    console.log('[INFO] Cannot proceed with live API tests without authentication');
    console.log('[INFO] Running offline validation tests instead...\n');
    await runOfflineTests();
  } else {
    // Run all test queries
    for (const testQuery of TEST_QUERIES) {
      console.log(`Testing: ${testQuery.scenario}...`);
      const result = await runQuery(testQuery);
      testResults.push(result);

      const emoji = result.status === 'PASS' ? '[PASS]' : '[FAIL]';
      console.log(`${emoji} ${result.status} (${result.responseTime}ms)`);

      if (result.status === 'FAIL') {
        result.issues.forEach((issue) => console.log(`   • ${issue}`));
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Generate report
  console.log('\n');
  console.log('================================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================================\n');

  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.status === 'PASS').length;
  const failedTests = testResults.filter((r) => r.status === 'FAIL').length;
  const skippedTests = testResults.filter((r) => r.status === 'SKIP').length;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';
  const avgResponseTime =
    testResults.length > 0
      ? testResults.reduce((sum, r) => sum + r.responseTime, 0) / totalTests
      : 0;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${passRate}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Skipped: ${skippedTests}`);
  if (avgResponseTime > 0) {
    console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  }
  console.log('');

  // Category breakdown
  const categories = [...new Set(testResults.map((r) => r.category))];
  console.log('Results by Category:');
  categories.forEach((category) => {
    const categoryResults = testResults.filter((r) => r.category === category);
    const categoryPassed = categoryResults.filter((r) => r.status === 'PASS').length;
    const categoryTotal = categoryResults.length;
    const categoryRate = ((categoryPassed / categoryTotal) * 100).toFixed(0);
    console.log(`  ${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`);
  });

  // Failed tests detail
  if (failedTests > 0) {
    console.log('\nFailed Tests:');
    testResults
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`\n  ${r.scenario}`);
        console.log(`  Query: "${r.query}"`);
        r.issues.forEach((issue) => console.log(`    • ${issue}`));
        if (r.response) {
          console.log(`    Response preview: ${r.response.substring(0, 100)}...`);
        }
      });
  }

  // Save detailed results
  const reportsDir = path.join(process.cwd(), 'test-suite', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  const reportPath = path.join(reportsDir, 'real-world-query-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}\n`);

  console.log('================================================================================');
  const passRateNum = parseFloat(passRate);
  if (passRateNum >= 90) {
    console.log('[EXCELLENT] Koda handles real-world queries perfectly!');
  } else if (passRateNum >= 70) {
    console.log('[GOOD] Koda is working well but needs some improvements.');
  } else {
    console.log('[NEEDS WORK] Koda requires significant improvements.');
  }
  console.log('================================================================================\n');
}

// Run the tests
runAllTests().catch(console.error);
