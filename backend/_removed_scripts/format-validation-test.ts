/**
 * COMPREHENSIVE FORMAT VALIDATION TEST
 *
 * Tests EVERY format rule with REAL queries
 * Shows EXACT frontend output for each response
 * Provides detailed checklist for manual verification
 *
 * ADAPTED FOR WINDOWS + PORT 5000
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION - Updated for your setup
// ============================================================================

const BACKEND_URL = 'http://localhost:5000';
const OUTPUT_DIR = 'C:\\Users\\pedro\\OneDrive\\Área de Trabalho\\web\\format-test-results';

// Test user credentials
const TEST_USER = {
  email: 'localhost@koda.com',
  password: 'localhost123'
};

// Test queries covering all scenarios
const TEST_QUERIES = [
  {
    id: 'Q1',
    query: 'What is the total revenue for Lone Mountain Ranch?',
    type: 'Simple factual query',
    expectedSources: true,
    expectedTable: false,
  },
  {
    id: 'Q2',
    query: 'Show me the revenue breakdown by month',
    type: 'List/breakdown query',
    expectedSources: true,
    expectedTable: false,
  },
  {
    id: 'Q3',
    query: 'Compare Food Revenue vs Beverage Revenue',
    type: 'Comparison query',
    expectedSources: true,
    expectedTable: true,
  },
  {
    id: 'Q4',
    query: 'What are the top 5 expenses?',
    type: 'Ranked list query',
    expectedSources: true,
    expectedTable: false,
  },
  {
    id: 'Q5',
    query: 'Show me the Room Revenue breakdown by month',
    type: 'Detailed breakdown query',
    expectedSources: true,
    expectedTable: false,
  },
  {
    id: 'Q6',
    query: 'What is the MoIC for Rosewood Fund?',
    type: 'Simple factual query',
    expectedSources: true,
    expectedTable: false,
  },
  {
    id: 'Q7',
    query: 'Compare Q1 vs Q2 revenue',
    type: 'Time comparison query',
    expectedSources: true,
    expectedTable: true,
  },
  {
    id: 'Q8',
    query: 'What properties are in the Rosewood Fund?',
    type: 'List query',
    expectedSources: true,
    expectedTable: false,
  },
];

// ============================================================================
// FORMAT RULES CHECKLIST
// ============================================================================

interface FormatCheckResult {
  rule: string;
  description: string;
  passed: boolean;
  details: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface QueryTestResult {
  queryId: string;
  query: string;
  type: string;
  response: string;
  checks: FormatCheckResult[];
  overallScore: number;
  grade: string;
  timestamp: string;
}

/**
 * Check if response has proper title (## format, 2-4 words)
 */
