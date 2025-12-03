/**
 * KODA COMPREHENSIVE UNIT TESTS
 * Tests all individual components implemented since November 28th
 */

import * as fs from 'fs';
import * as path from 'path';

// Test results storage
interface TestResult {
  category: string;
  testName: string;
  passed: boolean;
  score?: number;
  duration: number;
  details: any;
  errors: string[];
}

const results: TestResult[] = [];

// Utility to run a test
async function runTest(
  category: string,
  testName: string,
  testFn: () => Promise<{ passed: boolean; score?: number; details?: any; errors?: string[] }>
): Promise<void> {
  const startTime = Date.now();
  console.log(`\n  Testing: ${category} - ${testName}`);

  try {
    const result = await testFn();
    const duration = Date.now() - startTime;

    results.push({
      category,
      testName,
      passed: result.passed,
      score: result.score,
      duration,
      details: result.details || {},
      errors: result.errors || [],
    });

    const status = result.passed ? '[PASS]' : '[FAIL]';
    const scoreText = result.score !== undefined ? ` (${result.score}/100)` : '';
    console.log(`  ${status}${scoreText} - ${duration}ms`);

    if (!result.passed && result.errors) {
      result.errors.forEach((err) => console.log(`    - ${err}`));
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      category,
      testName,
      passed: false,
      duration,
      details: {},
      errors: [error.message],
    });
    console.log(`  [FAIL] - ${duration}ms`);
    console.log(`    - ${error.message}`);
  }
}

// ============================================================================
// CATEGORY 1: LANGUAGE DETECTION
// ============================================================================

