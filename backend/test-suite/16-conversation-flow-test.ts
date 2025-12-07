/**
 * Koda Conversation Flow Test Script
 *
 * Tests multi-turn conversations to validate:
 * - Context retention across messages
 * - Follow-up question handling
 * - Topic transitions
 * - Natural dialogue flow
 * - Conversation coherence
 * - Memory and reference resolution
 *
 * Run: npx ts-node test-suite/16-conversation-flow-test.ts
 */

import 'dotenv/config';
import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  testUserEmail: process.env.TEST_USER_EMAIL || 'localhost@koda.com',
  testUserPassword: process.env.TEST_USER_PASSWORD || 'localhost123',
  timeout: 60000,
  delayBetweenMessages: 1500, // 1.5 second delay between messages
  delayBetweenScenarios: 3000, // 3 second delay between scenarios
};

// Auth state
let authToken = '';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Message {
  query: string;
  expectedContext?: string[]; // Keywords that should appear in response
  shouldReference?: string; // Should reference previous message
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    mustContain?: string[];
    mustNotContain?: string[];
    shouldMaintainTopic?: boolean;
  };
}

interface ConversationScenario {
  name: string;
  description: string;
  messages: Message[];
  successCriteria: string;
}

interface ConversationResult {
  scenario: string;
  success: boolean;
  messagesProcessed: number;
  totalMessages: number;
  failures: string[];
  contextRetention: number; // 0-100%
  coherenceScore: number; // 0-100%
  avgResponseTime: number;
  conversationId: string;
  messageDetails: MessageResult[];
}

interface MessageResult {
  index: number;
  query: string;
  response: string;
  responseTime: number;
  valid: boolean;
  errors: string[];
}

// ============================================================================
// CONVERSATION SCENARIOS
// ============================================================================

