/**
 * Koda Semantic Understanding Test
 *
 * Validates that Koda:
 * 1. Understands natural language queries correctly
 * 2. Retrieves the correct documents
 * 3. Uses relevant information from those documents
 * 4. Provides accurate answers
 *
 * Shows which documents were used for each query and validates correctness.
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:5000',
  testUserId: process.env.TEST_USER_ID || 'cmaborxqx0000s96gfwgtghbv',
  testEmail: process.env.TEST_EMAIL || 'localhost@koda.com',
  testPassword: process.env.TEST_PASSWORD || 'localhost123',
  timeout: 60000, // Increased timeout
  delayBetweenTests: 5000, // 5 seconds between tests
  maxRetries: 2, // Retry failed requests
  outputDir: path.join(__dirname, '../test-results/semantic'),
};

// Auth token (set after login)
let authToken: string = '';

// ============================================================================
// TEST CASES
// ============================================================================

interface SemanticTest {
  id: number;
  category: string;
  query: string;
  expectedDocuments: string[]; // Documents that SHOULD be used
  forbiddenDocuments?: string[]; // Documents that SHOULD NOT be used
  expectedContent: string[]; // Content that MUST appear in response
  semanticIntent: string; // What the query is trying to find
  passIfAnyMatch?: boolean; // Pass if ANY expected doc is found (default: all)
}

const SEMANTIC_TESTS: SemanticTest[] = [
  // ========================================================================
  // CATEGORY 1: Specific Document Queries
  // ========================================================================
  {
    id: 1,
    category: 'Specific Document',
    query: 'What is in the Rosewood Fund v3 file?',
    expectedDocuments: ['Rosewood Fund v3.xlsx'],
    expectedContent: ['Rosewood Fund', 'MoIC', 'IRR'],
    semanticIntent: 'User wants information from a specific file',
  },

  {
    id: 2,
    category: 'Specific Document',
    query: 'Show me the Lone Mountain Ranch P&L for 2024',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx'],
    forbiddenDocuments: ['2025'],
    expectedContent: ['Lone Mountain Ranch', '2024', 'revenue'],
    semanticIntent: 'User wants 2024 P&L, not 2025',
  },

  {
    id: 3,
    category: 'Specific Document',
    query: 'What does the 2025 budget say?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    forbiddenDocuments: ['2024'],
    expectedContent: ['2025', 'budget'],
    semanticIntent: 'User wants 2025 budget, not 2024 actuals',
  },

  // ========================================================================
  // CATEGORY 2: Topic-Based Queries
  // ========================================================================
  {
    id: 4,
    category: 'Topic-Based',
    query: 'Tell me about the Rosewood Fund portfolio',
    expectedDocuments: ['Rosewood Fund v3.xlsx'],
    expectedContent: ['Rosewood Fund', 'properties', 'investment'],
    semanticIntent: 'User wants overview of Rosewood Fund',
    passIfAnyMatch: true,
  },

  {
    id: 5,
    category: 'Topic-Based',
    query: 'What do you know about Lone Mountain Ranch?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    expectedContent: ['Lone Mountain Ranch'],
    semanticIntent: 'User wants any info about Lone Mountain Ranch',
    passIfAnyMatch: true,
  },

  {
    id: 6,
    category: 'Topic-Based',
    query: 'Information about MoIC',
    expectedDocuments: ['Rosewood Fund v3.xlsx'],
    expectedContent: ['MoIC', 'multiple', 'investment'],
    semanticIntent: 'User wants MoIC information',
    passIfAnyMatch: true,
  },

  // ========================================================================
  // CATEGORY 3: Metric-Based Queries
  // ========================================================================
  {
    id: 7,
    category: 'Metric-Based',
    query: 'What is the total revenue?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    expectedContent: ['revenue', '$'],
    semanticIntent: 'User wants revenue data',
    passIfAnyMatch: true,
  },

  {
    id: 8,
    category: 'Metric-Based',
    query: 'Show me the IRR',
    expectedDocuments: ['Rosewood Fund v3.xlsx'],
    expectedContent: ['IRR', '%'],
    semanticIntent: 'User wants IRR metric',
  },

  {
    id: 9,
    category: 'Metric-Based',
    query: 'What are the expenses?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    expectedContent: ['expense', '$'],
    semanticIntent: 'User wants expense data',
    passIfAnyMatch: true,
  },

  // ========================================================================
  // CATEGORY 4: Time-Based Queries
  // ========================================================================
  {
    id: 10,
    category: 'Time-Based',
    query: 'What happened in 2024?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx'],
    forbiddenDocuments: ['2025'],
    expectedContent: ['2024'],
    semanticIntent: 'User wants 2024 data only',
  },

  {
    id: 11,
    category: 'Time-Based',
    query: 'What is the 2025 projection?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    forbiddenDocuments: ['2024'],
    expectedContent: ['2025', 'budget'],
    semanticIntent: 'User wants 2025 projections',
  },

  {
    id: 12,
    category: 'Time-Based',
    query: 'Compare 2024 to 2025',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    expectedContent: ['2024', '2025'],
    semanticIntent: 'User wants comparison across years',
  },

  // ========================================================================
  // CATEGORY 5: Cross-Document Queries
  // ========================================================================
  {
    id: 13,
    category: 'Cross-Document',
    query: 'What is the total portfolio value across all properties?',
    expectedDocuments: ['Rosewood Fund v3.xlsx'],
    expectedContent: ['portfolio', 'total', '$'],
    semanticIntent: 'User wants aggregated data from multiple properties',
    passIfAnyMatch: true,
  },

  {
    id: 14,
    category: 'Cross-Document',
    query: 'How is Lone Mountain Ranch performing compared to other properties?',
    expectedDocuments: ['Rosewood Fund v3.xlsx', 'Lone Mountain Ranch P&L 2024.xlsx'],
    expectedContent: ['Lone Mountain Ranch', 'performance'],
    semanticIntent: 'User wants comparative analysis',
    passIfAnyMatch: true,
  },

  // ========================================================================
  // CATEGORY 6: Implicit Queries (Requires Understanding)
  // ========================================================================
  {
    id: 15,
    category: 'Implicit Query',
    query: 'Is the ranch profitable?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Lone Mountain Ranch P&L 2025 (Budget).xlsx'],
    expectedContent: ['profit', 'Lone Mountain Ranch'],
    semanticIntent: 'User asking about Lone Mountain Ranch profitability',
    passIfAnyMatch: true,
  },

  {
    id: 16,
    category: 'Implicit Query',
    query: 'How are the investments doing?',
    expectedDocuments: ['Rosewood Fund v3.xlsx'],
    expectedContent: ['investment', 'performance', 'MoIC'],
    semanticIntent: 'User asking about Rosewood Fund investment performance',
    passIfAnyMatch: true,
  },

  {
    id: 17,
    category: 'Implicit Query',
    query: 'What is the biggest revenue source?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx'],
    expectedContent: ['revenue', 'Room', 'F&B'],
    semanticIntent: 'User wants revenue breakdown',
    passIfAnyMatch: true,
  },

  // ========================================================================
  // CATEGORY 7: Ambiguous Queries (Tests Disambiguation)
  // ========================================================================
  {
    id: 18,
    category: 'Ambiguous Query',
    query: 'What is the total?',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Rosewood Fund v3.xlsx'],
    expectedContent: ['total', '$'],
    semanticIntent: 'Ambiguous - should ask for clarification or provide multiple totals',
    passIfAnyMatch: true,
  },

  {
    id: 19,
    category: 'Ambiguous Query',
    query: 'Show me the numbers',
    expectedDocuments: ['Lone Mountain Ranch P&L 2024.xlsx', 'Rosewood Fund v3.xlsx'],
    expectedContent: ['$'],
    semanticIntent: 'Vague - should provide key metrics',
    passIfAnyMatch: true,
  },

  // ========================================================================
  // CATEGORY 8: Negative Tests (Should NOT Find)
  // ========================================================================
  {
    id: 20,
    category: 'Negative Test',
    query: 'What is the Q3 2026 forecast?',
    expectedDocuments: [],
    forbiddenDocuments: ['2024', '2025'],
    expectedContent: ['not', 'don\'t', 'unable', 'no data', 'doesn\'t'],
    semanticIntent: 'User asks for data that doesn\'t exist - should say not found',
  },
];

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function login(): Promise<string> {
  console.log(`\n🔐 Logging in as ${CONFIG.testEmail}...`);

  try {
    const response = await axios.post(
      `${CONFIG.baseUrl}/api/auth/login`,
      {
        email: CONFIG.testEmail,
        password: CONFIG.testPassword,
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const token = response.data.accessToken || response.data.token;
    if (!token) {
      throw new Error('No token returned from login');
    }

    console.log(`✅ Login successful! User ID: ${response.data.user?.id || 'unknown'}`);

    // Update CONFIG with actual user ID if available
    if (response.data.user?.id) {
      (CONFIG as any).testUserId = response.data.user.id;
    }

    return token;
  } catch (error: any) {
    console.error(`❌ Login failed: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

// ============================================================================
// DOCUMENT EXTRACTION
// ============================================================================

function extractDocumentsFromResponse(response: string): string[] {
  const documents: string[] = [];

  // Pattern 1: "Document.xlsx" or "Document.pdf"
  const filePattern = /["']?([^"'\n]+\.(xlsx|pdf|csv|docx))["']?/gi;
  let match;
  while ((match = filePattern.exec(response)) !== null) {
    documents.push(match[1]);
  }

  // Pattern 2: (document ID ...)
  const docIdPattern = /\(document ID ([a-f0-9-]+)\)/gi;
  while ((match = docIdPattern.exec(response)) !== null) {
    documents.push(`doc-${match[1].substring(0, 8)}`);
  }

  // Pattern 3: Look for document names mentioned in response
  const knownDocPatterns = [
    /Rosewood Fund v3/gi,
    /Lone Mountain Ranch P&L 2024/gi,
    /Lone Mountain Ranch P&L 2025/gi,
    /Lone Mountain Ranch.*2024/gi,
    /Lone Mountain Ranch.*2025/gi,
  ];

  for (const pattern of knownDocPatterns) {
    if (pattern.test(response)) {
      const matchText = response.match(pattern)?.[0];
      if (matchText) {
        if (matchText.toLowerCase().includes('rosewood')) {
          documents.push('Rosewood Fund v3.xlsx');
        } else if (matchText.includes('2024')) {
          documents.push('Lone Mountain Ranch P&L 2024.xlsx');
        } else if (matchText.includes('2025')) {
          documents.push('Lone Mountain Ranch P&L 2025 (Budget).xlsx');
        }
      }
    }
  }

  // Remove duplicates
  return [...new Set(documents)];
}

function normalizeDocumentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['"]/g, '')
    .trim();
}

function documentsMatch(found: string, expected: string): boolean {
  const normalizedFound = normalizeDocumentName(found);
  const normalizedExpected = normalizeDocumentName(expected);

  // Exact match
  if (normalizedFound === normalizedExpected) {
    return true;
  }

  // Partial match (found contains expected or vice versa)
  if (normalizedFound.includes(normalizedExpected) || normalizedExpected.includes(normalizedFound)) {
    return true;
  }

  // Special cases for year-based matching
  if (normalizedExpected.includes('2024') && normalizedFound.includes('2024')) {
    return true;
  }
  if (normalizedExpected.includes('2025') && normalizedFound.includes('2025')) {
    return true;
  }
  if (normalizedExpected.includes('rosewood') && normalizedFound.includes('rosewood')) {
    return true;
  }

  return false;
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  details: {
    foundDocuments: string[];
    expectedDocuments: string[];
    correctDocuments: string[];
    incorrectDocuments: string[];
    missingDocuments: string[];
    forbiddenDocumentsUsed: string[];
    hasExpectedContent: boolean;
    missingContent: string[];
  };
}

function validateSemanticUnderstanding(
  response: string,
  test: SemanticTest
): ValidationResult {
  const issues: string[] = [];
  let score = 100;

  // Extract documents from response
  const foundDocuments = extractDocumentsFromResponse(response);

  // Check expected documents
  const correctDocuments: string[] = [];
  const missingDocuments: string[] = [];

  for (const expectedDoc of test.expectedDocuments) {
    const found = foundDocuments.some(doc => documentsMatch(doc, expectedDoc));
    if (found) {
      correctDocuments.push(expectedDoc);
    } else {
      missingDocuments.push(expectedDoc);
    }
  }

  // Check if pass criteria met
  const passIfAnyMatch = test.passIfAnyMatch || false;
  let documentCheckPassed: boolean;

  if (test.expectedDocuments.length === 0) {
    // Negative test - no documents expected
    documentCheckPassed = true;
  } else {
    documentCheckPassed = passIfAnyMatch
      ? correctDocuments.length > 0
      : missingDocuments.length === 0;
  }

  if (!documentCheckPassed) {
    if (passIfAnyMatch) {
      issues.push(`No expected documents found (expected any of: ${test.expectedDocuments.join(', ')})`);
      score -= 40;
    } else {
      issues.push(`Missing documents: ${missingDocuments.join(', ')}`);
      score -= 20 * missingDocuments.length;
    }
  }

  // Check forbidden documents
  const forbiddenDocumentsUsed: string[] = [];
  if (test.forbiddenDocuments) {
    for (const forbiddenDoc of test.forbiddenDocuments) {
      // Check both document names and response content
      const foundInDocs = foundDocuments.some(doc => documentsMatch(doc, forbiddenDoc));
      const foundInResponse = response.toLowerCase().includes(forbiddenDoc.toLowerCase());

      if (foundInDocs) {
        forbiddenDocumentsUsed.push(forbiddenDoc);
        issues.push(`Used forbidden document: ${forbiddenDoc}`);
        score -= 30;
      }
    }
  }

  // Check incorrect documents (found but not expected)
  const incorrectDocuments = foundDocuments.filter(doc => {
    const isExpected = test.expectedDocuments.some(expected => documentsMatch(doc, expected));
    const isForbidden = test.forbiddenDocuments?.some(forbidden => documentsMatch(doc, forbidden)) || false;
    return !isExpected && !isForbidden;
  });

  if (incorrectDocuments.length > 0 && test.expectedDocuments.length > 0) {
    issues.push(`Unexpected documents used: ${incorrectDocuments.join(', ')}`);
    score -= 10 * Math.min(incorrectDocuments.length, 3);
  }

  // Check expected content
  const missingContent: string[] = [];
  for (const content of test.expectedContent) {
    if (!response.toLowerCase().includes(content.toLowerCase())) {
      missingContent.push(content);
    }
  }

  if (missingContent.length > 0) {
    issues.push(`Missing expected content: ${missingContent.join(', ')}`);
    score -= 15 * missingContent.length;
  }

  const hasExpectedContent = missingContent.length === 0;

  // Final score and pass/fail
  score = Math.max(0, score);

  // For negative tests, check if response indicates data not found
  if (test.expectedDocuments.length === 0) {
    const indicatesNotFound = test.expectedContent.some(c =>
      response.toLowerCase().includes(c.toLowerCase())
    );
    const passed = indicatesNotFound && forbiddenDocumentsUsed.length === 0;
    return {
      passed,
      score: passed ? 100 : 50,
      issues: passed ? [] : ['Response should indicate data not found'],
      details: {
        foundDocuments,
        expectedDocuments: test.expectedDocuments,
        correctDocuments,
        incorrectDocuments,
        missingDocuments,
        forbiddenDocumentsUsed,
        hasExpectedContent: indicatesNotFound,
        missingContent: indicatesNotFound ? [] : test.expectedContent,
      },
    };
  }

  const passed = score >= 70 && documentCheckPassed;

  return {
    passed,
    score,
    issues,
    details: {
      foundDocuments,
      expectedDocuments: test.expectedDocuments,
      correctDocuments,
      incorrectDocuments,
      missingDocuments,
      forbiddenDocumentsUsed,
      hasExpectedContent,
      missingContent,
    },
  };
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

interface TestResult {
  test: SemanticTest;
  response: string;
  responseTime: number;
  validation: ValidationResult;
}

const results: TestResult[] = [];

async function runTestWithRetry(test: SemanticTest, attempt: number = 1): Promise<{ response: any; conversationId: string }> {
  const conversationId = `semantic-test-${test.id}-${Date.now()}`;

  try {
    // First, create a conversation
    const convResponse = await axios.post(
      `${CONFIG.baseUrl}/api/chat/conversations`,
      {
        title: `Semantic Test ${test.id}`,
      },
      {
        timeout: CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    const actualConversationId = convResponse.data.id || conversationId;

    // Send query
    const response = await axios.post(
      `${CONFIG.baseUrl}/api/chat/conversations/${actualConversationId}/messages`,
      {
        content: test.query,
      },
      {
        timeout: CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    return { response, conversationId: actualConversationId };
  } catch (error: any) {
    if (attempt < CONFIG.maxRetries) {
      console.log(`   ⚠️ Attempt ${attempt} failed, retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return runTestWithRetry(test, attempt + 1);
    }
    throw error;
  }
}

async function runTest(test: SemanticTest): Promise<TestResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📝 TEST ${test.id}/20: ${test.category}`);
  console.log(`❓ Query: "${test.query}"`);
  console.log(`🎯 Intent: ${test.semanticIntent}`);
  console.log(`📄 Expected Docs: ${test.expectedDocuments.length > 0 ? test.expectedDocuments.join(', ') : 'None (negative test)'}`);
  if (test.forbiddenDocuments && test.forbiddenDocuments.length > 0) {
    console.log(`🚫 Forbidden: ${test.forbiddenDocuments.join(', ')}`);
  }
  console.log('='.repeat(80));

  const startTime = Date.now();

  try {
    const { response } = await runTestWithRetry(test);

    const responseTime = Date.now() - startTime;
    // Handle different response formats
    const responseText = response.data.assistantMessage?.content
      || response.data.response
      || response.data.message
      || '';

    console.log(`\n💬 Response (${responseTime}ms):`);
    console.log(responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));

    // Validate
    const validation = validateSemanticUnderstanding(responseText, test);

    console.log(`\n📄 Documents Found: ${validation.details.foundDocuments.length}`);
    if (validation.details.foundDocuments.length > 0) {
      validation.details.foundDocuments.forEach(doc => {
        const isCorrect = validation.details.correctDocuments.some(correct =>
          documentsMatch(doc, correct)
        );
        const isForbidden = validation.details.forbiddenDocumentsUsed.some(forbidden =>
          documentsMatch(doc, forbidden)
        );
        const status = isForbidden ? '🚫' : isCorrect ? '✅' : '⚠️';
        console.log(`   ${status} ${doc}`);
      });
    } else {
      console.log('   (No documents detected in response)');
    }

    console.log(`\n✅ Correct: ${validation.details.correctDocuments.length}`);
    console.log(`❌ Missing: ${validation.details.missingDocuments.length}`);
    if (validation.details.missingDocuments.length > 0) {
      console.log(`   ${validation.details.missingDocuments.join(', ')}`);
    }
    console.log(`⚠️ Unexpected: ${validation.details.incorrectDocuments.length}`);
    if (validation.details.incorrectDocuments.length > 0) {
      console.log(`   ${validation.details.incorrectDocuments.join(', ')}`);
    }
    if (validation.details.forbiddenDocumentsUsed.length > 0) {
      console.log(`🚫 Forbidden Used: ${validation.details.forbiddenDocumentsUsed.length}`);
      console.log(`   ${validation.details.forbiddenDocumentsUsed.join(', ')}`);
    }

    console.log(`\n📊 Score: ${validation.score}/100 ${validation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (validation.issues.length > 0) {
      console.log('   Issues:');
      validation.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    const result: TestResult = {
      test,
      response: responseText,
      responseTime,
      validation,
    };

    results.push(result);
    return result;

  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}`);

    const result: TestResult = {
      test,
      response: `ERROR: ${error.message}`,
      responseTime: Date.now() - startTime,
      validation: {
        passed: false,
        score: 0,
        issues: ['Request failed'],
        details: {
          foundDocuments: [],
          expectedDocuments: test.expectedDocuments,
          correctDocuments: [],
          incorrectDocuments: [],
          missingDocuments: test.expectedDocuments,
          forbiddenDocumentsUsed: [],
          hasExpectedContent: false,
          missingContent: test.expectedContent,
        },
      },
    };

    results.push(result);
    return result;
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateSummaryReport() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 SEMANTIC UNDERSTANDING TEST - SUMMARY');
  console.log('='.repeat(80));

  const totalTests = results.length;
  const passedTests = results.filter(r => r.validation.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`\nOverall Results:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failedTests}`);

  // Average scores
  const avgScore = results.reduce((sum, r) => sum + r.validation.score, 0) / results.length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  console.log(`\nAverage Score: ${avgScore.toFixed(1)}/100`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);

  // Document accuracy
  const totalExpectedDocs = results.reduce((sum, r) => sum + r.test.expectedDocuments.length, 0);
  const totalCorrectDocs = results.reduce((sum, r) => sum + r.validation.details.correctDocuments.length, 0);
  const totalIncorrectDocs = results.reduce((sum, r) => sum + r.validation.details.incorrectDocuments.length, 0);
  const totalForbiddenUsed = results.reduce((sum, r) => sum + r.validation.details.forbiddenDocumentsUsed.length, 0);

  console.log(`\nDocument Accuracy:`);
  if (totalExpectedDocs > 0) {
    console.log(`   Correct Documents: ${totalCorrectDocs}/${totalExpectedDocs} (${((totalCorrectDocs / totalExpectedDocs) * 100).toFixed(1)}%)`);
  } else {
    console.log(`   Correct Documents: N/A`);
  }
  console.log(`   Incorrect Documents: ${totalIncorrectDocs}`);
  console.log(`   Forbidden Documents Used: ${totalForbiddenUsed}`);

  // Results by category
  console.log(`\nResults by Category:`);
  const categories = [...new Set(results.map(r => r.test.category))];
  for (const category of categories) {
    const categoryResults = results.filter(r => r.test.category === category);
    const categoryPassed = categoryResults.filter(r => r.validation.passed).length;
    const categoryScore = categoryResults.reduce((sum, r) => sum + r.validation.score, 0) / categoryResults.length;
    console.log(`   ${category}: ${categoryPassed}/${categoryResults.length} (${categoryScore.toFixed(1)}/100)`);
  }

  // Failed tests
  if (failedTests > 0) {
    console.log(`\nFailed Tests:`);
    results.filter(r => !r.validation.passed).forEach(r => {
      console.log(`\n   ❌ Test ${r.test.id}: ${r.test.query}`);
      console.log(`      Score: ${r.validation.score}/100`);
      console.log(`      Issues: ${r.validation.issues.length}`);
      r.validation.issues.forEach(issue => console.log(`         - ${issue}`));
    });
  }

  // Final verdict
  console.log(`\n${'='.repeat(80)}`);
  const passRate = (passedTests / totalTests) * 100;
  const docAccuracy = totalExpectedDocs > 0 ? (totalCorrectDocs / totalExpectedDocs) * 100 : 100;

  if (passRate >= 90 && docAccuracy >= 90 && totalForbiddenUsed === 0) {
    console.log('✅ EXCELLENT: Semantic understanding is working perfectly!');
  } else if (passRate >= 75 && docAccuracy >= 75) {
    console.log('✅ GOOD: Semantic understanding is working well');
  } else if (passRate >= 60) {
    console.log('⚠️ WARNING: Semantic understanding needs improvement');
  } else {
    console.log('❌ CRITICAL: Major problems with semantic understanding');
  }
  console.log('='.repeat(80));
}

async function saveResults() {
  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const timestamp = Date.now();

  // Save JSON report
  const jsonReport = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    summary: {
      totalTests: results.length,
      passedTests: results.filter(r => r.validation.passed).length,
      avgScore: (results.reduce((sum, r) => sum + r.validation.score, 0) / results.length).toFixed(1),
      documentAccuracy: {
        totalExpected: results.reduce((sum, r) => sum + r.test.expectedDocuments.length, 0),
        totalCorrect: results.reduce((sum, r) => sum + r.validation.details.correctDocuments.length, 0),
        totalIncorrect: results.reduce((sum, r) => sum + r.validation.details.incorrectDocuments.length, 0),
        totalForbiddenUsed: results.reduce((sum, r) => sum + r.validation.details.forbiddenDocumentsUsed.length, 0),
      },
    },
    results,
  };

  const jsonFilename = path.join(CONFIG.outputDir, `semantic-test-${timestamp}.json`);
  fs.writeFileSync(jsonFilename, JSON.stringify(jsonReport, null, 2));
  console.log(`\n💾 JSON report saved: ${jsonFilename}`);

  // Save HTML report
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Koda Semantic Understanding Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .summary { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .test-result { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .test-header { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
    .query { font-size: 18px; font-weight: bold; margin: 10px 0; }
    .intent { color: #666; font-style: italic; }
    .documents { margin: 15px 0; }
    .doc-list { list-style: none; padding: 0; }
    .doc-item { padding: 8px; margin: 5px 0; border-radius: 4px; }
    .doc-item.correct { background: #d4edda; color: #155724; }
    .doc-item.incorrect { background: #fff3cd; color: #856404; }
    .doc-item.forbidden { background: #f8d7da; color: #721c24; }
    .doc-item.missing { background: #f8d7da; color: #721c24; }
    .score { font-size: 24px; font-weight: bold; margin: 15px 0; }
    .score.pass { color: #28a745; }
    .score.fail { color: #dc3545; }
    .issues { background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px; }
    .response-preview { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; max-height: 200px; overflow-y: auto; }
    h1 { color: #333; }
    .stat { display: inline-block; margin-right: 30px; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { color: #666; }
  </style>
</head>
<body>
  <h1>🔍 Koda Semantic Understanding Test Results</h1>
  <p>Generated: ${new Date().toISOString()}</p>

  <div class="summary">
    <h2>📊 Summary</h2>
    <div class="stat">
      <div class="stat-value">${jsonReport.summary.passedTests}/${jsonReport.summary.totalTests}</div>
      <div class="stat-label">Tests Passed</div>
    </div>
    <div class="stat">
      <div class="stat-value">${jsonReport.summary.avgScore}/100</div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat">
      <div class="stat-value">${jsonReport.summary.documentAccuracy.totalCorrect}/${jsonReport.summary.documentAccuracy.totalExpected}</div>
      <div class="stat-label">Documents Found</div>
    </div>
    <div class="stat">
      <div class="stat-value">${jsonReport.summary.documentAccuracy.totalForbiddenUsed}</div>
      <div class="stat-label">Forbidden Used</div>
    </div>
  </div>
`;

  for (const result of results) {
    html += `
  <div class="test-result">
    <div class="test-header">
      <div>Test ${result.test.id}/20 - ${result.test.category}</div>
      <div class="query">${result.test.query}</div>
      <div class="intent">Intent: ${result.test.semanticIntent}</div>
    </div>

    <div class="response-preview">
      <strong>Response (${result.responseTime}ms):</strong><br>
      ${result.response.substring(0, 500).replace(/\n/g, '<br>')}${result.response.length > 500 ? '...' : ''}
    </div>

    <div class="documents">
      <strong>Documents Found:</strong>
      <ul class="doc-list">
        ${result.validation.details.foundDocuments.map(doc => {
          const isCorrect = result.validation.details.correctDocuments.some(c => documentsMatch(doc, c));
          const isForbidden = result.validation.details.forbiddenDocumentsUsed.some(f => documentsMatch(doc, f));
          const className = isForbidden ? 'forbidden' : isCorrect ? 'correct' : 'incorrect';
          const icon = isForbidden ? '🚫' : isCorrect ? '✅' : '⚠️';
          return `<li class="doc-item ${className}">${icon} ${doc}</li>`;
        }).join('')}
        ${result.validation.details.foundDocuments.length === 0 ? '<li class="doc-item">(No documents detected)</li>' : ''}
      </ul>

      ${result.validation.details.missingDocuments.length > 0 ? `
      <div style="margin-top: 10px;">
        <strong>Missing Expected:</strong>
        <ul class="doc-list">
          ${result.validation.details.missingDocuments.map(doc => `<li class="doc-item missing">❌ ${doc}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <div class="score ${result.validation.passed ? 'pass' : 'fail'}">
      ${result.validation.score}/100 ${result.validation.passed ? '✅ PASSED' : '❌ FAILED'}
    </div>

    ${result.validation.issues.length > 0 ? `
    <div class="issues">
      <strong>Issues:</strong>
      <ul>
        ${result.validation.issues.map(issue => `<li>${issue}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
  </div>
`;
  }

  html += `
</body>
</html>`;

  const htmlFilename = path.join(CONFIG.outputDir, `semantic-test-${timestamp}.html`);
  fs.writeFileSync(htmlFilename, html);
  console.log(`💾 HTML report saved: ${htmlFilename}`);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('🚀 Koda Semantic Understanding Test');
  console.log('='.repeat(80));
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Test Email: ${CONFIG.testEmail}`);
  console.log(`Total Tests: ${SEMANTIC_TESTS.length}`);
  console.log('='.repeat(80));

  try {
    // Login first
    authToken = await login();
    console.log(`Test User ID: ${CONFIG.testUserId}`);

    // Run all tests
    for (const test of SEMANTIC_TESTS) {
      await runTest(test);

      // Delay between tests to let backend recover
      console.log(`\n⏳ Waiting ${CONFIG.delayBetweenTests / 1000}s before next test...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenTests));
    }

    // Generate reports
    generateSummaryReport();
    await saveResults();

    console.log(`\n✅ Semantic understanding test completed!`);
    console.log(`📁 Results saved to: ${CONFIG.outputDir}`);

    // Exit with appropriate code
    const failedCount = results.filter(r => !r.validation.passed).length;
    process.exit(failedCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Fatal error during test:', error);
    process.exit(1);
  }
}

// Run tests
main();
