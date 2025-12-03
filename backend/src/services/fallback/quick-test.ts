/**
 * Quick Fallback Detection Test
 * Run with: GEMINI_API_KEY=test npx ts-node --transpile-only src/services/fallback/quick-test.ts
 */

import fallbackDetection from './fallbackDetection.service';

const testScenarios = [
  // KNOWLEDGE QUERIES
  { cat: 'KNOWLEDGE', name: 'No docs', query: 'What is the revenue for Q4?', docCount: 0, ragResults: [], ragScore: 0, expected: 'knowledge' },
  { cat: 'KNOWLEDGE', name: 'Docs but no results', query: 'What is the CEO salary?', docCount: 5, ragResults: [], ragScore: 0, expected: 'knowledge' },
  { cat: 'KNOWLEDGE', name: 'Low relevance (short query)', query: 'Employee benefits?', docCount: 3, ragResults: [{score: 0.2}], ragScore: 0.2, expected: 'clarification' }, // Short query triggers clarification first
  { cat: 'KNOWLEDGE', name: 'Good query (NO FALLBACK)', query: 'What is Q4 revenue in report?', docCount: 5, ragResults: [{score: 0.95}], ragScore: 0.95, expected: 'none' },

  // CLARIFICATION QUERIES
  // Note: If RAG finds good results (>0.7), we skip clarification and let RAG answer
  { cat: 'CLARIFICATION', name: 'Vague pronoun + good RAG (no fallback)', query: 'What does it say?', docCount: 5, ragResults: [{score: 0.8}], ragScore: 0.8, expected: 'none' }, // RAG found good results, let it answer
  { cat: 'CLARIFICATION', name: 'Generic doc ref + good RAG (no fallback)', query: 'What is in the document?', docCount: 10, ragResults: [{score: 0.85}], ragScore: 0.85, expected: 'none' }, // RAG found good results
  { cat: 'CLARIFICATION', name: 'Vague pronoun + NO results', query: 'What does it say?', docCount: 5, ragResults: [], ragScore: 0, expected: 'clarification' }, // No RAG results, need clarification
  { cat: 'CLARIFICATION', name: 'Generic doc ref + NO results', query: 'What is in the document?', docCount: 10, ragResults: [], ragScore: 0, expected: 'clarification' }, // No RAG results
  { cat: 'CLARIFICATION', name: 'Incomplete', query: 'What about', docCount: 3, ragResults: [], ragScore: 0, expected: 'clarification' },
  { cat: 'CLARIFICATION', name: 'Short query', query: 'Revenue', docCount: 5, ragResults: [{score: 0.7}], ragScore: 0.7, expected: 'clarification' }, // Score=0.7 is not >0.7

  // REFUSAL QUERIES
  { cat: 'REFUSAL', name: 'Stock price', query: 'What is the current stock price?', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },
  { cat: 'REFUSAL', name: 'Send email', query: 'Send an email to John', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },
  { cat: 'REFUSAL', name: 'Book meeting', query: 'Book a meeting for tomorrow', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },
  { cat: 'REFUSAL', name: 'Make payment', query: 'Make a payment of 500', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },
  { cat: 'REFUSAL', name: 'Opinion', query: 'Do you think this is good?', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },
  { cat: 'REFUSAL', name: 'Delete file', query: 'Delete the old file', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },
  { cat: 'REFUSAL', name: 'Live news', query: 'What is the latest news?', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },

  // CALCULATION without docs
  { cat: 'CALCULATION', name: 'Sum no docs', query: 'Sum of expenses?', docCount: 0, ragResults: [], ragScore: 0, expected: 'knowledge' },

  // FILE ACTIONS
  { cat: 'FILE', name: 'Find non-existent', query: 'Where is contract.pdf?', docCount: 5, ragResults: [], ragScore: 0, expected: 'knowledge' },
  { cat: 'FILE', name: 'Rename (action)', query: 'Rename my file', docCount: 5, ragResults: [], ragScore: 0, expected: 'refusal' },

  // COMPARISON
  { cat: 'COMPARISON', name: 'Compare no docs', query: 'Compare Q1 and Q2 reports', docCount: 0, ragResults: [], ragScore: 0, expected: 'knowledge' },

  // SUMMARIZATION
  { cat: 'SUMMARY', name: 'Summarize no docs', query: 'Summarize all documents', docCount: 0, ragResults: [], ragScore: 0, expected: 'knowledge' },

  // EXCEL
  { cat: 'EXCEL', name: 'Cell ref no Excel', query: 'What is in cell A1?', docCount: 2, ragResults: [], ragScore: 0, expected: 'knowledge' },
];

console.log('\n' + '='.repeat(80));
console.log('  COMPREHENSIVE KODA FALLBACK DETECTION TEST');
console.log('='.repeat(80) + '\n');

let currentCat = '';
let catPassed = 0;
let catFailed = 0;
let totalPassed = 0;
let totalFailed = 0;
const failures: Array<{name: string; expected: string; got: string}> = [];

testScenarios.forEach(s => {
  if (s.cat !== currentCat) {
    if (currentCat !== '') {
      console.log(`  Category: ${catPassed} passed, ${catFailed} failed\n`);
    }
    currentCat = s.cat;
    catPassed = 0;
    catFailed = 0;
    console.log(`[${s.cat}]`);
    console.log('-'.repeat(50));
  }

  const result = fallbackDetection.detectFallback({
    query: s.query,
    documentCount: s.docCount,
    ragResults: s.ragResults || [],
    ragScore: s.ragScore || 0,
  });

  const passed = result.fallbackType === s.expected;

  if (passed) {
    console.log(`PASS: ${s.name}`);
    catPassed++;
    totalPassed++;
  } else {
    console.log(`FAIL: ${s.name}`);
    console.log(`      Expected: ${s.expected}, Got: ${result.fallbackType}`);
    catFailed++;
    totalFailed++;
    failures.push({name: s.name, expected: s.expected, got: result.fallbackType});
  }
  console.log(`      Query: "${s.query}"`);
  console.log(`      Type: ${result.fallbackType}, Confidence: ${result.confidence}`);
  console.log('');
});

console.log(`  Category: ${catPassed} passed, ${catFailed} failed\n`);
console.log('='.repeat(80));
console.log('  SUMMARY');
console.log('='.repeat(80) + '\n');
console.log(`  TOTAL: ${totalPassed} passed, ${totalFailed} failed out of ${testScenarios.length} tests\n`);

if (failures.length > 0) {
  console.log('  FAILED TESTS:');
  failures.forEach(f => {
    console.log(`    - ${f.name}: Expected ${f.expected}, got ${f.got}`);
  });
  console.log('');
}
console.log('='.repeat(80) + '\n');
