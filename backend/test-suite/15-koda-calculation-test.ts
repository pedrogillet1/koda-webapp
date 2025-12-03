/**
 * Koda Calculation Test Script
 *
 * Tests Koda's calculation capabilities and shows EXACT frontend output.
 * Compares with expected answers to identify gaps.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const KODA_API_URL = 'http://localhost:5000/api';
const TEST_EMAIL = 'localhost@koda.com';
const TEST_PASSWORD = 'localhost123';

interface CalculationTest {
  id: number;
  category: string;
  question: string;
  expectedAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const calculationTests: CalculationTest[] = [
  // ========================================
  // CATEGORY 1: BASIC ARITHMETIC (Easy)
  // ========================================
  {
    id: 1,
    category: 'Basic Arithmetic',
    question: 'What is 2,547 × 38?',
    expectedAnswer: '96,786',
    difficulty: 'easy'
  },
  {
    id: 2,
    category: 'Basic Arithmetic',
    question: 'Calculate 15% of $8,500',
    expectedAnswer: '$1,275',
    difficulty: 'easy'
  },
  {
    id: 3,
    category: 'Basic Arithmetic',
    question: 'What is 10,000 ÷ 37?',
    expectedAnswer: '270.27 (or approximately 270)',
    difficulty: 'easy'
  },
  {
    id: 4,
    category: 'Basic Arithmetic',
    question: 'If revenue is $10M and costs are $7M, what is the profit?',
    expectedAnswer: '$3M or $3,000,000',
    difficulty: 'easy'
  },
  {
    id: 5,
    category: 'Basic Arithmetic',
    question: 'Calculate the average of: 10, 20, 30, 40, 50',
    expectedAnswer: '30',
    difficulty: 'easy'
  },

  // ========================================
  // CATEGORY 2: PERCENTAGES (Easy-Medium)
  // ========================================
  {
    id: 6,
    category: 'Percentages',
    question: 'What is 25% of 480?',
    expectedAnswer: '120',
    difficulty: 'easy'
  },
  {
    id: 7,
    category: 'Percentages',
    question: 'If a product costs $120 and has a 20% discount, what is the final price?',
    expectedAnswer: '$96',
    difficulty: 'medium'
  },
  {
    id: 8,
    category: 'Percentages',
    question: 'Revenue increased from $50K to $65K. What is the percentage increase?',
    expectedAnswer: '30%',
    difficulty: 'medium'
  },
  {
    id: 9,
    category: 'Percentages',
    question: 'What percentage is 45 out of 180?',
    expectedAnswer: '25%',
    difficulty: 'easy'
  },
  {
    id: 10,
    category: 'Percentages',
    question: 'A price dropped from $80 to $60. What is the percentage decrease?',
    expectedAnswer: '25%',
    difficulty: 'medium'
  },

  // ========================================
  // CATEGORY 3: FINANCIAL CALCULATIONS (Medium)
  // ========================================
  {
    id: 11,
    category: 'Financial',
    question: 'Calculate simple interest: Principal $10,000, Rate 5%, Time 3 years',
    expectedAnswer: '$1,500',
    difficulty: 'medium'
  },
  {
    id: 12,
    category: 'Financial',
    question: 'Calculate compound interest: $10,000 principal, 5% annual rate, 10 years',
    expectedAnswer: '$16,288.95 (final amount) or $6,288.95 (interest)',
    difficulty: 'medium'
  },
  {
    id: 13,
    category: 'Financial',
    question: 'What is the monthly payment on a $200,000 loan at 5% annual interest for 30 years?',
    expectedAnswer: '$1,073.64',
    difficulty: 'hard'
  },
  {
    id: 14,
    category: 'Financial',
    question: 'Calculate ROI: Initial investment $50,000, Final value $75,000',
    expectedAnswer: '50%',
    difficulty: 'medium'
  },
  {
    id: 15,
    category: 'Financial',
    question: 'If gross profit is $150,000 and revenue is $500,000, what is the gross margin?',
    expectedAnswer: '30%',
    difficulty: 'medium'
  },

  // ========================================
  // CATEGORY 4: ADVANCED FINANCIAL (Hard)
  // ========================================
  {
    id: 16,
    category: 'Advanced Financial',
    question: 'Calculate IRR for cash flows: -$100,000, $30,000, $40,000, $50,000, $60,000',
    expectedAnswer: '28.09% or approximately 28%',
    difficulty: 'hard'
  },
  {
    id: 17,
    category: 'Advanced Financial',
    question: 'Calculate NPV with 10% discount rate for cash flows: -$100,000, $30,000, $40,000, $50,000',
    expectedAnswer: '$4,815.91',
    difficulty: 'hard'
  },
  {
    id: 18,
    category: 'Advanced Financial',
    question: 'What is the present value of $10,000 received in 5 years at 8% discount rate?',
    expectedAnswer: '$6,805.83',
    difficulty: 'hard'
  },
  {
    id: 19,
    category: 'Advanced Financial',
    question: 'Calculate the future value of $5,000 invested at 7% for 20 years compounded annually',
    expectedAnswer: '$19,348.42',
    difficulty: 'hard'
  },
  {
    id: 20,
    category: 'Advanced Financial',
    question: 'What is the effective annual rate if nominal rate is 12% compounded monthly?',
    expectedAnswer: '12.68%',
    difficulty: 'hard'
  },

  // ========================================
  // CATEGORY 5: STATISTICS (Medium-Hard)
  // ========================================
  {
    id: 21,
    category: 'Statistics',
    question: 'Calculate the median of: 5, 12, 18, 23, 45, 67, 89',
    expectedAnswer: '23',
    difficulty: 'medium'
  },
  {
    id: 22,
    category: 'Statistics',
    question: 'What is the standard deviation of: 10, 20, 30, 40, 50?',
    expectedAnswer: '15.81 or approximately 16',
    difficulty: 'hard'
  },
  {
    id: 23,
    category: 'Statistics',
    question: 'Calculate the variance of: 2, 4, 6, 8, 10',
    expectedAnswer: '10 (population) or 8 (sample)',
    difficulty: 'hard'
  },
  {
    id: 24,
    category: 'Statistics',
    question: 'What is the mode of: 3, 5, 5, 7, 8, 5, 9, 10?',
    expectedAnswer: '5',
    difficulty: 'easy'
  },
  {
    id: 25,
    category: 'Statistics',
    question: 'Calculate the range of: 15, 22, 8, 45, 33, 12',
    expectedAnswer: '37',
    difficulty: 'easy'
  },

  // ========================================
  // CATEGORY 6: GROWTH & RATES (Medium-Hard)
  // ========================================
  {
    id: 26,
    category: 'Growth & Rates',
    question: 'Calculate CAGR: Starting value $1M, Ending value $2M, 5 years',
    expectedAnswer: '14.87%',
    difficulty: 'hard'
  },
  {
    id: 27,
    category: 'Growth & Rates',
    question: 'If a population grows at 3% annually, what will it be in 10 years starting from 100,000?',
    expectedAnswer: '134,392',
    difficulty: 'medium'
  },
  {
    id: 28,
    category: 'Growth & Rates',
    question: 'Calculate year-over-year growth rate: Year 1: $500K, Year 2: $650K',
    expectedAnswer: '30%',
    difficulty: 'easy'
  },
  {
    id: 29,
    category: 'Growth & Rates',
    question: 'If inflation is 4% per year, what will $100 be worth in 10 years (in today\'s dollars)?',
    expectedAnswer: '$67.56',
    difficulty: 'hard'
  },
  {
    id: 30,
    category: 'Growth & Rates',
    question: 'Sales grew from $2M to $3.5M over 3 years. What is the average annual growth rate?',
    expectedAnswer: '20.51%',
    difficulty: 'hard'
  },

  // ========================================
  // CATEGORY 7: RATIOS & PROPORTIONS (Easy-Medium)
  // ========================================
  {
    id: 31,
    category: 'Ratios',
    question: 'If the ratio of A to B is 3:5 and A is 60, what is B?',
    expectedAnswer: '100',
    difficulty: 'medium'
  },
  {
    id: 32,
    category: 'Ratios',
    question: 'Calculate debt-to-equity ratio: Debt $500K, Equity $1M',
    expectedAnswer: '0.5 or 1:2',
    difficulty: 'easy'
  },
  {
    id: 33,
    category: 'Ratios',
    question: 'What is the price-to-earnings ratio if stock price is $50 and EPS is $5?',
    expectedAnswer: '10',
    difficulty: 'easy'
  },
  {
    id: 34,
    category: 'Ratios',
    question: 'Current ratio: Current assets $300K, Current liabilities $150K. What is it?',
    expectedAnswer: '2.0 or 2:1',
    difficulty: 'easy'
  },
  {
    id: 35,
    category: 'Ratios',
    question: 'Divide $10,000 in the ratio 2:3:5. What are the three amounts?',
    expectedAnswer: '$2,000, $3,000, $5,000',
    difficulty: 'medium'
  },

  // ========================================
  // CATEGORY 8: UNIT CONVERSIONS (Easy)
  // ========================================
  {
    id: 36,
    category: 'Unit Conversion',
    question: 'Convert 5 kilometers to miles',
    expectedAnswer: '3.107 miles',
    difficulty: 'easy'
  },
  {
    id: 37,
    category: 'Unit Conversion',
    question: 'Convert 100 Fahrenheit to Celsius',
    expectedAnswer: '37.78°C',
    difficulty: 'easy'
  },
  {
    id: 38,
    category: 'Unit Conversion',
    question: 'How many seconds are in 2.5 hours?',
    expectedAnswer: '9,000 seconds',
    difficulty: 'easy'
  },
  {
    id: 39,
    category: 'Unit Conversion',
    question: 'Convert 150 pounds to kilograms',
    expectedAnswer: '68.04 kg',
    difficulty: 'easy'
  },
  {
    id: 40,
    category: 'Unit Conversion',
    question: 'How many days are in 10,000 hours?',
    expectedAnswer: '416.67 days',
    difficulty: 'easy'
  },

  // ========================================
  // CATEGORY 9: COMPLEX MULTI-STEP (Hard)
  // ========================================
  {
    id: 41,
    category: 'Complex Multi-Step',
    question: 'A company has $1M revenue, 40% gross margin, and $200K operating expenses. What is the net income?',
    expectedAnswer: '$200,000',
    difficulty: 'hard'
  },
  {
    id: 42,
    category: 'Complex Multi-Step',
    question: 'Calculate break-even point: Fixed costs $50K, Variable cost per unit $20, Selling price per unit $50',
    expectedAnswer: '1,667 units',
    difficulty: 'hard'
  },
  {
    id: 43,
    category: 'Complex Multi-Step',
    question: 'If you invest $1,000 monthly at 8% annual return for 30 years, what will you have?',
    expectedAnswer: '$1,490,359',
    difficulty: 'hard'
  },
  {
    id: 44,
    category: 'Complex Multi-Step',
    question: 'Company A has 60% market share, Company B has 25%. If total market is $10M, how much more does A earn than B?',
    expectedAnswer: '$3.5M',
    difficulty: 'medium'
  },
  {
    id: 45,
    category: 'Complex Multi-Step',
    question: 'Calculate profit margin: Revenue $2M, COGS $1.2M, Operating expenses $400K, Tax rate 25%',
    expectedAnswer: '15% (Net profit $300K)',
    difficulty: 'hard'
  },

  // ========================================
  // CATEGORY 10: BUSINESS METRICS (Medium-Hard)
  // ========================================
  {
    id: 46,
    category: 'Business Metrics',
    question: 'Calculate Customer Lifetime Value: Average purchase $100, Purchases per year 4, Customer lifespan 5 years',
    expectedAnswer: '$2,000',
    difficulty: 'medium'
  },
  {
    id: 47,
    category: 'Business Metrics',
    question: 'What is the Customer Acquisition Cost if marketing spend is $50K and you acquired 500 customers?',
    expectedAnswer: '$100',
    difficulty: 'easy'
  },
  {
    id: 48,
    category: 'Business Metrics',
    question: 'Calculate churn rate: Started with 1,000 customers, lost 50 in a month',
    expectedAnswer: '5%',
    difficulty: 'easy'
  },
  {
    id: 49,
    category: 'Business Metrics',
    question: 'Revenue per employee: Total revenue $5M, 50 employees. What is it?',
    expectedAnswer: '$100,000',
    difficulty: 'easy'
  },
  {
    id: 50,
    category: 'Business Metrics',
    question: 'Calculate payback period: Initial investment $100K, Annual cash flow $25K',
    expectedAnswer: '4 years',
    difficulty: 'medium'
  },
];

/**
 * Main test runner
 */