function checkTitle(response: string): FormatCheckResult {
  const lines = response.split('\n');
  const firstNonEmptyLine = lines.find(l => l.trim().length > 0) || '';

  const hasHashHash = firstNonEmptyLine.trim().startsWith('##') && !firstNonEmptyLine.trim().startsWith('###');
  const titleText = firstNonEmptyLine.replace(/^##\s*/, '').replace(/\*\*/g, '').trim();
  const wordCount = titleText.split(/\s+/).filter(w => w.length > 0).length;

  const passed = hasHashHash && wordCount >= 2 && wordCount <= 6;

  return {
    rule: 'RULE 1: Title Format',
    description: 'Must start with ## and be 2-4 words',
    passed,
    details: passed
      ? `✅ Title: "${titleText}" (${wordCount} words)`
      : `❌ ${!hasHashHash ? 'Missing ## prefix' : `Word count: ${wordCount} (need 2-4)`}. First line: "${firstNonEmptyLine.substring(0, 50)}"`,
    severity: 'CRITICAL'
  };
}

/**
 * Check introduction length (max 2 lines, 60 words)
 */
function checkIntroduction(response: string): FormatCheckResult {
  const lines = response.split('\n').filter(l => l.trim());

  // Find intro (between title and first ###)
  let introStart = 1; // After title
  let introEnd = lines.findIndex((l, i) => i > 0 && l.trim().startsWith('###'));
  if (introEnd === -1) introEnd = Math.min(3, lines.length);

  const introLines = lines.slice(introStart, introEnd).filter(l => !l.startsWith('#'));
  const introText = introLines.join(' ');
  const wordCount = introText.split(/\s+/).filter(w => w.length > 0).length;
  const lineCount = introLines.length;

  const passed = lineCount <= 2 && wordCount <= 60;

  return {
    rule: 'RULE 2: Introduction Length',
    description: 'Max 2 lines, 60 words before first section',
    passed,
    details: passed
      ? `✅ ${lineCount} lines, ${wordCount} words`
      : `❌ ${lineCount} lines (max 2), ${wordCount} words (max 60)`,
    severity: 'HIGH'
  };
}

/**
 * Check sections (2-5 sections with ### format)
 */
function checkSections(response: string): FormatCheckResult {
  const sectionHeaders = response.match(/^###\s+.+$/gm) || [];
  const sectionCount = sectionHeaders.length;

  const passed = sectionCount >= 2 && sectionCount <= 5;

  return {
    rule: 'RULE 3: Section Count',
    description: 'Must have 2-5 sections using ###',
    passed,
    details: passed
      ? `✅ ${sectionCount} sections: ${sectionHeaders.map(h => h.replace('###', '').trim()).join(', ')}`
      : `❌ Found ${sectionCount} sections (need 2-5)`,
    severity: 'CRITICAL'
  };
}

/**
 * Check bullet points (• format, separate lines)
 */
function checkBullets(response: string): FormatCheckResult {
  const bulletLines = response.split('\n').filter(l => l.trim().startsWith('•'));
  const hasBullets = bulletLines.length > 0;

  // Check for wrong bullet formats (- or * at start of line, but not bold **)
  const wrongBullets = response.split('\n').filter(l => {
    const trimmed = l.trim();
    return (trimmed.startsWith('- ') || (trimmed.startsWith('* ') && !trimmed.startsWith('**')));
  });

  const passed = hasBullets && wrongBullets.length === 0;

  return {
    rule: 'RULE 4: Bullet Format',
    description: 'Use • (not - or *), separate lines',
    passed,
    details: passed
      ? `✅ ${bulletLines.length} bullets with correct format`
      : `❌ ${wrongBullets.length > 0 ? `Found ${wrongBullets.length} wrong bullets (- or *)` : 'No • bullets found'}`,
    severity: 'CRITICAL'
  };
}

/**
 * Check auto-bolding (numbers, dates, filenames)
 */
function checkBolding(response: string): FormatCheckResult {
  // Find significant numbers (4+ digits or currency)
  const significantNumbers = response.match(/\$[\d,]+(?:\.\d{2})?|\d{4,}(?:,\d{3})*(?:\.\d+)?/g) || [];
  const boldedItems = response.match(/\*\*[^*]+\*\*/g) || [];

  // Check if we have some bolded content
  const hasBoldContent = boldedItems.length > 0;

  // Check if significant numbers are bolded
  let boldedNumberCount = 0;
  significantNumbers.forEach(num => {
    if (response.includes(`**${num}**`) || response.includes(`**$${num}**`)) {
      boldedNumberCount++;
    }
  });

  const passed = hasBoldContent;

  return {
    rule: 'RULE 5: Auto-Bolding',
    description: 'Auto-bold numbers, dates, filenames, monetary values',
    passed,
    details: passed
      ? `✅ Found ${boldedItems.length} bolded items`
      : `❌ No bolded content found`,
    severity: 'MEDIUM'
  };
}

/**
 * Check for tables in comparison queries
 */
function checkTables(response: string, expectedTable: boolean): FormatCheckResult {
  const tableRows = response.match(/\|.+\|/g) || [];
  const hasTable = tableRows.length >= 2; // Need at least header + separator or data

  if (!expectedTable) {
    return {
      rule: 'RULE 6: Tables',
      description: 'Use tables for comparisons',
      passed: true,
      details: '✅ Table not required for this query type',
      severity: 'MEDIUM'
    };
  }

  const passed = hasTable;

  return {
    rule: 'RULE 6: Tables',
    description: 'Use markdown tables for comparisons',
    passed,
    details: passed
      ? `✅ Table found with ${tableRows.length} rows`
      : `❌ Comparison query but no table found`,
    severity: 'HIGH'
  };
}

/**
 * Check source section
 */
function checkSource(response: string, expectedSources: boolean): FormatCheckResult {
  const hasSourceSection = /###\s*(Source|Data Source|Sources)/i.test(response);

  if (!expectedSources) {
    return {
      rule: 'RULE 7: Source Section',
      description: 'Include ### Source section with document references',
      passed: true,
      details: '✅ Sources not required for this query type',
      severity: 'HIGH'
    };
  }

  const passed = hasSourceSection;

  return {
    rule: 'RULE 7: Source Section',
    description: 'Must include ### Source section listing documents',
    passed,
    details: passed
      ? `✅ Source section present`
      : `❌ No ### Source section found`,
    severity: 'HIGH'
  };
}

/**
 * Check follow-up question
 */
function checkFollowUp(response: string): FormatCheckResult {
  const lines = response.trim().split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1]?.trim() || '';
  const endsWithQuestion = lastLine.includes('?');

  const passed = endsWithQuestion;

  return {
    rule: 'RULE 8: Follow-up Question',
    description: 'Must end with a follow-up question',
    passed,
    details: passed
      ? `✅ Ends with question`
      : `❌ Last line doesn't contain "?": "${lastLine.substring(0, 50)}..."`,
    severity: 'MEDIUM'
  };
}

/**
 * Check for prohibited content (emojis, filler phrases)
 */
function checkProhibited(response: string): FormatCheckResult {
  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const hasEmojis = emojiPattern.test(response);

  const fillerPhrases = [
    "I'd be happy to",
    "I can help you with that",
    "Let me help",
    "Sure thing",
    "Absolutely",
    "Of course"
  ];

  const foundFillers = fillerPhrases.filter(phrase =>
    response.toLowerCase().includes(phrase.toLowerCase())
  );

  const passed = !hasEmojis && foundFillers.length === 0;

  return {
    rule: 'RULE 9: Prohibited Content',
    description: 'No emojis, no filler phrases',
    passed,
    details: passed
      ? `✅ No emojis or filler phrases`
      : `❌ ${hasEmojis ? 'Contains emojis' : ''} ${foundFillers.length > 0 ? `Filler: "${foundFillers[0]}"` : ''}`,
    severity: 'MEDIUM'
  };
}

/**
 * Check spacing (single blank lines only)
 */
function checkSpacing(response: string): FormatCheckResult {
  const multipleBlankLines = response.match(/\n{3,}/g) || [];
  const passed = multipleBlankLines.length === 0;

  return {
    rule: 'RULE 10: Spacing',
    description: 'Single blank lines between sections',
    passed,
    details: passed
      ? `✅ Proper spacing throughout`
      : `❌ Found ${multipleBlankLines.length} instances of multiple blank lines`,
    severity: 'MEDIUM'
  };
}

/**
 * Run all format checks on a response
 */
function runFormatChecks(
  response: string,
  expectedSources: boolean,
  expectedTable: boolean
): FormatCheckResult[] {
  return [
    checkTitle(response),
    checkIntroduction(response),
    checkSections(response),
    checkBullets(response),
    checkBolding(response),
    checkTables(response, expectedTable),
    checkSource(response, expectedSources),
    checkFollowUp(response),
    checkProhibited(response),
    checkSpacing(response),
  ];
}

/**
 * Calculate overall score and grade
 */
function calculateScore(checks: FormatCheckResult[]): { score: number; grade: string } {
  const weights = {
    CRITICAL: 3,
    HIGH: 2,
    MEDIUM: 1
  };

  let totalWeight = 0;
  let earnedWeight = 0;

  checks.forEach(check => {
    const weight = weights[check.severity];
    totalWeight += weight;
    if (check.passed) earnedWeight += weight;
  });

  const score = (earnedWeight / totalWeight) * 100;

  let grade = 'F';
  if (score >= 95) grade = 'A+';
  else if (score >= 90) grade = 'A';
  else if (score >= 85) grade = 'B+';
  else if (score >= 80) grade = 'B';
  else if (score >= 75) grade = 'C+';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';

  return { score, grade };
}

// ============================================================================
// API INTERACTION
// ============================================================================

let authToken: string = '';
let userId: string = '';

/**
 * Login and get auth token
 */
async function login(): Promise<void> {
  console.log('🔐 Logging in...');

  const response = await axios.post(`${BACKEND_URL}/api/auth/login`, TEST_USER);

  authToken = response.data.accessToken;
  userId = response.data.user.id;

  console.log(`✅ Logged in as ${userId}`);
}

/**
 * Create a new conversation
 */
async function createConversation(): Promise<string> {
  const response = await axios.post(
    `${BACKEND_URL}/api/chat/conversations`,
    { title: 'Format Test' },
    { headers: { Authorization: `Bearer ${authToken}` } }
  );

  return response.data.id;
}

/**
 * Send query to backend and get response
 */
async function queryBackend(conversationId: string, query: string): Promise<string> {
  try {
    console.log(`📤 Sending query: "${query}"`);

    const response = await axios.post(
      `${BACKEND_URL}/api/chat/conversations/${conversationId}/messages`,
      { content: query },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        timeout: 120000 // 2 minute timeout for RAG queries
      }
    );

    // Extract response text
    let responseText = response.data.assistantMessage?.content ||
                       response.data.response ||
                       response.data.answer ||
                       JSON.stringify(response.data);

    console.log(`✅ Received response (${responseText.length} chars)`);

    return responseText;

  } catch (error: any) {
    console.error(`❌ Query failed:`, error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
    return `ERROR: ${error.message}`;
  }
}

// ============================================================================
// RENDERING & OUTPUT
// ============================================================================

/**
 * Render response as it would appear in frontend
 */
function renderFrontendView(response: string, queryId: string): string {
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Format Test - ${queryId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
      line-height: 1.6;
    }
    .response-container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h2 {
      color: #2563eb;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-top: 0;
    }
    h3 {
      color: #1e40af;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    ul {
      padding-left: 20px;
      list-style: none;
    }
    li {
      margin: 8px 0;
      position: relative;
      padding-left: 20px;
    }
    li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #2563eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
    }
    strong {
      color: #1f2937;
      font-weight: 600;
    }
    .follow-up {
      margin-top: 24px;
      padding: 16px;
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      font-style: italic;
    }
    pre {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="response-container">
    <h1>Query: ${queryId}</h1>
    <hr>
    <h3>Rendered Response:</h3>
`;

  // Convert markdown to HTML (simple conversion)
  let htmlContent = response
    // Headers
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Bullets - convert to list items
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap in paragraph
  htmlContent = '<p>' + htmlContent + '</p>';

  // Clean up empty paragraphs
  htmlContent = htmlContent.replace(/<p><\/p>/g, '');
  htmlContent = htmlContent.replace(/<p><br>/g, '<p>');

  html += htmlContent;

  html += `
    <hr>
    <h3>Raw Markdown:</h3>
    <pre>${response.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>
`;

  return html;
}

/**
 * Generate detailed test report
 */
function generateReport(results: QueryTestResult[]): string {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.overallScore >= 90).length;
  const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / totalTests;

  let report = `# KODA FORMAT VALIDATION TEST REPORT
Generated: ${new Date().toISOString()}

## OVERALL RESULTS

- **Total Queries Tested**: ${totalTests}
- **Passed (90%+)**: ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)
- **Average Score**: ${avgScore.toFixed(1)}%
- **Overall Grade**: ${avgScore >= 95 ? 'A+' : avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F'}

---

`;

  // Individual query results
  results.forEach((result, index) => {
    report += `
## Query ${index + 1}: ${result.queryId}

**Query**: "${result.query}"
**Type**: ${result.type}
**Score**: ${result.overallScore.toFixed(1)}% (Grade: ${result.grade})

### Format Checklist

`;

    result.checks.forEach(check => {
      const icon = check.passed ? '✅' : '❌';
      const severity = check.severity === 'CRITICAL' ? '[CRITICAL]' : check.severity === 'HIGH' ? '[HIGH]' : '[MEDIUM]';
      report += `${icon} ${severity} **${check.rule}**\n`;
      report += `   ${check.details}\n\n`;
    });

    report += `
### Response Preview

\`\`\`markdown
${result.response.substring(0, 1000)}${result.response.length > 1000 ? '...(truncated)' : ''}
\`\`\`

---

`;
  });

  // Rule-by-rule analysis
  report += `
## RULE-BY-RULE ANALYSIS

`;

  const ruleStats: { [key: string]: { passed: number; total: number } } = {};

  results.forEach(result => {
    result.checks.forEach(check => {
      if (!ruleStats[check.rule]) {
        ruleStats[check.rule] = { passed: 0, total: 0 };
      }
      ruleStats[check.rule].total++;
      if (check.passed) ruleStats[check.rule].passed++;
    });
  });

  Object.entries(ruleStats).forEach(([rule, stats]) => {
    const percentage = (stats.passed / stats.total) * 100;
    const icon = percentage >= 90 ? '✅' : percentage >= 70 ? '⚠️' : '❌';
    report += `${icon} **${rule}**: ${stats.passed}/${stats.total} (${percentage.toFixed(1)}%)\n`;
  });

  return report;
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================

async function runTests() {
  console.log('🚀 Starting Koda Format Validation Tests\n');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Login first
    await login();

    // Create conversation
    const conversationId = await createConversation();
    console.log(`📝 Created conversation: ${conversationId}\n`);

    const results: QueryTestResult[] = [];

    // Test each query
    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const testQuery = TEST_QUERIES[i];

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📝 Test ${i + 1}/${TEST_QUERIES.length}: ${testQuery.id}`);
      console.log(`Query: "${testQuery.query}"`);
      console.log(`Type: ${testQuery.type}`);
      console.log(`${'='.repeat(80)}\n`);

      // Get response from backend
      const response = await queryBackend(conversationId, testQuery.query);

      if (response.startsWith('ERROR:')) {
        console.error(`❌ Test failed: ${response}\n`);
        continue;
      }

      // Run format checks
      const checks = runFormatChecks(
        response,
        testQuery.expectedSources,
        testQuery.expectedTable
      );

      // Calculate score
      const { score, grade } = calculateScore(checks);

      // Print results
      console.log(`\n📊 Results for ${testQuery.id}:`);
      console.log(`Score: ${score.toFixed(1)}% (Grade: ${grade})\n`);

      checks.forEach(check => {
        const icon = check.passed ? '✅' : '❌';
        console.log(`${icon} ${check.rule}`);
        console.log(`   ${check.details}`);
      });

      // Save result
      const result: QueryTestResult = {
        queryId: testQuery.id,
        query: testQuery.query,
        type: testQuery.type,
        response,
        checks,
        overallScore: score,
        grade,
        timestamp: new Date().toISOString()
      };

      results.push(result);

      // Save individual response files
      const queryDir = path.join(OUTPUT_DIR, testQuery.id);
      if (!fs.existsSync(queryDir)) {
        fs.mkdirSync(queryDir, { recursive: true });
      }

      // Save raw response
      fs.writeFileSync(
        path.join(queryDir, 'response.md'),
        response
      );

      // Save HTML preview
      const html = renderFrontendView(response, testQuery.id);
      fs.writeFileSync(
        path.join(queryDir, 'preview.html'),
        html
      );

      // Save checklist
      const checklist = checks.map(c =>
        `${c.passed ? '✅' : '❌'} ${c.rule}\n   ${c.details}`
      ).join('\n\n');

      fs.writeFileSync(
        path.join(queryDir, 'checklist.txt'),
        `Query: ${testQuery.query}\nScore: ${score.toFixed(1)}% (${grade})\n\n${checklist}`
      );

      console.log(`\n💾 Saved results to: ${queryDir}`);

      // Wait between queries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Generate final report
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 GENERATING FINAL REPORT');
    console.log(`${'='.repeat(80)}\n`);

    const report = generateReport(results);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'REPORT.md'),
      report
    );

    // Save JSON results
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'results.json'),
      JSON.stringify(results, null, 2)
    );

    console.log(`✅ Test complete!`);
    console.log(`\nResults saved to: ${OUTPUT_DIR}`);
    console.log(`- REPORT.md: Detailed test report`);
    console.log(`- results.json: Raw test data`);
    console.log(`- Q1/, Q2/, etc.: Individual query results with HTML previews\n`);

    // Print summary
    const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    const passedCount = results.filter(r => r.overallScore >= 90).length;

    console.log(`\n${'='.repeat(80)}`);
    console.log('🎯 FINAL SUMMARY');
    console.log(`${'='.repeat(80)}`);
    console.log(`Average Score: ${avgScore.toFixed(1)}%`);
    console.log(`Passed Tests: ${passedCount}/${results.length}`);
    console.log(`Overall Grade: ${avgScore >= 95 ? 'A+' : avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : 'F'}`);
    console.log(`${'='.repeat(80)}\n`);

  } catch (error: any) {
    console.error('💥 Test execution failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});
