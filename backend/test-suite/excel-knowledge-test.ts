/**
 * Koda Excel Knowledge Test - 20 Questions
 * Tests Koda's ability to understand Excel files, formulas, and perform calculations
 *
 * Files tested:
 * - LoneMountainRanchP&L2024.xlsx
 * - LoneMountainRanchP&L2025(Budget).xlsx
 * - RosewoodFundv3.xlsx
 * - LMRImprovementPlan202503($63mPIP).xlsx
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = 'localhost@koda.com';
const TEST_PASSWORD = 'localhost123';

interface TestQuestion {
  id: number;
  category: string;
  difficulty: string;
  question: string;
  expectedAnswer: string;
  keywords: string[];
  maxPoints: number;
}

interface TestResult {
  questionId: number;
  question: string;
  response: string;
  score: number;
  maxScore: number;
  passed: boolean;
  issues: string[];
  responseTime: number;
}

const questions: TestQuestion[] = [
  // BASIC DATA EXTRACTION (Q1-Q5)
  {
    id: 1,
    category: 'Data Extraction',
    difficulty: 'Easy',
    question: 'What are the names of the properties in the Rosewood Fund?',
    expectedAnswer: 'Carlyle, Lone Mountain Ranch, Baxter Hotel, Desert Ranch',
    keywords: ['Carlyle', 'Lone Mountain Ranch', 'Baxter Hotel', 'Desert Ranch', '4', 'properties'],
    maxPoints: 5
  },
  {
    id: 2,
    category: 'Data Extraction',
    difficulty: 'Easy',
    question: 'What was the total revenue for Lone Mountain Ranch in 2024?',
    expectedAnswer: 'Specific revenue value from the 2024 P&L file',
    keywords: ['revenue', '2024', 'total', 'million', '$'],
    maxPoints: 5
  },
  {
    id: 3,
    category: 'Data Extraction',
    difficulty: 'Easy',
    question: 'What is the budgeted total revenue for Lone Mountain Ranch in 2025?',
    expectedAnswer: 'Specific budget revenue value from the 2025 budget file',
    keywords: ['revenue', '2025', 'budget', 'million', '$'],
    maxPoints: 5
  },
  {
    id: 4,
    category: 'Data Extraction',
    difficulty: 'Easy',
    question: 'What is the total investment amount for the $63M improvement plan?',
    expectedAnswer: '$63,000,000 or $63 million',
    keywords: ['63', 'million', 'improvement', 'plan', 'investment'],
    maxPoints: 5
  },
  {
    id: 5,
    category: 'Data Extraction',
    difficulty: 'Easy',
    question: 'How many properties are included in the Rosewood Fund portfolio?',
    expectedAnswer: '4 properties',
    keywords: ['4', 'four', 'properties', 'Carlyle', 'Lone Mountain', 'Baxter', 'Desert'],
    maxPoints: 5
  },

  // FORMULA UNDERSTANDING (Q6-Q10)
  {
    id: 6,
    category: 'Formula Understanding',
    difficulty: 'Medium',
    question: 'How is the MoIC (Multiple on Invested Capital) calculated in the Rosewood Fund file?',
    expectedAnswer: '=IFERROR(H12/H10,0) - divides returns by investment',
    keywords: ['IFERROR', 'divide', 'returns', 'investment', 'formula', 'H12', 'H10'],
    maxPoints: 5
  },
  {
    id: 7,
    category: 'Formula Understanding',
    difficulty: 'Medium',
    question: 'How does the Rosewood Fund file calculate the total investment across all properties?',
    expectedAnswer: '=SUM(H10,N10,T10,Z10) - sums investments from all properties',
    keywords: ['SUM', 'H10', 'N10', 'T10', 'Z10', 'total', 'investment'],
    maxPoints: 5
  },
  {
    id: 8,
    category: 'Formula Understanding',
    difficulty: 'Easy',
    question: 'In the P&L files, how are subtotals calculated? For example, how is cell B71 calculated?',
    expectedAnswer: '=+B60 - simple cell reference',
    keywords: ['B71', 'B60', 'reference', 'equals', 'cell', 'formula'],
    maxPoints: 5
  },
  {
    id: 9,
    category: 'Formula Understanding',
    difficulty: 'Medium',
    question: 'How is the return percentage calculated for each property in the Rosewood Fund?',
    expectedAnswer: '=IFERROR(H12/H10,0) formatted as percentage',
    keywords: ['percentage', 'return', 'divide', 'IFERROR', 'formula'],
    maxPoints: 5
  },
  {
    id: 10,
    category: 'Formula Understanding',
    difficulty: 'Medium',
    question: 'Why does the Rosewood Fund use IFERROR in its formulas?',
    expectedAnswer: 'To handle division by zero errors and prevent #DIV/0! errors',
    keywords: ['IFERROR', 'error', 'division', 'zero', 'DIV', 'handle'],
    maxPoints: 5
  },

  // CROSS-FILE COMPARISON (Q11-Q13)
  {
    id: 11,
    category: 'Cross-File Analysis',
    difficulty: 'Hard',
    question: 'What is the expected revenue growth from 2024 to 2025 for Lone Mountain Ranch?',
    expectedAnswer: 'Percentage growth calculation comparing 2024 actual to 2025 budget',
    keywords: ['growth', '2024', '2025', 'revenue', 'percentage', 'increase', 'compare'],
    maxPoints: 5
  },
  {
    id: 12,
    category: 'Cross-File Analysis',
    difficulty: 'Hard',
    question: 'How does the $63M improvement plan relate to the Lone Mountain Ranch investment in the Rosewood Fund?',
    expectedAnswer: 'Comparison of $63M to original investment, showing multiple',
    keywords: ['63', 'million', 'investment', 'Lone Mountain', 'multiple', 'compare', 'relate'],
    maxPoints: 5
  },
  {
    id: 13,
    category: 'Cross-File Analysis',
    difficulty: 'Hard',
    question: 'If I compare the 2024 actual results to the 2025 budget, which expense categories show the biggest increase?',
    expectedAnswer: 'List of expense categories with largest increases',
    keywords: ['expense', 'increase', '2024', '2025', 'category', 'biggest', 'variance'],
    maxPoints: 5
  },

  // COMPLEX CALCULATIONS (Q14-Q17)
  {
    id: 14,
    category: 'Complex Calculation',
    difficulty: 'Hard',
    question: 'What is the total amount invested across all properties in the Rosewood Fund?',
    expectedAnswer: 'Sum of all property investments',
    keywords: ['total', 'investment', 'sum', 'properties', 'Rosewood', 'million', '$'],
    maxPoints: 5
  },
  {
    id: 15,
    category: 'Complex Calculation',
    difficulty: 'Hard',
    question: 'What is the average MoIC across all properties in the Rosewood Fund?',
    expectedAnswer: 'Average of all property MoICs',
    keywords: ['average', 'MoIC', 'properties', 'calculate', 'mean'],
    maxPoints: 5
  },
  {
    id: 16,
    category: 'Complex Calculation',
    difficulty: 'Hard',
    question: 'If the $63M improvement plan increases Lone Mountain Ranch\'s value by 40%, what is the return on investment?',
    expectedAnswer: 'ROI calculation based on 40% value increase',
    keywords: ['ROI', 'return', 'investment', '40', '63', 'million', 'calculate'],
    maxPoints: 5
  },
  {
    id: 17,
    category: 'Complex Calculation',
    difficulty: 'Hard',
    question: 'What is the weighted average return across the Rosewood Fund portfolio, weighted by investment size?',
    expectedAnswer: 'Weighted average calculation',
    keywords: ['weighted', 'average', 'return', 'investment', 'portfolio', 'calculate'],
    maxPoints: 5
  },

  // BUSINESS ANALYSIS (Q18-Q20)
  {
    id: 18,
    category: 'Business Analysis',
    difficulty: 'Hard',
    question: 'Based on the 2024 actual and 2025 budget, is Lone Mountain Ranch becoming more or less profitable?',
    expectedAnswer: 'Analysis of profitability trend with margin calculations',
    keywords: ['profitable', 'margin', 'trend', '2024', '2025', 'increasing', 'decreasing', 'more', 'less'],
    maxPoints: 5
  },
  {
    id: 19,
    category: 'Business Analysis',
    difficulty: 'Hard',
    question: 'Based on the Rosewood Fund data, which property has performed best and why?',
    expectedAnswer: 'Comparative analysis identifying best performer',
    keywords: ['best', 'performer', 'MoIC', 'return', 'highest', 'property', 'compare'],
    maxPoints: 5
  },
  {
    id: 20,
    category: 'Business Analysis',
    difficulty: 'Hard',
    question: 'If I have an additional $10M to invest, should I put it into the $63M improvement plan or invest in a new property? Explain your reasoning based on the data.',
    expectedAnswer: 'Investment recommendation with data-driven reasoning',
    keywords: ['recommend', 'invest', '10', 'million', 'improvement', 'new', 'ROI', 'return', 'data'],
    maxPoints: 5
  }
];

// Authentication
async function authenticate(): Promise<string> {
  try {
    console.log(`🔐 Authenticating as ${TEST_EMAIL}...`);
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    const token = response.data.accessToken;
    console.log(`✅ Authentication successful`);
    return token;
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

// Ask a question to Koda
async function askQuestion(token: string, question: string): Promise<{ response: string; responseTime: number }> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: question,
        conversationId: `excel-test-${Date.now()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // 2 minutes
      }
    );

    const responseTime = Date.now() - startTime;
    return {
      response: response.data.answer || response.data.response || 'No response',
      responseTime
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    // Enhanced error logging
    const errorDetails = {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      isAxiosError: error.isAxiosError
    };
    console.error(`❌ Error asking question:`, JSON.stringify(errorDetails, null, 2));
    return {
      response: `ERROR: ${error.response?.data?.error || error.message || 'Unknown error'}`,
      responseTime
    };
  }
}

// Score a response
function scoreResponse(question: TestQuestion, response: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 0;

  // Check if response is an error
  if (response.startsWith('ERROR:')) {
    issues.push('Query failed with error');
    return { score: 0, issues };
  }

  // Check if response says "I don't have" or similar
  const noAnswerPatterns = [
    /I don't have/i,
    /I don't see/i,
    /I couldn't find/i,
    /I'm not finding/i,
    /not available/i,
    /no documents/i
  ];

  if (noAnswerPatterns.some(pattern => pattern.test(response))) {
    issues.push('Koda could not find the information');
    return { score: 0, issues };
  }

  // Check for keyword presence (each keyword worth points)
  const pointsPerKeyword = question.maxPoints / question.keywords.length;
  let keywordsFound = 0;

  for (const keyword of question.keywords) {
    if (response.toLowerCase().includes(keyword.toLowerCase())) {
      keywordsFound++;
      score += pointsPerKeyword;
    }
  }

  if (keywordsFound === 0) {
    issues.push('No expected keywords found in response');
  } else if (keywordsFound < question.keywords.length / 2) {
    issues.push(`Only ${keywordsFound}/${question.keywords.length} keywords found`);
  }

  // Check response length (too short = incomplete)
  if (response.length < 50) {
    issues.push('Response too short (< 50 characters)');
    score *= 0.5; // Penalty for short responses
  }

  // Check for numbers in calculation questions
  if (question.category.includes('Calculation') && !/\d/.test(response)) {
    issues.push('No numbers found in calculation response');
    score *= 0.5;
  }

  // Round score
  score = Math.round(score * 10) / 10;

  // Cap at max points
  score = Math.min(score, question.maxPoints);

  return { score, issues };
}

// Run all tests
async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('🧪 KODA EXCEL KNOWLEDGE TEST - 20 QUESTIONS');
  console.log('================================================================================\n');

  // Authenticate
  const token = await authenticate();
  console.log('');

  const results: TestResult[] = [];
  let totalScore = 0;
  let totalMaxScore = 0;

  // Run each question
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`\n📝 Question ${question.id}/${questions.length} [${question.category} - ${question.difficulty}]`);
    console.log(`❓ ${question.question}`);
    console.log('');

    // Ask question
    const { response, responseTime } = await askQuestion(token, question.question);

    // Score response
    const { score, issues } = scoreResponse(question, response);
    const passed = score >= question.maxPoints * 0.7; // 70% to pass

    totalScore += score;
    totalMaxScore += question.maxPoints;

    // Store result
    results.push({
      questionId: question.id,
      question: question.question,
      response,
      score,
      maxScore: question.maxPoints,
      passed,
      issues,
      responseTime
    });

    // Display result
    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(`📊 Score: ${score.toFixed(1)}/${question.maxPoints} ${passed ? '✅ PASS' : '❌ FAIL'}`);

    if (issues.length > 0) {
      console.log(`⚠️  Issues:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    console.log(`💬 Response: ${response.substring(0, 300)}${response.length > 300 ? '...' : ''}`);

    // Small delay between questions
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Calculate statistics
  const percentage = (totalScore / totalMaxScore) * 100;
  const passedCount = results.filter(r => r.passed).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  // Category breakdown
  const categories = [...new Set(questions.map(q => q.category))];
  const categoryScores = categories.map(cat => {
    const catResults = results.filter(r => {
      const q = questions.find(q => q.id === r.questionId);
      return q?.category === cat;
    });
    const catScore = catResults.reduce((sum, r) => sum + r.score, 0);
    const catMaxScore = catResults.reduce((sum, r) => sum + r.maxScore, 0);
    return {
      category: cat,
      score: catScore,
      maxScore: catMaxScore,
      percentage: (catScore / catMaxScore) * 100
    };
  });

  // Print summary
  console.log('\n\n================================================================================');
  console.log('📊 TEST SUMMARY');
  console.log('================================================================================\n');

  console.log(`Overall Score: ${totalScore.toFixed(1)}/${totalMaxScore} (${percentage.toFixed(1)}%)`);
  console.log(`Tests Passed: ${passedCount}/${questions.length} (${((passedCount / questions.length) * 100).toFixed(1)}%)`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms\n`);

  console.log('Results by Category:\n');
  categoryScores.forEach(cat => {
    const bar = '█'.repeat(Math.round(cat.percentage / 5));
    console.log(`${cat.category.padEnd(25)} ${cat.score.toFixed(1)}/${cat.maxScore} (${cat.percentage.toFixed(1)}%) ${bar}`);
  });

  console.log('\n');

  // Grade
  let grade = 'F';
  if (percentage >= 90) grade = 'A';
  else if (percentage >= 80) grade = 'B';
  else if (percentage >= 70) grade = 'C';
  else if (percentage >= 60) grade = 'D';

  console.log(`Final Grade: ${grade}`);
  console.log('');

  // Save detailed results
  const reportPath = path.join(__dirname, 'excel_test_results.md');
  let report = '# Koda Excel Knowledge Test Results\n\n';
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**Overall Score**: ${totalScore.toFixed(1)}/${totalMaxScore} (${percentage.toFixed(1)}%)\n`;
  report += `**Grade**: ${grade}\n`;
  report += `**Tests Passed**: ${passedCount}/${questions.length}\n`;
  report += `**Average Response Time**: ${avgResponseTime.toFixed(0)}ms\n\n`;

  report += '## Results by Category\n\n';
  report += '| Category | Score | Percentage |\n';
  report += '|----------|-------|------------|\n';
  categoryScores.forEach(cat => {
    report += `| ${cat.category} | ${cat.score.toFixed(1)}/${cat.maxScore} | ${cat.percentage.toFixed(1)}% |\n`;
  });
  report += '\n';

  report += '## Detailed Results\n\n';
  results.forEach((result, index) => {
    const question = questions[index];
    report += `### Q${result.questionId}: ${question.category} (${question.difficulty})\n\n`;
    report += `**Question**: ${result.question}\n\n`;
    report += `**Score**: ${result.score.toFixed(1)}/${result.maxScore} ${result.passed ? '✅' : '❌'}\n\n`;
    report += `**Response Time**: ${result.responseTime}ms\n\n`;

    if (result.issues.length > 0) {
      report += `**Issues**:\n`;
      result.issues.forEach(issue => report += `- ${issue}\n`);
      report += '\n';
    }

    report += `**Koda's Response**:\n\`\`\`\n${result.response}\n\`\`\`\n\n`;
    report += `**Expected Keywords**: ${question.keywords.join(', ')}\n\n`;
    report += '---\n\n';
  });

  fs.writeFileSync(reportPath, report);
  console.log(`📄 Detailed results saved to: ${reportPath}\n`);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
