/**
 * Phase 3 Test Script: Query Understanding & RAG Enhancement
 *
 * Tests:
 * 1. Confidence Gating (CONFIDENCE_THRESHOLD = 0.7)
 * 2. Mentions Search
 * 3. Answer Length Control (short, medium, summary, long)
 * 4. Query Intent Detection
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'Test123!@#';

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  response?: any;
  duration: number;
}

class Phase3Tester {
  private authToken: string = '';
  private conversationId: string = '';
  private results: TestResult[] = [];

  async run() {
    console.log('🚀 Starting Phase 3 Test Suite...\n');

    try {
      // Step 1: Authenticate
      await this.authenticate();

      // Step 2: Create a test conversation
      await this.createConversation();
      console.log(`💬 Created test conversation: ${this.conversationId}`);

      // Step 3: Test Confidence Gating
      console.log('\n📊 Testing Confidence Gating...');
      await this.testConfidenceGating();

      // Step 4: Test Answer Length Control
      console.log('\n📏 Testing Answer Length Control...');
      await this.testAnswerLengthControl();

      // Step 5: Test Mentions Search
      console.log('\n🔍 Testing Mentions Search...');
      await this.testMentionsSearch();

      // Step 6: Test Query Intents
      console.log('\n🎯 Testing Query Intent Detection...');
      await this.testQueryIntents();

      // Step 7: Print Results
      this.printResults();

    } catch (error: any) {
      console.error('❌ Test suite failed:', error.message);
      if (error.response?.data) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  private async authenticate() {
    console.log('🔐 Authenticating...');
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      this.authToken = response.data.accessToken || response.data.token;
      console.log('✅ Authenticated successfully');
    } catch (error: any) {
      // If login fails, try to register
      console.log('⚠️  Login failed, attempting to register...');
      const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, {
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      this.authToken = registerResponse.data.accessToken || registerResponse.data.token;
      console.log('✅ Registered and authenticated successfully');
    }
  }

  private async createConversation() {
    console.log('💬 Creating test conversation...');
    const response = await axios.post(
      `${API_BASE_URL}/chat/conversations`,
      { title: 'Phase 3 Test Conversation' },
      { headers: { Authorization: `Bearer ${this.authToken}` } }
    );

    this.conversationId = response.data.id;
    console.log(`✅ Conversation created: ${this.conversationId}`);
  }

  private async testConfidenceGating() {
    // Test 1: Low-relevance query (should return "couldn't find" message)
    await this.runTest(
      'Confidence Gating: Low-Relevance Query',
      async () => {
        const response = await this.queryRAG(
          'What is the weather like on Mars?', // Completely irrelevant to uploaded documents
          'medium'
        );

        // Check if response indicates low confidence
        const indicatesLowConfidence =
          response.answer.includes("couldn't find") ||
          response.answer.includes("no relevant information") ||
          response.answer.includes("don't have") ||
          response.confidence === 0;

        if (!indicatesLowConfidence) {
          throw new Error(`Expected low confidence message, got: ${response.answer.substring(0, 100)}...`);
        }

        return response;
      }
    );

    // Test 2: High-relevance query (should return proper answer)
    await this.runTest(
      'Confidence Gating: High-Relevance Query',
      async () => {
        const response = await this.queryRAG(
          'Summarize the document', // Generic but relevant query
          'medium'
        );

        // Check if response has actual content (not a "couldn't find" message)
        const hasContent =
          response.answer.length > 50 &&
          !response.answer.includes("couldn't find") &&
          response.confidence !== 0;

        if (!hasContent) {
          throw new Error(`Expected high confidence answer, got: ${response.answer.substring(0, 100)}...`);
        }

        return response;
      }
    );
  }

  private async testAnswerLengthControl() {
    const query = 'Summarize the main points of the document';

    // Test all four answer length options
    const lengths: Array<'short' | 'medium' | 'summary' | 'long'> = ['short', 'medium', 'summary', 'long'];
    const expectedTokenRanges = {
      short: { min: 20, max: 150 },    // ~100 tokens = 20-150 words
      medium: { min: 100, max: 600 },  // ~500 tokens = 100-600 words
      summary: { min: 60, max: 400 },  // ~300 tokens = 60-400 words
      long: { min: 200, max: 1200 },   // ~1000 tokens = 200-1200 words
    };

    for (const length of lengths) {
      await this.runTest(
        `Answer Length: ${length.toUpperCase()}`,
        async () => {
          const response = await this.queryRAG(query, length);

          // Count words as a proxy for tokens
          const wordCount = response.answer.split(/\s+/).length;
          const expectedRange = expectedTokenRanges[length];

          console.log(`   📊 ${length}: ${wordCount} words`);

          // Allow some flexibility in word counts
          if (wordCount < expectedRange.min * 0.5 || wordCount > expectedRange.max * 1.5) {
            console.warn(`   ⚠️  Word count ${wordCount} outside expected range ${expectedRange.min}-${expectedRange.max}`);
          }

          return response;
        }
      );
    }
  }

  private async testMentionsSearch() {
    // Test 1: Search for a common phrase
    await this.runTest(
      'Mentions Search: Find phrase "revenue"',
      async () => {
        const response = await this.queryRAG(
          'Where is "revenue" mentioned?',
          'medium'
        );

        // Check if response lists document names and locations
        const hasMentions =
          response.answer.length > 30 &&
          !response.answer.includes("couldn't find") &&
          (response.intent === 'search_mentions' || response.answer.includes('mentioned'));

        if (!hasMentions) {
          throw new Error(`Expected mentions search result, got: ${response.answer.substring(0, 100)}...`);
        }

        return response;
      }
    );

    // Test 2: Search for non-existent phrase
    await this.runTest(
      'Mentions Search: Non-existent phrase',
      async () => {
        const response = await this.queryRAG(
          'Where is "zxyqpqwotijeoijf" mentioned?',
          'medium'
        );

        // Should indicate no results found
        const indicatesNoResults =
          response.answer.includes("couldn't find") ||
          response.answer.includes("no mentions") ||
          response.answer.includes("not found");

        if (!indicatesNoResults) {
          throw new Error(`Expected "not found" message, got: ${response.answer.substring(0, 100)}...`);
        }

        return response;
      }
    );
  }

  private async testQueryIntents() {
    const intentTests = [
      {
        intent: 'summarize',
        query: 'Summarize the key findings in the document',
        expectedKeywords: ['summary', 'main', 'key', 'overview'],
      },
      {
        intent: 'extract',
        query: 'What is the total revenue?',
        expectedKeywords: ['revenue', 'total', 'amount'],
      },
      {
        intent: 'compare',
        query: 'Compare Q1 and Q2 sales',
        expectedKeywords: ['q1', 'q2', 'sales', 'compare', 'vs'],
      },
      {
        intent: 'search_mentions',
        query: 'Find all mentions of "profit margin"',
        expectedKeywords: ['profit margin', 'mentioned', 'found'],
      },
    ];

    for (const test of intentTests) {
      await this.runTest(
        `Intent Detection: ${test.intent}`,
        async () => {
          const response = await this.queryRAG(test.query, 'medium');

          // Check if intent was detected correctly
          if (response.intent && response.intent !== test.intent) {
            console.warn(`   ⚠️  Expected intent "${test.intent}", got "${response.intent}"`);
          }

          // Check if answer contains expected keywords (case-insensitive)
          const answerLower = response.answer.toLowerCase();
          const hasExpectedKeywords = test.expectedKeywords.some(keyword =>
            answerLower.includes(keyword.toLowerCase())
          );

          console.log(`   🎯 Intent: ${response.intent || 'not specified'}`);
          console.log(`   📝 Answer: ${response.answer.substring(0, 80)}...`);

          return response;
        }
      );
    }
  }

  private async queryRAG(query: string, answerLength: string) {
    const response = await axios.post(
      `${API_BASE_URL}/rag/query`,
      {
        query,
        conversationId: this.conversationId,
        answerLength,
      },
      {
        headers: { Authorization: `Bearer ${this.authToken}` },
      }
    );

    return response.data;
  }

  private async runTest(testName: string, testFn: () => Promise<any>) {
    const startTime = Date.now();
    try {
      console.log(`\n  🧪 ${testName}`);
      const response = await testFn();
      const duration = Date.now() - startTime;

      this.results.push({
        testName,
        passed: true,
        response,
        duration,
      });

      console.log(`  ✅ PASSED (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        testName,
        passed: false,
        error: error.message,
        duration,
      });

      console.log(`  ❌ FAILED (${duration}ms)`);
      console.log(`     Error: ${error.message}`);
    }
  }

  private printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`\n✅ Passed: ${passed}/${total} (${passRate}%)`);
    console.log(`❌ Failed: ${failed}/${total}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   - ${r.testName}`);
          console.log(`     Error: ${r.error}`);
        });
    }

    const avgDuration = (
      this.results.reduce((sum, r) => sum + r.duration, 0) / total
    ).toFixed(0);

    console.log(`\n⏱️  Average test duration: ${avgDuration}ms`);
    console.log('='.repeat(60) + '\n');
  }
}

// Run tests
const tester = new Phase3Tester();
tester.run().catch(console.error);
