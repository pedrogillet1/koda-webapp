/**
 * Test Suite for Your Uploaded Documents
 *
 * Documents:
 * 1. ICP_Koda_Formatado (1).docx
 * 2. Koda Presentation English (1).pptx
 * 3. Koda blueprint (1).docx
 * 4. Lone Mountain Ranch P&L 2025 (Budget).xlsx
 * 5. 32d0f47e-162b-4081-abba-7d5500c49c39.jpg
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const USER_EMAIL = 'pedro@example.com'; // Change this to your actual email
const USER_PASSWORD = 'your-password'; // Change this to your actual password

interface TestResult {
  category: string;
  question: string;
  answerLength: string;
  passed: boolean;
  answer?: string;
  error?: string;
  duration: number;
  wordCount?: number;
  confidence?: number;
  intent?: string;
}

class DocumentTester {
  private authToken: string = '';
  private conversationId: string = '';
  private results: TestResult[] = [];

  async run() {
    console.log('🚀 Testing Your Uploaded Documents\n');
    console.log('=' .repeat(80) + '\n');

    try {
      await this.authenticate();
      await this.createConversation();
      await this.runAllTests();
      this.printResults();
    } catch (error: any) {
      console.error('❌ Test failed:', error.message);
    }
  }

  private async authenticate() {
    console.log('🔐 Authenticating...');

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: USER_EMAIL,
        password: USER_PASSWORD,
      });

      this.authToken = response.data.accessToken || response.data.token;
      console.log('✅ Authenticated successfully\n');
    } catch (error) {
      // Try to use the test user
      console.log('⚠️  Login failed, trying test user...');
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      this.authToken = response.data.accessToken || response.data.token;
      console.log('✅ Authenticated with test user\n');
    }
  }

  private async createConversation() {
    console.log('💬 Creating conversation...');

    const response = await axios.post(
      `${API_BASE_URL}/chat/conversations`,
      { title: 'Document Test Suite' },
      { headers: { Authorization: `Bearer ${this.authToken}` } }
    );

    this.conversationId = response.data.id;
    console.log(`✅ Conversation: ${this.conversationId}\n`);
  }

  private async runAllTests() {
    // Test 1: ICP Document Questions
    console.log('📄 TESTING: ICP_Koda_Formatado.docx');
    console.log('-'.repeat(80));

    await this.test('ICP Document', 'What is the Ideal Customer Profile for KODA?', 'medium');
    await this.test('ICP Document', 'Summarize the target market segments', 'summary');
    await this.test('ICP Document', 'What are the key pain points KODA addresses?', 'long');

    // Test 2: Presentation Questions
    console.log('\n📊 TESTING: Koda Presentation English.pptx');
    console.log('-'.repeat(80));

    await this.test('Presentation', 'What is KODA about?', 'short');
    await this.test('Presentation', 'Describe the main features of KODA', 'medium');
    await this.test('Presentation', 'What is the business model?', 'summary');

    // Test 3: Blueprint Questions
    console.log('\n📘 TESTING: Koda blueprint.docx');
    console.log('-'.repeat(80));

    await this.test('Blueprint', 'What is the technical architecture?', 'medium');
    await this.test('Blueprint', 'Summarize the development roadmap', 'summary');
    await this.test('Blueprint', 'What are the core features?', 'short');

    // Test 4: Budget Spreadsheet Questions
    console.log('\n💰 TESTING: Lone Mountain Ranch P&L 2025.xlsx');
    console.log('-'.repeat(80));

    await this.test('Budget', 'What are the major expense categories?', 'summary');
    await this.test('Budget', 'What is the total budget?', 'short');
    await this.test('Budget', 'Summarize the revenue projections', 'medium');

    // Test 5: Phase 3 Feature Tests
    console.log('\n✨ TESTING: Phase 3 Features');
    console.log('-'.repeat(80));

    // Answer Length Control
    console.log('\n  📏 Answer Length Control:');
    await this.test('Length: Short', 'Tell me about KODA', 'short');
    await this.test('Length: Medium', 'Tell me about KODA', 'medium');
    await this.test('Length: Long', 'Tell me about KODA', 'long');

    // Mentions Search
    console.log('\n  🔍 Mentions Search:');
    await this.test('Mentions', 'Where is "revenue" mentioned?', 'medium');
    await this.test('Mentions', 'Find all mentions of "customer"', 'medium');

    // Intent Detection
    console.log('\n  🎯 Intent Detection:');
    await this.test('Intent', 'Compare the ICP and blueprint documents', 'medium');
    await this.test('Intent', 'Extract the total budget amount', 'short');

    // Confidence Gating
    console.log('\n  🚫 Confidence Gating (should fail):');
    await this.test('Confidence', 'What is the weather on Mars?', 'medium');
    await this.test('Confidence', 'Tell me about quantum physics', 'medium');
  }

  private async test(category: string, question: string, answerLength: string) {
    const startTime = Date.now();

    try {
      console.log(`\n  Q: ${question}`);
      console.log(`     Length: ${answerLength}`);

      const response = await axios.post(
        `${API_BASE_URL}/rag/query`,
        {
          query: question,
          conversationId: this.conversationId,
          answerLength,
        },
        {
          headers: { Authorization: `Bearer ${this.authToken}` },
          timeout: 30000, // 30 second timeout
        }
      );

      const duration = Date.now() - startTime;
      const answer = response.data.answer || response.data.assistantMessage?.content || '';
      const confidence = response.data.confidence;
      const intent = response.data.intent;
      const wordCount = answer.split(/\s+/).length;

      this.results.push({
        category,
        question,
        answerLength,
        passed: true,
        answer: answer.substring(0, 200),
        duration,
        wordCount,
        confidence,
        intent,
      });

      console.log(`  ✅ PASSED (${duration}ms)`);
      console.log(`     Words: ${wordCount} | Confidence: ${confidence?.toFixed(2) || 'N/A'} | Intent: ${intent || 'N/A'}`);
      console.log(`     Answer: ${answer.substring(0, 120)}${answer.length > 120 ? '...' : ''}`);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        category,
        question,
        answerLength,
        passed: false,
        error: error.message,
        duration,
      });

      console.log(`  ❌ FAILED (${duration}ms)`);
      console.log(`     Error: ${error.message}`);
      if (error.response?.data?.error) {
        console.log(`     Details: ${error.response.data.error}`);
      }
    }
  }

  private printResults() {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80) + '\n');

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`✅ Passed: ${passed}/${total} (${passRate}%)`);
    console.log(`❌ Failed: ${failed}/${total}`);

    if (passed > 0) {
      const avgDuration = (
        this.results
          .filter(r => r.passed)
          .reduce((sum, r) => sum + r.duration, 0) / passed
      ).toFixed(0);

      console.log(`⏱️  Average response time: ${avgDuration}ms`);
    }

    // Group by category
    const byCategory = this.results.reduce((acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    }, {} as { [key: string]: TestResult[] });

    console.log('\n📋 Results by Category:\n');

    for (const [category, results] of Object.entries(byCategory)) {
      const catPassed = results.filter(r => r.passed).length;
      const catTotal = results.length;
      const status = catPassed === catTotal ? '✅' : catPassed > 0 ? '⚠️' : '❌';

      console.log(`${status} ${category}: ${catPassed}/${catTotal} passed`);
    }

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   - [${r.category}] ${r.question}`);
          console.log(`     ${r.error}`);
        });
    }

    // Show sample answers
    if (passed > 0) {
      console.log('\n✨ Sample Successful Responses:\n');
      this.results
        .filter(r => r.passed && r.answer)
        .slice(0, 3)
        .forEach((r, idx) => {
          console.log(`${idx + 1}. [${r.category}] ${r.question}`);
          console.log(`   ${r.answer}${r.answer && r.answer.length >= 200 ? '...' : ''}`);
          console.log(`   (${r.wordCount} words, ${r.duration}ms, confidence: ${r.confidence?.toFixed(2) || 'N/A'})\n`);
        });
    }

    console.log('='.repeat(80) + '\n');
  }
}

// Run tests
const tester = new DocumentTester();
tester.run().catch(console.error);
