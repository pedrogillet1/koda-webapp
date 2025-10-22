/**
 * Terminal-based chat speed testing system for KODA
 * Tests adaptive AI response times across all query types
 *
 * Usage: node scripts/testChatSpeed.js [options]
 */

const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');

class ChatSpeedTester {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'https://koda-backend.ngrok.app';
    this.apiEndpoint = options.apiEndpoint || '/api/chat/conversations';
    this.userId = options.userId || 'test-user-123';
    this.authToken = options.authToken || null;
    this.conversationId = options.conversationId || null;
    this.results = [];
  }

  /**
   * Test queries by type
   */
  getTestQueries() {
    return {
      greeting: [
        "Hello",
        "Hi there",
        "Good morning",
        "Hey KODA",
        "Olá" // Portuguese
      ],
      simple: [
        "Where is document X?",
        "Find the contract",
        "Which folder has the report?",
        "Where can I find the invoice?",
        "Onde está o documento?" // Portuguese
      ],
      factual: [
        "When does the contract expire?",
        "What is the budget?",
        "Who signed the agreement?",
        "How much did we spend?",
        "Quando expira o contrato?" // Portuguese
      ],
      explanation: [
        "How does the approval process work?",
        "Explain the payment terms",
        "Why was this decision made?",
        "What does this clause mean?",
        "Como funciona o processo?" // Portuguese
      ],
      comprehensive: [
        "Give me a complete guide to onboarding",
        "Explain everything about the project",
        "Provide a detailed overview of the process",
        "I need a full explanation of the policy",
        "Me dê um guia completo" // Portuguese
      ]
    };
  }

  /**
   * Expected time ranges by type (in seconds)
   */
  getExpectedTimes() {
    return {
      greeting: { min: 1, max: 2, target: 1.5 },
      simple: { min: 2, max: 5, target: 3.5 },
      factual: { min: 5, max: 8, target: 6.5 },
      explanation: { min: 10, max: 15, target: 12.5 },
      comprehensive: { min: 15, max: 20, target: 17.5 }
    };
  }

  /**
   * Get request headers with auth token
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Create a test conversation
   */
  async createTestConversation() {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat/conversations`,
        {
          userId: this.userId,
          title: `Speed Test - ${new Date().toISOString()}`
        },
        {
          headers: this.getHeaders()
        }
      );
      this.conversationId = response.data.id;
      console.log(chalk.gray(`Created test conversation: ${this.conversationId}\n`));
      return this.conversationId;
    } catch (error) {
      console.error(chalk.red('Failed to create conversation:'), error.message);
      if (error.response) {
        console.error(chalk.red('Response:'), error.response.status, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Test a single query
   */
  async testQuery(query, type, index) {
    const startTime = Date.now();

    try {
      // Try adaptive endpoint first, fall back to regular endpoint if it fails
      let response;
      let isAdaptive = true;

      try {
        response = await axios.post(
          `${this.baseURL}${this.apiEndpoint}/${this.conversationId}/messages/adaptive`,
          {
            content: query
          },
          {
            timeout: 30000,
            headers: this.getHeaders()
          }
        );
      } catch (adaptiveError) {
        // Adaptive endpoint failed, use regular endpoint
        console.log(chalk.gray(`   → Falling back to regular endpoint for: ${query.substring(0, 30)}...`));
        isAdaptive = false;

        response = await axios.post(
          `${this.baseURL}${this.apiEndpoint}/${this.conversationId}/messages`,
          {
            content: query
          },
          {
            timeout: 30000,
            headers: this.getHeaders()
          }
        );
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // seconds

      const result = {
        type,
        query,
        duration,
        success: true,
        answer: response.data.assistantMessage?.content || response.data.message || 'No answer',
        followUp: response.data.followUp || null,
        detectedType: response.data.queryType || type,
        confidence: response.data.confidence || null,
        responseTime: response.data.responseTime || null,
        isAdaptive,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);

      // Real-time output
      this.printQueryResult(result, index);

      return result;

    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const result = {
        type,
        query,
        duration,
        success: false,
        error: error.message,
        errorDetails: error.response?.data || null,
        timestamp: new Date().toISOString()
      };

      this.results.push(result);
      this.printQueryResult(result, index);

      return result;
    }
  }

  /**
   * Print individual query result
   */
  printQueryResult(result, index) {
    const expectedTimes = this.getExpectedTimes();
    const expected = expectedTimes[result.type];

    // Determine status
    let status = '';
    let color = '';

    if (!result.success) {
      status = '❌ FAILED';
      color = 'red';
    } else if (result.duration <= expected.max) {
      status = '✅ PASS';
      color = 'green';
    } else {
      status = '⚠️  SLOW';
      color = 'yellow';
    }

    // Type mismatch warning
    const typeMismatch = result.detectedType !== result.type;
    const typeWarning = typeMismatch ? chalk.red(` [TYPE MISMATCH! Got: ${result.detectedType}]`) : '';

    // Endpoint indicator
    const endpointIndicator = result.isAdaptive === false ? chalk.gray(' [Regular]') : chalk.blue(' [Adaptive]');

    console.log(
      chalk[color](`${status}`) +
      ` ${chalk.cyan(`[${result.type}]`)} ` +
      `${chalk.gray(`#${index + 1}`)} ` +
      `${chalk.white(result.query.substring(0, 40))}... ` +
      chalk.bold(`${result.duration.toFixed(2)}s`) +
      chalk.gray(` (target: ${expected.target}s)`) +
      endpointIndicator +
      typeWarning
    );
  }

  /**
   * Test all queries of a specific type
   */
  async testType(type) {
    const queries = this.getTestQueries()[type];

    console.log(chalk.bold.blue(`\n📊 Testing ${type.toUpperCase()} queries (${queries.length} tests)...\n`));

    const results = [];

    for (let i = 0; i < queries.length; i++) {
      const result = await this.testQuery(queries[i], type, i);
      results.push(result);

      // Small delay between queries
      await this.sleep(500);
    }

    return results;
  }

  /**
   * Test all query types
   */
  async testAll() {
    console.log(chalk.bold.green('\n🚀 KODA Chat Speed Test\n'));
    console.log(chalk.gray(`Base URL: ${this.baseURL}`));
    console.log(chalk.gray(`Endpoint: ${this.apiEndpoint}`));
    console.log(chalk.gray(`User ID: ${this.userId}\n`));

    // Create test conversation
    await this.createTestConversation();

    const types = ['greeting', 'simple', 'factual', 'explanation', 'comprehensive'];

    for (const type of types) {
      await this.testType(type);
    }

    // Print summary
    this.printSummary();

    // Save results
    this.saveResults();
  }

  /**
   * Print summary table
   */
  printSummary() {
    console.log(chalk.bold.blue('\n\n📊 TEST SUMMARY\n'));

    const types = ['greeting', 'simple', 'factual', 'explanation', 'comprehensive'];
    const expectedTimes = this.getExpectedTimes();

    const table = new Table({
      head: [
        chalk.white('Type'),
        chalk.white('Tests'),
        chalk.white('Passed'),
        chalk.white('Failed'),
        chalk.white('Avg Time'),
        chalk.white('Target'),
        chalk.white('Status')
      ],
      colWidths: [15, 8, 8, 8, 12, 10, 10]
    });

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    types.forEach(type => {
      const typeResults = this.results.filter(r => r.type === type);
      const count = typeResults.length;
      const passed = typeResults.filter(r => r.success && r.duration <= expectedTimes[type].max).length;
      const failed = typeResults.filter(r => !r.success).length;
      const avgTime = typeResults.reduce((sum, r) => sum + r.duration, 0) / count;
      const target = expectedTimes[type].target;

      totalTests += count;
      totalPassed += passed;
      totalFailed += failed;

      const status = avgTime <= expectedTimes[type].max ? chalk.green('✅ PASS') : chalk.yellow('⚠️  SLOW');

      table.push([
        chalk.cyan(type),
        count,
        chalk.green(passed),
        failed > 0 ? chalk.red(failed) : chalk.gray(failed),
        chalk.bold(`${avgTime.toFixed(2)}s`),
        `${target}s`,
        status
      ]);
    });

    console.log(table.toString());

    // Overall stats
    console.log(chalk.bold('\n📈 Overall Statistics:\n'));
    console.log(`  Total Tests: ${chalk.bold(totalTests)}`);
    console.log(`  Passed: ${chalk.green.bold(totalPassed)} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${chalk.red.bold(totalFailed)} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);

    const avgOverall = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    console.log(`  Average Time: ${chalk.bold(`${avgOverall.toFixed(2)}s`)}`);

    // Performance rating
    const rating = this.getPerformanceRating(avgOverall);
    console.log(`  Performance: ${rating}\n`);
  }

  /**
   * Get performance rating
   */
  getPerformanceRating(avgTime) {
    if (avgTime <= 5) return chalk.green.bold('⭐⭐⭐⭐⭐ EXCELLENT');
    if (avgTime <= 8) return chalk.green('⭐⭐⭐⭐ GREAT');
    if (avgTime <= 10) return chalk.yellow('⭐⭐⭐ GOOD');
    if (avgTime <= 15) return chalk.yellow('⭐⭐ FAIR');
    return chalk.red('⭐ NEEDS IMPROVEMENT');
  }

  /**
   * Save results to file
   */
  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results-${timestamp}.json`;
    const filepath = `./test-results/${filename}`;

    // Create directory if doesn't exist
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results');
    }

    const report = {
      timestamp: new Date().toISOString(),
      baseURL: this.baseURL,
      totalTests: this.results.length,
      results: this.results,
      summary: this.generateSummaryData()
    };

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

    console.log(chalk.gray(`\n💾 Results saved to: ${filepath}\n`));
  }

  /**
   * Generate summary data
   */
  generateSummaryData() {
    const types = ['greeting', 'simple', 'factual', 'explanation', 'comprehensive'];
    const expectedTimes = this.getExpectedTimes();
    const summary = {};

    types.forEach(type => {
      const typeResults = this.results.filter(r => r.type === type);
      const count = typeResults.length;
      const passed = typeResults.filter(r => r.success && r.duration <= expectedTimes[type].max).length;
      const failed = typeResults.filter(r => !r.success).length;
      const avgTime = typeResults.reduce((sum, r) => sum + r.duration, 0) / count;

      summary[type] = {
        count,
        passed,
        failed,
        avgTime: parseFloat(avgTime.toFixed(2)),
        target: expectedTimes[type].target,
        status: avgTime <= expectedTimes[type].max ? 'PASS' : 'SLOW'
      };
    });

    return summary;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    baseURL: process.env.BASE_URL || 'https://koda-backend.ngrok.app',
    userId: process.env.TEST_USER_ID || 'test-user-123',
    authToken: process.env.AUTH_TOKEN || null
  };

  const tester = new ChatSpeedTester(options);

  // Check command
  const command = args[0];

  if (command === 'all' || !command) {
    // Test all types
    await tester.testAll();
  } else if (command === 'type') {
    // Test specific type
    const type = args[1];
    if (!type) {
      console.error(chalk.red('Error: Please specify a type (greeting, simple, factual, explanation, comprehensive)'));
      process.exit(1);
    }
    await tester.createTestConversation();
    await tester.testType(type);
    tester.printSummary();
    tester.saveResults();
  } else if (command === 'help') {
    printHelp();
  } else {
    console.error(chalk.red(`Error: Unknown command '${command}'`));
    printHelp();
    process.exit(1);
  }
}

function printHelp() {
  console.log(chalk.bold('\n🚀 KODA Chat Speed Tester\n'));
  console.log('Usage: node scripts/testChatSpeed.js [command] [options]\n');
  console.log('Commands:');
  console.log('  all              Test all query types (default)');
  console.log('  type <type>      Test specific type (greeting, simple, factual, explanation, comprehensive)');
  console.log('  help             Show this help message\n');
  console.log('Environment Variables:');
  console.log('  BASE_URL         Base URL of your API (default: https://koda-backend.ngrok.app)');
  console.log('  TEST_USER_ID     User ID for testing (default: test-user-123)');
  console.log('  AUTH_TOKEN       JWT token for authentication (required for protected endpoints)\n');
  console.log('Examples:');
  console.log('  node scripts/testChatSpeed.js');
  console.log('  node scripts/testChatSpeed.js all');
  console.log('  node scripts/testChatSpeed.js type greeting');
  console.log('  BASE_URL=https://your-backend.com node scripts/testChatSpeed.js\n');
}

// Run
main().catch(error => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  if (error.response) {
    console.error(chalk.red('Response status:'), error.response.status);
    console.error(chalk.red('Response data:'), JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
});
