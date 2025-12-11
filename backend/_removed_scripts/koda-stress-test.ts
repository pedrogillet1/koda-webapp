#!/usr/bin/env ts-node

/**
 * KODA HARDCORE STRESS TEST - Realistic Conversation
 *
 * This script simulates a real user conversation that pushes Koda to its limits
 */

import axios from 'axios';
import * as fs from 'fs';

// Configuration - Backend is on port 5000
const API_URL = process.env.API_URL || 'http://localhost:5000';
const CONVERSATION_ID = `stress-test-${Date.now()}`;

// Test results tracking
interface TestResult {
  questionNumber: number;
  question: string;
  expectedKeywords: string[];
  response: string;
  responseTime: number;
  success: boolean;
  issues: string[];
}

const results: TestResult[] = [];

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Get auth token
async function getAuthToken(): Promise<string> {
  try {
    // Try to login with test credentials
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'localhost@koda.com',
      password: 'localhost123',
    });
    return response.data.accessToken || response.data.token;
  } catch (error: any) {
    log(`Auth error: ${error.message}`, colors.yellow);
    // Return empty - some endpoints might not need auth
    return '';
  }
}

// Send query to Koda RAG endpoint
async function askKoda(question: string, token: string): Promise<{ response: string; responseTime: number }> {
  const startTime = Date.now();

  try {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.post(
      `${API_URL}/api/rag/query`,
      {
        query: question,
        conversationId: CONVERSATION_ID,
      },
      {
        headers,
        timeout: 60000,
      }
    );

    const responseTime = Date.now() - startTime;

    return {
      response: response.data.answer || response.data.message || JSON.stringify(response.data),
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      response: `ERROR: ${error.response?.data?.error || error.message}`,
      responseTime,
    };
  }
}

// Validate response
function validateResponse(
  response: string,
  expectedKeywords: string[]
): { success: boolean; issues: string[] } {
  const issues: string[] = [];

  if (response.includes('ERROR:')) {
    issues.push(`Response contains error: ${response.substring(0, 100)}`);
  }

  if (response.length < 20) {
    issues.push(`Response too short: ${response.length} characters`);
  }

  // Check for expected keywords (case insensitive)
  const missingKeywords = expectedKeywords.filter(
    keyword => !response.toLowerCase().includes(keyword.toLowerCase())
  );
  if (missingKeywords.length > expectedKeywords.length / 2) {
    issues.push(`Missing many keywords: ${missingKeywords.join(', ')}`);
  }

  return {
    success: issues.length === 0,
    issues,
  };
}

// Main test
async function runStressTest() {
  log('\n========================================', colors.cyan);
  log('KODA STRESS TEST - QUICK VERSION', colors.cyan);
  log('========================================\n', colors.cyan);

  log(`API URL: ${API_URL}`);
  log(`Conversation ID: ${CONVERSATION_ID}\n`);

  // Get auth token
  log('Getting auth token...', colors.yellow);
  const token = await getAuthToken();
  if (token) {
    log('✓ Auth token obtained', colors.green);
  } else {
    log('⚠ No auth token - continuing anyway', colors.yellow);
  }

  // Quick test questions
  const questions: Array<{
    q: string;
    expectedKeywords: string[];
  }> = [
    {
      q: 'Olá, quem é você?',
      expectedKeywords: ['Koda', 'assistente', 'documento'],
    },
    {
      q: 'Quantos documentos eu tenho?',
      expectedKeywords: ['documento'],
    },
    {
      q: 'Qual foi a receita total em 2024?',
      expectedKeywords: ['receita', '2024'],
    },
    {
      q: 'Compare os dados de 2024 com 2025',
      expectedKeywords: ['2024', '2025'],
    },
    {
      q: 'Quais são as principais despesas?',
      expectedKeywords: ['despesas'],
    },
  ];

  // Run tests
  for (let i = 0; i < questions.length; i++) {
    const { q, expectedKeywords } = questions[i];
    const questionNumber = i + 1;

    log(`\n${'='.repeat(50)}`, colors.blue);
    log(`QUESTION ${questionNumber}/${questions.length}`, colors.blue);
    log('='.repeat(50), colors.blue);
    log(`\n${q}\n`, colors.cyan);

    log('Sending to Koda...', colors.reset);

    const { response, responseTime } = await askKoda(q, token);

    log(`\nResponse time: ${responseTime}ms`, responseTime > 10000 ? colors.red : colors.green);

    log(`\nKoda's answer:`, colors.green);
    log(response.substring(0, 300) + (response.length > 300 ? '...' : ''), colors.reset);

    // Validate
    const validation = validateResponse(response, expectedKeywords);

    const result: TestResult = {
      questionNumber,
      question: q,
      expectedKeywords,
      response,
      responseTime,
      success: validation.success,
      issues: validation.issues,
    };

    if (result.success) {
      log('\n✓ PASS', colors.green);
    } else {
      log('\n✗ FAIL', colors.red);
      result.issues.forEach(issue => log(`  - ${issue}`, colors.red));
    }

    results.push(result);

    // Wait between questions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Final report
  log('\n\n========================================', colors.cyan);
  log('STRESS TEST COMPLETE', colors.cyan);
  log('========================================\n', colors.cyan);

  const totalTests = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;

  log(`Total Questions: ${totalTests}`, colors.reset);
  log(`Passed: ${passed} (${((passed / totalTests) * 100).toFixed(1)}%)`, colors.green);
  log(`Failed: ${failed} (${((failed / totalTests) * 100).toFixed(1)}%)`, colors.red);
  log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`, colors.reset);

  if (failed > 0) {
    log(`\nFailed Tests:`, colors.red);
    results.filter(r => !r.success).forEach(r => {
      log(`\nQ${r.questionNumber}: ${r.question}`, colors.red);
      r.issues.forEach(issue => log(`  - ${issue}`, colors.red));
    });
  }

  // Save report
  const reportPath = `./stress-test-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log(`\nReport saved to: ${reportPath}`, colors.cyan);

  process.exit(failed === 0 ? 0 : 1);
}

// Run
runStressTest().catch(error => {
  log(`\nFATAL ERROR: ${error.message}`, colors.red);
  console.error(error);
  process.exit(2);
});
