/**
 * Test Q&A Without Documents
 * Tests the backend's ability to answer questions without requiring uploaded documents
 * This tests general knowledge, file creation, and AI assistance
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000';
const TEST_USER_ID = 'test-user-qa-' + Date.now();
let authToken = null;

// Test questions covering different scenarios
const TEST_QUESTIONS = [
  {
    category: 'General Knowledge',
    question: 'What is artificial intelligence?',
    expectedKeywords: ['AI', 'machine learning', 'intelligence', 'computer'],
  },
  {
    category: 'General Knowledge',
    question: 'Explain quantum computing in simple terms',
    expectedKeywords: ['quantum', 'computing', 'bits', 'superposition'],
  },
  {
    category: 'File Creation - Markdown',
    question: 'Create a markdown document about blockchain technology',
    expectedKeywords: ['blockchain', 'distributed', 'ledger'],
    expectsFileCreation: true,
  },
  {
    category: 'File Creation - PDF',
    question: 'Create a PDF report about renewable energy sources',
    expectedKeywords: ['renewable', 'energy', 'solar', 'wind'],
    expectsFileCreation: true,
  },
  {
    category: 'File Creation - Presentation',
    question: 'Create a presentation about machine learning basics',
    expectedKeywords: ['machine learning', 'AI', 'training', 'model'],
    expectsFileCreation: true,
  },
  {
    category: 'File Creation - Document',
    question: 'Create a Word document about project management methodologies',
    expectedKeywords: ['project', 'management', 'agile', 'methodology'],
    expectsFileCreation: true,
  },
  {
    category: 'Technical Question',
    question: 'How do I optimize database queries?',
    expectedKeywords: ['database', 'query', 'index', 'optimize', 'performance'],
  },
  {
    category: 'Business Question',
    question: 'What are the key principles of effective leadership?',
    expectedKeywords: ['leadership', 'team', 'communication', 'vision'],
  },
  {
    category: 'Creative Request',
    question: 'Write a short summary of the benefits of cloud computing',
    expectedKeywords: ['cloud', 'scalability', 'cost', 'flexibility'],
  },
  {
    category: 'Math/Calculation',
    question: 'If I have 100 users and each generates 5MB of data per day, how much storage do I need per month?',
    expectedKeywords: ['storage', 'MB', 'GB', 'calculation', 'month'],
  },
];

let passedTests = 0;
let failedTests = 0;
const results = [];

/**
 * Register or login a test user
 */
