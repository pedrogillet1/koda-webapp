/**
 * KODA PERFORMANCE ANALYSIS SCRIPT
 * Measures response times and identifies bottlenecks
 * Tests: Greeting, Simple, Medium, Complex, File Action
 *
 * IMPORTANT: Does NOT change the model - only measures performance
 */

const http = require('http');
const fs = require('fs');

const API_URL = 'http://localhost:5000';

// Test cases - one of each type
const TEST_CASES = [
  {
    type: 'GREETING',
    query: 'Hello',
    description: 'Simple greeting - should be fastest, no RAG needed'
  },
  {
    type: 'FILE_ACTION',
    query: 'What files do I have?',
    description: 'File listing - database query, no LLM generation'
  },
  {
    type: 'SIMPLE',
    query: 'Qual é o valor da multa da LGPD?',
    description: 'Simple factual query - single document lookup'
  },
  {
    type: 'MEDIUM',
    query: 'O que são dados pessoais e sensíveis segundo a LGPD?',
    description: 'Medium complexity - multiple concepts, same document'
  },
  {
    type: 'COMPLEX',
    query: 'Compare all project management documents and summarize key stakeholders and objectives',
    description: 'Complex query - cross-document analysis, synthesis'
  }
];

let token = null;
let results = [];

// High-resolution timer
function getTime() {
  return process.hrtime.bigint();
}

function msFromNano(start, end) {
  return Number(end - start) / 1_000_000;
}

async function makeRequest(options, data) {
  const startTime = getTime();

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      const firstByteTime = getTime();

      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const endTime = getTime();
        try {
          const parsed = JSON.parse(body);
          resolve({
            data: parsed,
            timing: {
              total: msFromNano(startTime, endTime),
              timeToFirstByte: msFromNano(startTime, firstByteTime),
              bodyTransfer: msFromNano(firstByteTime, endTime)
            }
          });
        } catch (e) {
          resolve({
            data: { raw: body, error: e.message },
            timing: {
              total: msFromNano(startTime, endTime),
              timeToFirstByte: msFromNano(startTime, firstByteTime),
              bodyTransfer: msFromNano(firstByteTime, endTime)
            }
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout (120s)'));
    });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login() {
  console.log('🔐 Authenticating...');
  const startTime = getTime();

  const result = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'localhost@koda.com', password: 'localhost123' });

  const loginTime = msFromNano(startTime, getTime());
  console.log(`   Login time: ${loginTime.toFixed(0)}ms`);

  return result.data.accessToken;
}

async function createConversation(token) {
  const result = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/chat/conversations',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, {});

  return {
    id: result.data.id,
    timing: result.timing
  };
}

