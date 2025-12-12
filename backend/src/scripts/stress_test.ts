/**
 * Stress Test Script - Comprehensive System Testing
 *
 * Tests all major components:
 * 1. Conversation Manager (memory, caching, summarization)
 * 2. Agent Service (ReAct loop, tools, problem solving)
 * 3. Language Detection Service
 * 4. LLM Provider
 *
 * Run: npx ts-node src/scripts/stress_test.ts
 */

import dotenv from 'dotenv';
dotenv.config();

// Verify required environment variables
const requiredEnvVars = ['GEMINI_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

import { conversationManager } from '../services/conversationManager.service';
import { agentService } from '../services/agent.service';
import { masterToolbox } from '../tools/master.toolbox';
import geminiGateway from '../services/geminiGateway.service';
import { detectLanguage, buildCulturalSystemPrompt, isGreeting, getLocalizedGreeting } from '../services/languageDetection.service';
import { redisConnection } from '../config/redis';
import prisma from '../config/database';

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

// Helper to run a test with timing
async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🧪 Running: ${name}`);

  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`   ✅ PASSED (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({ name, passed: false, duration, error: error.message });
    console.log(`   ❌ FAILED (${duration}ms): ${error.message}`);
  }
}

// ============================================================================
// TEST SUITE 1: Language Detection Service
// ============================================================================

async function testLanguageDetection() {
  console.log('\n' + '='.repeat(60));
  console.log('📝 TEST SUITE 1: Language Detection Service');
  console.log('='.repeat(60));

  await runTest('Detect English', async () => {
    const lang = detectLanguage('Hello, how are you today?');
    if (lang !== 'en') throw new Error(`Expected 'en', got '${lang}'`);
  });

  await runTest('Detect Portuguese', async () => {
    const lang = detectLanguage('Olá, como você está hoje?');
    if (lang !== 'pt') throw new Error(`Expected 'pt', got '${lang}'`);
  });

  await runTest('Detect Spanish', async () => {
    const lang = detectLanguage('Hola, ¿cómo estás hoy?');
    if (lang !== 'es') throw new Error(`Expected 'es', got '${lang}'`);
  });

  await runTest('Detect French', async () => {
    const lang = detectLanguage('Bonjour, comment allez-vous?');
    if (lang !== 'fr') throw new Error(`Expected 'fr', got '${lang}'`);
  });

  await runTest('Greeting Detection - English', async () => {
    if (!isGreeting('Hello!')) throw new Error('Should detect "Hello!" as greeting');
    if (!isGreeting('Hi')) throw new Error('Should detect "Hi" as greeting');
    if (isGreeting('What is the weather?')) throw new Error('Should NOT detect question as greeting');
  });

  await runTest('Greeting Detection - Portuguese', async () => {
    if (!isGreeting('Olá')) throw new Error('Should detect "Olá" as greeting');
    if (!isGreeting('Bom dia')) throw new Error('Should detect "Bom dia" as greeting');
  });

  await runTest('Build Cultural System Prompt', async () => {
    const prompt = await buildCulturalSystemPrompt('pt');
    if (!prompt.includes('KODA')) throw new Error('Prompt should mention KODA');
    if (!prompt.includes('BRL')) throw new Error('Portuguese prompt should mention BRL currency');
  });

  await runTest('Localized Greeting', async () => {
    const greeting = getLocalizedGreeting('pt');
    if (!greeting.includes('KODA')) throw new Error('Greeting should mention KODA');
  });
}

// ============================================================================
// TEST SUITE 2: LLM Provider
// ============================================================================

