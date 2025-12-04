/**
 * Koda Cell Extraction & Formula Test
 * Focused test on cell values, cell locations, and formula understanding
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = 'localhost@koda.com';
const TEST_PASSWORD = 'localhost123';

interface TestQuestion {
  id: number;
  category: string;
  question: string;
  expectedKeywords: string[];
  description: string;
}

interface TestResult {
  questionId: number;
  category: string;
  question: string;
  response: string;
  keywordsFound: string[];
  keywordsMissing: string[];
  score: number;
  maxScore: number;
  passed: boolean;
  responseTime: number;
}

const questions: TestQuestion[] = [
  // CELL VALUE EXTRACTION
  {
    id: 1,
    category: 'Cell Value',
    question: 'What is the value in cell B30 of the Lone Mountain Ranch 2024 P&L?',
    expectedKeywords: ['B30', '23,040,535', 'total', 'revenue'],
    description: 'Extract specific cell value (Total Operating Revenue)'
  },
  {
    id: 2,
    category: 'Cell Value',
    question: 'What is the Room Revenue value in the 2024 P&L file?',
    expectedKeywords: ['room', 'revenue', '$', '000'],
    description: 'Extract named value from P&L'
  },
  {
    id: 3,
    category: 'Cell Value',
    question: 'What does cell A1 contain in the Rosewood Fund file?',
    expectedKeywords: ['A1'],
    description: 'Extract first cell value'
  },

  // CELL LOCATION
  {
    id: 4,
    category: 'Cell Location',
    question: 'In which cell is the Total Operating Revenue located in the 2024 P&L?',
    expectedKeywords: ['B30', 'row', '30', 'total', 'revenue'],
    description: 'Find cell location by name'
  },
  {
    id: 5,
    category: 'Cell Location',
    question: 'Where is the EBITDA value located in the Lone Mountain Ranch P&L files?',
    expectedKeywords: ['EBITDA', 'row', 'cell'],
    description: 'Find EBITDA location'
  },
  {
    id: 6,
    category: 'Cell Location',
    question: 'Which row contains the MoIC values in the Rosewood Fund file?',
    expectedKeywords: ['MoIC', 'row'],
    description: 'Find MoIC row location'
  },

  // FORMULA EXTRACTION
  {
    id: 7,
    category: 'Formula',
    question: 'What formula is used to calculate cell B71 in the P&L files?',
    expectedKeywords: ['B71', 'formula', '=', 'B60'],
    description: 'Extract subtotal formula'
  },
  {
    id: 8,
    category: 'Formula',
    question: 'Show me any SUM formulas in the Lone Mountain Ranch files',
    expectedKeywords: ['SUM', 'formula', '='],
    description: 'Find SUM formulas'
  },
  {
    id: 9,
    category: 'Formula',
    question: 'Are there any IFERROR formulas in the Rosewood Fund file? If so, what do they calculate?',
    expectedKeywords: ['IFERROR', 'error', 'division', 'formula'],
    description: 'Find and explain IFERROR formulas'
  },
  {
    id: 10,
    category: 'Formula',
    question: 'How is the Total Operating Expenses calculated? What cells does it sum?',
    expectedKeywords: ['total', 'expenses', 'SUM', 'formula'],
    description: 'Explain expense total formula'
  },

  // FORMULA UNDERSTANDING
  {
    id: 11,
    category: 'Formula Understanding',
    question: 'If cell B30 contains =SUM(B10:B29), and I change B15 from $500,000 to $600,000, what happens to B30?',
    expectedKeywords: ['increase', '100,000', 'sum', 'total'],
    description: 'Understand SUM formula behavior'
  },
  {
    id: 12,
    category: 'Formula Understanding',
    question: 'What is the purpose of using IFERROR in financial spreadsheets?',
    expectedKeywords: ['error', 'division', 'zero', 'prevent', 'handle'],
    description: 'Explain IFERROR purpose'
  },

  // CROSS-CELL RELATIONSHIPS
  {
    id: 13,
    category: 'Cell Relationships',
    question: 'Which cells reference the Total Revenue cell in calculations?',
    expectedKeywords: ['total', 'revenue', 'reference', 'cell'],
    description: 'Find dependent cells'
  },
  {
    id: 14,
    category: 'Cell Relationships',
    question: 'What is the relationship between the MoIC and the investment values in the Rosewood Fund?',
    expectedKeywords: ['MoIC', 'investment', 'divide', 'return', 'multiple'],
    description: 'Explain MoIC calculation relationship'
  },

  // SPECIFIC VALUE LOOKUP
  {
    id: 15,
    category: 'Value Lookup',
    question: 'What is the F&B Revenue for 2024 at Lone Mountain Ranch?',
    expectedKeywords: ['F&B', 'food', 'beverage', 'revenue', '$'],
    description: 'Find Food & Beverage revenue'
  }
];

async function authenticate(): Promise<string> {
  console.log(`🔐 Authenticating as ${TEST_EMAIL}...`);
  const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  console.log(`✅ Authentication successful\n`);
  return response.data.accessToken;
}

async function askQuestion(token: string, question: string): Promise<{ response: string; responseTime: number }> {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/rag/query`,
      {
        query: question,
        conversationId: `cell-test-${Date.now()}`
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    return {
      response: response.data.answer || response.data.response || 'No response',
      responseTime: Date.now() - startTime
    };
  } catch (error: any) {
    return {
      response: `ERROR: ${error.response?.data?.error || error.message}`,
      responseTime: Date.now() - startTime
    };
  }
}

function scoreResponse(question: TestQuestion, response: string): TestResult {
  const lowerResponse = response.toLowerCase();
  const keywordsFound: string[] = [];
  const keywordsMissing: string[] = [];

  for (const keyword of question.expectedKeywords) {
    if (lowerResponse.includes(keyword.toLowerCase())) {
      keywordsFound.push(keyword);
    } else {
      keywordsMissing.push(keyword);
    }
  }

  const score = keywordsFound.length;
  const maxScore = question.expectedKeywords.length;
  const passed = score >= maxScore * 0.6; // 60% threshold

  return {
    questionId: question.id,
    category: question.category,
    question: question.question,
    response,
    keywordsFound,
    keywordsMissing,
    score,
    maxScore,
    passed,
    responseTime: 0
  };
}

async function runTests(): Promise<void> {
  console.log('================================================================================');
  console.log('🔬 KODA CELL EXTRACTION & FORMULA TEST');
  console.log('================================================================================\n');

  const token = await authenticate();
  const results: TestResult[] = [];

  for (const question of questions) {
    console.log(`\n📝 Q${question.id} [${question.category}]`);
    console.log(`❓ ${question.question}`);
    console.log(`📋 ${question.description}`);

    const { response, responseTime } = await askQuestion(token, question.question);
    const result = scoreResponse(question, response);
    result.responseTime = responseTime;
    results.push(result);

    console.log(`⏱️  ${responseTime}ms`);
    console.log(`📊 Score: ${result.score}/${result.maxScore} ${result.passed ? '✅' : '❌'}`);
    console.log(`✓ Found: ${result.keywordsFound.join(', ') || 'none'}`);
    console.log(`✗ Missing: ${result.keywordsMissing.join(', ') || 'none'}`);
    console.log(`💬 ${response.substring(0, 200)}...`);

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Summary by category
  console.log('\n\n================================================================================');
  console.log('📊 RESULTS BY CATEGORY');
  console.log('================================================================================\n');

  const categories = [...new Set(questions.map(q => q.category))];
  let totalScore = 0;
  let totalMaxScore = 0;

  for (const category of categories) {
    const catResults = results.filter(r => r.category === category);
    const catScore = catResults.reduce((sum, r) => sum + r.score, 0);
    const catMaxScore = catResults.reduce((sum, r) => sum + r.maxScore, 0);
    const catPassed = catResults.filter(r => r.passed).length;
    const percentage = (catScore / catMaxScore) * 100;

    totalScore += catScore;
    totalMaxScore += catMaxScore;

    const bar = '█'.repeat(Math.round(percentage / 5));
    console.log(`${category.padEnd(25)} ${catPassed}/${catResults.length} passed | ${catScore}/${catMaxScore} (${percentage.toFixed(1)}%) ${bar}`);
  }

  const overallPercentage = (totalScore / totalMaxScore) * 100;
  const totalPassed = results.filter(r => r.passed).length;

  console.log('\n================================================================================');
  console.log('📊 OVERALL SUMMARY');
  console.log('================================================================================\n');
  console.log(`Total Score: ${totalScore}/${totalMaxScore} (${overallPercentage.toFixed(1)}%)`);
  console.log(`Tests Passed: ${totalPassed}/${results.length} (${((totalPassed / results.length) * 100).toFixed(1)}%)`);
  console.log(`Average Response Time: ${(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length).toFixed(0)}ms`);

  let grade = 'F';
  if (overallPercentage >= 90) grade = 'A';
  else if (overallPercentage >= 80) grade = 'B';
  else if (overallPercentage >= 70) grade = 'C';
  else if (overallPercentage >= 60) grade = 'D';

  console.log(`\nFinal Grade: ${grade}\n`);
}

runTests().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
