/**
 * ============================================================================
 * KODA COMPREHENSIVE STRESS TEST SUITE
 * ============================================================================
 * Adapted for Windows and actual documents in the database
 *
 * Tests:
 * 1. Conversation Memory (20 questions - adapted)
 * 2. Data Extraction (20 tests - Excel, PDF, DOCX)
 * 3. File Location (10 tests)
 * 4. Context Understanding (10 tests)
 * 5. Semantic Understanding (10 tests)
 * 6. Navigation (15 tests)
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';

// Load .env from backend
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:5000';
const USER_ID = 'b7fa4bdb-893b-4273-9b7e-dd55ce996e75'; // localhost@koda.com
const USER_EMAIL = 'localhost@koda.com';

// Generate JWT token for authentication
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || '';
if (!JWT_SECRET) {
  console.error('ERROR: JWT_ACCESS_SECRET not found in backend/.env');
  process.exit(1);
}

const AUTH_TOKEN = jwt.sign(
  { userId: USER_ID, email: USER_EMAIL },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const BASE_DIR = 'C:/Users/pedro/OneDrive/Área de Trabalho/web/koda-webapp/STRESS_TESTS';
const RESULTS_DIR = path.join(BASE_DIR, 'results');

// ============================================================================
// TYPES
// ============================================================================

interface TestResult {
  testId: number;
  testName: string;
  category: string;
  question: string;
  response: string;
  responseTime: number;
  passed: boolean;
  errors: string[];
  formatScore: number;
}

interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  total: number;
  score: number;
  avgResponseTime: number;
  avgFormatScore: number;
  results: TestResult[];
}

// ============================================================================
// API HELPER
// ============================================================================

async function queryKoda(query: string, conversationId?: string): Promise<{ answer: string; responseTime: number }> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query,
        userId: USER_ID,
        conversationId
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        timeout: 120000 // 2 minutes timeout
      }
    );

    const responseTime = Date.now() - startTime;
    const answer = response.data.answer || response.data.response || '';

    return { answer, responseTime };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    throw new Error(`API Error (${responseTime}ms): ${error.message}`);
  }
}

// ============================================================================
// FORMAT VALIDATION
// ============================================================================

function validateFormat(markdown: string): { score: number; errors: string[] } {
  const errors: string[] = [];
  let score = 100;

  if (!markdown || markdown.trim().length === 0) {
    return { score: 0, errors: ['Empty response'] };
  }

  // Check title
  const hasTitle = /^##\s+.+$/m.test(markdown);
  if (!hasTitle) {
    errors.push('Missing title (## format)');
    score -= 15;
  }

  // Check sections
  const sections = (markdown.match(/^###\s+/gm) || []).length;
  if (sections < 1) {
    errors.push('No sections found');
    score -= 10;
  }

  // Check bullets (should use • not - or *)
  const wrongBullets = markdown.match(/^[\-\*]\s+/gm);
  if (wrongBullets && wrongBullets.length > 0) {
    errors.push(`Wrong bullet format (${wrongBullets.length} instances)`);
    score -= 5;
  }

  // Check word count
  const wordCount = markdown.split(/\s+/).length;
  if (wordCount < 50) {
    errors.push(`Response too short: ${wordCount} words`);
    score -= 20;
  }

  // Check for multiple blank lines
  if (/\n{3,}/.test(markdown)) {
    errors.push('Multiple consecutive blank lines');
    score -= 5;
  }

  return { score: Math.max(0, score), errors };
}

// ============================================================================
// TEST 1: CONVERSATION MEMORY (20 Questions)
// ============================================================================

async function runConversationMemoryTest(): Promise<TestSuiteResult> {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: CONVERSATION MEMORY (20 Questions)');
  console.log('='.repeat(80));

  const conversationId = `stress_test_${Date.now()}`;
  const outputDir = path.join(RESULTS_DIR, '01_conversation');
  fs.mkdirSync(outputDir, { recursive: true });

  const questions = [
    // Phase 1: Initial Context Building (Q1-5)
    { id: 1, q: "What World Bank indicators do you have data for? List the main ones.", category: "data_extraction" },
    { id: 2, q: "What research papers about financial topics do you have?", category: "data_extraction" },
    { id: 3, q: "Tell me about the Koda Business Plan documents.", category: "data_extraction" },
    { id: 4, q: "What interview documents are available?", category: "data_extraction" },
    { id: 5, q: "What is GDP growth data showing for major economies?", category: "analysis" },

    // Phase 2: Medium-term memory (Q6-12)
    { id: 6, q: "Going back to question 1, which World Bank indicator relates to CO2 emissions?", category: "recall" },
    { id: 7, q: "From the research papers you mentioned in question 2, which ones discuss machine learning?", category: "recall" },
    { id: 8, q: "What was the main focus of the Koda Business Plan from question 3?", category: "recall" },
    { id: 9, q: "Compare the GDP indicators with the CO2 emissions data we discussed earlier.", category: "comparison" },
    { id: 10, q: "Based on the interviews from question 4, what topics are covered?", category: "recall" },
    { id: 11, q: "What renewable energy indicators are available and how do they relate to CO2?", category: "cross_reference" },
    { id: 12, q: "Summarize all the document types we've discussed so far.", category: "synthesis" },

    // Phase 3: Long-term memory (Q13-17)
    { id: 13, q: "What exact World Bank indicators did you list in question 1?", category: "extreme_recall" },
    { id: 14, q: "From question 2, which financial research paper had the longest title?", category: "extreme_recall" },
    { id: 15, q: "Combine the business plan insights from question 3 with interview themes from question 4.", category: "synthesis" },
    { id: 16, q: "What are the top 3 most interesting patterns across all documents we've discussed?", category: "analysis" },
    { id: 17, q: "Create a summary of our entire conversation including all key data points.", category: "synthesis" },

    // Phase 4: Extreme recall (Q18-20)
    { id: 18, q: "List all questions I've asked you in this conversation.", category: "meta_recall" },
    { id: 19, q: "What was the first piece of data you mentioned in this conversation?", category: "extreme_recall" },
    { id: 20, q: "Based on everything we've discussed, what recommendations would you make for someone researching global economic trends?", category: "final_synthesis" }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const q of questions) {
    console.log(`\nQ${q.id}: ${q.q.substring(0, 60)}...`);

    try {
      const { answer, responseTime } = await queryKoda(q.q, conversationId);
      const { score: formatScore, errors: formatErrors } = validateFormat(answer);

      const testErrors: string[] = [...formatErrors];

      // Check for empty or too short response
      if (!answer || answer.trim().length < 50) {
        testErrors.push('Response too short or empty');
      }

      // Check for missing context indicators
      const missingContextPhrases = [
        "i don't have that information",
        "i don't recall",
        "i cannot find",
        "no information about"
      ];

      for (const phrase of missingContextPhrases) {
        if (answer.toLowerCase().includes(phrase)) {
          testErrors.push(`Missing context: "${phrase}"`);
        }
      }

      const testPassed = testErrors.length === 0;
      if (testPassed) passed++; else failed++;

      console.log(`  ${testPassed ? '✅' : '❌'} ${responseTime}ms | Format: ${formatScore}%`);
      if (testErrors.length > 0) {
        console.log(`  Errors: ${testErrors.slice(0, 2).join(', ')}`);
      }

      // Save response
      fs.writeFileSync(
        path.join(outputDir, `q${String(q.id).padStart(2, '0')}_response.md`),
        answer
      );

      results.push({
        testId: q.id,
        testName: `Q${q.id}: ${q.category}`,
        category: q.category,
        question: q.q,
        response: answer,
        responseTime,
        passed: testPassed,
        errors: testErrors,
        formatScore
      });

      // Wait between questions
      await new Promise(r => setTimeout(r, 2000));

    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        testId: q.id,
        testName: `Q${q.id}: ${q.category}`,
        category: q.category,
        question: q.q,
        response: '',
        responseTime: 0,
        passed: false,
        errors: [error.message],
        formatScore: 0
      });
    }
  }

  const score = (passed / questions.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const avgFormatScore = results.reduce((sum, r) => sum + r.formatScore, 0) / results.length;

  // Save report
  const report = generateReport('Conversation Memory', results, score, avgFormatScore);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), report);

  return { name: 'Conversation Memory', passed, failed, total: questions.length, score, avgResponseTime, avgFormatScore, results };
}

// ============================================================================
// TEST 2: DATA EXTRACTION (20 Tests)
// ============================================================================

async function runDataExtractionTest(): Promise<TestSuiteResult> {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: DATA EXTRACTION (20 Tests)');
  console.log('='.repeat(80));

  const outputDir = path.join(RESULTS_DIR, '02_data_extraction');
  fs.mkdirSync(outputDir, { recursive: true });

  const tests = [
    // Excel tests (World Bank data)
    { id: 1, q: "What is the GDP growth rate for the United States in 2020 from worldbank_NY.GDP.MKTP.KD.ZG.xlsx?", category: "excel" },
    { id: 2, q: "Extract the CO2 emissions per capita data for China from worldbank_EN.ATM.CO2E.PC.xlsx", category: "excel" },
    { id: 3, q: "What is the population data for India from worldbank_SP.POP.TOTL.xlsx?", category: "excel" },
    { id: 4, q: "Show me the inflation rates from worldbank_FP.CPI.TOTL.ZG.xlsx for 2019-2022", category: "excel" },
    { id: 5, q: "What does the worldbank_EG.FEC.RNEW.ZS indicator measure and what are recent values?", category: "excel" },
    { id: 6, q: "Extract unemployment data from worldbank_SL.UEM.TOTL.ZS.xlsx", category: "excel" },
    { id: 7, q: "Compare GDP per capita between countries using worldbank_NY.GDP.PCAP.CD.xlsx", category: "excel" },

    // PDF tests
    { id: 8, q: "What is the title and abstract of the paper about supply chain resilience?", category: "pdf" },
    { id: 9, q: "Extract the methodology section from any financial research PDF", category: "pdf" },
    { id: 10, q: "What conclusions are drawn in the neural network paper?", category: "pdf" },
    { id: 11, q: "How many references are cited in the fuzzy neural network paper?", category: "pdf" },
    { id: 12, q: "What are the key findings from any paper about machine learning?", category: "pdf" },

    // DOCX tests
    { id: 13, q: "What are the main sections in the Koda Business Plan?", category: "docx" },
    { id: 14, q: "Extract key financial metrics from any business document", category: "docx" },
    { id: 15, q: "What topics are discussed in the interview documents?", category: "docx" },
    { id: 16, q: "What is the VINES Framework document about?", category: "docx" },
    { id: 17, q: "Extract any tables from the supplementary information documents", category: "docx" },

    // Cross-format tests
    { id: 18, q: "Compare financial data across Excel and PDF documents", category: "cross_format" },
    { id: 19, q: "What economic indicators are mentioned across different document types?", category: "cross_format" },
    { id: 20, q: "Summarize the main data themes across all document formats", category: "cross_format" }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nTest ${test.id}: ${test.q.substring(0, 50)}...`);

    try {
      const { answer, responseTime } = await queryKoda(test.q);
      const { score: formatScore, errors: formatErrors } = validateFormat(answer);

      const testErrors: string[] = [...formatErrors];

      // Check for extraction failure indicators
      const failureIndicators = [
        "cannot find",
        "not available",
        "unable to extract",
        "no data found"
      ];

      for (const indicator of failureIndicators) {
        if (answer.toLowerCase().includes(indicator)) {
          testErrors.push(`Extraction failure: "${indicator}"`);
        }
      }

      // Category-specific validation
      if (test.category === 'excel' && !answer.match(/\d+/)) {
        testErrors.push('Expected numeric data but none found');
      }

      const testPassed = testErrors.length === 0 && answer.length > 100;
      if (testPassed) passed++; else failed++;

      console.log(`  ${testPassed ? '✅' : '❌'} ${responseTime}ms | Format: ${formatScore}%`);

      fs.writeFileSync(
        path.join(outputDir, `test${String(test.id).padStart(2, '0')}_response.md`),
        answer
      );

      results.push({
        testId: test.id,
        testName: `Test ${test.id}: ${test.category}`,
        category: test.category,
        question: test.q,
        response: answer,
        responseTime,
        passed: testPassed,
        errors: testErrors,
        formatScore
      });

      await new Promise(r => setTimeout(r, 2000));

    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        testId: test.id,
        testName: `Test ${test.id}: ${test.category}`,
        category: test.category,
        question: test.q,
        response: '',
        responseTime: 0,
        passed: false,
        errors: [error.message],
        formatScore: 0
      });
    }
  }

  const score = (passed / tests.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const avgFormatScore = results.reduce((sum, r) => sum + r.formatScore, 0) / results.length;

  const report = generateReport('Data Extraction', results, score, avgFormatScore);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), report);

  return { name: 'Data Extraction', passed, failed, total: tests.length, score, avgResponseTime, avgFormatScore, results };
}

// ============================================================================
// TEST 3: FILE LOCATION (10 Tests)
// ============================================================================

async function runFileLocationTest(): Promise<TestSuiteResult> {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: FILE LOCATION (10 Tests)');
  console.log('='.repeat(80));

  const outputDir = path.join(RESULTS_DIR, '03_file_location');
  fs.mkdirSync(outputDir, { recursive: true });

  const tests = [
    { id: 1, q: "Which document contains GDP growth data?", expected: "worldbank" },
    { id: 2, q: "Where can I find information about CO2 emissions?", expected: "worldbank" },
    { id: 3, q: "Which file has the Koda business plan?", expected: "Business Plan" },
    { id: 4, q: "What document discusses the VINES Framework?", expected: "VINES" },
    { id: 5, q: "Which PDFs are about machine learning or neural networks?", expected: "neural" },
    { id: 6, q: "Where are the interview transcripts stored?", expected: "Interview" },
    { id: 7, q: "Which World Bank file has population data?", expected: "SP.POP" },
    { id: 8, q: "What document contains supply chain research?", expected: "Supply Chain" },
    { id: 9, q: "Which files discuss financial topics?", expected: "financial" },
    { id: 10, q: "List all World Bank Excel files available", expected: "worldbank" }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nTest ${test.id}: ${test.q}`);

    try {
      const { answer, responseTime } = await queryKoda(test.q);
      const { score: formatScore, errors: formatErrors } = validateFormat(answer);

      const testErrors: string[] = [...formatErrors];

      // Check if expected file/term is mentioned
      if (!answer.toLowerCase().includes(test.expected.toLowerCase())) {
        testErrors.push(`Expected "${test.expected}" not found in response`);
      }

      const testPassed = testErrors.length === 0;
      if (testPassed) passed++; else failed++;

      console.log(`  ${testPassed ? '✅' : '❌'} ${responseTime}ms`);

      results.push({
        testId: test.id,
        testName: `Location ${test.id}`,
        category: 'file_location',
        question: test.q,
        response: answer,
        responseTime,
        passed: testPassed,
        errors: testErrors,
        formatScore
      });

      await new Promise(r => setTimeout(r, 1500));

    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        testId: test.id,
        testName: `Location ${test.id}`,
        category: 'file_location',
        question: test.q,
        response: '',
        responseTime: 0,
        passed: false,
        errors: [error.message],
        formatScore: 0
      });
    }
  }

  const score = (passed / tests.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const avgFormatScore = results.reduce((sum, r) => sum + r.formatScore, 0) / results.length;

  const report = generateReport('File Location', results, score, avgFormatScore);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), report);

  return { name: 'File Location', passed, failed, total: tests.length, score, avgResponseTime, avgFormatScore, results };
}

// ============================================================================
// TEST 4: CONTEXT UNDERSTANDING (10 Tests)
// ============================================================================

async function runContextUnderstandingTest(): Promise<TestSuiteResult> {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: CONTEXT UNDERSTANDING (10 Tests)');
  console.log('='.repeat(80));

  const outputDir = path.join(RESULTS_DIR, '04_context');
  fs.mkdirSync(outputDir, { recursive: true });

  const tests = [
    { id: 1, q: "What is the relationship between GDP growth and CO2 emissions based on the World Bank data?", category: "cross_document" },
    { id: 2, q: "How do the business documents relate to each other?", category: "relationship" },
    { id: 3, q: "What common themes appear across the research papers?", category: "theme" },
    { id: 4, q: "Compare the economic indicators across different countries", category: "comparison" },
    { id: 5, q: "What time periods are covered across all documents?", category: "temporal" },
    { id: 6, q: "How do the interview documents complement the business plan?", category: "relationship" },
    { id: 7, q: "What global trends can you identify from the World Bank data?", category: "analysis" },
    { id: 8, q: "What research methodologies are used across the PDF papers?", category: "methodology" },
    { id: 9, q: "How has population growth affected other economic indicators?", category: "causal" },
    { id: 10, q: "Summarize the main insights from analyzing all documents together", category: "synthesis" }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nTest ${test.id}: ${test.q.substring(0, 50)}...`);

    try {
      const { answer, responseTime } = await queryKoda(test.q);
      const { score: formatScore, errors: formatErrors } = validateFormat(answer);

      const testErrors: string[] = [...formatErrors];

      // Check for meaningful context
      if (answer.length < 100) {
        testErrors.push('Response too short for context understanding');
      }

      if (answer.toLowerCase().includes("i don't have")) {
        testErrors.push('Missing context indication');
      }

      const testPassed = testErrors.length === 0;
      if (testPassed) passed++; else failed++;

      console.log(`  ${testPassed ? '✅' : '❌'} ${responseTime}ms`);

      results.push({
        testId: test.id,
        testName: `Context ${test.id}`,
        category: test.category,
        question: test.q,
        response: answer,
        responseTime,
        passed: testPassed,
        errors: testErrors,
        formatScore
      });

      await new Promise(r => setTimeout(r, 2000));

    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        testId: test.id,
        testName: `Context ${test.id}`,
        category: test.category,
        question: test.q,
        response: '',
        responseTime: 0,
        passed: false,
        errors: [error.message],
        formatScore: 0
      });
    }
  }

  const score = (passed / tests.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const avgFormatScore = results.reduce((sum, r) => sum + r.formatScore, 0) / results.length;

  const report = generateReport('Context Understanding', results, score, avgFormatScore);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), report);

  return { name: 'Context Understanding', passed, failed, total: tests.length, score, avgResponseTime, avgFormatScore, results };
}

// ============================================================================
// TEST 5: SEMANTIC UNDERSTANDING (10 Tests)
// ============================================================================

async function runSemanticUnderstandingTest(): Promise<TestSuiteResult> {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: SEMANTIC UNDERSTANDING (10 Tests)');
  console.log('='.repeat(80));

  const outputDir = path.join(RESULTS_DIR, '05_semantic');
  fs.mkdirSync(outputDir, { recursive: true });

  const tests = [
    { id: 1, q: "Find documents about economic development", category: "semantic_search" },
    { id: 2, q: "Show me research on artificial intelligence", category: "semantic_search" },
    { id: 3, q: "What files discuss environmental sustainability?", category: "semantic_search" },
    { id: 4, q: "Find information about business strategy", category: "semantic_search" },
    { id: 5, q: "Show me data about poverty and inequality", category: "semantic_search" },
    { id: 6, q: "What documents talk about healthcare metrics?", category: "semantic_search" },
    { id: 7, q: "Find research about optimization algorithms", category: "semantic_search" },
    { id: 8, q: "Show me files related to education statistics", category: "semantic_search" },
    { id: 9, q: "What documents discuss international trade?", category: "semantic_search" },
    { id: 10, q: "Find information about demographic changes", category: "semantic_search" }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nTest ${test.id}: ${test.q}`);

    try {
      const { answer, responseTime } = await queryKoda(test.q);
      const { score: formatScore, errors: formatErrors } = validateFormat(answer);

      const testErrors: string[] = [...formatErrors];

      // Semantic search should return relevant results
      if (answer.length < 100) {
        testErrors.push('Response too short');
      }

      if (!answer.toLowerCase().includes('document') && !answer.toLowerCase().includes('file') && !answer.toLowerCase().includes('data')) {
        testErrors.push('No document references in response');
      }

      const testPassed = testErrors.length === 0;
      if (testPassed) passed++; else failed++;

      console.log(`  ${testPassed ? '✅' : '❌'} ${responseTime}ms`);

      results.push({
        testId: test.id,
        testName: `Semantic ${test.id}`,
        category: test.category,
        question: test.q,
        response: answer,
        responseTime,
        passed: testPassed,
        errors: testErrors,
        formatScore
      });

      await new Promise(r => setTimeout(r, 1500));

    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        testId: test.id,
        testName: `Semantic ${test.id}`,
        category: test.category,
        question: test.q,
        response: '',
        responseTime: 0,
        passed: false,
        errors: [error.message],
        formatScore: 0
      });
    }
  }

  const score = (passed / tests.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const avgFormatScore = results.reduce((sum, r) => sum + r.formatScore, 0) / results.length;

  const report = generateReport('Semantic Understanding', results, score, avgFormatScore);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), report);

  return { name: 'Semantic Understanding', passed, failed, total: tests.length, score, avgResponseTime, avgFormatScore, results };
}

// ============================================================================
// TEST 6: NAVIGATION (15 Tests - 1 per file type sample)
// ============================================================================

async function runNavigationTest(): Promise<TestSuiteResult> {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: NAVIGATION (15 Tests)');
  console.log('='.repeat(80));

  const outputDir = path.join(RESULTS_DIR, '06_navigation');
  fs.mkdirSync(outputDir, { recursive: true });

  const tests = [
    // Excel files
    { id: 1, file: "worldbank_NY.GDP.MKTP.KD.ZG.xlsx", q: "What is in worldbank_NY.GDP.MKTP.KD.ZG.xlsx?" },
    { id: 2, file: "worldbank_EN.ATM.CO2E.PC.xlsx", q: "What data does worldbank_EN.ATM.CO2E.PC.xlsx contain?" },
    { id: 3, file: "worldbank_SP.POP.TOTL.xlsx", q: "Describe the contents of worldbank_SP.POP.TOTL.xlsx" },
    { id: 4, file: "worldbank_FP.CPI.TOTL.ZG.xlsx", q: "What is in the inflation data file?" },
    { id: 5, file: "worldbank_SL.UEM.TOTL.ZS.xlsx", q: "What unemployment data is available?" },

    // PDF files
    { id: 6, file: "Supply Chain PDF", q: "What is the reverse stress testing supply chain paper about?" },
    { id: 7, file: "Neural Network PDF", q: "What is the fuzzy neural network paper about?" },
    { id: 8, file: "Financial PDF", q: "What research papers discuss financial modeling?" },
    { id: 9, file: "Optimization PDF", q: "What papers discuss optimization algorithms?" },
    { id: 10, file: "ML PDF", q: "What machine learning research is available?" },

    // DOCX files
    { id: 11, file: "Koda Business Plan", q: "What is in the Koda Business Plan document?" },
    { id: 12, file: "VINES Framework", q: "What is the VINES Framework document about?" },
    { id: 13, file: "Interview docs", q: "What are the interview documents about?" },
    { id: 14, file: "Supplementary info", q: "What supplementary information documents exist?" },
    { id: 15, file: "All files", q: "Give me an overview of all available documents" }
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\nTest ${test.id} (${test.file}): ${test.q.substring(0, 40)}...`);

    try {
      const { answer, responseTime } = await queryKoda(test.q);
      const { score: formatScore, errors: formatErrors } = validateFormat(answer);

      const testErrors: string[] = [...formatErrors];

      // Check file is accessible
      if (answer.length < 50) {
        testErrors.push('Response too short - file may not be accessible');
      }

      if (answer.toLowerCase().includes("cannot find") || answer.toLowerCase().includes("not found")) {
        testErrors.push('File not found');
      }

      const testPassed = testErrors.length === 0;
      if (testPassed) passed++; else failed++;

      console.log(`  ${testPassed ? '✅' : '❌'} ${responseTime}ms`);

      results.push({
        testId: test.id,
        testName: test.file,
        category: 'navigation',
        question: test.q,
        response: answer,
        responseTime,
        passed: testPassed,
        errors: testErrors,
        formatScore
      });

      await new Promise(r => setTimeout(r, 1500));

    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
      failed++;
      results.push({
        testId: test.id,
        testName: test.file,
        category: 'navigation',
        question: test.q,
        response: '',
        responseTime: 0,
        passed: false,
        errors: [error.message],
        formatScore: 0
      });
    }
  }

  const score = (passed / tests.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const avgFormatScore = results.reduce((sum, r) => sum + r.formatScore, 0) / results.length;

  const report = generateReport('Navigation', results, score, avgFormatScore);
  fs.writeFileSync(path.join(outputDir, 'REPORT.md'), report);

  return { name: 'Navigation', passed, failed, total: tests.length, score, avgResponseTime, avgFormatScore, results };
}

// ============================================================================
// REPORT GENERATOR
// ============================================================================

function generateReport(testName: string, results: TestResult[], score: number, avgFormatScore: number): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return `# ${testName.toUpperCase()} TEST REPORT

**Date:** ${new Date().toLocaleString()}
**Total Tests:** ${results.length}

---

## SUMMARY

| Metric | Value |
|--------|-------|
| **Score** | **${score.toFixed(2)}%** |
| **Format Score** | **${avgFormatScore.toFixed(2)}%** |
| **Passed** | ${passed} |
| **Failed** | ${failed} |

---

## RESULT

${score === 100 ? '✅ **PASSED** - All tests successful' : '❌ **FAILED** - Some tests did not pass'}

---

## DETAILED RESULTS

${results.map(r => `
### Test ${r.testId} - ${r.passed ? '✅ PASSED' : '❌ FAILED'}

**Question:** ${r.question}
**Response Time:** ${r.responseTime}ms
**Format Score:** ${r.formatScore}%

${r.errors.length > 0 ? `**Errors:**\n${r.errors.map(e => `- ${e}`).join('\n')}` : ''}

**Response Preview:** ${r.response.substring(0, 200)}...

---
`).join('\n')}
`;
}

// ============================================================================
// MASTER REPORT GENERATOR
// ============================================================================

function generateMasterReport(suites: TestSuiteResult[]): void {
  const totalTests = suites.reduce((sum, s) => sum + s.total, 0);
  const totalPassed = suites.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = suites.reduce((sum, s) => sum + s.failed, 0);
  const overallScore = (totalPassed / totalTests) * 100;
  const avgFormatScore = suites.reduce((sum, s) => sum + s.avgFormatScore, 0) / suites.length;

  const allPassed = suites.every(s => s.score === 100);
  const formatPassed = avgFormatScore >= 90;
  const canRelease = allPassed && formatPassed;

  const report = `# KODA COMPREHENSIVE STRESS TEST - MASTER REPORT

**Date:** ${new Date().toLocaleString()}
**Total Tests:** ${totalTests}

---

## OVERALL RESULTS

| Metric | Value |
|--------|-------|
| **Overall Score** | **${overallScore.toFixed(2)}%** |
| **Format Score** | **${avgFormatScore.toFixed(2)}%** |
| **Total Passed** | ${totalPassed} |
| **Total Failed** | ${totalFailed} |
| **Release Ready** | **${canRelease ? '✅ YES' : '❌ NO'}** |

---

## TEST SUITE BREAKDOWN

| Test Suite | Passed | Failed | Total | Score | Avg Response Time |
|------------|--------|--------|-------|-------|-------------------|
${suites.map(s => `| ${s.name} | ${s.passed} | ${s.failed} | ${s.total} | **${s.score.toFixed(1)}%** | ${s.avgResponseTime.toFixed(0)}ms |`).join('\n')}

---

## RELEASE CRITERIA

1. ${allPassed ? '✅' : '❌'} All tests must score 100%
2. ${formatPassed ? '✅' : '❌'} Format score must be ≥ 90%

### Status

${canRelease ? `
✅ **KODA CAN BE RELEASED**

All tests passed with proper formatting.
` : `
❌ **KODA CANNOT BE RELEASED**

${!allPassed ? `
**Failed Test Suites:**
${suites.filter(s => s.score < 100).map(s => `- ${s.name}: ${s.score.toFixed(1)}% (${s.failed} failed)`).join('\n')}
` : ''}

${!formatPassed ? `
**Format Issues:** Average score ${avgFormatScore.toFixed(1)}% (required: ≥ 90%)
` : ''}
`}

---

## RECOMMENDATIONS

${overallScore < 100 ? `
1. Review failed test reports in results/ directory
2. Fix empty response issues
3. Improve context retention
4. Re-run stress tests
` : `
✅ All systems functioning correctly
`}

---

**End of Master Report**
`;

  fs.writeFileSync(path.join(RESULTS_DIR, 'MASTER_REPORT.md'), report);

  console.log('\n' + '='.repeat(80));
  console.log('MASTER REPORT');
  console.log('='.repeat(80));
  console.log(`\n📊 Overall Score: ${overallScore.toFixed(2)}%`);
  console.log(`📝 Format Score: ${avgFormatScore.toFixed(2)}%`);
  console.log(`✅ Passed: ${totalPassed}/${totalTests}`);
  console.log(`❌ Failed: ${totalFailed}/${totalTests}`);
  console.log(`\n🚀 Release Ready: ${canRelease ? '✅ YES' : '❌ NO'}`);
  console.log(`\n📄 Full report: ${path.join(RESULTS_DIR, 'MASTER_REPORT.md')}`);
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  console.log('🚀 KODA COMPREHENSIVE STRESS TEST SUITE');
  console.log('='.repeat(80));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`User: ${USER_ID}`);
  console.log(`Results: ${RESULTS_DIR}`);
  console.log('');

  // Verify API is running
  try {
    const health = await axios.get(`${API_BASE_URL}/api/health`);
    console.log(`✅ API Health: ${health.data.status}`);
  } catch (error) {
    console.error('❌ API not responding. Please start the backend first.');
    process.exit(1);
  }

  const startTime = Date.now();
  const suites: TestSuiteResult[] = [];

  // Run all test suites
  suites.push(await runConversationMemoryTest());
  suites.push(await runDataExtractionTest());
  suites.push(await runFileLocationTest());
  suites.push(await runContextUnderstandingTest());
  suites.push(await runSemanticUnderstandingTest());
  suites.push(await runNavigationTest());

  const totalTime = Date.now() - startTime;
  console.log(`\n⏱️ Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);

  // Generate master report
  generateMasterReport(suites);
}

// Run
runAllTests()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test runner failed:', error);
    process.exit(1);
  });