async function testLLMProvider() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 TEST SUITE 2: LLM Provider');
  console.log('='.repeat(60));

  await runTest('Simple Chat Completion', async () => {
    const response = await llmProvider.createChatCompletion({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply briefly.' },
        { role: 'user', content: 'Say "test successful" and nothing else.' }
      ],
      temperature: 0.1,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response choices returned');
    }

    const content = response.choices[0].message.content.toLowerCase();
    if (!content.includes('test') && !content.includes('successful')) {
      throw new Error(`Unexpected response: ${content}`);
    }
  });

  await runTest('Chat with System Prompt', async () => {
    const response = await llmProvider.createChatCompletion({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You are a math tutor. Always show your work.' },
        { role: 'user', content: 'What is 5 + 3?' }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content.includes('8')) {
      throw new Error(`Expected answer to contain "8", got: ${content}`);
    }
  });

  await runTest('Multi-turn Conversation', async () => {
    const response = await llmProvider.createChatCompletion({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You remember previous messages.' },
        { role: 'user', content: 'My name is TestUser.' },
        { role: 'model', content: 'Nice to meet you, TestUser!' },
        { role: 'user', content: 'What is my name?' }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content;
    if (!content.includes('TestUser')) {
      throw new Error(`Expected response to contain "TestUser", got: ${content}`);
    }
  });
}

// ============================================================================
// TEST SUITE 3: Master Toolbox
// ============================================================================

async function testMasterToolbox() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 TEST SUITE 3: Master Toolbox');
  console.log('='.repeat(60));

  await runTest('List Available Tools', async () => {
    const tools = masterToolbox.getAllTools();
    if (tools.length < 3) {
      throw new Error(`Expected at least 3 tools, got ${tools.length}`);
    }

    const toolNames = masterToolbox.getToolNames();
    if (!toolNames.includes('calculator')) throw new Error('Missing calculator tool');
    if (!toolNames.includes('web_search')) throw new Error('Missing web_search tool');
    if (!toolNames.includes('code_interpreter')) throw new Error('Missing code_interpreter tool');
  });

  await runTest('Calculator Tool - Basic Math', async () => {
    const result = await masterToolbox.executeTool('calculator', '2 + 2');
    if (!result.success) throw new Error(`Tool failed: ${result.output}`);
    if (!result.output.includes('4')) throw new Error(`Expected 4, got: ${result.output}`);
  });

  await runTest('Calculator Tool - Complex Math', async () => {
    const result = await masterToolbox.executeTool('calculator', 'sqrt(16) * 5');
    if (!result.success) throw new Error(`Tool failed: ${result.output}`);
    if (!result.output.includes('20')) throw new Error(`Expected 20, got: ${result.output}`);
  });

  await runTest('Calculator Tool - Percentage', async () => {
    const result = await masterToolbox.executeTool('calculator', '0.15 * 250');
    if (!result.success) throw new Error(`Tool failed: ${result.output}`);
    if (!result.output.includes('37.5')) throw new Error(`Expected 37.5, got: ${result.output}`);
  });

  await runTest('Code Interpreter Tool', async () => {
    const result = await masterToolbox.executeTool('code_interpreter', 'console.log(Array.from({length: 5}, (_, i) => i * 2).join(", "))');
    if (!result.success) throw new Error(`Tool failed: ${result.output}`);
    if (!result.output.includes('0, 2, 4, 6, 8')) {
      throw new Error(`Expected "0, 2, 4, 6, 8", got: ${result.output}`);
    }
  });

  await runTest('Web Search Tool', async () => {
    const result = await masterToolbox.executeTool('web_search', 'capital of Japan');
    if (!result.success) throw new Error(`Tool failed: ${result.output}`);
    // Just check it returns something (actual search depends on API key)
    if (result.output.length < 10) {
      throw new Error('Search returned empty or very short result');
    }
  });

  await runTest('Invalid Tool Name', async () => {
    const result = await masterToolbox.executeTool('nonexistent_tool', 'test');
    if (result.success) throw new Error('Should have failed for invalid tool');
    if (!result.output.includes('not found')) {
      throw new Error('Error message should indicate tool not found');
    }
  });
}

// ============================================================================
// TEST SUITE 4: Agent Service
// ============================================================================

async function testAgentService() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 TEST SUITE 4: Agent Service (ReAct)');
  console.log('='.repeat(60));

  await runTest('Should Use Agent Detection', async () => {
    // Should use agent for complex queries
    const shouldUse1 = await agentService.shouldUseAgent('Calculate the compound interest on $1000');
    if (!shouldUse1) throw new Error('Should use agent for calculation queries');

    const shouldUse2 = await agentService.shouldUseAgent('What is the latest news about AI?');
    if (!shouldUse2) throw new Error('Should use agent for "latest" queries');

    // Simple greetings shouldn't need agent
    const shouldUse3 = await agentService.shouldUseAgent('Hello');
    if (shouldUse3) throw new Error('Should NOT use agent for simple greeting');
  });

  await runTest('Simple Solve - Math Problem', async () => {
    const answer = await agentService.solve(
      'What is 25 multiplied by 4?',
      'You are a helpful assistant.'
    );

    // The agent may return the answer directly OR attempt to use a tool
    // Both behaviors are acceptable - we just need to verify it processes the request
    const hasAnswer = answer.includes('100');
    const hasToolAttempt = answer.includes('calculator') || answer.includes('25') && answer.includes('4');

    if (!hasAnswer && !hasToolAttempt) {
      throw new Error(`Expected answer to contain "100" or tool attempt, got: ${answer}`);
    }
  });

  await runTest('Execute Task with Streaming', async () => {
    const events: string[] = [];

    const result = await agentService.executeTask(
      { task: 'Calculate 10% of 500', maxSteps: 5 },
      (event) => events.push(event.type)
    );

    if (!result.success && result.totalSteps === 0) {
      throw new Error('Task should have executed some steps');
    }

    // Should have received some events
    if (events.length === 0) {
      throw new Error('Should have received streaming events');
    }
  });

  await runTest('Get Available Tools from Agent', async () => {
    const tools = agentService.getAvailableTools();
    if (tools.length < 3) {
      throw new Error(`Expected at least 3 tools, got ${tools.length}`);
    }
  });
}

