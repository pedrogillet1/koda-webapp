/**
 * KODA Stress Test - Full Output Suite
 *
 * Tests ALL question types Koda can answer with FULL response content.
 * Shows exact frontend output to understand Koda's writing style.
 *
 * Run with: node src/services/fallback/stress-test-full-output.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const fs = require('fs');
const path = require('path');

// Register ts-node for TypeScript imports
require('ts-node').register({ transpileOnly: true });

const prisma = require('../../config/database').default;
const { generateAnswer } = require('../rag.service');

// Rate limiting helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Get actual documents from database
async function getActualDocuments(userId) {
  const docs = await prisma.documents.findMany({
    where: { userId, status: 'completed' },
    select: { id: true, filename: true, mimeType: true },
    take: 10
  });
  return docs;
}

// Test categories covering ALL Koda capabilities
const testCategories = [
  // ============================================================================
  // 1. DOCUMENT RETRIEVAL & RAG QUERIES
  // ============================================================================
  {
    category: 'DOCUMENT RETRIEVAL - Specific Data',
    description: 'Questions that require finding specific information in documents',
    questions: [
      'What is the total revenue shown in the financial documents?',
      'Show me the data for Brazil in the worldbank files',
      'What are the key metrics from the Lone Mountain Ranch P&L?',
      'Find all mentions of GDP in my documents',
      'What countries have the highest renewable energy consumption?',
    ]
  },
  {
    category: 'DOCUMENT RETRIEVAL - Summaries',
    description: 'Questions asking for document summaries and overviews',
    questions: [
      'Summarize the main points from the Rosewood Fund document',
      'Give me an overview of the LMR Improvement Plan',
      'What are the key findings across all my financial documents?',
      'Summarize the worldbank data I uploaded',
      'What is the HSBC paper about?',
    ]
  },
  {
    category: 'DOCUMENT RETRIEVAL - Comparisons',
    description: 'Questions comparing information across documents',
    questions: [
      'Compare the 2024 and 2025 budget for Lone Mountain Ranch',
      'What are the differences between the worldbank indicators?',
      'How do the financial metrics compare across my Excel files?',
      'Compare the different interview documents',
      'What trends can you see across the worldbank data files?',
    ]
  },

  // ============================================================================
  // 2. EXCEL/SPREADSHEET SPECIFIC QUERIES
  // ============================================================================
  {
    category: 'EXCEL QUERIES - Cell/Range',
    description: 'Questions about specific cells, ranges, or sheets',
    questions: [
      'What is in cell A1 of the Rosewood Fund spreadsheet?',
      'Show me the data from the first sheet of the budget file',
      'What formulas are used in the LMR Improvement Plan?',
      'List the column headers in the worldbank files',
      'What sheets are in the Lone Mountain Ranch P&L 2024?',
    ]
  },
  {
    category: 'EXCEL QUERIES - Calculations',
    description: 'Questions requiring calculations on spreadsheet data',
    questions: [
      'Calculate the total of all expenses in the budget',
      'What is the average value across all countries in the worldbank data?',
      'Sum up the revenue figures from Lone Mountain Ranch',
      'What is the percentage change between 2024 and 2025 budget?',
      'Find the maximum and minimum values in the financial data',
    ]
  },

  // ============================================================================
  // 3. PDF DOCUMENT QUERIES
  // ============================================================================
  {
    category: 'PDF QUERIES - Academic Papers',
    description: 'Questions about PDF research papers and reports',
    questions: [
      'What methodology is used in the machine learning paper?',
      'Explain the key findings from the reinforcement learning paper',
      'What is the main thesis of the HSBC paper?',
      'Summarize the statistical evaluation paper',
      'What are the conclusions of the financial research papers?',
    ]
  },
  {
    category: 'PDF QUERIES - Specific Sections',
    description: 'Questions about specific sections or pages',
    questions: [
      'What does page 1 of the machine learning paper say?',
      'Find the abstract from the deep reinforcement learning paper',
      'What references are cited in the Shapley allocation paper?',
      'Show me the introduction section of any research paper',
      'What figures or tables are in the statistical evaluation paper?',
    ]
  },

  // ============================================================================
  // 4. WORD DOCUMENT QUERIES
  // ============================================================================
  {
    category: 'WORD DOCUMENT QUERIES',
    description: 'Questions about Word documents and interviews',
    questions: [
      'What topics are discussed in Interview 1?',
      'Compare the three interview documents',
      'What is the main content of the figshare documents?',
      'Summarize the supplementary information document',
      'What themes appear across all the interview files?',
    ]
  },

  // ============================================================================
  // 5. CROSS-DOCUMENT ANALYSIS
  // ============================================================================
  {
    category: 'CROSS-DOCUMENT ANALYSIS',
    description: 'Complex queries spanning multiple documents',
    questions: [
      'What common themes appear across all my documents?',
      'Create a comprehensive summary of everything I uploaded',
      'What financial insights can you derive from all my files?',
      'How do the research papers relate to the financial data?',
      'Generate a report combining insights from all documents',
    ]
  },

  // ============================================================================
  // 6. CONTEXTUAL & FOLLOW-UP QUERIES
  // ============================================================================
  {
    category: 'CONTEXTUAL QUERIES',
    description: 'Questions that build on document context',
    questions: [
      'Tell me more about the renewable energy data',
      'Explain this in simpler terms',
      'What are the implications of these findings?',
      'Why is this data important?',
      'How can I use this information?',
    ]
  },

  // ============================================================================
  // 7. SEARCH & DISCOVERY QUERIES
  // ============================================================================
  {
    category: 'SEARCH QUERIES',
    description: 'Questions searching for specific terms or concepts',
    questions: [
      'Find all mentions of "investment" in my documents',
      'Search for any data related to electricity consumption',
      'Where is "capital expenditure" mentioned?',
      'Find references to specific years like 2020 or 2021',
      'Search for any mentions of specific countries',
    ]
  },

  // ============================================================================
  // 8. ANALYTICAL QUERIES
  // ============================================================================
  {
    category: 'ANALYTICAL QUERIES',
    description: 'Questions requiring analysis and interpretation',
    questions: [
      'What patterns do you see in the worldbank data?',
      'Analyze the financial health of Lone Mountain Ranch',
      'What trends are visible in the time series data?',
      'Identify any anomalies or outliers in the data',
      'What are the key performance indicators across my files?',
    ]
  },

  // ============================================================================
  // 9. FORMATTING & PRESENTATION QUERIES
  // ============================================================================
  {
    category: 'FORMATTING QUERIES',
    description: 'Questions about how to present or format data',
    questions: [
      'Create a table summarizing the key metrics',
      'List the top 10 countries by renewable energy percentage',
      'Format the budget data as a comparison chart description',
      'Organize the research paper findings into bullet points',
      'Create an executive summary of the financial documents',
    ]
  },

  // ============================================================================
  // 10. EDGE CASES & STRESS TESTS
  // ============================================================================
  {
    category: 'EDGE CASES - Very Long Queries',
    description: 'Testing with unusually long or complex questions',
    questions: [
      'I need you to look through all of my uploaded documents including the worldbank data files, the Lone Mountain Ranch financial statements, the Rosewood Fund spreadsheet, the research papers on machine learning and reinforcement learning, and the interview transcripts, and create a comprehensive analysis that identifies common themes, key metrics, trends over time, and any notable findings that might be relevant for investment decision making',
      'Compare and contrast the methodologies used across all the academic research papers I uploaded, specifically looking at how they approach financial analysis, what statistical techniques they employ, how they validate their findings, and what limitations they acknowledge in their research',
    ]
  },
  {
    category: 'EDGE CASES - Ambiguous Queries',
    description: 'Testing with intentionally vague or ambiguous questions',
    questions: [
      'What does it show?',
      'Tell me about the numbers',
      'Explain the main thing',
      'What should I know?',
      'Is this good or bad?',
    ]
  },
  {
    category: 'EDGE CASES - Technical Queries',
    description: 'Highly technical questions that may or may not be answerable',
    questions: [
      'What is the Sharpe ratio calculation methodology in the documents?',
      'Explain the stochastic differential equations mentioned in any paper',
      'What machine learning algorithms are discussed?',
      'Describe the API rate limiting approach if mentioned',
      'What database schemas are referenced?',
    ]
  }
];

async function runStressTest() {
  const outputLines = [];
  const startTime = Date.now();

  const log = (line = '') => {
    console.log(line);
    outputLines.push(line);
  };

  log('═'.repeat(100));
  log('');
  log('  KODA STRESS TEST - FULL OUTPUT ANALYSIS');
  log('  Understanding Koda\'s Writing Style & Response Patterns');
  log('');
  log('═'.repeat(100));
  log('');
  log(`Test Date: ${new Date().toISOString()}`);
  log(`Total Categories: ${testCategories.length}`);
  log(`Total Questions: ${testCategories.reduce((sum, cat) => sum + cat.questions.length, 0)}`);
  log('');
  log('---');
  log('');

  // Get the localhost user
  const user = await prisma.users.findFirst({
    where: { email: 'localhost@koda.com' }
  });

  if (!user) {
    log('ERROR: User localhost@koda.com not found');
    await prisma.$disconnect();
    return;
  }

  log(`User: ${user.email}`);
  log(`User ID: ${user.id}`);
  log('');

  // Get actual documents
  const documents = await getActualDocuments(user.id);
  log(`Available Documents: ${documents.length}`);
  documents.forEach((doc, i) => {
    log(`  ${i + 1}. ${doc.filename}`);
  });
  log('');
  log('---');
  log('');

  let totalQuestions = 0;
  let successfulResponses = 0;
  let failedResponses = 0;
  let totalResponseLength = 0;
  let shortestResponse = Infinity;
  let longestResponse = 0;

  for (let catIndex = 0; catIndex < testCategories.length; catIndex++) {
    const category = testCategories[catIndex];

    log('');
    log('═'.repeat(100));
    log(`## ${catIndex + 1}. ${category.category}`);
    log('═'.repeat(100));
    log('');
    log(`*${category.description}*`);
    log('');

    for (let qIndex = 0; qIndex < category.questions.length; qIndex++) {
      const question = category.questions[qIndex];
      totalQuestions++;

      log('─'.repeat(80));
      log(`### Question ${catIndex + 1}.${qIndex + 1}: "${question}"`);
      log('─'.repeat(80));
      log('');

      try {
        // Call RAG service with the actual user context
        // generateAnswer(userId, query, conversationId, answerLength, attachedDocumentId, conversationHistory, isFirstMessage)
        const conversationId = `stress-test-${Date.now()}-${totalQuestions}`;
        const response = await generateAnswer(
          user.id,
          question,
          conversationId,
          'medium',  // answerLength
          undefined, // attachedDocumentId
          [],        // conversationHistory
          true       // isFirstMessage
        );

        successfulResponses++;

        const responseText = response.answer || response.text || JSON.stringify(response);
        const responseLength = responseText.length;
        totalResponseLength += responseLength;

        if (responseLength < shortestResponse) shortestResponse = responseLength;
        if (responseLength > longestResponse) longestResponse = responseLength;

        log('**KODA RESPONSE:**');
        log('');
        log('```');
        log(responseText);
        log('```');
        log('');

        // Log metadata if available
        if (response.sources || response.documents) {
          log('**Sources Used:**');
          const sources = response.sources || response.documents || [];
          if (Array.isArray(sources) && sources.length > 0) {
            sources.slice(0, 5).forEach((src, i) => {
              const name = src.filename || src.document?.filename || src.name || 'Unknown';
              const score = src.similarity || src.score || 'N/A';
              log(`  ${i + 1}. ${name} (score: ${typeof score === 'number' ? score.toFixed(4) : score})`);
            });
          } else {
            log('  (No specific sources identified)');
          }
          log('');
        }

        log(`**Response Stats:** ${responseLength} chars | ${responseText.split(/\s+/).length} words`);
        log('');

      } catch (error) {
        failedResponses++;
        log('**ERROR:**');
        log('```');
        log(error.message || String(error));
        log('```');
        log('');
      }

      // Rate limiting - wait between requests
      await delay(2000);
    }
  }

  // Final Summary
  const duration = (Date.now() - startTime) / 1000;

  log('');
  log('═'.repeat(100));
  log('## STRESS TEST SUMMARY');
  log('═'.repeat(100));
  log('');
  log('| Metric | Value |');
  log('|--------|-------|');
  log(`| Total Questions | ${totalQuestions} |`);
  log(`| Successful Responses | ${successfulResponses} |`);
  log(`| Failed Responses | ${failedResponses} |`);
  log(`| Success Rate | ${((successfulResponses / totalQuestions) * 100).toFixed(1)}% |`);
  log(`| Total Duration | ${duration.toFixed(1)}s |`);
  log(`| Avg Time per Question | ${(duration / totalQuestions).toFixed(1)}s |`);
  log('');
  log('### Response Length Analysis');
  log('');
  log('| Metric | Value |');
  log('|--------|-------|');
  log(`| Average Response Length | ${Math.round(totalResponseLength / successfulResponses)} chars |`);
  log(`| Shortest Response | ${shortestResponse === Infinity ? 'N/A' : shortestResponse} chars |`);
  log(`| Longest Response | ${longestResponse} chars |`);
  log(`| Total Content Generated | ${totalResponseLength} chars |`);
  log('');

  log('### Categories Tested');
  log('');
  log('| # | Category | Questions |');
  log('|---|----------|-----------|');
  testCategories.forEach((cat, i) => {
    log(`| ${i + 1} | ${cat.category} | ${cat.questions.length} |`);
  });
  log('');

  log('---');
  log('');
  log('*Generated by Koda Stress Test Suite*');
  log(`*Completed at: ${new Date().toISOString()}*`);

  // Write to file
  const outputPath = path.join(__dirname, '..', '..', '..', 'stress_test_full_output.md');
  fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8');

  console.log('\n' + '═'.repeat(80));
  console.log(`  OUTPUT SAVED TO: ${outputPath}`);
  console.log('═'.repeat(80) + '\n');

  await prisma.$disconnect();
}

// Run the test
runStressTest()
  .then(() => {
    console.log('Stress test completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Stress test failed:', error);
    process.exit(1);
  });