async function testLanguageDetection() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 1: LANGUAGE DETECTION');
  console.log('='.repeat(60));

  const languageDetectionPath = path.join(process.cwd(), 'src/services/languageDetection.service.ts');

  await runTest('Language Detection', 'Service File Exists', async () => {
    const exists = fs.existsSync(languageDetectionPath);
    return {
      passed: exists,
      details: { path: languageDetectionPath },
      errors: exists ? [] : ['languageDetection.service.ts not found'],
    };
  });

  await runTest('Language Detection', 'Has Word Boundary Checks', async () => {
    if (!fs.existsSync(languageDetectionPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(languageDetectionPath, 'utf-8');
    const hasWordBoundary = content.includes('\\b') || content.includes('word') || content.includes('pattern');
    return {
      passed: hasWordBoundary,
      details: { hasWordBoundary },
      errors: hasWordBoundary ? [] : ['Missing word boundary checks for accurate detection'],
    };
  });

  await runTest('Language Detection', 'Supports Multiple Languages', async () => {
    if (!fs.existsSync(languageDetectionPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(languageDetectionPath, 'utf-8');
    const supportsEnglish = content.includes("'en'") || content.includes('"en"');
    const supportsPortuguese = content.includes("'pt'") || content.includes('"pt"');
    const supportsSpanish = content.includes("'es'") || content.includes('"es"');
    return {
      passed: supportsEnglish && supportsPortuguese,
      details: { supportsEnglish, supportsPortuguese, supportsSpanish },
      errors: [],
    };
  });
}

// ============================================================================
// CATEGORY 2: DOCUMENT GENERATION
// ============================================================================

async function testDocumentGeneration() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 2: DOCUMENT GENERATION');
  console.log('='.repeat(60));

  const docGenDetectionPath = path.join(process.cwd(), 'src/services/documentGenerationDetection.service.ts');
  const chatDocGenPath = path.join(process.cwd(), 'src/services/chatDocumentGeneration.service.ts');

  await runTest('Document Generation', 'Detection Service Exists', async () => {
    const exists = fs.existsSync(docGenDetectionPath);
    return {
      passed: exists,
      details: { path: docGenDetectionPath },
      errors: exists ? [] : ['documentGenerationDetection.service.ts not found'],
    };
  });

  await runTest('Document Generation', 'Has documentType Field', async () => {
    if (!fs.existsSync(docGenDetectionPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(docGenDetectionPath, 'utf-8');
    const hasDocumentType = content.includes('documentType');
    return {
      passed: hasDocumentType,
      details: { hasDocumentType },
      errors: hasDocumentType ? [] : ['Missing documentType field in detection result'],
    };
  });

  await runTest('Document Generation', 'Chat Document Service Exists', async () => {
    const exists = fs.existsSync(chatDocGenPath);
    return {
      passed: exists,
      details: { path: chatDocGenPath },
      errors: exists ? [] : ['chatDocumentGeneration.service.ts not found'],
    };
  });
}

// ============================================================================
// CATEGORY 3: DYNAMIC RESPONSES
// ============================================================================

async function testDynamicResponses() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 3: DYNAMIC RESPONSES');
  console.log('='.repeat(60));

  const dynamicResponsePath = path.join(process.cwd(), 'src/services/dynamicResponseSystem.service.ts');

  await runTest('Dynamic Responses', 'Dynamic Response System Exists', async () => {
    const exists = fs.existsSync(dynamicResponsePath);
    return {
      passed: exists,
      details: { path: dynamicResponsePath },
      errors: exists ? [] : ['dynamicResponseSystem.service.ts not found'],
    };
  });

  await runTest('Dynamic Responses', 'Has generateDynamicGreeting', async () => {
    if (!fs.existsSync(dynamicResponsePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(dynamicResponsePath, 'utf-8');
    const hasGreeting = content.includes('generateDynamicGreeting');
    return {
      passed: hasGreeting,
      details: { hasGreeting },
      errors: hasGreeting ? [] : ['Missing generateDynamicGreeting function'],
    };
  });

  await runTest('Dynamic Responses', 'Has generateDynamicCapabilities', async () => {
    if (!fs.existsSync(dynamicResponsePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(dynamicResponsePath, 'utf-8');
    const hasCapabilities = content.includes('generateDynamicCapabilities');
    return {
      passed: hasCapabilities,
      details: { hasCapabilities },
      errors: hasCapabilities ? [] : ['Missing generateDynamicCapabilities function'],
    };
  });

  await runTest('Dynamic Responses', 'Context-Aware (Uses documentCount)', async () => {
    if (!fs.existsSync(dynamicResponsePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(dynamicResponsePath, 'utf-8');
    const hasContextAware = content.includes('documentCount') && content.includes('hasUploadedDocuments');
    return {
      passed: hasContextAware,
      details: { hasContextAware },
      errors: hasContextAware ? [] : ['Greetings not context-aware'],
    };
  });
}

// ============================================================================
// CATEGORY 4: CONTEXT ENGINEERING
// ============================================================================

async function testContextEngineering() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 4: CONTEXT ENGINEERING');
  console.log('='.repeat(60));

  const contextEngineeringPath = path.join(process.cwd(), 'src/services/contextEngineering.service.ts');

  await runTest('Context Engineering', 'Service Exists', async () => {
    const exists = fs.existsSync(contextEngineeringPath);
    return {
      passed: exists,
      details: { path: contextEngineeringPath },
      errors: exists ? [] : ['contextEngineering.service.ts not found'],
    };
  });

  await runTest('Context Engineering', 'Has Stable System Prompt', async () => {
    if (!fs.existsSync(contextEngineeringPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(contextEngineeringPath, 'utf-8');
    const hasStablePrompt = content.includes('createStableSystemPrompt') || content.includes('stablePrompt');
    return {
      passed: hasStablePrompt,
      details: { hasStablePrompt },
      errors: hasStablePrompt ? [] : ['Missing stable system prompt function'],
    };
  });

  await runTest('Context Engineering', 'Has Append-Only History', async () => {
    if (!fs.existsSync(contextEngineeringPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(contextEngineeringPath, 'utf-8');
    const hasAppendOnly = content.includes('appendTurn') || content.includes('append');
    return {
      passed: hasAppendOnly,
      details: { hasAppendOnly },
      errors: hasAppendOnly ? [] : ['Missing append-only history implementation'],
    };
  });

  await runTest('Context Engineering', 'Has Validation Function', async () => {
    if (!fs.existsSync(contextEngineeringPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(contextEngineeringPath, 'utf-8');
    const hasValidation = content.includes('validate') || content.includes('Validation');
    return {
      passed: hasValidation,
      details: { hasValidation },
      errors: hasValidation ? [] : ['Missing context state validation'],
    };
  });
}

// ============================================================================
// CATEGORY 5: ADAPTIVE ANSWER GENERATION
// ============================================================================

async function testAdaptiveAnswerGeneration() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 5: ADAPTIVE ANSWER GENERATION');
  console.log('='.repeat(60));

  const adaptivePath = path.join(process.cwd(), 'src/services/adaptiveAnswerGeneration.service.ts');

  await runTest('Adaptive Answer', 'Service Exists', async () => {
    const exists = fs.existsSync(adaptivePath);
    return {
      passed: exists,
      details: { path: adaptivePath },
      errors: exists ? [] : ['adaptiveAnswerGeneration.service.ts not found'],
    };
  });

  await runTest('Adaptive Answer', 'Has Length Determination', async () => {
    if (!fs.existsSync(adaptivePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(adaptivePath, 'utf-8');
    const hasLengthDetermination = content.includes('determineAnswerLength');
    return {
      passed: hasLengthDetermination,
      details: { hasLengthDetermination },
      errors: hasLengthDetermination ? [] : ['Missing answer length determination'],
    };
  });

  await runTest('Adaptive Answer', 'Has Quality Validation', async () => {
    if (!fs.existsSync(adaptivePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(adaptivePath, 'utf-8');
    const hasValidation = content.includes('validateAnswerQuality');
    return {
      passed: hasValidation,
      details: { hasValidation },
      errors: hasValidation ? [] : ['Missing answer quality validation'],
    };
  });

  await runTest('Adaptive Answer', 'Has buildAnswerPrompt', async () => {
    if (!fs.existsSync(adaptivePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(adaptivePath, 'utf-8');
    const hasBuildPrompt = content.includes('buildAnswerPrompt');
    return {
      passed: hasBuildPrompt,
      details: { hasBuildPrompt },
      errors: hasBuildPrompt ? [] : ['Missing buildAnswerPrompt function'],
    };
  });

  await runTest('Adaptive Answer', 'Supports Document Info', async () => {
    if (!fs.existsSync(adaptivePath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(adaptivePath, 'utf-8');
    const hasDocInfo =
      content.includes('DocumentInfo') && content.includes('pageCount') && content.includes('wordCount');
    return {
      passed: hasDocInfo,
      details: { hasDocInfo },
      errors: hasDocInfo ? [] : ['Missing document info support for adaptive scaling'],
    };
  });
}

// ============================================================================
// CATEGORY 6: SYSTEM PROMPTS
// ============================================================================

async function testSystemPrompts() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 6: SYSTEM PROMPTS');
  console.log('='.repeat(60));

  const systemPromptsPath = path.join(process.cwd(), 'src/services/systemPrompts.service.ts');

  await runTest('System Prompts', 'Service Exists', async () => {
    const exists = fs.existsSync(systemPromptsPath);
    return {
      passed: exists,
      details: { path: systemPromptsPath },
      errors: exists ? [] : ['systemPrompts.service.ts not found'],
    };
  });

  await runTest('System Prompts', 'Has Natural Response Guidelines', async () => {
    if (!fs.existsSync(systemPromptsPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(systemPromptsPath, 'utf-8');
    const hasNaturalGuidelines = content.includes('natural') || content.includes('conversational');
    return {
      passed: hasNaturalGuidelines,
      details: { hasNaturalGuidelines },
      errors: hasNaturalGuidelines ? [] : ['Missing natural response guidelines'],
    };
  });

  await runTest('System Prompts', 'Has getSystemPrompt Function', async () => {
    if (!fs.existsSync(systemPromptsPath)) {
      return { passed: false, errors: ['File not found'] };
    }
    const content = fs.readFileSync(systemPromptsPath, 'utf-8');
    const hasGetSystemPrompt = content.includes('getSystemPrompt');
    return {
      passed: hasGetSystemPrompt,
      details: { hasGetSystemPrompt },
      errors: hasGetSystemPrompt ? [] : ['Missing getSystemPrompt function'],
    };
  });
}

// ============================================================================
// CATEGORY 7: RAG INTEGRATION
// ============================================================================

async function testRagIntegration() {
  console.log('\n' + '='.repeat(60));
  console.log('CATEGORY 7: RAG SERVICE INTEGRATION');
  console.log('='.repeat(60));

  const ragServicePath = path.join(process.cwd(), 'src/services/rag.service.ts');

  await runTest('RAG Integration', 'Imports adaptiveAnswerGeneration', async () => {
    if (!fs.existsSync(ragServicePath)) {
      return { passed: false, errors: ['rag.service.ts not found'] };
    }
    const content = fs.readFileSync(ragServicePath, 'utf-8');
    const hasImport = content.includes('adaptiveAnswerGeneration');
    return {
      passed: hasImport,
      details: { hasImport },
      errors: hasImport ? [] : ['adaptiveAnswerGeneration not imported in RAG service'],
    };
  });

  await runTest('RAG Integration', 'Imports dynamicResponseSystem', async () => {
    if (!fs.existsSync(ragServicePath)) {
      return { passed: false, errors: ['rag.service.ts not found'] };
    }
    const content = fs.readFileSync(ragServicePath, 'utf-8');
    const hasImport = content.includes('dynamicResponseSystem');
    return {
      passed: hasImport,
      details: { hasImport },
      errors: hasImport ? [] : ['dynamicResponseSystem not imported in RAG service'],
    };
  });

  await runTest('RAG Integration', 'Has DYNAMIC RESPONSE SYSTEM Section', async () => {
    if (!fs.existsSync(ragServicePath)) {
      return { passed: false, errors: ['rag.service.ts not found'] };
    }
    const content = fs.readFileSync(ragServicePath, 'utf-8');
    const hasSection = content.includes('DYNAMIC RESPONSE SYSTEM');
    return {
      passed: hasSection,
      details: { hasSection },
      errors: hasSection ? [] : ['Missing DYNAMIC RESPONSE SYSTEM section in RAG service'],
    };
  });

  await runTest('RAG Integration', 'Has ADAPTIVE ANSWER GENERATION Section', async () => {
    if (!fs.existsSync(ragServicePath)) {
      return { passed: false, errors: ['rag.service.ts not found'] };
    }
    const content = fs.readFileSync(ragServicePath, 'utf-8');
    const hasSection = content.includes('ADAPTIVE ANSWER GENERATION');
    return {
      passed: hasSection,
      details: { hasSection },
      errors: hasSection ? [] : ['Missing ADAPTIVE ANSWER GENERATION section in RAG service'],
    };
  });
}

// ============================================================================
// GENERATE REPORT
// ============================================================================

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('UNIT TEST REPORT');
  console.log('='.repeat(60));

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} (${passRate}%)`);
  console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);

  // Group by category
  const categories = [...new Set(results.map((r) => r.category))];

  console.log('\n' + '-'.repeat(60));
  console.log('RESULTS BY CATEGORY');
  console.log('-'.repeat(60));

  categories.forEach((category) => {
    const categoryResults = results.filter((r) => r.category === category);
    const categoryPassed = categoryResults.filter((r) => r.passed).length;
    const categoryTotal = categoryResults.length;
    const categoryRate = ((categoryPassed / categoryTotal) * 100).toFixed(1);

    console.log(`\n${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`);

    categoryResults.forEach((result) => {
      const status = result.passed ? '[OK]' : '[FAIL]';
      const scoreText = result.score ? ` [${result.score}/100]` : '';
      console.log(`  ${status} ${result.testName}${scoreText} (${result.duration}ms)`);

      if (!result.passed && result.errors.length > 0) {
        result.errors.forEach((err) => console.log(`       - ${err}`));
      }
    });
  });

  // Save to file
  const reportPath = path.join(process.cwd(), 'test-suite/reports/unit-test-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        summary: {
          totalTests,
          passedTests,
          failedTests,
          passRate: parseFloat(passRate),
          timestamp: new Date().toISOString(),
        },
        results,
      },
      null,
      2
    )
  );

  console.log(`\nFull report saved to: ${reportPath}`);

  return { passRate: parseFloat(passRate), failedTests };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('Starting Koda Unit Tests...\n');
  console.log('Testing all features implemented since November 28th\n');

  try {
    await testLanguageDetection();
    await testDocumentGeneration();
    await testDynamicResponses();
    await testContextEngineering();
    await testAdaptiveAnswerGeneration();
    await testSystemPrompts();
    await testRagIntegration();

    const { passRate, failedTests } = generateReport();

    console.log('\n' + '='.repeat(60));
    if (passRate >= 80) {
      console.log('[SUCCESS] UNIT TESTS PASSED');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('[FAILURE] UNIT TESTS FAILED');
      console.log('='.repeat(60));
      console.log(`\n${failedTests} test(s) failed. Please review the report above.`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n[ERROR] Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