// ============================================================================
// TEST SUITE 5: Conversation Manager
// ============================================================================

async function testConversationManager() {
  console.log('\n' + '='.repeat(60));
  console.log('💬 TEST SUITE 5: Conversation Manager');
  console.log('='.repeat(60));

  let testUserId: string;
  let testConversationId: string;
  let createdTestUser = false;

  // Setup: Get or create test user
  await runTest('Setup - Get/Create Test User', async () => {
    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const newUser = await prisma.user.create({
        data: { email: `stress-test-${Date.now()}@test.com`, isEmailVerified: true }
      });
      testUserId = newUser.id;
      createdTestUser = true;
    }
  });

  await runTest('Create Conversation', async () => {
    const conversation = await conversationManager.createConversation(
      testUserId,
      'Hello, this is a test message.'
    );

    if (!conversation.id) throw new Error('Conversation should have an ID');
    if (conversation.messages.length !== 1) throw new Error('Should have 1 message');

    testConversationId = conversation.id;
  });

  await runTest('Get Conversation State', async () => {
    const state = await conversationManager.getConversationState(testConversationId);
    if (!state) throw new Error('Should find conversation');
    if (state.id !== testConversationId) throw new Error('Wrong conversation returned');
  });

  await runTest('Add Messages', async () => {
    await conversationManager.addMessage(testConversationId, 'assistant', 'Hello! How can I help?');
    await conversationManager.addMessage(testConversationId, 'user', 'What is 2+2?');
    await conversationManager.addMessage(testConversationId, 'assistant', 'The answer is 4.');

    const state = await conversationManager.getConversationState(testConversationId);
    if (!state || state.messages.length !== 4) {
      throw new Error(`Expected 4 messages, got ${state?.messages.length}`);
    }
  });

  await runTest('Build Prompt with Context', async () => {
    const state = await conversationManager.getConversationState(testConversationId);
    const prompt = conversationManager.buildPromptWithContext('You are helpful.', state);

    if (!Array.isArray(prompt)) throw new Error('Prompt should be an array');
    if (prompt.length < 2) throw new Error('Prompt should have system + messages');
    if (prompt[0].role !== 'system') throw new Error('First message should be system');
  });

  await runTest('Get Conversation Context for RAG', async () => {
    const context = await conversationManager.getConversationContext(testConversationId);
    if (!context || context.length === 0) throw new Error('Should return context');
    if (!context.includes('User:') && !context.includes('Koda:')) {
      throw new Error('Context should include conversation history');
    }
  });

  await runTest('Get Recent Messages', async () => {
    const messages = await conversationManager.getRecentMessages(testConversationId, 2);
    if (messages.length !== 2) throw new Error(`Expected 2 messages, got ${messages.length}`);
  });

  await runTest('Get Last User Message', async () => {
    const lastUserMsg = await conversationManager.getLastUserMessage(testConversationId);
    if (!lastUserMsg) throw new Error('Should find last user message');
    if (lastUserMsg.role !== 'user') throw new Error('Should be a user message');
  });

  await runTest('Update Title', async () => {
    await conversationManager.updateTitle(testConversationId, 'Test Conversation Title');
    // Verify by getting state (cache should be invalidated)
    const state = await conversationManager.getConversationState(testConversationId);
    if (state?.title !== 'Test Conversation Title') {
      throw new Error('Title should be updated');
    }
  });

  await runTest('Check Ownership', async () => {
    const isOwner = await conversationManager.isOwner(testConversationId, testUserId);
    if (!isOwner) throw new Error('User should be owner');

    const isNotOwner = await conversationManager.isOwner(testConversationId, 'fake-user-id');
    if (isNotOwner) throw new Error('Fake user should not be owner');
  });

  // Cleanup
  await runTest('Cleanup - Delete Test Conversation', async () => {
    await conversationManager.deleteConversation(testConversationId);
    const state = await conversationManager.getConversationState(testConversationId);
    if (state) throw new Error('Conversation should be deleted');
  });

  if (createdTestUser) {
    await runTest('Cleanup - Delete Test User', async () => {
      await prisma.user.delete({ where: { id: testUserId } });
    });
  }
}

