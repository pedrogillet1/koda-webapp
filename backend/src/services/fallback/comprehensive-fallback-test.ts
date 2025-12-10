/**
 * Comprehensive Fallback Test Suite
 *
 * Tests ALL Koda functions to verify correct fallback messages.
 * Simulates exactly what the frontend/user would receive.
 */

import fallbackDetection from './fallbackDetection.service';
import fallbackResponse from './fallbackResponse.service';
import psychologicalSafety from './psychologicalSafety.service';

// Test scenarios organized by Koda function
interface TestScenario {
  category: string;
  name: string;
  query: string;
  context: {
    documentCount: number;
    ragResults?: any[];
    ragScore?: number;
    documentNames?: string[];
  };
  expectedFallbackType: string;
  description: string;
}

const testScenarios: TestScenario[] = [
  // ============================================================================
  // KNOWLEDGE QUERIES (Main RAG function)
  // ============================================================================
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'No documents uploaded',
    query: 'What is the total revenue for Q4?',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    description: 'User asks about content but has no documents'
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Documents exist but no relevant results',
    query: 'What is the CEO salary?',
    context: {
      documentCount: 5,
      ragResults: [],
      ragScore: 0,
      documentNames: ['Budget_2024.xlsx', 'Q4_Report.pdf', 'Meeting_Notes.docx']
    },
    expectedFallbackType: 'knowledge',
    description: 'User has documents but info not found'
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Low relevance results',
    query: 'What are the employee benefits?',
    context: {
      documentCount: 3,
      ragResults: [{ content: 'Company overview...', score: 0.2 }],
      ragScore: 0.2,
      documentNames: ['Annual_Report.pdf']
    },
    expectedFallbackType: 'knowledge',
    description: 'RAG returns results but very low relevance'
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Good query with good results (NO FALLBACK)',
    query: 'What is the Q4 revenue mentioned in the financial report?',
    context: {
      documentCount: 5,
      ragResults: [{ content: 'Q4 2024 revenue was $10M', score: 0.95 }],
      ragScore: 0.95,
      documentNames: ['Financial_Report_2024.pdf']
    },
    expectedFallbackType: 'none',
    description: 'Normal query - should NOT trigger fallback'
  },

  // ============================================================================
  // CLARIFICATION QUERIES (Ambiguous)
  // ============================================================================
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Vague pronoun - it',
    query: 'What does it say?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge', // Knowledge takes priority when no results
    description: 'User uses "it" without context'
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Vague pronoun - this',
    query: 'Tell me about this',
    context: {
      documentCount: 5,
      ragResults: [{ content: 'Some content', score: 0.8 }],
      ragScore: 0.8
    },
    expectedFallbackType: 'clarification',
    description: 'User uses "this" without context (has results)'
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Generic document reference',
    query: 'What is in the document?',
    context: {
      documentCount: 10,
      ragResults: [{ content: 'Some content', score: 0.85 }],
      ragScore: 0.85,
      documentNames: ['Doc1.pdf', 'Doc2.pdf', 'Doc3.pdf', 'Doc4.pdf']
    },
    expectedFallbackType: 'clarification',
    description: 'User says "the document" but has 10 documents'
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Incomplete question',
    query: 'What about',
    context: { documentCount: 3, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'clarification',
    description: 'Incomplete follow-up question'
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Very short query',
    query: 'Revenue',
    context: {
      documentCount: 5,
      ragResults: [{ content: 'Revenue data', score: 0.7 }],
      ragScore: 0.7
    },
    expectedFallbackType: 'clarification',
    description: 'Single word query that is ambiguous'
  },

  // ============================================================================
  // REFUSAL QUERIES (Outside capabilities)
  // ============================================================================
  {
    category: 'REFUSAL QUERIES',
    name: 'Real-time stock price',
    query: 'What is the current stock price of Apple?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Asking for real-time data'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Today\'s weather',
    query: 'What is today\'s weather in New York?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Asking for real-time weather'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Send email action',
    query: 'Send an email to John about the quarterly report',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Requesting external action'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Book appointment',
    query: 'Book a meeting with Sarah for tomorrow at 2pm',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Requesting calendar action'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Make payment',
    query: 'Make a payment of $500 to vendor ABC',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Requesting financial action'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Personal opinion',
    query: 'Do you think this is a good investment?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Asking for personal opinion'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Market prediction',
    query: 'Will the stock market crash next year?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Asking for prediction'
  },
  {
    category: 'REFUSAL QUERIES',
    name: 'Delete file action',
    query: 'Delete the old budget file',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Requesting file deletion'
  },

  // ============================================================================
  // CALCULATION QUERIES
  // ============================================================================
  {
    category: 'CALCULATION QUERIES',
    name: 'Simple math (should work)',
    query: 'What is 25% of 1000?',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge', // No docs but calculation should handle
    description: 'Simple calculation - handled by calculation engine'
  },
  {
    category: 'CALCULATION QUERIES',
    name: 'Sum from non-existent data',
    query: 'What is the sum of all expenses in the budget?',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    description: 'Calculation requiring document data but no docs'
  },
  {
    category: 'CALCULATION QUERIES',
    name: 'Calculation with documents but no relevant data',
    query: 'Calculate the average salary from the employee data',
    context: {
      documentCount: 3,
      ragResults: [],
      ragScore: 0,
      documentNames: ['Marketing_Plan.pdf', 'Product_Roadmap.docx']
    },
    expectedFallbackType: 'knowledge',
    description: 'Calculation request but relevant data not found'
  },

  // ============================================================================
  // FILE ACTION QUERIES
  // ============================================================================
  {
    category: 'FILE ACTIONS',
    name: 'Find file that doesn\'t exist',
    query: 'Where is the contract_2025.pdf?',
    context: {
      documentCount: 5,
      ragResults: [],
      ragScore: 0,
      documentNames: ['Budget.xlsx', 'Report.pdf', 'Notes.docx']
    },
    expectedFallbackType: 'knowledge',
    description: 'Looking for file that doesn\'t exist'
  },
  {
    category: 'FILE ACTIONS',
    name: 'List files when none exist',
    query: 'Show me all my documents',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    description: 'User asks to list files but has none'
  },
  {
    category: 'FILE ACTIONS',
    name: 'Rename file (action)',
    query: 'Rename my budget file to budget_2024.xlsx',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'refusal',
    description: 'Requesting file modification action'
  },

  // ============================================================================
  // DOCUMENT COMPARISON
  // ============================================================================
  {
    category: 'DOCUMENT COMPARISON',
    name: 'Compare with no documents',
    query: 'Compare the Q1 and Q2 reports',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    description: 'Comparison request but no documents'
  },
  {
    category: 'DOCUMENT COMPARISON',
    name: 'Compare non-existent docs',
    query: 'Compare the sales report with the marketing report',
    context: {
      documentCount: 2,
      ragResults: [],
      ragScore: 0,
      documentNames: ['HR_Policy.pdf', 'Vacation_Calendar.xlsx']
    },
    expectedFallbackType: 'knowledge',
    description: 'Documents exist but not the ones requested'
  },

  // ============================================================================
  // SUMMARIZATION QUERIES
  // ============================================================================
  {
    category: 'SUMMARIZATION',
    name: 'Summarize with no documents',
    query: 'Summarize all my documents',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    description: 'Summary request but no documents'
  },
  {
    category: 'SUMMARIZATION',
    name: 'Summarize specific non-existent doc',
    query: 'Summarize the annual report',
    context: {
      documentCount: 3,
      ragResults: [],
      ragScore: 0,
      documentNames: ['Budget.xlsx', 'Notes.docx']
    },
    expectedFallbackType: 'knowledge',
    description: 'Summary of non-existent document'
  },

  // ============================================================================
  // EXCEL QUERIES
  // ============================================================================
  {
    category: 'EXCEL QUERIES',
    name: 'Excel cell reference - no Excel files',
    query: 'What is in cell A1 of the spreadsheet?',
    context: {
      documentCount: 2,
      ragResults: [],
      ragScore: 0,
      documentNames: ['Report.pdf', 'Notes.docx']
    },
    expectedFallbackType: 'knowledge',
    description: 'Excel query but no Excel files'
  },
  {
    category: 'EXCEL QUERIES',
    name: 'Excel formula - no documents',
    query: 'What if I change cell B2 to 1000?',
    context: { documentCount: 0, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    description: 'What-if analysis but no documents'
  },

  // ============================================================================
  // GREETING/HELP QUERIES (Should NOT trigger fallback - handled by fast path)
  // ============================================================================
  {
    category: 'GREETINGS/HELP',
    name: 'Greeting',
    query: 'Hello!',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'clarification', // Short query pattern
    description: 'Greeting - handled by fast path, not fallback'
  },
  {
    category: 'GREETINGS/HELP',
    name: 'Help request',
    query: 'What can you do?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge', // No results
    description: 'Help request - handled by fast path, not fallback'
  },
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function runComprehensiveTests() {
  console.log('\n' + '='.repeat(80));
  console.log(colors.bright + colors.cyan + '  COMPREHENSIVE KODA FALLBACK TEST SUITE' + colors.reset);
  console.log('='.repeat(80) + '\n');

  const results: {
    category: string;
    name: string;
    query: string;
    expectedType: string;
    actualType: string;
    confidence: number;
    passed: boolean;
    fallbackResponse?: string;
    safetyCheck?: any;
  }[] = [];

  let currentCategory = '';
  let categoryPassed = 0;
  let categoryFailed = 0;

  for (const scenario of testScenarios) {
    // Print category header
    if (scenario.category !== currentCategory) {
      if (currentCategory !== '') {
        console.log(`  ${colors.bright}Category Result: ${categoryPassed} passed, ${categoryFailed} failed${colors.reset}\n`);
      }
      currentCategory = scenario.category;
      categoryPassed = 0;
      categoryFailed = 0;
      console.log(colors.bright + colors.magenta + `\n[${ scenario.category }]` + colors.reset);
      console.log('-'.repeat(60));
    }

    // Run detection
    const detection = fallbackDetection.detectFallback({
      query: scenario.query,
      documentCount: scenario.context.documentCount,
      ragResults: scenario.context.ragResults || [],
      ragScore: scenario.context.ragScore || 0,
    });

    const passed = detection.fallbackType === scenario.expectedFallbackType;

    if (passed) {
      categoryPassed++;
      console.log(`${colors.green}PASS${colors.reset} ${scenario.name}`);
    } else {
      categoryFailed++;
      console.log(`${colors.red}FAIL${colors.reset} ${scenario.name}`);
      console.log(`     Expected: ${scenario.expectedFallbackType}, Got: ${detection.fallbackType}`);
    }

    console.log(`     Query: "${scenario.query}"`);
    console.log(`     Type: ${detection.fallbackType} (confidence: ${detection.confidence})`);
    console.log(`     ${colors.yellow}${scenario.description}${colors.reset}`);

    // Generate fallback response for fallback scenarios
    let fallbackResponseText: string | undefined;
    let safetyCheck: any;

    if (detection.needsFallback && detection.fallbackType !== 'none') {
      try {
        fallbackResponseText = await fallbackResponse.generateFallbackResponse({
          query: scenario.query,
          fallbackType: detection.fallbackType,
          reason: detection.reason,
          documentCount: scenario.context.documentCount,
          documentNames: scenario.context.documentNames,
          language: 'English',
        });

        safetyCheck = psychologicalSafety.checkResponseSafety(fallbackResponseText);

        console.log(`     ${colors.cyan}--- FRONTEND OUTPUT ---${colors.reset}`);
        console.log(`     "${fallbackResponseText.substring(0, 150)}${fallbackResponseText.length > 150 ? '...' : ''}"`);

        if (!safetyCheck.isSafe) {
          console.log(`     ${colors.red}Safety Issues: ${safetyCheck.issues.join(', ')}${colors.reset}`);
        }
      } catch (error: any) {
        console.log(`     ${colors.red}Error generating response: ${error.message}${colors.reset}`);
      }
    }

    console.log('');

    results.push({
      category: scenario.category,
      name: scenario.name,
      query: scenario.query,
      expectedType: scenario.expectedFallbackType,
      actualType: detection.fallbackType,
      confidence: detection.confidence,
      passed,
      fallbackResponse: fallbackResponseText,
      safetyCheck,
    });
  }

  // Print final category results
  console.log(`  ${colors.bright}Category Result: ${categoryPassed} passed, ${categoryFailed} failed${colors.reset}\n`);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(colors.bright + colors.cyan + '  TEST SUMMARY' + colors.reset);
  console.log('='.repeat(80) + '\n');

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;

  // Group by category
  const categoryStats: Record<string, { passed: number; failed: number }> = {};
  results.forEach(r => {
    if (!categoryStats[r.category]) {
      categoryStats[r.category] = { passed: 0, failed: 0 };
    }
    if (r.passed) {
      categoryStats[r.category].passed++;
    } else {
      categoryStats[r.category].failed++;
    }
  });

  Object.entries(categoryStats).forEach(([category, stats]) => {
    const status = stats.failed === 0 ? colors.green + 'ALL PASS' : colors.red + `${stats.failed} FAILED`;
    console.log(`  ${category}: ${stats.passed}/${stats.passed + stats.failed} ${status}${colors.reset}`);
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`  ${colors.bright}TOTAL: ${totalPassed} passed, ${totalFailed} failed out of ${results.length} tests${colors.reset}`);

  if (totalFailed > 0) {
    console.log(`\n  ${colors.red}FAILED TESTS:${colors.reset}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    - ${r.name}: Expected ${r.expectedType}, got ${r.actualType}`);
    });
  }

  // Safety analysis
  const withResponses = results.filter(r => r.fallbackResponse);
  const unsafeResponses = withResponses.filter(r => r.safetyCheck && !r.safetyCheck.isSafe);

  console.log(`\n  ${colors.bright}SAFETY ANALYSIS:${colors.reset}`);
  console.log(`    Responses generated: ${withResponses.length}`);
  console.log(`    Safe responses: ${withResponses.length - unsafeResponses.length}`);
  console.log(`    Unsafe responses: ${unsafeResponses.length}`);

  if (unsafeResponses.length > 0) {
    console.log(`\n  ${colors.yellow}UNSAFE RESPONSES:${colors.reset}`);
    unsafeResponses.forEach(r => {
      console.log(`    - ${r.name}: ${r.safetyCheck.issues.join(', ')}`);
    });
  }

  console.log('\n' + '='.repeat(80) + '\n');

  return {
    totalPassed,
    totalFailed,
    results,
    categoryStats,
  };
}

// Run tests if executed directly
if (require.main === module) {
  runComprehensiveTests()
    .then(results => {
      process.exit(results.totalFailed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}

export { runComprehensiveTests, testScenarios };
