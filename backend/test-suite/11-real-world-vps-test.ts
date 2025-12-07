/**
 * Real-World Query Testing Script (VPS Version)
 *
 * This script tests Koda with real, practical user queries against the VPS.
 */

import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION - VPS
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'https://koda.bfranca.com';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'pedrobffranca@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

let authToken: string = '';
let conversationId: string | null = null;

// ============================================================================
// TEST QUERIES
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
  // CONVERSATIONAL
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
      minLength: 50,
      maxLength: 500,
      shouldHaveBullets: false,
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

  // FILE ACTIONS
  {
    category: 'File Actions',
    scenario: 'User asks which documents they have',
    query: 'which documents do I have',
    language: 'en',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['Vous avez', 'Astuce:', 'Que souhaitez-vous savoir'],
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

  // SIMPLE RAG
  {
    category: 'Simple RAG',
    scenario: 'User asks for specific information',
    query: 'what is the main topic of my documents',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['based on the provided context', 'as an AI language model'],
      maxLength: 500,
    },
  },

  // MULTILINGUAL
  {
    category: 'Multilingual',
    scenario: 'Spanish greeting',
    query: 'hola',
    language: 'es',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!', "I'm KODA"],
      maxLength: 200,
    },
  },
  {
    category: 'Multilingual',
    scenario: 'French greeting',
    query: 'bonjour',
    language: 'fr',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!', "I'm KODA"],
      maxLength: 200,
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
  if (!TEST_USER_PASSWORD) {
    console.log('[SKIP] No password provided - set TEST_USER_PASSWORD env var');
    return false;
  }

  try {
    console.log(`Authenticating to ${API_BASE_URL}...`);
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      { timeout: 30000 }
    );

    authToken = response.data.token;
    console.log('[PASS] Authentication successful\n');
    return true;
  } catch (error: any) {
    console.log('[FAIL] Authentication failed:', error.message);
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
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
        timeout: 120000,
      }
    );

    const responseTime = Date.now() - startTime;
    const output = response.data.answer || response.data.message || response.data.response || '';

    if (response.data.conversationId) {
      conversationId = response.data.conversationId;
    }

    const rules = testQuery.validationRules;

    if (rules.mustNotContain) {
      rules.mustNotContain.forEach((phrase) => {
        if (output.toLowerCase().includes(phrase.toLowerCase())) {
          issues.push(`Contains forbidden: "${phrase}"`);
        }
      });
    }

    if (rules.mustContain) {
      rules.mustContain.forEach((phrase) => {
        if (!output.toLowerCase().includes(phrase.toLowerCase())) {
          issues.push(`Missing required: "${phrase}"`);
        }
      });
    }

    if (rules.maxLength && output.length > rules.maxLength) {
      issues.push(`Too long: ${output.length} chars (max: ${rules.maxLength})`);
    }

    if (rules.minLength && output.length < rules.minLength) {
      issues.push(`Too short: ${output.length} chars (min: ${rules.minLength})`);
    }

    if (rules.shouldHaveBullets === true && !/^[-•*]\s/m.test(output)) {
      issues.push('Expected bullet points');
    }

    if (rules.shouldHaveBullets === false && /^[-•*]\s/m.test(output)) {
      issues.push('Should not have bullets');
    }

    return {
      category: testQuery.category,
      scenario: testQuery.scenario,
      query: testQuery.query,
      status: issues.length === 0 ? 'PASS' : 'FAIL',
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

async function runAllTests(): Promise<void> {
  console.log('\n');
  console.log('='.repeat(70));
  console.log('KODA REAL-WORLD QUERY TESTING (VPS)');
  console.log('='.repeat(70));
  console.log(`\nAPI: ${API_BASE_URL}`);
  console.log(`User: ${TEST_USER_EMAIL}\n`);

  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('\n[INFO] Cannot run live tests without authentication');
    console.log('[INFO] Set TEST_USER_PASSWORD environment variable\n');
    return;
  }

  for (const testQuery of TEST_QUERIES) {
    console.log(`Testing: ${testQuery.scenario}...`);
    const result = await runQuery(testQuery);
    testResults.push(result);

    const emoji = result.status === 'PASS' ? '[PASS]' : '[FAIL]';
    console.log(`  ${emoji} (${result.responseTime}ms)`);

    if (result.status === 'FAIL') {
      result.issues.forEach((issue) => console.log(`    - ${issue}`));
    }

    if (result.response) {
      console.log(`    Response: "${result.response.substring(0, 80)}..."`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n');
  console.log('='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));

  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.status === 'PASS').length;
  const failedTests = testResults.filter((r) => r.status === 'FAIL').length;
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';
  const avgTime = testResults.reduce((s, r) => s + r.responseTime, 0) / totalTests;

  console.log(`\nTotal: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${passRate}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Avg Response Time: ${avgTime.toFixed(0)}ms`);

  const categories = [...new Set(testResults.map((r) => r.category))];
  console.log('\nBy Category:');
  categories.forEach((cat) => {
    const catResults = testResults.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.status === 'PASS').length;
    console.log(`  ${cat}: ${catPassed}/${catResults.length}`);
  });

  if (failedTests > 0) {
    console.log('\nFailed Tests:');
    testResults
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  - ${r.scenario}`);
        r.issues.forEach((i) => console.log(`    ${i}`));
      });
  }

  // Save results
  const reportsDir = path.join(process.cwd(), 'test-suite', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, 'vps-real-world-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nResults saved to: ${reportPath}`);

  console.log('\n' + '='.repeat(70));
  if (parseFloat(passRate) >= 90) {
    console.log('[EXCELLENT] VPS is handling queries correctly!');
  } else if (parseFloat(passRate) >= 70) {
    console.log('[GOOD] VPS is working but some improvements needed.');
  } else {
    console.log('[NEEDS WORK] VPS has significant issues.');
  }
  console.log('='.repeat(70) + '\n');
}

runAllTests().catch(console.error);