async function runCalculationTests() {
  console.log('🧮 Koda Calculation Test Suite - 50 Questions\n');
  console.log('='.repeat(80));
  console.log('\n');

  // 1. Authenticate
  console.log('🔐 Authenticating...');
  const token = await authenticate();

  if (!token) {
    console.error('❌ Authentication failed. Exiting.');
    return;
  }

  console.log('✅ Authenticated successfully\n');
  console.log('='.repeat(80));
  console.log('\n');

  // 2. Create a conversation for all tests
  console.log('💬 Creating conversation...');
  const conversationId = await createConversation(token);

  if (!conversationId) {
    console.error('❌ Failed to create conversation. Exiting.');
    return;
  }

  console.log(`✅ Conversation created: ${conversationId}\n`);
  console.log('='.repeat(80));
  console.log('\n');

  // 3. Run tests
  const results: any[] = [];

  for (const test of calculationTests) {
    console.log(`\n📝 Test ${test.id}/${calculationTests.length}: ${test.category} (${test.difficulty})`);
    console.log(`Question: "${test.question}"`);
    console.log(`Expected: ${test.expectedAnswer}`);
    console.log('-'.repeat(80));

    try {
      const result = await askKoda(test.question, token, conversationId);

      console.log(`\n✅ Koda's Answer:\n${result.answer}\n`);

      // Analyze answer quality
      const analysis = analyzeAnswer(result.answer, test.expectedAnswer);

      console.log(`📊 Analysis:`);
      console.log(`   - Contains number: ${analysis.containsNumber ? '✅' : '❌'}`);
      console.log(`   - Shows calculation: ${analysis.showsCalculation ? '✅' : '❌'}`);
      console.log(`   - Provides explanation: ${analysis.providesExplanation ? '✅' : '❌'}`);
      console.log(`   - Has expected number: ${analysis.hasExpectedNumber ? '✅' : '❌'}`);
      console.log(`   - Word count: ${analysis.wordCount}`);
      console.log(`   - Response time: ${result.responseTime}ms`);

      results.push({
        ...test,
        kodaAnswer: result.answer,
        responseTime: result.responseTime,
        analysis
      });

      // Delay between requests to avoid overwhelming the server
      await sleep(3000);

    } catch (error: any) {
      console.log(`\n❌ Error: ${error.message}\n`);

      results.push({
        ...test,
        kodaAnswer: `ERROR: ${error.message}`,
        responseTime: 0,
        analysis: { error: true }
      });

      // Wait longer on errors before retrying
      await sleep(5000);
    }

    console.log('='.repeat(80));
  }

  // 3. Generate report
  console.log('\n\n📊 GENERATING REPORT...\n');
  await generateReport(results);

  console.log('\n✅ Test completed! Check calculation_test_results.md for full report.\n');
}

