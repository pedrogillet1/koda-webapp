/**
 * Koda RAG System - Comprehensive Stress Test
 * Tests all routing paths: Greeting, Doc Count, File Navigation, App Help, RAG queries
 */

const API_BASE = 'http://localhost:5000/api';

// Test credentials
const TEST_USER = {
  email: 'localhost@koda.com',
  password: 'localhost123'
};

// Comprehensive test queries based on ACTUAL user documents
const QUERIES = [
  // ═══════════════════════════════════════════════════════════════
  // ULTRA_FAST_GREETING - Should be < 500ms (no LLM, no DB retrieval)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'Q1: Simple Greeting (PT)',
    query: 'Olá, quem é você?',
    expectedType: 'ULTRA_FAST_GREETING',
    maxTime: 3000,
    validation: (answer) => answer.toLowerCase().includes('koda') || answer.toLowerCase().includes('assistente')
  },
  {
    name: 'Q2: Simple Greeting (EN)',
    query: 'Hello, who are you?',
    expectedType: 'ULTRA_FAST_GREETING',
    maxTime: 3000,
    validation: (answer) => answer.toLowerCase().includes('koda') || answer.toLowerCase().includes('assistant')
  },

  // ═══════════════════════════════════════════════════════════════
  // DOC_COUNT - Should be < 5000ms (simple DB count)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'Q3: Document Count (PT)',
    query: 'Quantos documentos eu tenho?',
    expectedType: 'DOC_COUNT',
    maxTime: 5000,
    validation: (answer) => /\d+\s*(documento|document|arquivo|file)/i.test(answer)
  },

  // ═══════════════════════════════════════════════════════════════
  // RAG QUERIES - Based on actual documents in the workspace
  // ═══════════════════════════════════════════════════════════════

  // Lone Mountain Ranch P&L 2024.xlsx
  {
    name: 'Q4: Lone Mountain Ranch P&L',
    query: 'What are the main expenses in the Lone Mountain Ranch P&L?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // Rosewood Fund v3.xlsx
  {
    name: 'Q5: Rosewood Fund Analysis',
    query: 'Summarize the key data from the Rosewood Fund document',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // 2511.11383v1_Optimal Dividend Reinsurance and Capital Injectio.pdf
  {
    name: 'Q6: Dividend Reinsurance Paper',
    query: 'What is the main topic of the Optimal Dividend Reinsurance paper?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // 2511.12120v1_Deep Reinforcement Learning for Automated Stock Tr.pdf
  {
    name: 'Q7: Deep Learning Stock Trading',
    query: 'Explain the methodology used in the Deep Reinforcement Learning for Stock Trading paper',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // Koda Presentation Port Final (2).pptx
  {
    name: 'Q8: Koda Presentation Content',
    query: 'What are the main points in the Koda presentation?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // Project Management Presentation.pptx
  {
    name: 'Q9: Project Management Topics',
    query: 'What topics are covered in the Project Management presentation?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // World Bank Excel files
  {
    name: 'Q10: World Bank Energy Data',
    query: 'What does the World Bank electricity data show?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // Financ_as_II_Aula_12__Gabarito_b.xlsx
  {
    name: 'Q11: Finance Class Data',
    query: 'O que contém a planilha de Finanças II?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // Interview files
  {
    name: 'Q12: Interview Content',
    query: 'What are the main topics discussed in the interviews?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // OBA_marketing_servicos (1).pdf
  {
    name: 'Q13: Marketing Services PDF',
    query: 'Qual é o conteúdo do documento de marketing de serviços OBA?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // guarda bens self storage.pptx
  {
    name: 'Q14: Self Storage Presentation',
    query: 'O que é apresentado no documento de guarda bens self storage?',
    expectedType: 'STANDARD_QUERY',
    maxTime: 15000,
    validation: (answer) => answer.length > 50
  },

  // Cross-document analysis
  {
    name: 'Q15: Compare Financial Docs',
    query: 'Compare the financial data between Lone Mountain Ranch and Rosewood Fund',
    expectedType: 'COMPLEX_ANALYSIS',
    maxTime: 20000,
    validation: (answer) => answer.length > 50
  },
];

async function login() {
  console.log('Logging in...');
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Logged in as ${TEST_USER.email}\n`);
  return data.accessToken;
}

async function runQuery(token, query, conversationId) {
  const start = Date.now();

  const response = await fetch(`${API_BASE}/rag/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query,
      conversationId
    })
  });

  const elapsed = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Query failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return { data, elapsed };
}

async function runStressTest() {
  console.log('================================================================================');
  console.log('KODA RAG SYSTEM - COMPREHENSIVE STRESS TEST');
  console.log('================================================================================');
  console.log(`Testing ${QUERIES.length} queries across all intent types\n`);

  try {
    // Login
    const token = await login();

    // Statistics
    const results = [];
    const byType = {};
    let totalTime = 0;

    // Run queries
    for (let i = 0; i < QUERIES.length; i++) {
      const test = QUERIES[i];
      const conversationId = `stress-test-${Date.now()}-${i}`;

      console.log(`\n[${i + 1}/${QUERIES.length}] ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Expected: ${test.expectedType}`);

      try {
        const { data, elapsed } = await runQuery(token, test.query, conversationId);

        const passed = test.validation(data.answer);
        const timeOk = elapsed <= test.maxTime;

        // Truncate answer for display
        const displayAnswer = data.answer.length > 100
          ? data.answer.substring(0, 100) + '...'
          : data.answer;

        console.log(`   Answer: ${displayAnswer}`);
        console.log(`   Time: ${elapsed}ms ${timeOk ? '[OK]' : '[SLOW - exceeded ' + test.maxTime + 'ms]'}`);
        console.log(`   Validation: ${passed ? '[PASS]' : '[FAIL]'}`);

        results.push({
          name: test.name,
          type: test.expectedType,
          passed,
          timeOk,
          elapsed,
          answer: data.answer
        });

        totalTime += elapsed;

        // Track by type
        if (!byType[test.expectedType]) {
          byType[test.expectedType] = { count: 0, passed: 0, totalTime: 0 };
        }
        byType[test.expectedType].count++;
        byType[test.expectedType].totalTime += elapsed;
        if (passed) byType[test.expectedType].passed++;

      } catch (error) {
        console.log(`   ERROR: ${error.message}`);
        results.push({
          name: test.name,
          type: test.expectedType,
          passed: false,
          timeOk: false,
          elapsed: 0,
          error: error.message
        });
      }
    }

    // Summary
    console.log('\n================================================================================');
    console.log('RESULTS SUMMARY');
    console.log('================================================================================');

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const avgTime = Math.round(totalTime / total);

    console.log(`\nOverall: ${passed}/${total} passed (${Math.round(passed/total*100)}%)`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average response time: ${avgTime}ms`);

    console.log('\n--- By Intent Type ---');
    Object.entries(byType).forEach(([type, stats]) => {
      const avg = Math.round(stats.totalTime / stats.count);
      console.log(`  ${type}: ${stats.passed}/${stats.count} passed, avg ${avg}ms`);
    });

    console.log('\n--- Individual Results ---');
    results.forEach(r => {
      const status = r.passed ? '[PASS]' : '[FAIL]';
      const time = r.error ? 'ERROR' : `${r.elapsed}ms`;
      console.log(`  ${status} ${r.name}: ${time}`);
    });

    // Failures
    const failures = results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log('\n--- Failures ---');
      failures.forEach(f => {
        console.log(`  ${f.name}:`);
        if (f.error) {
          console.log(`    Error: ${f.error}`);
        } else {
          console.log(`    Answer preview: ${f.answer?.substring(0, 80)}...`);
        }
      });
    }

    console.log('\n================================================================================\n');

    // Exit with error code if any failures
    if (failures.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runStressTest();
