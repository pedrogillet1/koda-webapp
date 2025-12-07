/**
 * Extreme Stress Test Suite
 *
 * 50 comprehensive tests across 11 categories against 35 real documents.
 * Tests the full capabilities of Koda's RAG system.
 */

import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'localhost@koda.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'localhost123';

let authToken: string = '';
let conversationId: string = '';

async function createConversation(): Promise<string> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/conversations`,
      { title: `Test ${Date.now()}` },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 10000,
      }
    );
    return response.data.id;
  } catch (error: any) {
    console.log('[WARN] Failed to create conversation:', error.message);
    return '';
  }
}

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

interface TestQuery {
  id: number;
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
    mustBeInLanguage?: string;
  };
  newConversation?: boolean;
}

const TEST_QUERIES: TestQuery[] = [
  // ============================================================================
  // CATEGORY 1: SIMPLE RETRIEVAL (8 tests)
  // ============================================================================
  {
    id: 1,
    category: 'Simple Retrieval',
    scenario: 'Ask for document titles',
    query: 'what are the titles of my documents?',
    language: 'en',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['based on the provided context', 'as an AI'],
      minLength: 20,
    },
  },
  {
    id: 2,
    category: 'Simple Retrieval',
    scenario: 'Ask for specific topic',
    query: 'do I have any documents about technology?',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['based on the provided context'],
      minLength: 10,
    },
  },
  {
    id: 3,
    category: 'Simple Retrieval',
    scenario: 'Count documents',
    query: 'how many documents do I have?',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['as an AI language model'],
      minLength: 5,
    },
  },
  {
    id: 4,
    category: 'Simple Retrieval',
    scenario: 'Ask about recent uploads',
    query: 'what was the last document I uploaded?',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['I cannot', "I don't have access"],
    },
  },
  {
    id: 5,
    category: 'Simple Retrieval',
    scenario: 'Search by keyword',
    query: 'find documents mentioning "data"',
    language: 'en',
    expectedType: 'search_results',
    validationRules: {
      mustNotContain: ['based on the provided context'],
    },
  },
  {
    id: 6,
    category: 'Simple Retrieval',
    scenario: 'Ask about file types',
    query: 'what types of files do I have? PDFs, docs, etc?',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {},
  },
  {
    id: 7,
    category: 'Simple Retrieval',
    scenario: 'Portuguese document list',
    query: 'liste meus documentos',
    language: 'pt',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['You have', 'Here are your'],
      mustBeInLanguage: 'pt',
    },
  },
  {
    id: 8,
    category: 'Simple Retrieval',
    scenario: 'Spanish document count',
    query: 'cuantos documentos tengo?',
    language: 'es',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['You have', 'documents'],
      mustBeInLanguage: 'es',
    },
  },

  // ============================================================================
  // CATEGORY 2: INTERMEDIATE ANALYSIS (7 tests)
  // ============================================================================
  {
    id: 9,
    category: 'Intermediate Analysis',
    scenario: 'Summarize a document',
    query: 'summarize the main points of my first document',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 100,
      mustNotContain: ['based on the provided context'],
    },
  },
  {
    id: 10,
    category: 'Intermediate Analysis',
    scenario: 'Compare documents',
    query: 'what do my documents have in common?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 50,
    },
  },
  {
    id: 11,
    category: 'Intermediate Analysis',
    scenario: 'Extract key themes',
    query: 'what are the main themes across all my documents?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 50,
    },
  },
  {
    id: 12,
    category: 'Intermediate Analysis',
    scenario: 'Find contradictions',
    query: 'are there any contradicting information in my documents?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 13,
    category: 'Intermediate Analysis',
    scenario: 'Timeline extraction',
    query: 'create a timeline of events mentioned in my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 14,
    category: 'Intermediate Analysis',
    scenario: 'Portuguese summary',
    query: 'faça um resumo dos meus documentos',
    language: 'pt',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['Here is', 'Summary:'],
      mustBeInLanguage: 'pt',
    },
  },
  {
    id: 15,
    category: 'Intermediate Analysis',
    scenario: 'French analysis',
    query: 'analysez le contenu de mes documents',
    language: 'fr',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['Here is', 'Analysis:'],
      mustBeInLanguage: 'fr',
    },
  },

  // ============================================================================
  // CATEGORY 3: COMPLEX SYNTHESIS (7 tests)
  // ============================================================================
  {
    id: 16,
    category: 'Complex Synthesis',
    scenario: 'Generate report',
    query: 'generate a comprehensive report from all my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 200,
    },
  },
  {
    id: 17,
    category: 'Complex Synthesis',
    scenario: 'Create outline',
    query: 'create an outline combining key points from all documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 100,
    },
  },
  {
    id: 18,
    category: 'Complex Synthesis',
    scenario: 'Identify gaps',
    query: 'what topics are missing or underrepresented in my documents?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 19,
    category: 'Complex Synthesis',
    scenario: 'Generate questions',
    query: 'based on my documents, what questions should I be asking?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 50,
    },
  },
  {
    id: 20,
    category: 'Complex Synthesis',
    scenario: 'Executive summary',
    query: 'write an executive summary suitable for a board meeting',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 150,
    },
  },
  {
    id: 21,
    category: 'Complex Synthesis',
    scenario: 'Action items',
    query: 'extract all action items and recommendations from my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 22,
    category: 'Complex Synthesis',
    scenario: 'Portuguese synthesis',
    query: 'crie um relatório executivo baseado nos meus documentos',
    language: 'pt',
    expectedType: 'complex_answer',
    validationRules: {
      mustBeInLanguage: 'pt',
    },
  },

  // ============================================================================
  // CATEGORY 4: ADVANCED REASONING (4 tests)
  // ============================================================================
  {
    id: 23,
    category: 'Advanced Reasoning',
    scenario: 'Cause and effect',
    query: 'what cause-and-effect relationships can you identify in my documents?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 24,
    category: 'Advanced Reasoning',
    scenario: 'Predictions',
    query: 'based on the information in my documents, what predictions can you make?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      mustNotContain: ['as an AI language model', 'I cannot predict'],
    },
  },
  {
    id: 25,
    category: 'Advanced Reasoning',
    scenario: 'Assumptions',
    query: 'what assumptions are made in my documents?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 26,
    category: 'Advanced Reasoning',
    scenario: 'Implications',
    query: 'what are the broader implications of the information in my documents?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },

  // ============================================================================
  // CATEGORY 5: NAVIGATION & CONVERSATIONAL (8 tests)
  // ============================================================================
  {
    id: 27,
    category: 'Navigation',
    scenario: 'Greeting English',
    query: 'hello',
    language: 'en',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ["I'm KODA, your AI document assistant"],
      maxLength: 200,
    },
    newConversation: true,
  },
  {
    id: 28,
    category: 'Navigation',
    scenario: 'Greeting Portuguese',
    query: 'oi',
    language: 'pt',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!'],
      maxLength: 200,
      mustBeInLanguage: 'pt',
    },
    newConversation: true,
  },
  {
    id: 29,
    category: 'Navigation',
    scenario: 'Greeting Spanish',
    query: 'hola',
    language: 'es',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!'],
      maxLength: 200,
      mustBeInLanguage: 'es',
    },
    newConversation: true,
  },
  {
    id: 30,
    category: 'Navigation',
    scenario: 'Greeting French',
    query: 'bonjour',
    language: 'fr',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!'],
      maxLength: 200,
      mustBeInLanguage: 'fr',
    },
    newConversation: true,
  },
  {
    id: 31,
    category: 'Navigation',
    scenario: 'Capabilities query',
    query: 'what can you do?',
    language: 'en',
    expectedType: 'capabilities',
    validationRules: {
      mustNotContain: ["I'm KODA, your AI document assistant. I can help you:"],
      maxLength: 500,
    },
    newConversation: true,
  },
  {
    id: 32,
    category: 'Navigation',
    scenario: 'Help request',
    query: 'help me',
    language: 'en',
    expectedType: 'capabilities',
    validationRules: {
      maxLength: 500,
    },
    newConversation: true,
  },
  {
    id: 33,
    category: 'Navigation',
    scenario: 'Goodbye English',
    query: 'goodbye',
    language: 'en',
    expectedType: 'farewell',
    validationRules: {
      maxLength: 150,
    },
    newConversation: true,
  },
  {
    id: 34,
    category: 'Navigation',
    scenario: 'Thank you',
    query: 'thanks for your help',
    language: 'en',
    expectedType: 'farewell',
    validationRules: {
      maxLength: 150,
    },
    newConversation: true,
  },

  // ============================================================================
  // CATEGORY 6: MULTI-DOCUMENT QUERIES (3 tests)
  // ============================================================================
  {
    id: 35,
    category: 'Multi-Document',
    scenario: 'Cross-reference',
    query: 'cross-reference information between my newest and oldest documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 36,
    category: 'Multi-Document',
    scenario: 'Merge information',
    query: 'merge the key information from all my documents into one summary',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {
      minLength: 100,
    },
  },
  {
    id: 37,
    category: 'Multi-Document',
    scenario: 'Find patterns',
    query: 'identify recurring patterns or phrases across my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },

  // ============================================================================
  // CATEGORY 7: DATA EXTRACTION (2 tests)
  // ============================================================================
  {
    id: 38,
    category: 'Data Extraction',
    scenario: 'Extract numbers',
    query: 'extract all numbers and statistics from my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 39,
    category: 'Data Extraction',
    scenario: 'Extract names',
    query: 'list all people, companies, or organizations mentioned in my documents',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },

  // ============================================================================
  // CATEGORY 8: MULTILINGUAL (4 tests)
  // ============================================================================
  {
    id: 40,
    category: 'Multilingual',
    scenario: 'German greeting',
    query: 'guten tag',
    language: 'de',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!'],
      maxLength: 200,
    },
    newConversation: true,
  },
  {
    id: 41,
    category: 'Multilingual',
    scenario: 'Italian question',
    query: 'quali documenti ho?',
    language: 'it',
    expectedType: 'file_listing',
    validationRules: {
      mustNotContain: ['You have', 'Here are'],
    },
  },
  {
    id: 42,
    category: 'Multilingual',
    scenario: 'Japanese greeting',
    query: 'こんにちは',
    language: 'ja',
    expectedType: 'greeting',
    validationRules: {
      mustNotContain: ['Hello', 'Hi!'],
      maxLength: 200,
    },
    newConversation: true,
  },
  {
    id: 43,
    category: 'Multilingual',
    scenario: 'Chinese question',
    query: '我有多少文件？',
    language: 'zh',
    expectedType: 'simple_answer',
    validationRules: {
      mustNotContain: ['You have', 'documents'],
    },
  },

  // ============================================================================
  // CATEGORY 9: CONVERSATION FLOW (3 tests)
  // ============================================================================
  {
    id: 44,
    category: 'Conversation Flow',
    scenario: 'Follow-up question',
    query: 'tell me more about that',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 45,
    category: 'Conversation Flow',
    scenario: 'Clarification request',
    query: 'can you be more specific?',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },
  {
    id: 46,
    category: 'Conversation Flow',
    scenario: 'Change topic',
    query: 'actually, let me ask something else - what documents do I have about finance?',
    language: 'en',
    expectedType: 'simple_answer',
    validationRules: {},
  },

  // ============================================================================
  // CATEGORY 10: ERROR HANDLING (3 tests)
  // ============================================================================
  {
    id: 47,
    category: 'Error Handling',
    scenario: 'Empty query',
    query: '',
    language: 'en',
    expectedType: 'error',
    validationRules: {},
  },
  {
    id: 48,
    category: 'Error Handling',
    scenario: 'Gibberish query',
    query: 'asdfghjkl zxcvbnm qwertyuiop',
    language: 'en',
    expectedType: 'clarification',
    validationRules: {
      mustNotContain: ['Error', 'error', 'Invalid'],
    },
  },
  {
    id: 49,
    category: 'Error Handling',
    scenario: 'Very long query',
    query: 'I want to know everything about all my documents including every single detail and every piece of information that you can extract from them without leaving anything out and please make sure to cover all aspects and topics and themes and ideas and concepts and data points and statistics and numbers and names and dates and locations and events and relationships and connections and patterns and trends and insights and conclusions and recommendations and action items and next steps',
    language: 'en',
    expectedType: 'complex_answer',
    validationRules: {},
  },

  // ============================================================================
  // CATEGORY 11: META (1 test)
  // ============================================================================
  {
    id: 50,
    category: 'Meta',
    scenario: 'Ask about Koda',
    query: 'who are you?',
    language: 'en',
    expectedType: 'capabilities',
    validationRules: {
      maxLength: 500,
    },
    newConversation: true,
  },
];

// ============================================================================
// TEST EXECUTION
// ============================================================================

interface TestResult {
  id: number;
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
    console.log(`Authenticating to ${API_BASE_URL}...`);
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      },
      { timeout: 30000 }
    );

    authToken = response.data.accessToken || response.data.token;
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

  // Create new conversation if needed
  if (testQuery.newConversation || !conversationId) {
    conversationId = await createConversation();
  }

  // Skip empty query test
  if (testQuery.query === '') {
    return {
      id: testQuery.id,
      category: testQuery.category,
      scenario: testQuery.scenario,
      query: testQuery.query,
      status: 'SKIP',
      response: '',
      issues: ['Empty query - skipped'],
      responseTime: 0,
    };
  }

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

    // Validation checks
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
      id: testQuery.id,
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
      id: testQuery.id,
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
  console.log('='.repeat(80));
  console.log('KODA EXTREME STRESS TEST SUITE');
  console.log('50 Comprehensive Tests | 11 Categories | 35 Real Documents');
  console.log('='.repeat(80));
  console.log(`\nAPI: ${API_BASE_URL}`);
  console.log(`User: ${TEST_USER_EMAIL}\n`);

  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('\n[INFO] Cannot run tests without authentication');
    console.log('[INFO] Make sure the backend is running and credentials are correct\n');
    return;
  }

  let currentCategory = '';

  for (const testQuery of TEST_QUERIES) {
    // Print category header when it changes
    if (testQuery.category !== currentCategory) {
      currentCategory = testQuery.category;
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`CATEGORY: ${currentCategory.toUpperCase()}`);
      console.log('─'.repeat(60));
    }

    console.log(`\n[${testQuery.id}/50] ${testQuery.scenario}...`);
    console.log(`  Query: "${testQuery.query.substring(0, 50)}${testQuery.query.length > 50 ? '...' : ''}"`);

    const result = await runQuery(testQuery);
    testResults.push(result);

    const emoji = result.status === 'PASS' ? '[PASS]' : result.status === 'SKIP' ? '[SKIP]' : '[FAIL]';
    console.log(`  ${emoji} (${result.responseTime}ms)`);

    if (result.status === 'FAIL') {
      result.issues.forEach((issue) => console.log(`    - ${issue}`));
    }

    if (result.response) {
      const preview = result.response.substring(0, 60).replace(/\n/g, ' ');
      console.log(`  Response: "${preview}..."`);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const totalTests = testResults.length;
  const passedTests = testResults.filter((r) => r.status === 'PASS').length;
  const failedTests = testResults.filter((r) => r.status === 'FAIL').length;
  const skippedTests = testResults.filter((r) => r.status === 'SKIP').length;
  const passRate = totalTests > 0 ? ((passedTests / (totalTests - skippedTests)) * 100).toFixed(1) : '0';
  const avgTime = testResults.filter((r) => r.responseTime > 0).reduce((s, r) => s + r.responseTime, 0) / (totalTests - skippedTests);

  console.log(`\nTotal: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${passRate}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Skipped: ${skippedTests}`);
  console.log(`Avg Response Time: ${avgTime.toFixed(0)}ms`);

  // By category
  const categories = [...new Set(testResults.map((r) => r.category))];
  console.log('\nBy Category:');
  categories.forEach((cat) => {
    const catResults = testResults.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.status === 'PASS').length;
    const catTotal = catResults.filter((r) => r.status !== 'SKIP').length;
    const catRate = catTotal > 0 ? ((catPassed / catTotal) * 100).toFixed(0) : '0';
    console.log(`  ${cat}: ${catPassed}/${catTotal} (${catRate}%)`);
  });

  // Failed tests
  if (failedTests > 0) {
    console.log('\nFailed Tests:');
    testResults
      .filter((r) => r.status === 'FAIL')
      .forEach((r) => {
        console.log(`  [${r.id}] ${r.scenario}`);
        r.issues.forEach((i) => console.log(`      - ${i}`));
      });
  }

  // Save results
  const reportsDir = path.join(process.cwd(), 'test-suite', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, 'extreme-stress-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nResults saved to: ${reportPath}`);

  // Final verdict
  console.log('\n' + '='.repeat(80));
  const passRateNum = parseFloat(passRate);
  if (passRateNum >= 95) {
    console.log('[EXCELLENT] Koda is performing exceptionally well!');
  } else if (passRateNum >= 85) {
    console.log('[GREAT] Koda is performing very well with minor issues.');
  } else if (passRateNum >= 70) {
    console.log('[GOOD] Koda is working but needs some improvements.');
  } else if (passRateNum >= 50) {
    console.log('[FAIR] Koda has significant issues that need attention.');
  } else {
    console.log('[NEEDS WORK] Koda has major issues requiring immediate attention.');
  }
  console.log('='.repeat(80) + '\n');
}

runAllTests().catch(console.error);
