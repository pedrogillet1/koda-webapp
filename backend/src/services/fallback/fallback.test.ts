/**
 * Fallback System Test Suite
 *
 * Tests all 4 fallback types with real-world scenarios
 */

import fallbackDetection from './fallbackDetection.service';
import fallbackResponse from './fallbackResponse.service';
import psychologicalSafety from './psychologicalSafety.service';

interface TestCase {
  name: string;
  query: string;
  context: {
    documentCount: number;
    ragResults?: any[];
    ragScore?: number;
  };
  expectedFallbackType: string;
  shouldNeedFallback: boolean;
}

const testCases: TestCase[] = [
  // ========================================
  // CLARIFICATION FALLBACK TESTS
  // ========================================
  {
    name: 'Vague pronoun without context',
    query: 'What does it say?',
    context: { documentCount: 5 },
    expectedFallbackType: 'clarification',
    shouldNeedFallback: true,
  },
  {
    name: 'Generic "the document" with multiple documents',
    query: 'What is the revenue in the document?',
    context: { documentCount: 10 },
    expectedFallbackType: 'clarification',
    shouldNeedFallback: true,
  },
  {
    name: 'Incomplete question',
    query: 'What about',
    context: { documentCount: 3 },
    expectedFallbackType: 'clarification',
    shouldNeedFallback: true,
  },
  {
    name: 'Ambiguous term',
    query: 'What is the cost?',
    context: { documentCount: 5 },
    expectedFallbackType: 'clarification',
    shouldNeedFallback: true,
  },
  {
    name: 'Very short query',
    query: 'Revenue',
    context: { documentCount: 3 },
    expectedFallbackType: 'clarification',
    shouldNeedFallback: true,
  },

  // ========================================
  // KNOWLEDGE FALLBACK TESTS
  // ========================================
  {
    name: 'No documents uploaded',
    query: 'What is the total revenue in Q4?',
    context: { documentCount: 0, ragResults: [] },
    expectedFallbackType: 'knowledge',
    shouldNeedFallback: true,
  },
  {
    name: 'No RAG results found',
    query: 'What is the population of Mars?',
    context: { documentCount: 5, ragResults: [], ragScore: 0 },
    expectedFallbackType: 'knowledge',
    shouldNeedFallback: true,
  },
  {
    name: 'RAG score too low',
    query: 'What is the company mission statement?',
    context: {
      documentCount: 5,
      ragResults: [{ content: 'Some unrelated content', score: 0.2 }],
      ragScore: 0.2,
    },
    expectedFallbackType: 'knowledge',
    shouldNeedFallback: true,
  },
  {
    name: 'Very few results with low scores',
    query: 'What is the CEO salary?',
    context: {
      documentCount: 5,
      ragResults: [{ content: 'Unrelated', score: 0.4 }],
      ragScore: 0.4,
    },
    expectedFallbackType: 'knowledge',
    shouldNeedFallback: true,
  },

  // ========================================
  // REFUSAL FALLBACK TESTS
  // ========================================
  {
    name: 'Real-time data request',
    query: 'What is the current stock price of Apple?',
    context: { documentCount: 5 },
    expectedFallbackType: 'refusal',
    shouldNeedFallback: true,
  },
  {
    name: 'External action request',
    query: 'Send an email to John about the report',
    context: { documentCount: 5 },
    expectedFallbackType: 'refusal',
    shouldNeedFallback: true,
  },
  {
    name: 'Personal opinion request',
    query: 'Do you think this investment is good?',
    context: { documentCount: 5 },
    expectedFallbackType: 'refusal',
    shouldNeedFallback: true,
  },
  {
    name: 'Prediction request',
    query: 'Will the market crash next year?',
    context: { documentCount: 5 },
    expectedFallbackType: 'refusal',
    shouldNeedFallback: true,
  },

  // ========================================
  // NO FALLBACK NEEDED (NORMAL QUERIES)
  // ========================================
  {
    name: 'Clear specific question with good results',
    query: 'What is the total revenue in Q4 2024?',
    context: {
      documentCount: 5,
      ragResults: [
        { content: 'Q4 2024 revenue was $10M', score: 0.95 },
        { content: 'Revenue breakdown by quarter', score: 0.85 },
      ],
      ragScore: 0.95,
    },
    expectedFallbackType: 'none',
    shouldNeedFallback: false,
  },
  {
    name: 'Specific document reference',
    query: 'What does the Q4 Financial Report say about revenue?',
    context: {
      documentCount: 5,
      ragResults: [{ content: 'Q4 revenue data', score: 0.9 }],
      ragScore: 0.9,
    },
    expectedFallbackType: 'none',
    shouldNeedFallback: false,
  },
];

/**
 * Run all fallback detection tests
 */
async function runDetectionTests() {
  console.log('Running Fallback Detection Tests...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = fallbackDetection.detectFallback({
      query: testCase.query,
      documentCount: testCase.context.documentCount,
      ragResults: testCase.context.ragResults,
      ragScore: testCase.context.ragScore,
    });

    const testPassed =
      result.needsFallback === testCase.shouldNeedFallback &&
      (result.needsFallback ? result.fallbackType === testCase.expectedFallbackType : true);

    if (testPassed) {
      console.log(`PASS: ${testCase.name}`);
      console.log(`   Query: "${testCase.query}"`);
      console.log(`   Expected: ${testCase.expectedFallbackType}, Got: ${result.fallbackType}`);
      console.log(`   Confidence: ${result.confidence}\n`);
      passed++;
    } else {
      console.log(`FAIL: ${testCase.name}`);
      console.log(`   Query: "${testCase.query}"`);
      console.log(`   Expected: ${testCase.expectedFallbackType}, Got: ${result.fallbackType}`);
      console.log(
        `   Expected needsFallback: ${testCase.shouldNeedFallback}, Got: ${result.needsFallback}`
      );
      console.log(`   Confidence: ${result.confidence}\n`);
      failed++;
    }
  }

  console.log(
    `\nDetection Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`
  );
  return { passed, failed };
}

