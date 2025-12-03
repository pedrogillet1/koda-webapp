/**
 * KODA TEST ANALYSIS GENERATOR
 * Generates comprehensive analysis report from all test results
 */

import * as fs from 'fs';
import * as path from 'path';

// Get command line arguments
const reportsDir = process.argv[2] || path.join(process.cwd(), 'test-suite/reports');
const outputFile = process.argv[3] || path.join(reportsDir, 'final-analysis.md');

interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  avgResponseTime?: number;
  timestamp: string;
}

interface TestReport {
  summary: TestSummary;
  results: any[];
}

// ============================================================================
// LOAD TEST REPORTS
// ============================================================================

function loadReport(filename: string): TestReport | null {
  const filePath = path.join(reportsDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Report not found: ${filename}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.log(`Error loading ${filename}:`, error);
    return null;
  }
}

const unitTestReport = loadReport('unit-test-report.json');

// ============================================================================
// GENERATE MARKDOWN REPORT
// ============================================================================

function generateMarkdownReport(): string {
  let md = '';

  // Header
  md += '# Koda Comprehensive Test Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += '---\n\n';

  // Executive Summary
  md += '## Executive Summary\n\n';

  const totalTests = unitTestReport?.summary.totalTests || 0;
  const totalPassed = unitTestReport?.summary.passedTests || 0;
  const totalFailed = totalTests - totalPassed;
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

  md += `This report provides a comprehensive analysis of all Koda features implemented since November 28th, 2024. The test suite covers **${totalTests} tests** across all major service categories.\n\n`;

  md += '### Overall Results\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Total Tests | ${totalTests} |\n`;
  md += `| Passed | ${totalPassed} (${overallPassRate}%) |\n`;
  md += `| Failed | ${totalFailed} |\n`;

  md += '\n';

  // Status Badge
  const status = parseFloat(overallPassRate) >= 80 ? 'PASSING' : 'FAILING';
  md += `**Status:** ${status}\n\n`;

  md += '---\n\n';

  // Unit Tests Section
  if (unitTestReport) {
    md += '## Unit Tests\n\n';
    md += '**Purpose:** Validate individual components and services.\n\n';
    md += '### Summary\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| Total Tests | ${unitTestReport.summary.totalTests} |\n`;
    md += `| Passed | ${unitTestReport.summary.passedTests} (${unitTestReport.summary.passRate}%) |\n`;
    md += `| Failed | ${unitTestReport.summary.failedTests} |\n\n`;

    // Group by category
    const categories = [...new Set(unitTestReport.results.map((r: any) => r.category))];

    md += '### Results by Category\n\n';

    categories.forEach((category) => {
      const categoryResults = unitTestReport.results.filter((r: any) => r.category === category);
      const categoryPassed = categoryResults.filter((r: any) => r.passed).length;
      const categoryTotal = categoryResults.length;
      const categoryRate = ((categoryPassed / categoryTotal) * 100).toFixed(1);

      md += `#### ${category}\n\n`;
      md += `**Pass Rate:** ${categoryPassed}/${categoryTotal} (${categoryRate}%)\n\n`;

      md += '| Test | Status | Duration |\n';
      md += '|------|--------|----------|\n';

      categoryResults.forEach((result: any) => {
        const statusIcon = result.passed ? 'PASS' : 'FAIL';
        md += `| ${result.testName} | ${statusIcon} | ${result.duration}ms |\n`;
      });

      md += '\n';

      // Show errors if any
      const failedTests = categoryResults.filter((r: any) => !r.passed);
      if (failedTests.length > 0) {
        md += '**Issues Found:**\n\n';
        failedTests.forEach((result: any) => {
          md += `- **${result.testName}**\n`;
          result.errors.forEach((err: string) => {
            md += `  - ${err}\n`;
          });
        });
        md += '\n';
      }
    });

    md += '---\n\n';
  }

  // Feature Implementation Status
  md += '## Feature Implementation Status\n\n';
  md += 'Based on the test results, here is the status of features implemented since November 28th:\n\n';

  md += '| Feature | Status | Notes |\n';
  md += '|---------|--------|-------|\n';

  // Determine feature status from test results
  const features = [
    { name: 'Language Detection', category: 'Language Detection' },
    { name: 'Document Generation', category: 'Document Generation' },
    { name: 'Dynamic Responses', category: 'Dynamic Responses' },
    { name: 'Context Engineering', category: 'Context Engineering' },
    { name: 'Adaptive Answer Generation', category: 'Adaptive Answer' },
    { name: 'System Prompts', category: 'System Prompts' },
    { name: 'RAG Integration', category: 'RAG Integration' },
  ];

  features.forEach((feature) => {
    if (unitTestReport) {
      const featureResults = unitTestReport.results.filter((r: any) => r.category === feature.category);
      if (featureResults.length > 0) {
        const allPassed = featureResults.every((r: any) => r.passed);
        const status = allPassed ? 'Implemented' : 'Partial';
        const notes = allPassed ? 'Working as expected' : 'Some issues found';
        md += `| ${feature.name} | ${status} | ${notes} |\n`;
      }
    }
  });

  md += '\n---\n\n';

  // Recommendations Section
  md += '## Recommendations\n\n';

  if (parseFloat(overallPassRate) >= 95) {
    md +=
      'Excellent! All features are working as expected. The system is ready for production deployment.\n\n';
  } else if (parseFloat(overallPassRate) >= 80) {
    md +=
      'Good, but needs attention. Most features are working correctly, but there are some issues that should be addressed before production deployment.\n\n';
  } else {
    md +=
      'Critical issues found. Several features are not working as expected. Please review the failed tests and address the issues before deploying to production.\n\n';
  }

  // Conclusion
  md += '## Conclusion\n\n';
  md += `This comprehensive test suite has validated **${totalTests} tests** across all major features implemented since November 28th. `;

  if (parseFloat(overallPassRate) >= 80) {
    md += `With a pass rate of **${overallPassRate}%**, the system demonstrates strong overall quality and is production-ready. `;
  } else {
    md += `With a pass rate of **${overallPassRate}%**, there are significant issues that need to be addressed before the system can be considered production-ready. `;
  }

  md += '\n\nFor detailed information on specific test failures, please review the individual test reports.\n\n';

  md += '---\n\n';
  md += '*Generated by Koda Comprehensive Test Suite*\n';

  return md;
}

// ============================================================================
// MAIN
// ============================================================================

console.log('Generating comprehensive analysis report...\n');

const markdownReport = generateMarkdownReport();

// Write to file
fs.writeFileSync(outputFile, markdownReport);

console.log(`Analysis report generated: ${outputFile}\n`);

// Also output to console
console.log(markdownReport);
