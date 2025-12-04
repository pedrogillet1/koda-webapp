/**
 * Frontend Output Test Runner - Complete 50 Question Suite
 * Shows EXACTLY what messages users see in the frontend
 * Outputs results to a markdown file for review
 */

// Set API key BEFORE any imports - load from .env
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const fs = require('fs');
const path = require('path');

require('ts-node').register({ transpileOnly: true });

const fallbackDetection = require('./fallbackDetection.service').default;
const fallbackResponse = require('./fallbackResponse.service').default;

const testCases = [
  // ============================================================================
  // KNOWLEDGE FALLBACKS (10 scenarios)
  // ============================================================================
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'No documents uploaded',
    query: 'What is the total revenue for Q4?',
    docCount: 0, ragResults: [], ragScore: 0,
    docNames: []
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Documents exist but specific info not found',
    query: 'What is the CEO salary?',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Budget_2024.xlsx', 'Q4_Report.pdf', 'Meeting_Notes.docx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Looking for specific date not in documents',
    query: 'What happened on March 15th, 2024?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Annual_Report.pdf', 'Q4_Summary.xlsx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Asking about person not mentioned',
    query: 'What did John Smith say in the meeting?',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Meeting_Notes.docx', 'Team_Update.pdf']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Looking for specific product not in docs',
    query: 'What are the specifications for Product XYZ?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Product_Catalog.pdf', 'Sales_Data.xlsx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Asking about department not covered',
    query: 'What is the HR policy on remote work?',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['Finance_Policy.pdf', 'IT_Guidelines.docx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Historical data not available',
    query: 'What were the sales figures for 2019?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Sales_2023.xlsx', 'Sales_2024.xlsx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Technical spec not in documents',
    query: 'What is the API rate limit?',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['User_Guide.pdf', 'FAQ.docx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Contact info not found',
    query: 'What is the vendor contact email?',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Invoice_001.pdf', 'Contract.pdf', 'Terms.docx']
  },
  {
    category: 'KNOWLEDGE QUERIES',
    name: 'Metric not tracked in documents',
    query: 'What is the customer churn rate?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Revenue_Report.xlsx', 'Growth_Metrics.pdf']
  },

  // ============================================================================
  // CLARIFICATION FALLBACKS (10 scenarios)
  // ============================================================================
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Vague pronoun - it',
    query: 'What does it say?',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Report_A.pdf', 'Report_B.pdf', 'Budget.xlsx', 'Notes.docx']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Vague pronoun - this',
    query: 'Can you explain this?',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Analysis.pdf', 'Summary.docx', 'Data.xlsx']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Vague pronoun - that',
    query: 'What does that mean?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Report.pdf', 'Guide.docx']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Vague pronoun - they',
    query: 'What did they decide?',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Board_Minutes.pdf', 'Team_Notes.docx', 'Action_Items.xlsx']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Generic document reference',
    query: 'What is in the document?',
    docCount: 10, ragResults: [], ragScore: 0,
    docNames: ['Finance_Report.pdf', 'Sales_Data.xlsx', 'HR_Policy.docx', 'Marketing_Plan.pdf', 'Budget_2024.xlsx']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Generic file reference',
    query: 'Summarize the file',
    docCount: 6, ragResults: [], ragScore: 0,
    docNames: ['Doc1.pdf', 'Doc2.xlsx', 'Doc3.docx', 'Doc4.pdf']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Incomplete question - what about',
    query: 'What about',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Report.pdf', 'Summary.docx']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Incomplete question - how about',
    query: 'How about',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Data.xlsx', 'Analysis.pdf']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Very short ambiguous query',
    query: 'Revenue',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Q1_Revenue.xlsx', 'Q2_Revenue.xlsx', 'Annual_Report.pdf']
  },
  {
    category: 'CLARIFICATION QUERIES',
    name: 'Ambiguous term - costs',
    query: 'Show me the costs',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Operating_Costs.xlsx', 'Capital_Expenses.pdf', 'Budget.xlsx']
  },

  // ============================================================================
  // REFUSAL FALLBACKS - Real-time Data (5 scenarios)
  // ============================================================================
  {
    category: 'REFUSAL - REAL-TIME DATA',
    name: 'Current stock price',
    query: 'What is the current stock price of Apple?',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Portfolio.xlsx', 'Investment_Analysis.pdf']
  },
  {
    category: 'REFUSAL - REAL-TIME DATA',
    name: 'Today\'s weather',
    query: 'What is today\'s weather in New York?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Travel_Plan.pdf']
  },
  {
    category: 'REFUSAL - REAL-TIME DATA',
    name: 'Latest news',
    query: 'What is the latest news about Tesla?',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Market_Analysis.pdf']
  },
  {
    category: 'REFUSAL - REAL-TIME DATA',
    name: 'Live data feed',
    query: 'Show me live cryptocurrency prices',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['Crypto_Portfolio.xlsx']
  },
  {
    category: 'REFUSAL - REAL-TIME DATA',
    name: 'Current exchange rate',
    query: 'What is the current USD to EUR exchange rate?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['International_Invoice.pdf']
  },

  // ============================================================================
  // REFUSAL FALLBACKS - External Actions (10 scenarios)
  // ============================================================================
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Send email',
    query: 'Send an email to John about the quarterly report',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Q4_Report.pdf', 'Contact_List.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Book meeting',
    query: 'Book a meeting for tomorrow at 2pm with the team',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Team_Calendar.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Make payment',
    query: 'Make a payment of $500 to vendor ABC',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Invoice_ABC.pdf', 'Payment_History.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Delete file',
    query: 'Delete the old budget file',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Budget_2023.xlsx', 'Budget_2024.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Rename file',
    query: 'Rename my budget file to budget_final.xlsx',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['budget.xlsx', 'expenses.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Move file',
    query: 'Move the report to the archive folder',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Report_2024.pdf', 'Archive_Index.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Create new document',
    query: 'Create a new spreadsheet for tracking expenses',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['Template.xlsx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Set reminder',
    query: 'Set a reminder to review the contract next week',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Contract.pdf']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Call someone',
    query: 'Call the client about the proposal',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['Proposal.pdf', 'Client_Info.docx']
  },
  {
    category: 'REFUSAL - EXTERNAL ACTIONS',
    name: 'Download from internet',
    query: 'Download the latest financial report from SEC',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Financial_Analysis.pdf']
  },

  // ============================================================================
  // REFUSAL FALLBACKS - Opinions & Predictions (5 scenarios)
  // ============================================================================
  {
    category: 'REFUSAL - OPINIONS',
    name: 'Personal opinion on investment',
    query: 'Do you think this is a good investment?',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Investment_Analysis.pdf', 'Risk_Assessment.xlsx']
  },
  {
    category: 'REFUSAL - OPINIONS',
    name: 'Preference question',
    query: 'Which option do you prefer?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Options_Comparison.pdf']
  },
  {
    category: 'REFUSAL - OPINIONS',
    name: 'Market prediction',
    query: 'Will the stock market crash next year?',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['Market_Trends.pdf']
  },
  {
    category: 'REFUSAL - OPINIONS',
    name: 'Future forecast',
    query: 'Predict the revenue for next quarter',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Revenue_History.xlsx', 'Growth_Trends.pdf']
  },
  {
    category: 'REFUSAL - OPINIONS',
    name: 'Belief question',
    query: 'What do you believe is the best strategy?',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Strategy_Doc.pdf', 'Options.docx']
  },

  // ============================================================================
  // CALCULATION FALLBACKS (5 scenarios)
  // ============================================================================
  {
    category: 'CALCULATION QUERIES',
    name: 'Sum without documents',
    query: 'What is the sum of all expenses?',
    docCount: 0, ragResults: [], ragScore: 0,
    docNames: []
  },
  {
    category: 'CALCULATION QUERIES',
    name: 'Average without relevant data',
    query: 'What is the average salary in the company?',
    docCount: 2, ragResults: [], ragScore: 0,
    docNames: ['Revenue.xlsx', 'Expenses.pdf']
  },
  {
    category: 'CALCULATION QUERIES',
    name: 'Percentage calculation - no data',
    query: 'What percentage of revenue comes from product A?',
    docCount: 0, ragResults: [], ragScore: 0,
    docNames: []
  },
  {
    category: 'CALCULATION QUERIES',
    name: 'Growth rate - missing historical data',
    query: 'What is the year-over-year growth rate?',
    docCount: 1, ragResults: [], ragScore: 0,
    docNames: ['Current_Year.xlsx']
  },
  {
    category: 'CALCULATION QUERIES',
    name: 'Comparison calculation - one doc missing',
    query: 'How much did Q4 revenue increase compared to Q3?',
    docCount: 1, ragResults: [], ragScore: 0,
    docNames: ['Q4_Report.pdf']
  },

  // ============================================================================
  // FILE FINDING FALLBACKS (5 scenarios)
  // ============================================================================
  {
    category: 'FILE QUERIES',
    name: 'Find non-existent file',
    query: 'Where is contract_2025.pdf?',
    docCount: 5, ragResults: [], ragScore: 0,
    docNames: ['Budget.xlsx', 'Report.pdf', 'Notes.docx', 'Summary.pdf']
  },
  {
    category: 'FILE QUERIES',
    name: 'List files when none exist',
    query: 'Show me all my documents',
    docCount: 0, ragResults: [], ragScore: 0,
    docNames: []
  },
  {
    category: 'FILE QUERIES',
    name: 'Find file with wrong name',
    query: 'Open the sales spreadsheet',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Revenue.xlsx', 'Budget.xlsx', 'Expenses.xlsx']
  },
  {
    category: 'FILE QUERIES',
    name: 'Find file from different year',
    query: 'Find the 2020 annual report',
    docCount: 3, ragResults: [], ragScore: 0,
    docNames: ['Annual_Report_2023.pdf', 'Annual_Report_2024.pdf']
  },
  {
    category: 'FILE QUERIES',
    name: 'Find file by content that doesn\'t exist',
    query: 'Find the document about employee benefits',
    docCount: 4, ragResults: [], ragScore: 0,
    docNames: ['Finance_Policy.pdf', 'IT_Security.docx', 'Travel_Policy.pdf']
  },
];