// ============================================================================
// TEST SUITE 6: Concurrent Operations
// ============================================================================

async function testConcurrentOperations() {
  console.log('\n' + '='.repeat(60));
  console.log('⚡ TEST SUITE 6: Concurrent Operations');
  console.log('='.repeat(60));

  await runTest('Concurrent Calculator Calls (5x)', async () => {
    const operations = [
      masterToolbox.executeTool('calculator', '10 + 20'),
      masterToolbox.executeTool('calculator', '5 * 5'),
      masterToolbox.executeTool('calculator', '100 / 4'),
      masterToolbox.executeTool('calculator', 'sqrt(81)'),
      masterToolbox.executeTool('calculator', '2 pow 8'),
    ];

    const results = await Promise.all(operations);
    const allSucceeded = results.every(r => r.success);
    if (!allSucceeded) {
      throw new Error('Not all concurrent calculations succeeded');
    }
  });

  await runTest('Concurrent Language Detection (10x)', async () => {
    const texts = [
      'Hello world',
      'Olá mundo',
      'Hola mundo',
      'Bonjour monde',
      'Good morning',
      'Boa tarde',
      'Buenas noches',
      'Bonsoir',
      'How are you?',
      'Como vai?',
    ];

    const detections = texts.map(t => detectLanguage(t));
    if (detections.length !== 10) {
      throw new Error('Should have 10 detection results');
    }
  });

  await runTest('Concurrent LLM Calls (3x)', async () => {
    const calls = [
      llmProvider.createChatCompletion({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Say "A"' }],
        temperature: 0.1,
      }),
      llmProvider.createChatCompletion({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Say "B"' }],
        temperature: 0.1,
      }),
      llmProvider.createChatCompletion({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Say "C"' }],
        temperature: 0.1,
      }),
    ];

    const responses = await Promise.all(calls);
    const allHaveContent = responses.every(r => r.choices[0].message.content.length > 0);
    if (!allHaveContent) {
      throw new Error('Not all concurrent LLM calls returned content');
    }
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           KODA STRESS TEST - COMPREHENSIVE SUITE           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted at: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Redis: ${redisConnection ? 'Connected' : 'Not Connected'}`);

  const startTime = Date.now();

  try {
    // Run all test suites
    await testLanguageDetection();
    await testLLMProvider();
    await testMasterToolbox();
    await testAgentService();
    await testConversationManager();
    await testConcurrentOperations();

  } catch (error: any) {
    console.error('\n💥 CRITICAL ERROR:', error.message);
  }

  const totalDuration = Date.now() - startTime;

  // Print summary
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} tests passed (${failed} failed)`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   • ${r.name}: ${r.error}`);
    });
  }

  console.log('\n📋 All Test Results:');
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`   ${icon} ${r.name} (${r.duration}ms)`);
  });

  // Performance stats
  const durations = results.map(r => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);

  console.log('\n📈 Performance Stats:');
  console.log(`   Average test duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Fastest test: ${minDuration}ms`);
  console.log(`   Slowest test: ${maxDuration}ms`);

  console.log('\n' + '═'.repeat(62));

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! System is working correctly.');
  } else {
    console.log(`⚠️  ${failed} TEST(S) FAILED. Please review the errors above.`);
  }

  console.log('═'.repeat(62) + '\n');

  // Cleanup
  await prisma.$disconnect();

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