/**
 * Authenticate with Koda
 */
async function authenticate(): Promise<string | null> {
  try {
    const response = await axios.post(`${KODA_API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    return response.data.accessToken;
  } catch (error: any) {
    console.error('Authentication error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Create a new conversation
 */
async function createConversation(token: string): Promise<string | null> {
  try {
    const response = await axios.post(
      `${KODA_API_URL}/chat/conversations`,
      { title: 'Calculation Test Suite - 50 Questions' },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.id || response.data.conversationId;
  } catch (error: any) {
    console.error('Create conversation error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Ask Koda a question
 */
async function askKoda(
  query: string,
  token: string,
  conversationId: string
): Promise<{ answer: string; responseTime: number }> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${KODA_API_URL}/rag/query`,
      {
        query,
        conversationId
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    const responseTime = Date.now() - startTime;

    return {
      answer: response.data.answer || response.data.message || 'No answer provided',
      responseTime
    };

  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message
    );
  }
}

/**
 * Analyze answer quality
 */
function analyzeAnswer(answer: string, expected: string): any {
  // Extract numbers from both answers
  const extractNumbers = (text: string): number[] => {
    const matches = text.match(/[\d,]+\.?\d*/g);
    return matches ? matches.map(m => parseFloat(m.replace(/,/g, ''))) : [];
  };

  const answerNumbers = extractNumbers(answer);
  const expectedNumbers = extractNumbers(expected);

  return {
    containsNumber: answerNumbers.length > 0,
    showsCalculation: answer.includes('=') || answer.includes('calculate') || answer.includes('×') || answer.includes('+') || answer.includes('*'),
    providesExplanation: answer.split(/\s+/).length > 10,
    wordCount: answer.split(/\s+/).length,
    hasExpectedNumber: expectedNumbers.some(exp =>
      answerNumbers.some(ans => Math.abs(ans - exp) / Math.max(exp, 1) < 0.05) // Within 5%
    )
  };
}

/**
 * Generate markdown report
 */
async function generateReport(results: any[]): Promise<void> {
  let report = `# Koda Calculation Test Results - 50 Questions\n\n`;
  report += `**Date:** ${new Date().toLocaleString()}\n`;
  report += `**Total Tests:** ${results.length}\n\n`;

  // Summary stats
  const withNumbers = results.filter(r => r.analysis?.containsNumber).length;
  const withCalculations = results.filter(r => r.analysis?.showsCalculation).length;
  const withExplanations = results.filter(r => r.analysis?.providesExplanation).length;
  const withCorrectAnswer = results.filter(r => r.analysis?.hasExpectedNumber).length;
  const errors = results.filter(r => r.analysis?.error).length;
  const avgResponseTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length;

  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Tests with correct answer | ${withCorrectAnswer}/${results.length} (${Math.round(withCorrectAnswer/results.length*100)}%) |\n`;
  report += `| Tests with numbers | ${withNumbers}/${results.length} (${Math.round(withNumbers/results.length*100)}%) |\n`;
  report += `| Tests with calculations | ${withCalculations}/${results.length} (${Math.round(withCalculations/results.length*100)}%) |\n`;
  report += `| Tests with explanations | ${withExplanations}/${results.length} (${Math.round(withExplanations/results.length*100)}%) |\n`;
  report += `| Errors | ${errors}/${results.length} (${Math.round(errors/results.length*100)}%) |\n`;
  report += `| Average response time | ${Math.round(avgResponseTime)}ms |\n\n`;

  // By difficulty
  report += `## Results by Difficulty\n\n`;
  const difficulties = ['easy', 'medium', 'hard'];

  for (const diff of difficulties) {
    const diffTests = results.filter(r => r.difficulty === diff);
    const correct = diffTests.filter(r => r.analysis?.hasExpectedNumber).length;
    report += `- **${diff.charAt(0).toUpperCase() + diff.slice(1)}**: ${correct}/${diffTests.length} correct (${Math.round(correct/diffTests.length*100)}%)\n`;
  }
  report += `\n`;

  // By category
  report += `## Results by Category\n\n`;

  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    const categoryTests = results.filter(r => r.category === category);
    const correct = categoryTests.filter(r => r.analysis?.hasExpectedNumber).length;
    report += `### ${category} (${correct}/${categoryTests.length} correct)\n\n`;

    for (const test of categoryTests) {
      const status = test.analysis?.hasExpectedNumber ? '✅' : (test.analysis?.error ? '❌' : '⚠️');
      report += `#### ${status} Test ${test.id}: ${test.question}\n\n`;
      report += `**Difficulty:** ${test.difficulty}\n\n`;
      report += `**Expected Answer:**\n\`${test.expectedAnswer}\`\n\n`;
      report += `**Koda's Answer:**\n${test.kodaAnswer}\n\n`;

      if (test.analysis && !test.analysis.error) {
        report += `**Analysis:**\n`;
        report += `- Contains number: ${test.analysis.containsNumber ? '✅' : '❌'}\n`;
        report += `- Shows calculation: ${test.analysis.showsCalculation ? '✅' : '❌'}\n`;
        report += `- Has expected number: ${test.analysis.hasExpectedNumber ? '✅' : '❌'}\n`;
        report += `- Word count: ${test.analysis.wordCount}\n`;
        report += `- Response time: ${test.responseTime}ms\n\n`;
      }

      report += `---\n\n`;
    }
  }

  // Save report
  const reportPath = path.join(process.cwd(), 'calculation_test_results.md');
  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(`📄 Report saved to: ${reportPath}`);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
runCalculationTests().catch(console.error);
