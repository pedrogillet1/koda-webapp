/**
 * Integration Tests - Intent Detection with Real Data
 *
 * Tests the RAG system's ability to:
 * 1. Correctly detect query intent
 * 2. Apply appropriate format rules
 * 3. Return properly formatted responses
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const TEST_USER_EMAIL = 'localhost@koda.com';
const TEST_USER_PASSWORD = 'localhost123';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: string;
  response?: string;
}

const results: TestResult[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

async function authenticate(): Promise<string> {
  console.log('Authenticating...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    console.log('Authenticated successfully');
    return response.data.accessToken;
  } catch (error: any) {
    console.log('Login failed:', error.response?.data?.error || error.message);
    throw error;
  }
}

async function createConversation(authToken: string): Promise<string> {
  const response = await axios.post(
    `${API_BASE_URL}/chat/conversations`,
    { title: 'Integration Test - Intent Detection' },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  return response.data.id;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

async function testGreetingFormat(authToken: string, conversationId: string) {
  console.log('\nTest: Greeting format (simple, no title)');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      { query: 'Hello', conversationId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const answer = response.data.answer;
    const hasTitle = /^#{1,2}\s+/.test(answer.trim());
    const isShort = answer.length < 500;

    const passed = !hasTitle && isShort;

    results.push({
      test: 'Greeting format (no title)',
      passed,
      details: passed ? undefined : `hasTitle: ${hasTitle}, length: ${answer.length}`,
      response: answer.substring(0, 200)
    });
  } catch (error: any) {
    results.push({
      test: 'Greeting format (no title)',
      passed: false,
      error: error.response?.data?.error || error.message
    });
  }
}

async function testCapabilityFormat(authToken: string, conversationId: string) {
  console.log('\nTest: Capability query format');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      { query: 'What can you do?', conversationId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const answer = response.data.answer;
    // Capability answers should be conversational
    const isConversational = /I can|I'm able|I help|you can ask/i.test(answer);

    results.push({
      test: 'Capability query format',
      passed: isConversational,
      details: isConversational ? undefined : 'Response not conversational',
      response: answer.substring(0, 200)
    });
  } catch (error: any) {
    results.push({
      test: 'Capability query format',
      passed: false,
      error: error.response?.data?.error || error.message
    });
  }
}

async function testDataQueryFormat(authToken: string, conversationId: string) {
  console.log('\nTest: Data query format (complex, with title)');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      { query: 'Show me all documents and their contents', conversationId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const answer = response.data.answer;
    // Complex queries should have structured format (title or sections)
    const hasStructure = /^#{1,2}\s+/.test(answer.trim()) ||
                         /#{2,3}\s+/m.test(answer) ||
                         /^[-*]\s+/m.test(answer);

    results.push({
      test: 'Data query format (structured)',
      passed: hasStructure,
      details: hasStructure ? undefined : 'Response lacks structure',
      response: answer.substring(0, 300)
    });
  } catch (error: any) {
    results.push({
      test: 'Data query format (structured)',
      passed: false,
      error: error.response?.data?.error || error.message
    });
  }
}

async function testYesNoQuestionFormat(authToken: string, conversationId: string) {
  console.log('\nTest: Yes/No question format (simple)');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      { query: 'Do you understand Portuguese?', conversationId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const answer = response.data.answer;
    const hasTitle = /^#{1,2}\s+/.test(answer.trim());
    // Yes/No answers should be simple and direct
    const passed = !hasTitle && answer.length < 1000;

    results.push({
      test: 'Yes/No question format (no title)',
      passed,
      details: passed ? undefined : `hasTitle: ${hasTitle}, length: ${answer.length}`,
      response: answer.substring(0, 200)
    });
  } catch (error: any) {
    results.push({
      test: 'Yes/No question format (no title)',
      passed: false,
      error: error.response?.data?.error || error.message
    });
  }
}

async function testAnalysisQueryFormat(authToken: string, conversationId: string) {
  console.log('\nTest: Analysis query format (complex)');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      { query: 'Analyze the key themes across all my documents and provide insights', conversationId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const answer = response.data.answer;
    // Analysis should have sections or bullet points
    const hasStructure = /#{2,3}\s+/m.test(answer) ||
                         (answer.match(/^[-*]\s+/gm) || []).length >= 2;

    results.push({
      test: 'Analysis query format (structured)',
      passed: hasStructure,
      details: hasStructure ? undefined : 'Analysis response lacks structure',
      response: answer.substring(0, 300)
    });
  } catch (error: any) {
    results.push({
      test: 'Analysis query format (structured)',
      passed: false,
      error: error.response?.data?.error || error.message
    });
  }
}

async function testNoExcessiveBlankLines(authToken: string, conversationId: string) {
  console.log('\nTest: No excessive blank lines in responses');

  try {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      { query: 'List all the main topics from my documents', conversationId },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    const answer = response.data.answer;
    // Check for 3+ consecutive newlines
    const hasExcessiveBlankLines = /\n{3,}/.test(answer);

    results.push({
      test: 'No excessive blank lines',
      passed: !hasExcessiveBlankLines,
      details: hasExcessiveBlankLines ? 'Found 3+ consecutive newlines' : undefined,
      response: answer.substring(0, 200)
    });
  } catch (error: any) {
    results.push({
      test: 'No excessive blank lines',
      passed: false,
      error: error.response?.data?.error || error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('='.repeat(70));
  console.log('INTEGRATION TESTS - INTENT DETECTION WITH REAL DATA');
  console.log('='.repeat(70));
  console.log('');

  let authToken: string;
  let conversationId: string;

  try {
    authToken = await authenticate();
    conversationId = await createConversation(authToken);
    console.log(`Created test conversation: ${conversationId}`);
  } catch (error: any) {
    console.error('Failed to set up test environment:', error.message);
    process.exit(1);
  }

  // Run tests sequentially to avoid rate limiting
  await testGreetingFormat(authToken, conversationId);
  await testCapabilityFormat(authToken, conversationId);
  await testYesNoQuestionFormat(authToken, conversationId);
  await testDataQueryFormat(authToken, conversationId);
  await testAnalysisQueryFormat(authToken, conversationId);
  await testNoExcessiveBlankLines(authToken, conversationId);

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS');
  console.log('='.repeat(70));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const icon = result.passed ? '\u2713' : '\u2717';
    console.log(`${icon} [${status}] ${result.test}`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`   Details: ${result.details}`);
    }
    if (result.response && !result.passed) {
      console.log(`   Response preview: ${result.response}...`);
    }

    if (result.passed) passed++;
    else failed++;
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