const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  // ========================================================================
  // SCENARIO 1: Document Analysis with Follow-ups
  // ========================================================================
  {
    name: 'Document Analysis Flow',
    description: 'User asks about a document, then asks follow-up questions',
    messages: [
      {
        query: 'What is the total revenue for Lone Mountain Ranch in 2024?',
        expectedContext: ['revenue', 'Lone Mountain Ranch', '2024'],
        validationRules: {
          mustContain: ['Lone Mountain', '2024'],
          minLength: 50,
        },
      },
      {
        query: 'How does that compare to 2025?',
        shouldReference: 'previous revenue figure',
        expectedContext: ['2024', '2025', 'compare'],
        validationRules: {
          mustContain: ['2024', '2025'],
          shouldMaintainTopic: true,
        },
      },
      {
        query: 'What are the main revenue sources?',
        shouldReference: 'Lone Mountain Ranch',
        expectedContext: ['revenue', 'sources'],
        validationRules: {
          mustContain: ['revenue'],
          shouldMaintainTopic: true,
        },
      },
      {
        query: 'Which source generates the most?',
        shouldReference: 'revenue sources from previous message',
        validationRules: {
          shouldMaintainTopic: true,
        },
      },
    ],
    successCriteria: 'Maintains context about Lone Mountain Ranch throughout conversation',
  },

  // ========================================================================
  // SCENARIO 2: Clarification and Refinement
  // ========================================================================
  {
    name: 'Clarification Flow',
    description: 'User asks vague question, then refines it',
    messages: [
      {
        query: 'What is the MoIC?',
        expectedContext: ['MoIC'],
        validationRules: {
          minLength: 30,
        },
      },
      {
        query: 'I mean for the Rosewood Fund',
        shouldReference: 'MoIC',
        expectedContext: ['Rosewood Fund', 'MoIC'],
        validationRules: {
          mustContain: ['Rosewood'],
          shouldMaintainTopic: true,
        },
      },
      {
        query: 'What about for each property?',
        shouldReference: 'Rosewood Fund',
        expectedContext: ['property', 'MoIC'],
        validationRules: {
          shouldMaintainTopic: true,
        },
      },
    ],
    successCriteria: 'Understands refinements and maintains topic context',
  },

  // ========================================================================
  // SCENARIO 3: Multi-Document Comparison
  // ========================================================================
  {
    name: 'Cross-Document Analysis',
    description: 'User compares information across multiple documents',
    messages: [
      {
        query: 'Show me the Rosewood Fund v3 file',
        expectedContext: ['Rosewood Fund'],
      },
      {
        query: 'Now show me the Lone Mountain Ranch P&L',
        expectedContext: ['Lone Mountain Ranch', 'P&L'],
      },
      {
        query: 'Compare the revenue between these two',
        shouldReference: 'both documents',
        expectedContext: ['revenue', 'compare'],
        validationRules: {
          mustContain: ['Rosewood', 'Lone Mountain'],
          shouldMaintainTopic: true,
        },
      },
    ],
    successCriteria: 'Remembers both documents and compares them',
  },

  // ========================================================================
  // SCENARIO 4: Topic Transition
  // ========================================================================
  {
    name: 'Topic Change Flow',
    description: 'User changes topics mid-conversation',
    messages: [
      {
        query: 'What is the average MoIC across all properties?',
        expectedContext: ['MoIC', 'average'],
      },
      {
        query: 'Actually, let me ask something else. What folders do I have?',
        validationRules: {
          mustContain: ['folder'],
        },
      },
      {
        query: 'Back to my first question - what was the MoIC again?',
        shouldReference: 'first message about MoIC',
        expectedContext: ['MoIC'],
        validationRules: {
          mustContain: ['MoIC'],
        },
      },
    ],
    successCriteria: 'Handles topic changes and can return to previous topics',
  },

  // ========================================================================
  // SCENARIO 5: Pronoun and Reference Resolution
  // ========================================================================
  {
    name: 'Reference Resolution',
    description: 'User uses pronouns and references',
    messages: [
      {
        query: 'What is the total investment for Lone Mountain Ranch?',
        expectedContext: ['investment', 'Lone Mountain Ranch'],
      },
      {
        query: 'What about its revenue?',
        shouldReference: 'Lone Mountain Ranch',
        expectedContext: ['revenue'],
        validationRules: {
          mustContain: ['Lone Mountain'],
          shouldMaintainTopic: true,
        },
      },
      {
        query: 'Is it profitable?',
        shouldReference: 'Lone Mountain Ranch',
        validationRules: {
          mustContain: ['profit'],
          shouldMaintainTopic: true,
        },
      },
      {
        query: 'Show me that document',
        shouldReference: 'Lone Mountain Ranch document',
        validationRules: {
          shouldMaintainTopic: true,
        },
      },
    ],
    successCriteria: 'Resolves pronouns (it, its, that) correctly',
  },

  // ========================================================================
  // SCENARIO 6: Calculation with Follow-up
  // ========================================================================
  {
    name: 'Calculation Flow',
    description: 'User asks for calculation, then follow-up questions',
    messages: [
      {
        query: 'What is 15% of $1,000,000?',
        expectedContext: ['15', '1,000,000'],
        validationRules: {
          mustContain: ['150,000'],
        },
      },
      {
        query: 'What if it was 20% instead?',
        shouldReference: '$1,000,000',
        validationRules: {
          mustContain: ['200,000'],
          shouldMaintainTopic: true,
        },
      },
      {
        query: 'Add them together',
        shouldReference: 'both previous calculations',
        validationRules: {
          mustContain: ['350,000'],
        },
      },
    ],
    successCriteria: 'Maintains calculation context and performs follow-up calculations',
  },

  // ========================================================================
  // SCENARIO 7: Greeting and Context Building
  // ========================================================================
  {
    name: 'Natural Conversation Start',
    description: 'User starts with greeting, builds context naturally',
    messages: [
      {
        query: 'Hi!',
        expectedContext: ['hello', 'help'],
      },
      {
        query: 'I need help analyzing some financial data',
        validationRules: {
          minLength: 20,
        },
      },
      {
        query: 'Specifically, I want to know about the Rosewood Fund',
        shouldReference: 'financial data',
        expectedContext: ['Rosewood Fund'],
      },
      {
        query: 'What is its MoIC?',
        shouldReference: 'Rosewood Fund',
        validationRules: {
          mustContain: ['MoIC'],
        },
      },
    ],
    successCriteria: 'Builds context naturally from greeting to specific question',
  },

  // ========================================================================
  // SCENARIO 8: Error Recovery
  // ========================================================================
  {
    name: 'Error Recovery Flow',
    description: 'User makes typo, then corrects it',
    messages: [
      {
        query: 'What is the revenue for Lone Mountian Ranch?', // Typo
        expectedContext: ['revenue'],
      },
      {
        query: 'Sorry, I meant Lone Mountain Ranch',
        shouldReference: 'previous query',
        expectedContext: ['Lone Mountain Ranch', 'revenue'],
        validationRules: {
          mustContain: ['Lone Mountain'],
        },
      },
    ],
    successCriteria: 'Handles corrections gracefully',
  },

  // ========================================================================
  // SCENARIO 9: Multilanguage Conversation
  // ========================================================================
  {
    name: 'Multilanguage Flow',
    description: 'User switches languages mid-conversation',
    messages: [
      {
        query: 'What is the total revenue?',
        expectedContext: ['revenue'],
      },
      {
        query: 'E qual e o lucro?', // Portuguese: And what is the profit?
        shouldReference: 'revenue',
        expectedContext: ['profit', 'lucro'],
      },
      {
        query: 'Back to English - what is the difference?',
        shouldReference: 'revenue and profit',
        validationRules: {
          shouldMaintainTopic: true,
        },
      },
    ],
    successCriteria: 'Handles language switches and maintains context',
  },

  // ========================================================================
  // SCENARIO 10: Complex Multi-Turn Analysis
  // ========================================================================
  {
    name: 'Deep Dive Analysis',
    description: 'User performs deep analysis with multiple follow-ups',
    messages: [
      {
        query: 'What properties are in the Rosewood Fund?',
        expectedContext: ['Rosewood Fund', 'properties'],
      },
      {
        query: 'Which one has the highest MoIC?',
        shouldReference: 'properties from Rosewood Fund',
        expectedContext: ['MoIC', 'highest'],
      },
      {
        query: 'What is its total investment?',
        shouldReference: 'property with highest MoIC',
        expectedContext: ['investment'],
      },
      {
        query: 'How does that compare to the average investment across all properties?',
        shouldReference: 'investment amount and all properties',
        expectedContext: ['average', 'compare'],
      },
      {
        query: 'Is this a good investment?',
        shouldReference: 'entire analysis',
        validationRules: {
          shouldMaintainTopic: true,
        },
      },
    ],
    successCriteria: 'Maintains complex context across 5+ messages',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const results: ConversationResult[] = [];

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Authenticate with the API
 */
async function authenticate(): Promise<boolean> {
  try {
    console.log(`Authenticating to ${CONFIG.baseUrl}...`);
    const response = await axios.post(
      `${CONFIG.baseUrl}/api/auth/login`,
      {
        email: CONFIG.testUserEmail,
        password: CONFIG.testUserPassword
      },
      { timeout: 30000 }
    );
    authToken = response.data.accessToken || response.data.token;
    console.log('[OK] Authentication successful\n');
    return true;
  } catch (error: any) {
    console.log('[ERROR] Authentication failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.code) {
      console.log('Error code:', error.code);
    }
    if (error.cause) {
      console.log('Error cause:', error.cause);
    }
    console.log('Full error:', error);
    return false;
  }
}

/**
 * Create a new conversation
 */
async function createConversation(title: string): Promise<string | null> {
  try {
    const response = await axios.post(
      `${CONFIG.baseUrl}/api/chat/conversations`,
      { title },
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 30000
      }
    );
    return response.data.id;
  } catch (error: any) {
    console.log('[ERROR] Failed to create conversation:', error.message);
    return null;
  }
}

