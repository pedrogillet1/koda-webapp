/**
 * COMPREHENSIVE FORMAT VERIFICATION SCRIPT
 * Tests ALL format rules from the checklist with real queries
 * Shows actual outputs and validates compliance
 */

import axios from 'axios';
import * as fs from 'fs';

const API_URL = 'http://localhost:5000/api';
const TEST_USER = {
  email: 'localhost@koda.com',
  password: 'localhost123'
};

interface FormatRule {
  id: string;
  category: string;
  rule: string;
  validator: (response: string) => { passed: boolean; details: string };
}

interface TestQuery {
  id: string;
  query: string;
  expectedType: string;
  description: string;
}

interface TestResult {
  queryId: string;
  query: string;
  response: string;
  ruleResults: {
    ruleId: string;
    ruleName: string;
    passed: boolean;
    details: string;
  }[];
  overallPassed: boolean;
  complianceScore: number;
}

// ============================================================================
// FORMAT RULES (From your checklist)
// ============================================================================

const FORMAT_RULES: FormatRule[] = [
  // TITLE RULES
  {
    id: 'TITLE_1',
    category: 'Title',
    rule: 'Response MUST start with a title (## Title)',
    validator: (response: string) => {
      const hasTitle = /^##\s+.+$/m.test(response);
      return {
        passed: hasTitle,
        details: hasTitle ? 'Title found' : 'No title (## Title) at start'
      };
    }
  },
  {
    id: 'TITLE_2',
    category: 'Title',
    rule: 'Title must be 2-4 words, bold',
    validator: (response: string) => {
      const titleMatch = response.match(/^##\s+(.+)$/m);
      if (!titleMatch) return { passed: false, details: 'No title found' };

      const title = titleMatch[1].replace(/\*\*/g, '');
      const wordCount = title.split(/\s+/).length;
      const isBold = /\*\*/.test(titleMatch[1]);

      const passed = wordCount >= 2 && wordCount <= 4;
      return {
        passed,
        details: `Title: "${title}" (${wordCount} words, ${isBold ? 'bold' : 'not bold'})`
      };
    }
  },

  // INTRODUCTION RULES
  {
    id: 'INTRO_1',
    category: 'Introduction',
    rule: 'Introduction must be max 2 lines (60 words)',
    validator: (response: string) => {
      const titleMatch = response.match(/^##\s+.+$/m);
      if (!titleMatch) return { passed: false, details: 'No title to measure from' };

      const afterTitle = response.substring(titleMatch.index! + titleMatch[0].length).trim();
      const firstSection = afterTitle.split(/\n###/)[0].trim();

      const lines = firstSection.split('\n').filter(l => l.trim().length > 0);
      const words = firstSection.split(/\s+/).length;

      const passed = lines.length <= 2 && words <= 60;
      return {
        passed,
        details: `Intro: ${lines.length} lines, ${words} words (max 2 lines, 60 words)`
      };
    }
  },

  // SECTION RULES
  {
    id: 'SECTION_1',
    category: 'Sections',
    rule: 'Must have 2-5 sections (### Section)',
    validator: (response: string) => {
      const sections = response.match(/^###\s+.+$/gm) || [];
      const count = sections.length;
      const passed = count >= 2 && count <= 5;
      return {
        passed,
        details: `${count} sections found (need 2-5)`
      };
    }
  },

  // BULLET RULES
  {
    id: 'BULLET_1',
    category: 'Bullets',
    rule: 'Use standard bullet (•) not - or *',
    validator: (response: string) => {
      const hasDashBullets = /^[\s]*-\s+/m.test(response);
      const hasAsteriskBullets = /^[\s]*\*\s+[^*]/m.test(response);
      const hasStandardBullets = /^[\s]*•\s+/m.test(response);

      if (hasDashBullets || hasAsteriskBullets) {
        return {
          passed: false,
          details: `Found ${hasDashBullets ? 'dash (-)' : 'asterisk (*)'} bullets instead of •`
        };
      }

      return {
        passed: hasStandardBullets,
        details: hasStandardBullets ? 'Using standard bullet (•)' : 'No bullets found'
      };
    }
  },
  {
    id: 'BULLET_2',
    category: 'Bullets',
    rule: 'Each bullet on separate line',
    validator: (response: string) => {
      const bulletLines = response.split('\n').filter(line => line.trim().startsWith('•'));
      const multipleBulletsPerLine = bulletLines.some(line =>
        (line.match(/•/g) || []).length > 1
      );

      return {
        passed: !multipleBulletsPerLine,
        details: multipleBulletsPerLine
          ? 'Multiple bullets on same line'
          : `${bulletLines.length} bullets, each on separate line`
      };
    }
  },
  {
    id: 'BULLET_3',
    category: 'Bullets',
    rule: 'Max 2-3 items per bullet line',
    validator: (response: string) => {
      const bulletLines = response.split('\n').filter(line => line.trim().startsWith('•'));
      const violations: string[] = [];

      bulletLines.forEach((line, idx) => {
        // Count items (separated by commas, but not inside parentheses)
        const withoutParens = line.replace(/\([^)]*\)/g, '');
        const items = withoutParens.split(',').length;

        if (items > 3) {
          violations.push(`Line ${idx + 1}: ${items} items`);
        }
      });

      return {
        passed: violations.length === 0,
        details: violations.length > 0
          ? `${violations.length} bullets with 4+ items: ${violations.join(', ')}`
          : 'All bullets have 2-3 items max'
      };
    }
  },
  {
    id: 'BULLET_4',
    category: 'Bullets',
    rule: 'Max 7 bullets per section',
    validator: (response: string) => {
      const sections = response.split(/^###\s+/m);
      const violations: string[] = [];

      sections.forEach((section, idx) => {
        if (idx === 0) return; // Skip before first section
        const bullets = (section.match(/^[\s]*•/gm) || []).length;
        if (bullets > 7) {
          violations.push(`Section ${idx}: ${bullets} bullets`);
        }
      });

      return {
        passed: violations.length === 0,
        details: violations.length > 0
          ? `${violations.length} sections with 8+ bullets: ${violations.join(', ')}`
          : 'All sections have ≤7 bullets'
      };
    }
  },

  // FORMATTING RULES
  {
    id: 'FORMAT_1',
    category: 'Formatting',
    rule: 'Auto-bold numbers, dates, filenames',
    validator: (response: string) => {
      // Check if numbers/dates/files are bolded
      const hasBoldNumbers = /\*\*[$€£¥]?[\d,]+(\.\d+)?[%]?\*\*/.test(response);
      const hasBoldDates = /\*\*\d{4}\*\*|\*\*Q[1-4]\*\*/.test(response);
      const hasBoldFiles = /\*\*[A-Za-z0-9_-]+\.(xlsx|pdf|docx|csv)\*\*/.test(response);

      const found = [];
      if (hasBoldNumbers) found.push('numbers');
      if (hasBoldDates) found.push('dates');
      if (hasBoldFiles) found.push('files');

      return {
        passed: found.length > 0,
        details: found.length > 0
          ? `Bolded: ${found.join(', ')}`
          : 'No bolded numbers/dates/files found'
      };
    }
  },
  {
    id: 'FORMAT_2',
    category: 'Formatting',
    rule: 'No emojis',
    validator: (response: string) => {
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      const hasEmojis = emojiRegex.test(response);

      return {
        passed: !hasEmojis,
        details: hasEmojis ? 'Emojis found' : 'No emojis'
      };
    }
  },

  // TABLE RULES
  {
    id: 'TABLE_1',
    category: 'Tables',
    rule: 'Use tables for comparisons',
    validator: (response: string) => {
      const hasTable = /\|.*\|/.test(response);
      const hasComparison = /compar|vs|versus|between/i.test(response);

      if (hasComparison && !hasTable) {
        return {
          passed: false,
          details: 'Comparison detected but no table used'
        };
      }

      return {
        passed: true,
        details: hasTable ? 'Table found' : 'No comparison, table not needed'
      };
    }
  },

  // SPACING RULES
  {
    id: 'SPACING_1',
    category: 'Spacing',
    rule: 'Single blank line between sections',
    validator: (response: string) => {
      const hasTripleNewlines = /\n\n\n+/.test(response);

      return {
        passed: !hasTripleNewlines,
        details: hasTripleNewlines
          ? 'Multiple blank lines found (3+)'
          : 'Proper spacing (single blank lines)'
      };
    }
  },

  // TONE RULES
  {
    id: 'TONE_1',
    category: 'Tone',
    rule: 'No filler phrases',
    validator: (response: string) => {
      const fillerPhrases = [
        'I can tell you that',
        'To put it into perspective',
        'This impressive',
        'It is worth noting',
        'Let me explain',
        'As you can see'
      ];

      const found = fillerPhrases.filter(phrase =>
        response.toLowerCase().includes(phrase.toLowerCase())
      );

      return {
        passed: found.length === 0,
        details: found.length > 0
          ? `Filler phrases: ${found.join(', ')}`
          : 'No filler phrases'
      };
    }
  },

  // SOURCE RULES
  {
    id: 'SOURCE_1',
    category: 'Source',
    rule: 'Include source section when using documents',
    validator: (response: string) => {
      const hasDocumentMention = /\.xlsx|\.pdf|\.docx|\.csv/i.test(response);
      const hasSourceSection = /^###\s+(Source|Data Source)/im.test(response);

      if (hasDocumentMention && !hasSourceSection) {
        return {
          passed: false,
          details: 'Document mentioned but no Source section'
        };
      }

      return {
        passed: true,
        details: hasSourceSection ? 'Source section found' : 'No documents, source not needed'
      };
    }
  },

  // CLOSING RULES
  {
    id: 'CLOSING_1',
    category: 'Closing',
    rule: 'End with follow-up question',
    validator: (response: string) => {
      const lastLine = response.trim().split('\n').pop() || '';
      const hasQuestion = lastLine.includes('?');

      return {
        passed: hasQuestion,
        details: hasQuestion
          ? `Follow-up: "${lastLine.substring(0, 60)}..."`
          : 'No follow-up question at end'
      };
    }
  },

  // STRUCTURE RULES
  {
    id: 'STRUCTURE_1',
    category: 'Structure',
    rule: 'No paragraphs after bullets',
    validator: (response: string) => {
      const sections = response.split(/^###\s+/m);
      const violations: string[] = [];

      sections.forEach((section, idx) => {
        if (idx === 0) return;

        const lines = section.split('\n');
        let foundBullet = false;
        let foundParagraphAfter = false;

        lines.forEach(line => {
          if (line.trim().startsWith('•')) {
            foundBullet = true;
          } else if (foundBullet && line.trim().length > 50 && !line.includes('|')) {
            foundParagraphAfter = true;
          }
        });

        if (foundParagraphAfter) {
          violations.push(`Section ${idx}`);
        }
      });

      return {
        passed: violations.length === 0,
        details: violations.length > 0
          ? `Paragraphs after bullets in: ${violations.join(', ')}`
          : 'No paragraphs after bullets'
      };
    }
  }
];

// ============================================================================
// TEST QUERIES
// ============================================================================

const TEST_QUERIES: TestQuery[] = [
  {
    id: 'Q1',
    query: 'What is the total revenue for Lone Mountain Ranch?',
    expectedType: 'financial',
    description: 'Financial query - should have title, sections, bullets, source'
  },
  {
    id: 'Q2',
    query: 'What properties are in the Rosewood Fund?',
    expectedType: 'list',
    description: 'List query - should have bullets, max 7 per section'
  },
  {
    id: 'Q3',
    query: 'Compare Food Revenue vs Beverage Revenue for LMR',
    expectedType: 'comparison',
    description: 'Comparison query - should have table'
  },
  {
    id: 'Q4',
    query: 'Show me the Room Revenue breakdown by month',
    expectedType: 'detailed',
    description: 'Detailed query - should have proper structure, no filler'
  },
  {
    id: 'Q5',
    query: 'What is the MoIC for Rosewood Fund?',
    expectedType: 'simple',
    description: 'Simple query - should be concise, have source'
  }
];

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function runVerification(): Promise<void> {
  console.log('COMPREHENSIVE FORMAT VERIFICATION\n');
  console.log('Testing ALL format rules from checklist with real queries\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Login
    console.log('Logging in...');
    const { token, userId } = await login();
    console.log(`Logged in as ${userId}\n`);

    // Create conversation
    console.log('Creating test conversation...');
    const conversationId = await createConversation(token);
    console.log(`Conversation created: ${conversationId}\n`);

    const allResults: TestResult[] = [];

    // Run each test query
    for (const testQuery of TEST_QUERIES) {
      console.log('='.repeat(80));
      console.log(`\nTEST: ${testQuery.id} - ${testQuery.description}`);
      console.log(`Query: "${testQuery.query}"\n`);

      try {
        // Send query
        const response = await sendQuery(token, conversationId, testQuery.query);

        console.log('RESPONSE RECEIVED:\n');
        console.log('-'.repeat(80));
        console.log(response);
        console.log('-'.repeat(80) + '\n');

        // Validate against all rules
        console.log('VALIDATION RESULTS:\n');

        const ruleResults = FORMAT_RULES.map(rule => {
          const result = rule.validator(response);
          const icon = result.passed ? '[PASS]' : '[FAIL]';

          console.log(`${icon} [${rule.id}] ${rule.category}: ${rule.rule}`);
          console.log(`   ${result.details}\n`);

          return {
            ruleId: rule.id,
            ruleName: rule.rule,
            passed: result.passed,
            details: result.details
          };
        });

        const passedCount = ruleResults.filter(r => r.passed).length;
        const totalCount = ruleResults.length;
        const complianceScore = (passedCount / totalCount) * 100;

        console.log(`\nCOMPLIANCE SCORE: ${passedCount}/${totalCount} (${complianceScore.toFixed(0)}%)\n`);

        allResults.push({
          queryId: testQuery.id,
          query: testQuery.query,
          response,
          ruleResults,
          overallPassed: complianceScore >= 80,
          complianceScore
        });

        // Wait between queries
        await sleep(2000);

      } catch (error: any) {
        console.error(`Error testing ${testQuery.id}:`, error.message);
        allResults.push({
          queryId: testQuery.id,
          query: testQuery.query,
          response: `ERROR: ${error.message}`,
          ruleResults: [],
          overallPassed: false,
          complianceScore: 0
        });
      }
    }

    // Generate summary
    console.log('\n' + '='.repeat(80));
    console.log('\nFINAL SUMMARY\n');
    console.log('='.repeat(80) + '\n');

    const overallPassed = allResults.filter(r => r.overallPassed).length;
    const overallTotal = allResults.length;
    const avgCompliance = allResults.reduce((sum, r) => sum + r.complianceScore, 0) / allResults.length;

    console.log(`Tests Passed: ${overallPassed}/${overallTotal} (${((overallPassed/overallTotal)*100).toFixed(0)}%)`);
    console.log(`Average Compliance: ${avgCompliance.toFixed(1)}%\n`);

    allResults.forEach(result => {
      const icon = result.overallPassed ? '[PASS]' : '[FAIL]';
      console.log(`${icon} ${result.queryId}: ${result.complianceScore.toFixed(0)}% compliance`);
    });

    // Category breakdown
    console.log('\nCOMPLIANCE BY CATEGORY:\n');

    const categories = [...new Set(FORMAT_RULES.map(r => r.category))];
    categories.forEach(category => {
      const categoryRules = FORMAT_RULES.filter(r => r.category === category);
      const categoryResults = allResults.flatMap(result =>
        result.ruleResults.filter(rr =>
          categoryRules.some(cr => cr.id === rr.ruleId)
        )
      );

      const passed = categoryResults.filter(r => r.passed).length;
      const total = categoryResults.length;
      const percentage = total > 0 ? (passed / total) * 100 : 0;

      const icon = percentage >= 80 ? '[OK]' : percentage >= 60 ? '[WARN]' : '[FAIL]';
      console.log(`${icon} ${category}: ${passed}/${total} (${percentage.toFixed(0)}%)`);
    });

    // Grade
    console.log('\nOVERALL GRADE:\n');
    let grade = 'F';
    if (avgCompliance >= 90) grade = 'A';
    else if (avgCompliance >= 80) grade = 'B';
    else if (avgCompliance >= 70) grade = 'C';
    else if (avgCompliance >= 60) grade = 'D';

    console.log(`   ${grade} (${avgCompliance.toFixed(1)}% compliance)\n`);

    // Save JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        testsRun: overallTotal,
        testsPassed: overallPassed,
        averageCompliance: avgCompliance,
        grade
      },
      results: allResults,
      rules: FORMAT_RULES.map(r => ({
        id: r.id,
        category: r.category,
        rule: r.rule
      }))
    };

    const reportPath = 'C:\\Users\\pedro\\OneDrive\\Área de Trabalho\\web\\format-verification-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Detailed report saved to: ${reportPath}\n`);

    // Recommendations
    if (avgCompliance < 90) {
      console.log('RECOMMENDATIONS:\n');

      const failedRules = allResults.flatMap(r =>
        r.ruleResults.filter(rr => !rr.passed)
      );

      const ruleFailCounts = failedRules.reduce((acc, r) => {
        acc[r.ruleId] = (acc[r.ruleId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topFailures = Object.entries(ruleFailCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      topFailures.forEach(([ruleId, count]) => {
        const rule = FORMAT_RULES.find(r => r.id === ruleId);
        if (rule) {
          console.log(`[FAIL] ${rule.category} - ${rule.rule}`);
          console.log(`   Failed in ${count}/${overallTotal} tests\n`);
        }
      });
    } else {
      console.log('EXCELLENT! All format rules are working correctly!\n');
    }

  } catch (error: any) {
    console.error('Verification failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function login(): Promise<{ token: string; userId: string }> {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, TEST_USER);
    console.log('Login response:', JSON.stringify(response.data, null, 2));
    return {
      token: response.data.accessToken,
      userId: response.data.user.id
    };
  } catch (error: any) {
    console.error('Login error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

async function createConversation(token: string): Promise<string> {
  const response = await axios.post(
    `${API_URL}/chat/conversations`,
    { title: 'Format Verification Test' },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log('Conversation response:', JSON.stringify(response.data, null, 2));
  return response.data.id;
}

async function sendQuery(token: string, conversationId: string, query: string): Promise<string> {
  try {
    const response = await axios.post(
      `${API_URL}/rag/query`,
      { query, conversationId },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 120000 }
    );
    return response.data.answer;
  } catch (error: any) {
    console.error('Query error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// RUN
// ============================================================================

runVerification().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