async function sendMessage(token, convId, message) {
  const result = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/chat/conversations/${convId}/messages`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }, { content: message });

  return {
    content: result.data.assistantMessage?.content || result.data.error || 'No response',
    metadata: result.data.metadata || {},
    timing: result.timing
  };
}

function analyzeResponse(response, type) {
  const issues = [];
  const suggestions = [];

  // Check response length
  const len = response.content.length;
  if (len < 10) {
    issues.push('⚠️ Response too short');
  }

  // Check for access denial (should be fixed)
  if (/i do not have access|cannot access your/i.test(response.content)) {
    issues.push('❌ Access denial response detected');
    suggestions.push('Check document access denial fix in rag.service.ts');
  }

  // Check timing anomalies based on type
  const totalTime = response.timing.total;

  switch(type) {
    case 'GREETING':
      if (totalTime > 2000) {
        issues.push(`⚠️ Greeting took ${totalTime.toFixed(0)}ms (expected <2000ms)`);
        suggestions.push('Greeting should bypass RAG - check intent detection');
      }
      break;
    case 'FILE_ACTION':
      if (totalTime > 3000) {
        issues.push(`⚠️ File listing took ${totalTime.toFixed(0)}ms (expected <3000ms)`);
        suggestions.push('File listing should be fast DB query - check file handler');
      }
      break;
    case 'SIMPLE':
      if (totalTime > 8000) {
        issues.push(`⚠️ Simple query took ${totalTime.toFixed(0)}ms (expected <8000ms)`);
        suggestions.push('Check embedding generation and Pinecone latency');
      }
      break;
    case 'MEDIUM':
      if (totalTime > 15000) {
        issues.push(`⚠️ Medium query took ${totalTime.toFixed(0)}ms (expected <15000ms)`);
        suggestions.push('Check context assembly and Gemini streaming');
      }
      break;
    case 'COMPLEX':
      if (totalTime > 30000) {
        issues.push(`⚠️ Complex query took ${totalTime.toFixed(0)}ms (expected <30000ms)`);
        suggestions.push('Check multi-document retrieval and synthesis');
      }
      break;
  }

  // Check time to first byte (TTFB)
  if (response.timing.timeToFirstByte > 10000) {
    issues.push(`⚠️ High TTFB: ${response.timing.timeToFirstByte.toFixed(0)}ms`);
    suggestions.push('Backend processing is slow - check RAG pipeline');
  }

  return { issues, suggestions };
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printTimingBar(label, ms, maxMs = 30000) {
  const barWidth = 40;
  const filled = Math.min(Math.round((ms / maxMs) * barWidth), barWidth);
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const color = ms < 3000 ? '32' : ms < 10000 ? '33' : '31'; // green, yellow, red
  console.log(`   ${label.padEnd(20)} \x1b[${color}m${bar}\x1b[0m ${formatTime(ms)}`);
}

async function runPerformanceTest() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    KODA PERFORMANCE ANALYSIS                               ║');
  console.log('║                    Testing Response Times & Bottlenecks                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Login
  try {
    token = await login();
    if (!token) throw new Error('No token received');
    console.log('   ✅ Authentication successful\n');
  } catch (e) {
    console.error('❌ Authentication failed:', e.message);
    return;
  }

  const allIssues = [];
  const allSuggestions = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const test = TEST_CASES[i];

    console.log('─'.repeat(78));
    console.log(`\n📊 TEST ${i + 1}/${TEST_CASES.length}: ${test.type}`);
    console.log(`   Query: "${test.query}"`);
    console.log(`   ${test.description}`);
    console.log('');

    const testStart = getTime();

    try {
      // Step 1: Create conversation
      console.log('   ⏱️  TIMING BREAKDOWN:');
      const step1Start = getTime();
      const conv = await createConversation(token);
      const step1Time = msFromNano(step1Start, getTime());
      printTimingBar('1. Create Conv', step1Time);

      // Step 2: Send message and get response
      const step2Start = getTime();
      const response = await sendMessage(token, conv.id, test.query);
      const step2Time = msFromNano(step2Start, getTime());

      printTimingBar('2. TTFB', response.timing.timeToFirstByte);
      printTimingBar('3. Body Transfer', response.timing.bodyTransfer);
      printTimingBar('4. Total Request', response.timing.total);

      const totalTestTime = msFromNano(testStart, getTime());
      console.log('');
      console.log(`   📈 TOTAL TEST TIME: ${formatTime(totalTestTime)}`);

      // Response preview
      console.log('');
      console.log('   📝 RESPONSE PREVIEW:');
      const preview = response.content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`   "${preview}${response.content.length > 200 ? '...' : ''}"`);
      console.log(`   [${response.content.length} chars]`);

      // Analyze for issues
      const analysis = analyzeResponse(response, test.type);

      if (analysis.issues.length > 0) {
        console.log('');
        console.log('   🔍 ISSUES DETECTED:');
        analysis.issues.forEach(issue => {
          console.log(`      ${issue}`);
          allIssues.push({ type: test.type, issue });
        });
      }

      if (analysis.suggestions.length > 0) {
        analysis.suggestions.forEach(s => {
          allSuggestions.push({ type: test.type, suggestion: s });
        });
      }

      // Store result
      results.push({
        type: test.type,
        query: test.query,
        totalTime: totalTestTime,
        convTime: step1Time,
        ttfb: response.timing.timeToFirstByte,
        bodyTransfer: response.timing.bodyTransfer,
        requestTime: response.timing.total,
        responseLength: response.content.length,
        issues: analysis.issues,
        suggestions: analysis.suggestions,
        status: analysis.issues.length === 0 ? 'PASS' : 'ISSUES'
      });

      console.log('');

    } catch (e) {
      console.log(`   ❌ ERROR: ${e.message}`);
      results.push({
        type: test.type,
        query: test.query,
        error: e.message,
        status: 'ERROR'
      });
      allIssues.push({ type: test.type, issue: `Error: ${e.message}` });
    }
  }

  // Summary
  console.log('');
  console.log('═'.repeat(78));
  console.log('');
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('═'.repeat(78));
  console.log('');

  // Timing table
  console.log('┌────────────────┬──────────────┬──────────────┬──────────────┬──────────┐');
  console.log('│ Type           │ Total Time   │ TTFB         │ Response Len │ Status   │');
  console.log('├────────────────┼──────────────┼──────────────┼──────────────┼──────────┤');

  for (const r of results) {
    if (r.error) {
      console.log(`│ ${r.type.padEnd(14)} │ ERROR        │ -            │ -            │ ❌ ERROR │`);
    } else {
      const status = r.status === 'PASS' ? '✅ PASS ' : '⚠️ ISSUES';
      console.log(`│ ${r.type.padEnd(14)} │ ${formatTime(r.totalTime).padEnd(12)} │ ${formatTime(r.ttfb).padEnd(12)} │ ${String(r.responseLength).padEnd(12)} │ ${status} │`);
    }
  }

  console.log('└────────────────┴──────────────┴──────────────┴──────────────┴──────────┘');

  // Performance rating
  console.log('');
  console.log('📈 PERFORMANCE RATING:');
  console.log('');

  const avgTime = results.filter(r => !r.error).reduce((sum, r) => sum + r.totalTime, 0) / results.filter(r => !r.error).length;
  const fastestResult = results.filter(r => !r.error).reduce((min, r) => r.totalTime < min.totalTime ? r : min, results[0]);
  const slowestResult = results.filter(r => !r.error).reduce((max, r) => r.totalTime > max.totalTime ? r : max, results[0]);

  console.log(`   Average Response Time: ${formatTime(avgTime)}`);
  console.log(`   Fastest: ${fastestResult?.type} (${formatTime(fastestResult?.totalTime || 0)})`);
  console.log(`   Slowest: ${slowestResult?.type} (${formatTime(slowestResult?.totalTime || 0)})`);

  // Issues summary
  if (allIssues.length > 0) {
    console.log('');
    console.log('⚠️  ALL ISSUES DETECTED:');
    allIssues.forEach(({ type, issue }) => {
      console.log(`   [${type}] ${issue}`);
    });
  }

  // Suggestions
  if (allSuggestions.length > 0) {
    console.log('');
    console.log('💡 OPTIMIZATION SUGGESTIONS:');
    const uniqueSuggestions = [...new Set(allSuggestions.map(s => s.suggestion))];
    uniqueSuggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s}`);
    });
  }

  // Bottleneck analysis
  console.log('');
  console.log('🔍 BOTTLENECK ANALYSIS:');
  console.log('');

  for (const r of results.filter(r => !r.error)) {
    const ttfbPercent = ((r.ttfb / r.totalTime) * 100).toFixed(1);
    const transferPercent = ((r.bodyTransfer / r.totalTime) * 100).toFixed(1);

    console.log(`   ${r.type}:`);
    console.log(`      TTFB (backend processing): ${ttfbPercent}% of total time`);
    console.log(`      Body Transfer (streaming): ${transferPercent}% of total time`);

    if (parseFloat(ttfbPercent) > 80) {
      console.log(`      ⚠️  High TTFB indicates slow backend processing`);
      console.log(`         → Check: RAG retrieval, embedding generation, Pinecone latency`);
    }
    if (parseFloat(transferPercent) > 50) {
      console.log(`      ⚠️  High transfer time indicates slow LLM streaming`);
      console.log(`         → Check: Gemini API latency, token generation speed`);
    }
    console.log('');
  }

  // Potential flaws
  console.log('');
  console.log('🚨 POTENTIAL SYSTEM FLAWS TO INVESTIGATE:');
  console.log('');
  console.log('   1. EMBEDDING GENERATION:');
  console.log('      - Check if embeddings are cached or regenerated each time');
  console.log('      - Batch embedding requests if multiple queries');
  console.log('');
  console.log('   2. PINECONE LATENCY:');
  console.log('      - Check index region (should match server location)');
  console.log('      - Consider using approximate search for faster results');
  console.log('');
  console.log('   3. GEMINI API:');
  console.log('      - Check if context caching is enabled');
  console.log('      - Monitor rate limiting and retry delays');
  console.log('');
  console.log('   4. DATABASE QUERIES:');
  console.log('      - Check for N+1 queries in document retrieval');
  console.log('      - Ensure indexes on frequently queried columns');
  console.log('');
  console.log('   5. FORMAT ENFORCEMENT:');
  console.log('      - Post-processing adds latency');
  console.log('      - Consider streaming format fixes');
  console.log('');

  // Save results
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      avgTime,
      fastest: { type: fastestResult?.type, time: fastestResult?.totalTime },
      slowest: { type: slowestResult?.type, time: slowestResult?.totalTime },
      issuesCount: allIssues.length
    },
    issues: allIssues,
    suggestions: allSuggestions
  };

  fs.writeFileSync('performance_report.json', JSON.stringify(report, null, 2));
  console.log('📁 Full report saved to performance_report.json');
  console.log('');
  console.log('═'.repeat(78));
}

runPerformanceTest().catch(console.error);
