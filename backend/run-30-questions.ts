/**
 * Re-run 30-Question Benchmark
 * Tests KODA's performance after document cleanup
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API_URL = 'http://localhost:5000';

// Your 30 test questions
const questions = [
  // KODA Business Plan Questions
  "What is Koda's core purpose according to the business plan?",
  "How many acres is the Montana Rocking CC Sanctuary?",
  "When was the Hotel Baxter formally opened?",
  "What psychological frameworks does Koda AI apply?",
  "How many guest rooms did the Hotel Baxter have?",
  "What is the location of the Rocking CC Sanctuary?",
  "What are Koda AI's three reasoning layers?",
  "Who designed the Hotel Baxter?",

  // Financial Data Questions
  "What is the ADR for the Baxter Hotel according to the profitability analysis?",
  "What is the total gross revenue projected for the Baxter Hotel?",
  "What is the ROI for the Baxter Hotel?",
  "What is the total operating revenue for Lone Mountain Ranch in January 2025?",
  "What is the occupancy rate for the Baxter Hotel?",
  "What is the EBITDA for Lone Mountain Ranch in January 2025?",
  "What is the total portfolio ROI across all projects?",

  // Behavioral Questions
  "How should Koda AI behave when it's unsure of an answer?",
  "What is Koda AI's personality model based on?",
  "What makes the Rocking CC Sanctuary a valuable investment opportunity?",
  "How does the RevPAR model work for the Baxter Hotel?",

  // Negative Tests
  "Who is the CEO of Koda AI?",
  "Do I have any Word documents?",

  // Financial Projections
  "What are Koda's financial projections for Year 1?",
  "Which document is a historical article?",
  "Which document contains a detailed P&L budget?",

  // Cross-Document Questions
  "What are the common themes across my business documents?",
  "Compare the ROI of Baxter Hotel vs Lone Mountain Ranch",
  "What are the total acquisition costs mentioned across all documents?",

  // Revenue Questions
  "What are Koda's main revenue streams?",
  "What is Koda's competitive advantage according to the business plan?"
];

async function runBenchmark() {
  console.log('🧪 Running 30-Question Benchmark\n');
  console.log('='.repeat(80));
  console.log(`API URL: ${API_URL}`);
  console.log(`Total Questions: ${questions.length}\n`);

  // You need to provide a valid userId and auth token
  // Replace these with actual values from your database
  const userId = '03ec97ac-1934-4188-8471-524366d87521'; // User from diagnostics
  const authToken = 'YOUR_AUTH_TOKEN'; // Get from login or database

  let correctAnswers = 0;
  let totalAnswers = 0;
  const results: Array<{
    question: string;
    answer: string;
    sources: number;
    status: 'correct' | 'incorrect' | 'unable';
  }> = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`\n[${i + 1}/${questions.length}] ${question}`);

    try {
      const response = await axios.post(
        `${API_URL}/api/rag/query`,
        {
          query: question,
          userId: userId
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const answer = response.data.answer || '';
      const sources = response.data.sources?.length || 0;

      console.log(`   Answer: ${answer.substring(0, 100)}...`);
      console.log(`   Sources: ${sources}`);

      // Simple scoring logic
      const isUnable = answer.toLowerCase().includes('unable to locate') ||
                       answer.toLowerCase().includes('i don\'t have') ||
                       answer.toLowerCase().includes('no information');

      if (isUnable) {
        results.push({ question, answer, sources, status: 'unable' });
      } else if (sources > 0) {
        results.push({ question, answer, sources, status: 'correct' });
        correctAnswers++;
      } else {
        results.push({ question, answer, sources, status: 'incorrect' });
      }

      totalAnswers++;

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.push({
        question,
        answer: `ERROR: ${error.message}`,
        sources: 0,
        status: 'incorrect'
      });
      totalAnswers++;
    }
  }

  // Summary
  console.log('\n\n📊 BENCHMARK RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Questions: ${totalAnswers}`);
  console.log(`Correct Answers: ${correctAnswers}`);
  console.log(`Unable to Locate: ${results.filter(r => r.status === 'unable').length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'incorrect').length}`);
  console.log(`Score: ${((correctAnswers / totalAnswers) * 100).toFixed(1)}%`);

  // Category breakdown (simplified)
  const categories = {
    'Simple Retrieval': [0, 1, 2, 4, 5, 7],
    'Data Extraction': [8, 9, 10, 11, 12, 13, 14],
    'Conceptual': [3, 6, 15, 16, 17, 18],
    'Synthesis': [24, 25, 26],
    'Doc Recognition': [20, 22, 23],
    'Negative Tests': [19]
  };

  console.log('\n\nCATEGORY BREAKDOWN:');
  for (const [category, indices] of Object.entries(categories)) {
    const categoryCorrect = indices.filter(i => results[i]?.status === 'correct').length;
    const categoryTotal = indices.length;
    const score = ((categoryCorrect / categoryTotal) * 100).toFixed(0);
    console.log(`${category}: ${categoryCorrect}/${categoryTotal} (${score}%)`);
  }

  // Save results to file
  const fs = await import('fs');
  fs.writeFileSync(
    'benchmark-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Results saved to benchmark-results.json');
}

// Note: This script requires authentication
// You'll need to either:
// 1. Add proper authentication headers
// 2. Or run these questions through the frontend UI manually
console.log('\n⚠️  IMPORTANT: This script requires authentication');
console.log('Please update the userId and authToken variables');
console.log('Or run the questions manually through the UI\n');

// Uncomment to run:
// runBenchmark();

console.log('To run this benchmark:');
console.log('1. Update userId and authToken in the script');
console.log('2. Uncomment runBenchmark() at the bottom');
console.log('3. Run: npx ts-node run-30-questions.ts');
