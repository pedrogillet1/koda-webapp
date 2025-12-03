/**
 * KODA Quick Test - 5 Questions Only
 *
 * Quick sanity check to verify basic RAG functionality.
 * Run with: node src/services/fallback/quick-test.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const fs = require('fs');
const path = require('path');

// Register ts-node for TypeScript imports
require('ts-node').register({ transpileOnly: true });

const prisma = require('../../config/database').default;
const { generateAnswer } = require('../rag.service');

// Just 5 representative questions
const testQuestions = [
  'What documents do I have uploaded?',
  'Summarize the worldbank data',
  'What is the total revenue in the financial documents?',
  'List the main topics across my documents',
  'What countries are mentioned in my files?',
];

async function runQuickTest() {
  console.log('\n' + '='.repeat(60));
  console.log('  KODA QUICK TEST - 5 Questions');
  console.log('='.repeat(60) + '\n');

  // Get the localhost user
  const user = await prisma.users.findFirst({
    where: { email: 'localhost@koda.com' }
  });

  if (!user) {
    console.log('ERROR: User localhost@koda.com not found');
    await prisma.$disconnect();
    return;
  }

  console.log(`User: ${user.email}`);
  console.log(`Testing ${testQuestions.length} questions...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    console.log('-'.repeat(60));
    console.log(`Q${i + 1}: "${question}"`);
    console.log('-'.repeat(60));

    try {
      const startTime = Date.now();
      const response = await generateAnswer(
        user.id,
        question,
        `quick-test-${Date.now()}`,
        'medium',
        undefined,
        [],
        true
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const answer = response.answer || response.text || JSON.stringify(response);

      console.log(`\nRESPONSE (${duration}s):`);
      console.log(answer.substring(0, 500) + (answer.length > 500 ? '...' : ''));
      console.log(`\n[${answer.length} chars total]\n`);

      successCount++;
    } catch (error) {
      console.log(`\nERROR: ${error.message}\n`);
      failCount++;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('='.repeat(60));
  console.log(`  RESULTS: ${successCount}/${testQuestions.length} successful`);
  console.log('='.repeat(60) + '\n');

  await prisma.$disconnect();
}

runQuickTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
