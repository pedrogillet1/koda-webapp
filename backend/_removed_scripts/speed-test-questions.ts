/**
 * Speed Run Test - Direct RAG Service Call
 * Runs all 30 questions and waits for answers
 */

import dotenv from 'dotenv';
dotenv.config();

import ragService from './src/services/rag.service';

const USER_ID = '03ec97ac-1934-4188-8471-524366d87521';

const questions = [
  { q: "What is Koda's core purpose according to the business plan?", cat: "Conceptual" },
  { q: "How many acres is the Montana Rocking CC Sanctuary?", cat: "Simple Retrieval" },
  { q: "When was the Hotel Baxter formally opened?", cat: "Simple Retrieval" },
  { q: "What psychological frameworks does Koda AI apply?", cat: "Conceptual" },
  { q: "How many guest rooms did the Hotel Baxter have?", cat: "Simple Retrieval" },
  { q: "What is the location of the Rocking CC Sanctuary?", cat: "Simple Retrieval" },
  { q: "What are Koda AI's three reasoning layers?", cat: "Conceptual" },
  { q: "Who designed the Hotel Baxter?", cat: "Simple Retrieval" },
  { q: "What is the ADR for the Baxter Hotel?", cat: "Data" },
  { q: "What is the total gross revenue for the Baxter Hotel?", cat: "Data" },
  { q: "What is the ROI for the Baxter Hotel?", cat: "Data" },
  { q: "What is the total operating revenue for Lone Mountain Ranch in January 2025?", cat: "Data" },
  { q: "What is the occupancy rate for the Baxter Hotel?", cat: "Data" },
  { q: "What is the EBITDA for Lone Mountain Ranch in January 2025?", cat: "Data" },
  { q: "What is the total portfolio ROI?", cat: "Data" },
  { q: "How should Koda AI behave when unsure?", cat: "Conceptual" },
  { q: "What is Koda AI's personality model based on?", cat: "Conceptual" },
  { q: "What makes the Rocking CC Sanctuary valuable?", cat: "Conceptual" },
  { q: "How does the RevPAR model work for Baxter Hotel?", cat: "Data" },
  { q: "Who is the CEO of Koda AI?", cat: "Negative" },
  { q: "Do I have any Word documents?", cat: "DocRec" },
  { q: "What are Koda's financial projections for Year 1?", cat: "Data" },
  { q: "Which document is a historical article?", cat: "DocRec" },
  { q: "Which document contains a P&L budget?", cat: "DocRec" },
  { q: "What are common themes across my business documents?", cat: "Synthesis" },
  { q: "Compare ROI of Baxter vs Lone Mountain Ranch", cat: "Synthesis" },
  { q: "What are total acquisition costs?", cat: "Synthesis" },
  { q: "What are Koda's main revenue streams?", cat: "Data" },
  { q: "What is Koda's competitive advantage?", cat: "Conceptual" },
  { q: "What is Koda's target market?", cat: "Conceptual" }
];

async function speedTest() {
  console.log('🏃 SPEED TEST - 30 Questions\n');
  console.log('='.repeat(80));

  const results: any[] = [];
  const startTime = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const { q, cat } = questions[i];

    console.log(`\n[${i + 1}/30] ${q}`);

    try {
      const qStart = Date.now();

      const result = await ragService.generateAnswer(USER_ID, q, 'test-conversation');

      const duration = Date.now() - qStart;
      const answer = result.answer || '';
      const sources = result.sources?.length || 0;

      const isUnable = answer.toLowerCase().includes('unable') ||
                       answer.toLowerCase().includes('don\'t have');

      const status = isUnable ? '⚠️' : (sources > 0 ? '✅' : '❌');

      console.log(`${status} [${(duration/1000).toFixed(1)}s] Sources: ${sources}`);
      console.log(`   ${answer.substring(0, 120)}...`);

      results.push({
        question: q,
        category: cat,
        answer: answer.substring(0, 300),
        sources,
        duration,
        status: isUnable ? 'unable' : (sources > 0 ? 'answered' : 'no-source')
      });

    } catch (error: any) {
      console.log(`❌ ERROR: ${error.message}`);
      results.push({
        question: q,
        category: cat,
        answer: `ERROR: ${error.message}`,
        sources: 0,
        duration: 0,
        status: 'error'
      });
    }
  }

  // Summary
  const totalTime = Date.now() - startTime;
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS\n');

  const answered = results.filter(r => r.status === 'answered').length;
  const unable = results.filter(r => r.status === 'unable').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`Total Questions: ${questions.length}`);
  console.log(`✅ Answered: ${answered} (${((answered/questions.length)*100).toFixed(1)}%)`);
  console.log(`⚠️  Unable: ${unable}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`⏱️  Total Time: ${(totalTime/1000).toFixed(1)}s`);
  console.log(`⚡ Avg Time: ${(totalTime/questions.length/1000).toFixed(1)}s per question`);

  // Category scores
  console.log('\n📂 BY CATEGORY:\n');
  const cats: any = {};
  results.forEach(r => {
    if (!cats[r.category]) cats[r.category] = { correct: 0, total: 0 };
    cats[r.category].total++;
    if (r.status === 'answered') cats[r.category].correct++;
  });

  Object.entries(cats).forEach(([cat, scores]: any) => {
    const pct = ((scores.correct / scores.total) * 100).toFixed(0);
    console.log(`${cat.padEnd(20)} ${scores.correct}/${scores.total} (${pct}%)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`FINAL SCORE: ${((answered/questions.length)*100).toFixed(1)}%`);
  console.log('='.repeat(80));

  // Save results
  const fs = await import('fs');
  fs.writeFileSync('speed-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Results saved to speed-test-results.json');
}

speedTest().catch(console.error);