/**
 * Test fallback response generation
 */
async function runResponseGenerationTests() {
  console.log('\nRunning Fallback Response Generation Tests...\n');

  const responseTests = [
    {
      name: 'Clarification fallback',
      context: {
        query: 'What does it say?',
        fallbackType: 'clarification' as const,
        reason: 'Vague pronoun',
        documentCount: 5,
        documentNames: ['Report1.pdf', 'Report2.pdf', 'Budget.xlsx'],
        language: 'English',
      },
    },
    {
      name: 'Knowledge fallback (no documents)',
      context: {
        query: 'What is the revenue?',
        fallbackType: 'knowledge' as const,
        reason: 'No documents uploaded',
        documentCount: 0,
        language: 'English',
      },
    },
    {
      name: 'Refusal fallback (real-time data)',
      context: {
        query: 'What is the current stock price?',
        fallbackType: 'refusal' as const,
        reason: 'Real-time data not available',
        documentCount: 5,
        language: 'English',
      },
    },
    {
      name: 'Error recovery fallback',
      context: {
        query: 'Summarize the report',
        fallbackType: 'error_recovery' as const,
        reason: 'Technical error',
        documentCount: 5,
        errorDetails: 'Connection timeout',
        language: 'English',
      },
    },
  ];

  for (const test of responseTests) {
    console.log(`\nTesting: ${test.name}`);
    console.log(`Query: "${test.context.query}"`);

    try {
      const response = await fallbackResponse.generateFallbackResponse(test.context);

      console.log(`\nGenerated Response:\n${response}\n`);

      // Check psychological safety
      const safetyCheck = psychologicalSafety.checkResponseSafety(response);

      if (safetyCheck.isSafe) {
        console.log('Psychological safety: PASS');
      } else {
        console.log('Psychological safety issues:');
        safetyCheck.issues.forEach((issue) => console.log(`   - ${issue}`));
        console.log('Suggestions:');
        safetyCheck.suggestions.forEach((suggestion) => console.log(`   - ${suggestion}`));
      }

      // Check formatting
      const formatCheck = psychologicalSafety.checkFormatting(response);

      if (formatCheck.isValid) {
        console.log('Formatting: PASS');
      } else {
        console.log('Formatting issues:');
        formatCheck.issues.forEach((issue) => console.log(`   - ${issue}`));
      }

      // Check length
      const lengthCheck = psychologicalSafety.checkResponseLength(response, 'fallback');

      if (lengthCheck.isValid) {
        console.log('Length: PASS');
      } else {
        console.log(`Length issue: ${lengthCheck.issue}`);
      }

      console.log('---');
    } catch (error: any) {
      console.log(`Error generating response: ${error.message}`);
    }
  }
}

/**
 * Test psychological safety checker
 */
function runSafetyTests() {
  console.log('\nRunning Psychological Safety Tests...\n');

  const safetyTests = [
    {
      name: 'Good response (safe)',
      response:
        "I want to help you find that information. I see you're asking about 'the report,' but you have 3 reports uploaded. Which one are you interested in?",
      shouldPass: true,
    },
    {
      name: 'Bad response (blames user)',
      response:
        'Your question is unclear. Please be more specific about which document you mean.',
      shouldPass: false,
    },
    {
      name: 'Bad response (sounds incompetent)',
      response: "I don't know what you're asking about. I can't help with that.",
      shouldPass: false,
    },
    {
      name: 'Bad response (technical jargon)',
      response: 'Error 500: Internal server error. Stack trace: null pointer exception.',
      shouldPass: false,
    },
    {
      name: 'Bad response (no alternatives)',
      response: "I don't have that information.",
      shouldPass: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of safetyTests) {
    const result = psychologicalSafety.checkResponseSafety(test.response);
    const testPassed = result.isSafe === test.shouldPass;

    if (testPassed) {
      console.log(`PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`FAIL: ${test.name}`);
      console.log(`   Expected safe: ${test.shouldPass}, Got: ${result.isSafe}`);
      if (!result.isSafe) {
        console.log(`   Issues: ${result.issues.join(', ')}`);
      }
      failed++;
    }
  }

  console.log(
    `\nSafety Test Results: ${passed} passed, ${failed} failed out of ${safetyTests.length} tests`
  );
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting Fallback System Tests\n');
  console.log('='.repeat(60));

  // 1. Detection tests
  const detectionResults = await runDetectionTests();

  console.log('\n' + '='.repeat(60));

  // 2. Response generation tests
  await runResponseGenerationTests();

  console.log('\n' + '='.repeat(60));

  // 3. Safety tests
  runSafetyTests();

  console.log('\n' + '='.repeat(60));
  console.log('\nAll tests completed!\n');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, runDetectionTests, runResponseGenerationTests, runSafetyTests };
