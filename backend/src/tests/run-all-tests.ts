import * as geminiTests from './01-gemini.test';
import * as intentTests from './02-intent-detection.test';
import * as fileCreationTests from './03-file-creation.test';
import * as folderTests from './04-folder-management.test';
import * as conversationTests from './05-conversation.test';
import * as memoryTests from './06-memory.test';
import * as calculationTests from './07-calculation.test';
import * as documentQueryTests from './08-document-queries.test';
import prisma from '../config/database';

interface TestSuiteResult {
  suite: string;
  passed: number;
  failed: number;
  duration: number;
  tests: any[];
}

async function runAllTests() {
  const suiteResults: TestSuiteResult[] = [];
  const startTime = Date.now();

  // Test Suite 1: Gemini
  const geminiResults = await geminiTests.runTests();
  suiteResults.push({
    suite: 'Gemini AI Service',
    passed: geminiResults.filter(r => r.passed).length,
    failed: geminiResults.filter(r => !r.passed).length,
    duration: geminiResults.reduce((sum, r) => sum + r.duration, 0),
    tests: geminiResults
  });

  // Test Suite 2: Intent Detection
  const intentResults = await intentTests.runTests();
  suiteResults.push({
    suite: 'Intent Detection',
    passed: intentResults.filter(r => r.passed).length,
    failed: intentResults.filter(r => !r.passed).length,
    duration: intentResults.reduce((sum, r) => sum + r.duration, 0),
    tests: intentResults
  });

  // Test Suite 3: File Creation
  const fileCreationResults = await fileCreationTests.runTests();
  suiteResults.push({
    suite: 'File Creation',
    passed: fileCreationResults.filter(r => r.passed).length,
    failed: fileCreationResults.filter(r => !r.passed).length,
    duration: fileCreationResults.reduce((sum, r) => sum + r.duration, 0),
    tests: fileCreationResults
  });

  // Test Suite 4: Folder Management
  const folderResults = await folderTests.runTests();
  suiteResults.push({
    suite: 'Folder Management',
    passed: folderResults.filter(r => r.passed).length,
    failed: folderResults.filter(r => !r.passed).length,
    duration: folderResults.reduce((sum, r) => sum + r.duration, 0),
    tests: folderResults
  });

  // Test Suite 5: Conversations
  const conversationResults = await conversationTests.runTests();
  suiteResults.push({
    suite: 'Conversations',
    passed: conversationResults.filter(r => r.passed).length,
    failed: conversationResults.filter(r => !r.passed).length,
    duration: conversationResults.reduce((sum, r) => sum + r.duration, 0),
    tests: conversationResults
  });

  // Test Suite 6: User Memory
  const memoryResults = await memoryTests.runTests();
  suiteResults.push({
    suite: 'User Memory',
    passed: memoryResults.filter(r => r.passed).length,
    failed: memoryResults.filter(r => !r.passed).length,
    duration: memoryResults.reduce((sum, r) => sum + r.duration, 0),
    tests: memoryResults
  });

  // Test Suite 7: Calculation
  const calculationResults = await calculationTests.runTests();
  suiteResults.push({
    suite: 'Calculation',
    passed: calculationResults.filter(r => r.passed).length,
    failed: calculationResults.filter(r => !r.passed).length,
    duration: calculationResults.reduce((sum, r) => sum + r.duration, 0),
    tests: calculationResults
  });

  // Test Suite 8: Document Queries
  const documentQueryResults = await documentQueryTests.runTests();
  suiteResults.push({
    suite: 'Document Queries',
    passed: documentQueryResults.filter(r => r.passed).length,
    failed: documentQueryResults.filter(r => !r.passed).length,
    duration: documentQueryResults.reduce((sum, r) => sum + r.duration, 0),
    tests: documentQueryResults
  });

  const totalDuration = Date.now() - startTime;

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    totalDuration,
    suites: suiteResults,
    summary: {
      totalTests: suiteResults.reduce((sum, s) => sum + s.passed + s.failed, 0),
      totalPassed: suiteResults.reduce((sum, s) => sum + s.passed, 0),
      totalFailed: suiteResults.reduce((sum, s) => sum + s.failed, 0),
      successRate: 0
    }
  };

  report.summary.successRate =
    (report.summary.totalPassed / report.summary.totalTests) * 100;

  // Save report to file
  const fs = require('fs');
  const reportPath = `/tmp/koda-test-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Cleanup
  await prisma.$disconnect();

  return { report, reportPath };
}

runAllTests()
  .then(({ report, reportPath }) => {
    process.stdout.write(JSON.stringify({
      success: report.summary.totalFailed === 0,
      passed: report.summary.totalPassed,
      failed: report.summary.totalFailed,
      total: report.summary.totalTests,
      successRate: report.summary.successRate.toFixed(1),
      duration: report.totalDuration,
      reportPath
    }));
    process.exit(report.summary.totalFailed === 0 ? 0 : 1);
  })
  .catch(error => {
    process.stderr.write(JSON.stringify({ error: error.message }));
    process.exit(1);
  });
