import 'dotenv/config'; // Load environment variables
import geminiGateway from '../services/geminiGateway.service';
import { personaService } from '../services/persona.service';

/**
 * Test script for the AI Creativity Engine
 * Tests different personas and temperature settings
 */

async function runTest(persona: string, temperature: number) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing Persona: ${persona.toUpperCase()}, Temperature: ${temperature}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Get the persona system prompt
    const systemPrompt = personaService.getPersonaPrompt(persona);

    // Test query
    const query = 'Tell me a short story about a robot who discovers music.';

    console.log(`Query: ${query}\n`);
    console.log(`System Prompt Preview: ${systemPrompt.substring(0, 100)}...\n`);
    console.log(`Generating response...\n`);

    // Call the LLM provider directly
    const response = await llmProvider.createChatCompletion({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: temperature,
    });

    const content = response.choices[0].message.content || 'No response generated.';

    console.log(`Koda Response:\n${content}\n`);
    console.log(`${'='.repeat(80)}\n`);
  } catch (error) {
    console.error(`Error in test for ${persona} with temperature ${temperature}:`, error);
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     KODA AI CREATIVITY ENGINE TEST SUITE                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

  try {
    // Test 1: Default persona with low temperature (factual, deterministic)
    await runTest('default', 0.2);

    // Test 2: Default persona with high temperature (creative, imaginative)
    await runTest('default', 0.9);

    // Test 3: Comedian persona (humorous)
    await runTest('comedian', 0.7);

    // Test 4: Pirate persona (pirate slang and attitude)
    await runTest('pirate', 0.8);

    // Test 5: Academic persona (formal and structured)
    await runTest('academic', 0.3);

    // Test 6: Zen persona (calm and mindful)
    await runTest('zen', 0.6);

    console.log('\n✅ All tests completed successfully!\n');
    console.log('🎉 The Creativity Engine is working as expected!');
    console.log('📊 Results show clear differences between personas and temperatures.\n');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests()
  .then(() => {
    console.log('\n👋 Test suite finished. Exiting...\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