/**
 * Send message to Koda API using the correct chat endpoint
 */
async function sendMessage(
  query: string,
  conversationId: string
): Promise<{ success: boolean; data?: any; error?: string; responseTime: number }> {
  const startTime = Date.now();

  try {
    // Use the correct API endpoint: /api/chat/conversations/:conversationId/messages
    const response = await axios.post(
      `${CONFIG.baseUrl}/api/chat/conversations/${conversationId}/messages`,
      { content: query },
      {
        timeout: CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      data: response.data,
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    let errorMessage = error.message;
    if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }

    return {
      success: false,
      error: errorMessage,
      responseTime,
    };
  }
}

/**
 * Extract response text from API response
 */
function extractResponseText(data: any): string {
  // Handle different response formats
  if (typeof data === 'string') return data;
  if (data.response) return data.response;
  if (data.message) return data.message;
  if (data.answer) return data.answer;
  if (data.content) return data.content;
  if (data.text) return data.text;
  if (data.assistantMessage?.content) return data.assistantMessage.content;
  return JSON.stringify(data);
}

/**
 * Validate message response
 */
function validateResponse(
  response: string,
  message: Message,
  previousMessages: Array<{ query: string; response: string }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!response || response.length === 0) {
    errors.push('Empty response');
    return { valid: false, errors };
  }

  const lowerResponse = response.toLowerCase();
  const rules = message.validationRules;

  if (rules) {
    // Check minimum length
    if (rules.minLength && response.length < rules.minLength) {
      errors.push(`Response too short (${response.length} < ${rules.minLength})`);
    }

    // Check maximum length
    if (rules.maxLength && response.length > rules.maxLength) {
      errors.push(`Response too long (${response.length} > ${rules.maxLength})`);
    }

    // Check must contain (case insensitive)
    if (rules.mustContain) {
      for (const keyword of rules.mustContain) {
        if (!lowerResponse.includes(keyword.toLowerCase())) {
          errors.push(`Missing required keyword: "${keyword}"`);
        }
      }
    }

    // Check must not contain
    if (rules.mustNotContain) {
      for (const keyword of rules.mustNotContain) {
        if (lowerResponse.includes(keyword.toLowerCase())) {
          errors.push(`Contains forbidden keyword: "${keyword}"`);
        }
      }
    }

    // Check topic maintenance
    if (rules.shouldMaintainTopic && previousMessages.length > 0) {
      // Extract key terms from previous messages
      const previousTerms = previousMessages
        .flatMap(m => m.query.toLowerCase().split(/\s+/))
        .filter(term => term.length > 4); // Only meaningful terms

      // Check if response references any previous terms
      const referencesFound = previousTerms.some(term =>
        lowerResponse.includes(term)
      );

      if (!referencesFound) {
        errors.push('Response does not maintain topic from previous messages');
      }
    }
  }

  // Check expected context (case insensitive)
  if (message.expectedContext) {
    const missingContext: string[] = [];
    for (const keyword of message.expectedContext) {
      if (!lowerResponse.includes(keyword.toLowerCase())) {
        missingContext.push(keyword);
      }
    }
    if (missingContext.length > message.expectedContext.length / 2) {
      errors.push(`Missing expected context: ${missingContext.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate context retention score
 */
function calculateContextRetention(
  messages: Array<{ query: string; response: string; valid: boolean }>
): number {
  if (messages.length <= 1) return 100;

  let retentionScore = 0;

  // Check if each message references previous context
  for (let i = 1; i < messages.length; i++) {
    const currentResponse = messages[i].response.toLowerCase();
    const previousQueries = messages.slice(0, i).map(m => m.query.toLowerCase());

    // Extract key terms from previous queries
    const previousTerms = previousQueries
      .flatMap(q => q.split(/\s+/))
      .filter(term => term.length > 4);

    // Check if current response references previous terms
    const referencesCount = previousTerms.filter(term =>
      currentResponse.includes(term)
    ).length;

    if (referencesCount > 0) {
      retentionScore += 1;
    }
  }

  return (retentionScore / (messages.length - 1)) * 100;
}

/**
 * Calculate coherence score
 */
function calculateCoherenceScore(
  messages: Array<{ query: string; response: string; valid: boolean }>
): number {
  const validMessages = messages.filter(m => m.valid).length;
  return (validMessages / messages.length) * 100;
}

/**
 * Run a conversation scenario
 */
async function runConversationScenario(
  scenario: ConversationScenario
): Promise<ConversationResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log(`${scenario.description}`);
  console.log('='.repeat(80));

  // Create a new conversation for this scenario
  const conversationId = await createConversation(`Test: ${scenario.name}`);

  if (!conversationId) {
    console.log('   [ERROR] Failed to create conversation');
    return {
      scenario: scenario.name,
      success: false,
      messagesProcessed: 0,
      totalMessages: scenario.messages.length,
      failures: ['Failed to create conversation'],
      contextRetention: 0,
      coherenceScore: 0,
      avgResponseTime: 0,
      conversationId: '',
      messageDetails: [],
    };
  }

  console.log(`   Conversation ID: ${conversationId}`);

  const messages: Array<{ query: string; response: string; valid: boolean }> = [];
  const messageDetails: MessageResult[] = [];
  const failures: string[] = [];
  const responseTimes: number[] = [];

  for (let i = 0; i < scenario.messages.length; i++) {
    const message = scenario.messages[i];

    console.log(`\n[${i + 1}/${scenario.messages.length}] User: ${message.query}`);

    // Send message
    const result = await sendMessage(message.query, conversationId);

    if (!result.success) {
      console.log(`   [ERROR] ${result.error}`);
      failures.push(`Message ${i + 1}: ${result.error}`);
      messages.push({ query: message.query, response: '', valid: false });
      messageDetails.push({
        index: i + 1,
        query: message.query,
        response: '',
        responseTime: result.responseTime,
        valid: false,
        errors: [result.error || 'Unknown error'],
      });
      continue;
    }

    const response = extractResponseText(result.data);
    responseTimes.push(result.responseTime);

    // Truncate response for display
    const displayResponse = response.length > 200
      ? response.substring(0, 200) + '...'
      : response;
    console.log(`   Koda: ${displayResponse}`);
    console.log(`   [${result.responseTime}ms]`);

    // Validate response
    const validation = validateResponse(response, message, messages);

    if (!validation.valid) {
      console.log(`   [VALIDATION FAILED]:`);
      validation.errors.forEach(error => console.log(`      - ${error}`));
      failures.push(`Message ${i + 1}: ${validation.errors.join(', ')}`);
    } else {
      console.log(`   [VALID]`);
    }

    messages.push({ query: message.query, response, valid: validation.valid });
    messageDetails.push({
      index: i + 1,
      query: message.query,
      response,
      responseTime: result.responseTime,
      valid: validation.valid,
      errors: validation.errors,
    });

    // Delay before next message
    if (i < scenario.messages.length - 1) {
      await sleep(CONFIG.delayBetweenMessages);
    }
  }

  // Calculate scores
  const contextRetention = calculateContextRetention(messages);
  const coherenceScore = calculateCoherenceScore(messages);
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const success = failures.length === 0 && contextRetention >= 70 && coherenceScore >= 80;

  console.log(`\n--- Scenario Results ---`);
  console.log(`   Messages Processed: ${messages.length}/${scenario.messages.length}`);
  console.log(`   Context Retention: ${contextRetention.toFixed(1)}%`);
  console.log(`   Coherence Score: ${coherenceScore.toFixed(1)}%`);
  console.log(`   Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   Failures: ${failures.length}`);

  if (success) {
    console.log(`   [PASSED] ${scenario.successCriteria}`);
  } else {
    console.log(`   [FAILED]`);
    if (failures.length > 0) {
      console.log(`   Failure Details:`);
      failures.slice(0, 3).forEach(f => console.log(`      - ${f}`));
      if (failures.length > 3) {
        console.log(`      ... and ${failures.length - 3} more`);
      }
    }
  }

  const result: ConversationResult = {
    scenario: scenario.name,
    success,
    messagesProcessed: messages.length,
    totalMessages: scenario.messages.length,
    failures,
    contextRetention,
    coherenceScore,
    avgResponseTime,
    conversationId,
    messageDetails,
  };

  results.push(result);
  return result;
}

/**
 * Generate summary report
 */
function generateReport() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('CONVERSATION FLOW TEST - SUMMARY');
  console.log('='.repeat(80));

  const totalScenarios = results.length;
  const passedScenarios = results.filter(r => r.success).length;
  const failedScenarios = totalScenarios - passedScenarios;

  console.log(`\nOverall Results:`);
  console.log(`   Total Scenarios: ${totalScenarios}`);
  console.log(`   Passed: ${passedScenarios} (${((passedScenarios / totalScenarios) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failedScenarios}`);

  // Average scores
  const avgContextRetention = results.reduce((sum, r) => sum + r.contextRetention, 0) / results.length;
  const avgCoherence = results.reduce((sum, r) => sum + r.coherenceScore, 0) / results.length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length;

  console.log(`\nAverage Scores:`);
  console.log(`   Context Retention: ${avgContextRetention.toFixed(1)}%`);
  console.log(`   Coherence: ${avgCoherence.toFixed(1)}%`);
  console.log(`   Response Time: ${avgResponseTime.toFixed(0)}ms`);

  // Passed scenarios
  if (passedScenarios > 0) {
    console.log(`\nPassed Scenarios:`);
    results.filter(r => r.success).forEach(r => {
      console.log(`   [OK] ${r.scenario} (Context: ${r.contextRetention.toFixed(1)}%, Coherence: ${r.coherenceScore.toFixed(1)}%)`);
    });
  }

  // Failed scenarios
  if (failedScenarios > 0) {
    console.log(`\nFailed Scenarios:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`\n   [FAIL] ${r.scenario}`);
      console.log(`      Context Retention: ${r.contextRetention.toFixed(1)}%`);
      console.log(`      Coherence: ${r.coherenceScore.toFixed(1)}%`);
      console.log(`      Failures: ${r.failures.length}`);
      r.failures.slice(0, 3).forEach(f => console.log(`         - ${f}`));
    });
  }

  // Final verdict
  console.log(`\n${'='.repeat(80)}`);

  const passRate = (passedScenarios / totalScenarios) * 100;

  if (passRate >= 90 && avgContextRetention >= 80 && avgCoherence >= 85) {
    console.log('EXCELLENT: Conversations flow naturally with strong context retention!');
  } else if (passRate >= 70 && avgContextRetention >= 60) {
    console.log('GOOD: Most conversations work well, some improvements needed');
  } else if (passRate >= 50) {
    console.log('WARNING: Significant conversation flow issues detected');
  } else {
    console.log('CRITICAL: Major conversation flow problems');
  }

  console.log('='.repeat(80));
}

/**
 * Save results to JSON
 */
async function saveResults() {
  const reportData = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: CONFIG.baseUrl,
      testUserEmail: CONFIG.testUserEmail,
    },
    summary: {
      totalScenarios: results.length,
      passedScenarios: results.filter(r => r.success).length,
      failedScenarios: results.filter(r => !r.success).length,
      avgContextRetention: (results.reduce((sum, r) => sum + r.contextRetention, 0) / results.length).toFixed(1) + '%',
      avgCoherence: (results.reduce((sum, r) => sum + r.coherenceScore, 0) / results.length).toFixed(1) + '%',
      avgResponseTime: (results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length).toFixed(0) + 'ms',
    },
    results,
  };

  const filename = `conversation-test-results-${Date.now()}.json`;
  const filepath = path.join(__dirname, filename);

  fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2));

  console.log(`\nResults saved to: ${filename}`);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('Koda Conversation Flow Test');
  console.log('='.repeat(80));
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Test User: ${CONFIG.testUserEmail}`);
  console.log(`Total Scenarios: ${CONVERSATION_SCENARIOS.length}`);
  console.log('='.repeat(80));

  try {
    // Authenticate first
    const authenticated = await authenticate();
    if (!authenticated) {
      console.log('\n[FATAL] Could not authenticate. Exiting...');
      process.exit(1);
    }

    // Run all conversation scenarios
    for (const scenario of CONVERSATION_SCENARIOS) {
      await runConversationScenario(scenario);

      // Delay between scenarios
      await sleep(CONFIG.delayBetweenScenarios);
    }

    // Generate report
    generateReport();

    // Save results
    await saveResults();

    console.log(`\nConversation flow test completed!`);

    // Exit with appropriate code
    const failedCount = results.filter(r => !r.success).length;
    process.exit(failedCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n[FATAL] Error during conversation test:', error);
    process.exit(1);
  }
}

// Run tests
main();