async function getAuthToken() {
  console.log('🔐 Authenticating test user...');

  // Try to login with default test credentials first
  try {
    const loginResponse = await axios.post(
      `${API_BASE}/api/auth/login`,
      {
        email: 'test@example.com',
        password: 'password123',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    if (loginResponse.data.accessToken) {
      console.log('✅ Logged in successfully');
      console.log('User ID:', loginResponse.data.user.id);
      console.log('');
      return {
        token: loginResponse.data.accessToken,
        userId: loginResponse.data.user.id,
      };
    }
  } catch (loginError) {
    console.log('⚠️  Default login failed, trying admin credentials...');

    // Try admin credentials
    try {
      const adminLoginResponse = await axios.post(
        `${API_BASE}/api/auth/login`,
        {
          email: 'admin@koda.com',
          password: 'admin123',
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      if (adminLoginResponse.data.accessToken) {
        console.log('✅ Logged in as admin');
        console.log('User ID:', adminLoginResponse.data.user.id);
        console.log('');
        return {
          token: adminLoginResponse.data.accessToken,
          userId: adminLoginResponse.data.user.id,
        };
      }
    } catch (adminError) {
      console.error('❌ All authentication attempts failed');
      console.error('Please ensure a test user exists in the database');
      throw new Error('Could not authenticate');
    }
  }

  throw new Error('Authentication failed: No token received');
}

/**
 * Send a question to the RAG endpoint
 */
async function askQuestion(question, userId) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if we have a token
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await axios.post(
      `${API_BASE}/api/rag/chat`,
      {
        query: question,
        userId: userId,
      },
      {
        headers: headers,
        timeout: 60000, // 60 second timeout
      }
    );

    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

/**
 * Test a single question
 */
async function testQuestion(testCase, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📝 Test ${index + 1}/${total}: ${testCase.category}`);
  console.log('='.repeat(80));
  console.log(`Question: "${testCase.question}"`);
  console.log('');

  const startTime = Date.now();
  const result = await askQuestion(testCase.question, TEST_USER_ID);
  const duration = Date.now() - startTime;

  const testResult = {
    category: testCase.category,
    question: testCase.question,
    duration: duration,
    success: result.success,
    status: result.status,
  };

  if (!result.success) {
    console.log('❌ Request Failed');
    console.log('Status:', result.status);
    console.log('Error:', JSON.stringify(result.error, null, 2));
    testResult.passed = false;
    testResult.reason = 'Request failed';
    failedTests++;
    results.push(testResult);
    return;
  }

  console.log('✅ Request Successful');
  console.log('Status:', result.status);
  console.log('Response Time:', duration + 'ms');
  console.log('');

  // Check if it's a file creation request
  if (testCase.expectsFileCreation) {
    if (result.data.actionType === 'file_created' && result.data.file) {
      console.log('📄 File Created:');
      console.log('  Name:', result.data.file.name);
      console.log('  Type:', result.data.file.type);
      console.log('  Size:', result.data.file.size, 'bytes');
      console.log('  URL:', result.data.file.url);

      testResult.passed = true;
      testResult.fileCreated = true;
      testResult.fileName = result.data.file.name;
      testResult.fileSize = result.data.file.size;
      passedTests++;

      console.log('\n✅ PASSED: File created successfully');
    } else {
      console.log('❌ Expected file creation but got:', result.data.actionType);
      testResult.passed = false;
      testResult.reason = 'File not created';
      failedTests++;
    }
  } else {
    // Check for general answer
    const answer = result.data.answer || result.data.response || '';
    console.log('💬 Answer Preview:');
    console.log(answer.substring(0, 300) + (answer.length > 300 ? '...' : ''));
    console.log('');

    // Verify answer contains expected keywords
    const answerLower = answer.toLowerCase();
    const foundKeywords = testCase.expectedKeywords.filter((keyword) =>
      answerLower.includes(keyword.toLowerCase())
    );

    console.log('🔍 Keyword Check:');
    console.log('  Expected:', testCase.expectedKeywords.join(', '));
    console.log('  Found:', foundKeywords.join(', '));

    if (foundKeywords.length > 0) {
      testResult.passed = true;
      testResult.keywordsFound = foundKeywords.length;
      testResult.keywordsTotal = testCase.expectedKeywords.length;
      passedTests++;
      console.log(`\n✅ PASSED: ${foundKeywords.length}/${testCase.expectedKeywords.length} keywords found`);
    } else {
      testResult.passed = false;
      testResult.reason = 'No expected keywords found in answer';
      failedTests++;
      console.log('\n❌ FAILED: No expected keywords found');
    }

    testResult.answer = answer.substring(0, 500);
  }

  results.push(testResult);
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Testing Q&A Without Documents');
  console.log('Backend:', API_BASE);
  console.log('Total Tests:', TEST_QUESTIONS.length);
  console.log('');

  // Check if backend is running
  try {
    await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    console.log('✅ Backend is running\n');
  } catch (error) {
    console.error('❌ Backend is not responding!');
    console.error('Make sure the backend is running on', API_BASE);
    process.exit(1);
  }

  // Get authentication token
  try {
    const auth = await getAuthToken();
    authToken = auth.token;
    console.log('User ID:', auth.userId);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to authenticate');
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Run all tests
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    await testQuestion(TEST_QUESTIONS[i], i, TEST_QUESTIONS.length);

    // Wait 2 seconds between tests to avoid overwhelming the server
    if (i < TEST_QUESTIONS.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  printSummary();
}

/**
 * Print test summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('Total Tests:', TEST_QUESTIONS.length);
  console.log('Passed:', passedTests, '✅');
  console.log('Failed:', failedTests, '❌');
  console.log('Success Rate:', ((passedTests / TEST_QUESTIONS.length) * 100).toFixed(1) + '%');
  console.log('');

  // Group by category
  const byCategory = {};
  results.forEach((result) => {
    if (!byCategory[result.category]) {
      byCategory[result.category] = { passed: 0, failed: 0, total: 0 };
    }
    byCategory[result.category].total++;
    if (result.passed) {
      byCategory[result.category].passed++;
    } else {
      byCategory[result.category].failed++;
    }
  });

  console.log('📈 Results by Category:');
  console.log('');
  Object.entries(byCategory).forEach(([category, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  console.log('');

  // List failed tests
  if (failedTests > 0) {
    console.log('❌ Failed Tests:');
    console.log('');
    results
      .filter((r) => !r.passed)
      .forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.category}: ${result.question.substring(0, 60)}...`);
        console.log(`     Reason: ${result.reason}`);
        console.log('');
      });
  }

  // Average response time
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log('⏱️  Average Response Time:', avgDuration.toFixed(0) + 'ms');
  console.log('');

  // Files created
  const filesCreated = results.filter((r) => r.fileCreated).length;
  if (filesCreated > 0) {
    console.log('📄 Files Created:', filesCreated);
    console.log('');
    results
      .filter((r) => r.fileCreated)
      .forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.fileName} (${result.fileSize} bytes)`);
      });
    console.log('');
  }

  console.log('='.repeat(80));

  if (passedTests === TEST_QUESTIONS.length) {
    console.log('🎉 ALL TESTS PASSED!');
  } else if (passedTests > failedTests) {
    console.log('✅ MOST TESTS PASSED');
  } else {
    console.log('⚠️  MANY TESTS FAILED - CHECK BACKEND LOGS');
  }
  console.log('='.repeat(80));
  console.log('');
}

// Run the tests
runAllTests().catch((error) => {
  console.error('❌ Fatal error running tests:', error);
  process.exit(1);
});
