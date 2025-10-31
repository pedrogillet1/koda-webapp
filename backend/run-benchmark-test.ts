import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API_URL = 'http://localhost:5000';
const USER_ID = '03ec97ac-1934-4188-8471-524366d87521'; // From diagnostics

const questions = [
  // KODA Business Plan Questions
  { q: "What is Koda's core purpose according to the business plan?", category: "Conceptual" },
  { q: "How many acres is the Montana Rocking CC Sanctuary?", category: "Simple Retrieval" },
  { q: "When was the Hotel Baxter formally opened?", category: "Simple Retrieval" },
  { q: "What psychological frameworks does Koda AI apply?", category: "Conceptual" },
  { q: "How many guest rooms did the Hotel Baxter have?", category: "Simple Retrieval" },
  { q: "What is the location of the Rocking CC Sanctuary?", category: "Simple Retrieval" },
  { q: "What are Koda AI's three reasoning layers?", category: "Conceptual" },
  { q: "Who designed the Hotel Baxter?", category: "Simple Retrieval" },

  // Financial Data
  { q: "What is the ADR for the Baxter Hotel according to the profitability analysis?", category: "Data Extraction" },
  { q: "What is the total gross revenue projected for the Baxter Hotel?", category: "Data Extraction" },
  { q: "What is the ROI for the Baxter Hotel?", category: "Data Extraction" },
  { q: "What is the total operating revenue for Lone Mountain Ranch in January 2025?", category: "Data Extraction" },
  { q: "What is the occupancy rate for the Baxter Hotel?", category: "Data Extraction" },
  { q: "What is the EBITDA for Lone Mountain Ranch in January 2025?", category: "Data Extraction" },
  { q: "What is the total portfolio ROI across all projects?", category: "Data Extraction" },

  // Behavioral
  { q: "How should Koda AI behave when it's unsure of an answer?", category: "Conceptual" },
  { q: "What is Koda AI's personality model based on?", category: "Conceptual" },
  { q: "What makes the Rocking CC Sanctuary a valuable investment opportunity?", category: "Conceptual" },
  { q: "How does the RevPAR model work for the Baxter Hotel?", category: "Data Extraction" },

  // Negative Tests
  { q: "Who is the CEO of Koda AI?", category: "Negative Tests" },
  { q: "Do I have any Word documents?", category: "Doc Recognition" },

  // Financial Projections
  { q: "What are Koda's financial projections for Year 1?", category: "Data Extraction" },
  { q: "Which document is a historical article?", category: "Doc Recognition" },
  { q: "Which document contains a detailed P&L budget?", category: "Doc Recognition" },

  // Cross-Document
  { q: "What are the common themes across my business documents?", category: "Synthesis" },
  { q: "Compare the ROI of Baxter Hotel vs Lone Mountain Ranch", category: "Synthesis" },
  { q: "What are the total acquisition costs mentioned across all documents?", category: "Synthesis" },

  // Revenue
  { q: "What are Koda's main revenue streams?", category: "Data Extraction" },
  { q: "What is Koda's competitive advantage according to the business plan?", category: "Conceptual" }
];

async function runBenchmark() {
  console.log('🧪 KODA 30-Question Benchmark Test\n');
  console.log('='.repeat(80));
  console.log(`API: ${API_URL}`);
  console.log(`User: ${USER_ID.substring(0, 20)}...`);
  console.log(`Questions: ${questions.length}\n`);
  console.log('='.repeat(80));

  const results: any[] = [];
  const categoryScores: Record<string, { correct: number; total: number }> = {};

  for (let i = 0; i < questions.length; i++) {
    const { q, category } = questions[i];

    console.log(`\n[${i + 1}/${questions.length}] ${q}`);
    console.log(`Category: ${category}`);

    try {
      const startTime = Date.now();

      const response = await axios.post(
        `${API_URL}/api/rag/query`,
        { query: q, userId: USER_ID },
        { timeout: 60000 }
      );

      const duration = Date.now() - startTime;
      const answer = response.data.answer || '';
      const sources = response.data.sources || [];

      // Check if answer is useful
      const isUnable = answer.toLowerCase().includes('unable to locate') ||
                       answer.toLowerCase().includes('i don\'t have') ||
                       answer.toLowerCase().includes('no information') ||
                       answer.toLowerCase().includes('could not find');

      const hasSource = sources.length > 0;
      const status = isUnable ? 'unable' : (hasSource ? 'answered' : 'no-source');

      console.log(`   Status: ${status}`);
      console.log(`   Sources: ${sources.length}`);
      console.log(`   Time: ${duration}ms`);
      console.log(`   Answer: ${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}`);

      if (sources.length > 0) {
        console.log(`   From: ${sources.map((s: any) => s.documentName).slice(0, 2).join(', ')}`);
      }

      // Track category scores
      if (!categoryScores[category]) {
        categoryScores[category] = { correct: 0, total: 0 };
      }
      categoryScores[category].total++;
      if (status === 'answered') {
        categoryScores[category].correct++;
      }

      results.push({
        question: q,
        category,
        answer: answer.substring(0, 300),
        sources: sources.length,
        sourceNames: sources.map((s: any) => s.documentName).slice(0, 3),
        status,
        duration
      });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);

      if (!categoryScores[category]) {
        categoryScores[category] = { correct: 0, total: 0 };
      }
      categoryScores[category].total++;

      results.push({
        question: q,
        category,
        answer: `ERROR: ${error.message}`,
        sources: 0,
        sourceNames: [],
        status: 'error',
        duration: 0
      });
    }
  }

  // Calculate scores
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(80));

  const answered = results.filter(r => r.status === 'answered').length;
  const unable = results.filter(r => r.status === 'unable').length;
  const errors = results.filter(r => r.status === 'error').length;
  const noSource = results.filter(r => r.status === 'no-source').length;

  console.log(`\nOverall Performance:`);
  console.log(`  Answered with sources: ${answered}/${questions.length} (${((answered/questions.length)*100).toFixed(1)}%)`);
  console.log(`  Unable to locate: ${unable}/${questions.length} (${((unable/questions.length)*100).toFixed(1)}%)`);
  console.log(`  No source provided: ${noSource}/${questions.length}`);
  console.log(`  Errors: ${errors}/${questions.length}`);

  console.log(`\nCategory Breakdown:`);
  const sortedCategories = Object.entries(categoryScores).sort((a, b) => {
    const scoreA = (a[1].correct / a[1].total) * 100;
    const scoreB = (b[1].correct / b[1].total) * 100;
    return scoreB - scoreA;
  });

  for (const [category, scores] of sortedCategories) {
    const percentage = ((scores.correct / scores.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(scores.correct / scores.total * 20));
    console.log(`  ${category.padEnd(20)} ${scores.correct}/${scores.total} (${percentage.padStart(3)}%) ${bar}`);
  }

  // Save results
  const fs = await import('fs');
  fs.writeFileSync(
    'benchmark-results.json',
    JSON.stringify({ results, categoryScores, summary: { answered, unable, errors, noSource } }, null, 2)
  );

  console.log(`\n✅ Results saved to benchmark-results.json`);
  console.log('\n' + '='.repeat(80));
  console.log(`FINAL SCORE: ${((answered/questions.length)*100).toFixed(1)}%`);
  console.log('='.repeat(80));
}

runBenchmark().catch(console.error);