async function runTests() {
  const outputLines = [];

  const log = (line = '') => {
    console.log(line);
    outputLines.push(line);
  };

  log('# KODA Fallback System - Complete Frontend Output Test');
  log('');
  log('> This document shows the **EXACT messages** users see in the frontend when fallback responses are triggered.');
  log('');
  log(`> **Test Date:** ${new Date().toISOString()}`);
  log(`> **Total Test Cases:** ${testCases.length}`);
  log('');
  log('---');
  log('');

  let currentCat = '';
  let categoryCount = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];

    if (test.category !== currentCat) {
      if (currentCat !== '') {
        log('');
        log('---');
        log('');
      }
      currentCat = test.category;
      categoryCount++;
      log(`## ${categoryCount}. ${test.category}`);
      log('');
    }

    // Detect fallback type
    const detection = fallbackDetection.detectFallback({
      query: test.query,
      documentCount: test.docCount,
      ragResults: test.ragResults,
      ragScore: test.ragScore,
    });

    log(`### Test ${i + 1}: ${test.name}`);
    log('');
    log(`**User Query:** \`${test.query}\``);
    log('');
    log(`**Context:**`);
    log(`- Documents: ${test.docCount} (${test.docNames.length > 0 ? test.docNames.join(', ') : 'none'})`);
    log(`- Fallback Type: \`${detection.fallbackType}\``);
    log(`- Confidence: ${detection.confidence}`);
    log(`- Reason: ${detection.reason}`);
    log('');

    if (detection.needsFallback && detection.fallbackType !== 'none') {
      try {
        // Generate the ACTUAL frontend response
        const response = await fallbackResponse.generateFallbackResponse({
          query: test.query,
          fallbackType: detection.fallbackType,
          reason: detection.reason,
          documentCount: test.docCount,
          documentNames: test.docNames,
          language: 'English',
        });

        log('**Frontend Output (What User Sees):**');
        log('');
        log('```');
        log(response);
        log('```');
        log('');
        totalPassed++;

      } catch (err) {
        log(`**Error:** ${err.message}`);
        log('');
        totalFailed++;
      }
    } else {
      log('**Result:** No fallback needed - normal RAG response would be used');
      log('');
      totalPassed++;
    }
  }

  // Summary
  log('---');
  log('');
  log('## Summary');
  log('');
  log(`| Metric | Value |`);
  log(`|--------|-------|`);
  log(`| Total Tests | ${testCases.length} |`);
  log(`| Passed | ${totalPassed} |`);
  log(`| Failed | ${totalFailed} |`);
  log('');

  // Category breakdown
  log('### Tests by Category');
  log('');
  const categories = {};
  testCases.forEach(t => {
    if (!categories[t.category]) categories[t.category] = 0;
    categories[t.category]++;
  });

  log('| Category | Count |');
  log('|----------|-------|');
  Object.entries(categories).forEach(([cat, count]) => {
    log(`| ${cat} | ${count} |`);
  });
  log('');

  log('---');
  log('');
  log('*Generated by Koda Fallback Test Suite*');

  // Write to file
  const outputPath = path.join(__dirname, '..', '..', '..', 'fallback_test_results.md');
  fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log(`  OUTPUT SAVED TO: ${outputPath}`);
  console.log('='.repeat(80) + '\n');
}

runTests().catch(console.error);
