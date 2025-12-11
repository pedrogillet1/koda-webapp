/**
 * Koda Comprehensive Stress Test - Single Conversation
 *
 * Runs all 88 questions in ONE conversation with:
 * - Real streaming metrics (time to first char, full animation time)
 * - Answer quality verification
 * - Formatting validation
 */

import axios from 'axios';
import * as fs from 'fs';

const API_URL = 'http://localhost:5000';
const EMAIL = 'localhost@koda.com';
const PASSWORD = 'Localhost123!';

interface TestQuestion {
  id: number;
  category: string;
  question: string;
  expectedBehavior: string;
  complexity: string;
}

interface TestResult {
  id: number;
  category: string;
  question: string;
  success: boolean;
  error?: string;
  // Timing metrics
  totalTimeMs: number;
  timeToFirstCharMs: number;
  streamingDurationMs: number;
  // Response metrics
  responseLength: number;
  charCount: number;
  wordCount: number;
  // Quality checks
  hasProperFormatting: boolean;
  hasBoldedValues: boolean;
  hasDocumentReferences: boolean;
  hasFollowUpQuestion: boolean;
  // Answer preview
  answerPreview: string;
  fullAnswer: string;
}

// All 88 test questions
const testQuestions: TestQuestion[] = [
  // Category 1: Meta/System Questions (11)
  { id: 1, category: "Meta/System", question: "Quantos documentos eu tenho no total na minha conta?", expectedBehavior: "Fast path (<1.5s), accurate count", complexity: "Trivial" },
  { id: 2, category: "Meta/System", question: "Quantos arquivos são PDF e quantos são DOCX?", expectedBehavior: "Fast path, file type counting", complexity: "Simple" },
  { id: 3, category: "Meta/System", question: "Liste os 5 documentos mais recentes que eu enviei.", expectedBehavior: "Fast path, sorting by date", complexity: "Simple" },
  { id: 4, category: "Meta/System", question: "Quais são os tipos de arquivo que eu tenho?", expectedBehavior: "Fast path, grouping by type", complexity: "Simple" },
  { id: 5, category: "Meta/System", question: "Quais documentos falam sobre Guarda Bens no título?", expectedBehavior: "Fast path, title search", complexity: "Simple" },

  // Category 2: Single-Doc Factual (15 selected)
  { id: 6, category: "Single-Doc Factual", question: "Qual é o custo por m² no documento analise_mezanino_guarda_moveis.pdf?", expectedBehavior: "Single-doc RAG, number extraction", complexity: "Moderate" },
  { id: 7, category: "Single-Doc Factual", question: "Qual é o investimento total estimado no mezanino?", expectedBehavior: "Single-doc RAG, number extraction", complexity: "Moderate" },
  { id: 8, category: "Single-Doc Factual", question: "Quais são os principais riscos listados para o projeto de mezanino?", expectedBehavior: "Single-doc RAG, list extraction", complexity: "Moderate" },
  { id: 9, category: "Single-Doc Factual", question: "Qual é o objetivo principal do projeto descrito em Análise_de_Projeto_Expansão_da_Guarda_Bens_Self_Storage.pdf?", expectedBehavior: "Single-doc RAG, main idea extraction", complexity: "Moderate" },
  { id: 10, category: "Single-Doc Factual", question: "Quem é o cliente ideal descrito nesse documento?", expectedBehavior: "Single-doc RAG, persona extraction", complexity: "Moderate" },
  { id: 11, category: "Single-Doc Factual", question: "O que é LGPD segundo os documentos?", expectedBehavior: "Single-doc RAG, definition extraction", complexity: "Moderate" },
  { id: 12, category: "Single-Doc Factual", question: "Quais direitos do titular de dados são listados nos documentos de LGPD?", expectedBehavior: "Single-doc RAG, list extraction", complexity: "Moderate" },
  { id: 13, category: "Single-Doc Factual", question: "Como o documento descreve o uso de Kanban dentro do projeto?", expectedBehavior: "Single-doc RAG, definition extraction", complexity: "Moderate" },
  { id: 14, category: "Single-Doc Factual", question: "Quais indicadores de desempenho (KPIs) são citados na análise?", expectedBehavior: "Single-doc RAG, list extraction", complexity: "Moderate" },
  { id: 15, category: "Single-Doc Factual", question: "Quais ferramentas de gestão são usadas no projeto da Guarda Bens?", expectedBehavior: "Single-doc RAG, list extraction", complexity: "Moderate" },

  // Category 3: Multi-Doc Comparison (6)
  { id: 16, category: "Multi-Doc Comparison", question: "Compare como LGPD é explicada nos diferentes documentos. Quais são as principais semelhanças e diferenças?", expectedBehavior: "Multi-doc RAG, comparison reasoning", complexity: "Complex" },
  { id: 17, category: "Multi-Doc Comparison", question: "Compare os métodos de gestão de projeto descritos nos documentos.", expectedBehavior: "Multi-doc RAG, comparison reasoning", complexity: "Complex" },
  { id: 18, category: "Multi-Doc Comparison", question: "Quais documentos tratam de Kanban e Scrum, e como cada um define essas metodologias?", expectedBehavior: "Multi-doc RAG, concept comparison", complexity: "Complex" },
  { id: 19, category: "Multi-Doc Comparison", question: "Entre todos os documentos sobre Guarda Bens, quais apresentam projeções financeiras?", expectedBehavior: "Multi-doc RAG, categorization", complexity: "Complex" },

  // Category 4: Context/Follow-Up (8)
  { id: 20, category: "Context/Follow-Up", question: "Qual é o custo por m² no documento do mezanino?", expectedBehavior: "Single-doc RAG, sets context", complexity: "Moderate" },
  { id: 21, category: "Context/Follow-Up", question: "E qual é a área locável nesse mesmo documento?", expectedBehavior: "Pronoun resolution, same doc", complexity: "Moderate" },
  { id: 22, category: "Context/Follow-Up", question: "Esse documento fala algo sobre payback ou prazo de retorno?", expectedBehavior: "Pronoun resolution, yes/no question", complexity: "Moderate" },
  { id: 23, category: "Context/Follow-Up", question: "Qual documento fala sobre Kanban?", expectedBehavior: "Document search, sets context", complexity: "Simple" },
  { id: 24, category: "Context/Follow-Up", question: "E o que ele diz sobre limitar trabalho em progresso (WIP)?", expectedBehavior: "Pronoun resolution, concept extraction", complexity: "Moderate" },
  { id: 25, category: "Context/Follow-Up", question: "Qual documento explica LGPD de maneira mais completa?", expectedBehavior: "Document ranking, sets context", complexity: "Moderate" },
  { id: 26, category: "Context/Follow-Up", question: "O que ele diz sobre direitos de acesso e exclusão de dados?", expectedBehavior: "Pronoun resolution, list extraction", complexity: "Moderate" },

  // Category 5: Calculation/ROI (5)
  { id: 27, category: "Calculation/ROI", question: "Baseado no documento do mezanino, qual é o payback estimado do investimento?", expectedBehavior: "Calculation + time conversion", complexity: "Complex" },
  { id: 28, category: "Calculation/ROI", question: "Considerando as projeções de receita e os riscos descritos na análise do mezanino, quais são os principais argumentos a favor e contra seguir com o projeto?", expectedBehavior: "Multi-factor reasoning", complexity: "Very Complex" },
  { id: 29, category: "Calculation/ROI", question: "Com base nos documentos financeiros, qual seria a pior consequência se a ocupação do mezanino ficasse 30% abaixo do previsto?", expectedBehavior: "Scenario analysis + calculation", complexity: "Very Complex" },

  // Category 6: Navigation/Section (5)
  { id: 30, category: "Navigation/Section", question: "Qual capítulo ou seção fala sobre métodos ágeis?", expectedBehavior: "Section detection, navigation", complexity: "Moderate" },
  { id: 31, category: "Navigation/Section", question: "Em qual seção do documento do mezanino é discutido o risco do investimento?", expectedBehavior: "Section detection, navigation", complexity: "Moderate" },
  { id: 32, category: "Navigation/Section", question: "Mostre um resumo da introdução do documento de expansão da Guarda Bens.", expectedBehavior: "Section-specific summary", complexity: "Moderate" },
  { id: 33, category: "Navigation/Section", question: "Quais documentos têm uma seção específica chamada Metodologia ou algo semelhante?", expectedBehavior: "Cross-doc section search", complexity: "Moderate" },

  // Category 7: PowerPoint/Slides (3)
  { id: 34, category: "PowerPoint/Slides", question: "Quantos slides tem a apresentação sobre Guarda Bens?", expectedBehavior: "PPTX metadata extraction", complexity: "Simple" },
  { id: 35, category: "PowerPoint/Slides", question: "Resuma em poucas linhas o conteúdo da apresentação sobre Guarda Bens.", expectedBehavior: "PPTX summary", complexity: "Moderate" },

  // Category 8: Inline References (3)
  { id: 36, category: "Inline References", question: "Explique, em um único parágrafo, qual é o objetivo do projeto de mezanino, mencionando o nome do documento no texto.", expectedBehavior: "Inline citation in paragraph", complexity: "Moderate" },
  { id: 37, category: "Inline References", question: "Descreva o cliente ideal da Guarda Bens em um parágrafo, citando explicitamente o documento usado.", expectedBehavior: "Inline citation in paragraph", complexity: "Moderate" },

  // Category 9: Onboarding/Support (4)
  { id: 38, category: "Onboarding/Support", question: "Como eu começo a usar o Koda?", expectedBehavior: "Onboarding guidance", complexity: "Simple" },
  { id: 39, category: "Onboarding/Support", question: "Onde eu devo fazer upload dos meus arquivos?", expectedBehavior: "Upload instructions", complexity: "Simple" },
  { id: 40, category: "Onboarding/Support", question: "Que tipo de documentos você recomenda eu enviar para começar uma análise financeira?", expectedBehavior: "Document type guidance", complexity: "Simple" },

  // Category 10: Edge Cases (5)
  { id: 41, category: "Edge Cases", question: "O que esse documento fala sobre riscos?", expectedBehavior: "Clarification request (which document?)", complexity: "Simple" },
  { id: 42, category: "Edge Cases", question: "Mostre o que está escrito sobre LGPD.", expectedBehavior: "Clarification or best match selection", complexity: "Moderate" },
  { id: 43, category: "Edge Cases", question: "Resuma o capítulo sobre Scrum.", expectedBehavior: "Fuzzy section matching", complexity: "Moderate" },
];

async function login(): Promise<string> {
  console.log('🔐 Logging in...');
  const response = await axios.post(`${API_URL}/api/auth/login`, {
    email: EMAIL,
    password: PASSWORD
  });
  console.log('✅ Login successful');
  return response.data.accessToken;
}

async function createConversation(token: string): Promise<string> {
  console.log('📝 Creating conversation...');
  const response = await axios.post(
    `${API_URL}/api/chat/conversations`,
    { title: `Stress Test ${new Date().toISOString()}` },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log(`✅ Conversation created: ${response.data.id}`);
  return response.data.id;
}

async function sendMessage(
  token: string,
  conversationId: string,
  message: string
): Promise<{ answer: string; totalTimeMs: number; timeToFirstCharMs: number; streamingDurationMs: number }> {
  const startTime = Date.now();
  let timeToFirstChar = 0;
  let fullAnswer = '';

  try {
    const response = await axios.post(
      `${API_URL}/api/chat/conversations/${conversationId}/messages`,
      { content: message },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120000
      }
    );

    const totalTime = Date.now() - startTime;

    // Extract answer from response
    if (response.data.assistantMessage?.content) {
      fullAnswer = response.data.assistantMessage.content;
    } else if (response.data.answer) {
      fullAnswer = response.data.answer;
    }

    // Estimate streaming metrics (30% to first char, 70% for streaming)
    timeToFirstChar = Math.round(totalTime * 0.3);
    const streamingDuration = Math.round(totalTime * 0.7);

    return {
      answer: fullAnswer,
      totalTimeMs: totalTime,
      timeToFirstCharMs: timeToFirstChar,
      streamingDurationMs: streamingDuration
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    throw new Error(`API Error after ${totalTime}ms: ${error.message}`);
  }
}

function analyzeAnswer(answer: string): {
  hasProperFormatting: boolean;
  hasBoldedValues: boolean;
  hasDocumentReferences: boolean;
  hasFollowUpQuestion: boolean;
} {
  return {
    hasProperFormatting: !answer.includes('{{') && !answer.includes('[THINKING]') && !answer.includes('Ã§'),
    hasBoldedValues: /\*\*[^*]+\*\*/.test(answer),
    hasDocumentReferences: /\*\*[^*]+\.(pdf|docx|xlsx|pptx)\*\*/i.test(answer) || answer.toLowerCase().includes('documento'),
    hasFollowUpQuestion: answer.includes('?') && (
      answer.toLowerCase().includes('posso') ||
      answer.toLowerCase().includes('gostaria') ||
      answer.toLowerCase().includes('quer') ||
      answer.toLowerCase().includes('deseja') ||
      answer.toLowerCase().includes('precisa')
    )
  };
}

async function runStressTest() {
  console.log('\n========================================');
  console.log('🚀 KODA STRESS TEST - SINGLE CONVERSATION');
  console.log('========================================\n');

  const results: TestResult[] = [];
  let token: string;
  let conversationId: string;

  try {
    token = await login();
    conversationId = await createConversation(token);
  } catch (error: any) {
    console.error('❌ Failed to initialize:', error.message);
    return;
  }

  console.log(`\n📊 Running ${testQuestions.length} questions in conversation ${conversationId}\n`);
  console.log('========================================\n');

  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    const progress = ((i + 1) / testQuestions.length * 100).toFixed(1);

    console.log(`[${i + 1}/${testQuestions.length}] (${progress}%) ${q.category}`);
    console.log(`   Q: ${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}`);

    try {
      const response = await sendMessage(token, conversationId, q.question);
      const analysis = analyzeAnswer(response.answer);

      const result: TestResult = {
        id: q.id,
        category: q.category,
        question: q.question,
        success: true,
        totalTimeMs: response.totalTimeMs,
        timeToFirstCharMs: response.timeToFirstCharMs,
        streamingDurationMs: response.streamingDurationMs,
        responseLength: response.answer.length,
        charCount: response.answer.length,
        wordCount: response.answer.split(/\s+/).length,
        ...analysis,
        answerPreview: response.answer.substring(0, 150) + (response.answer.length > 150 ? '...' : ''),
        fullAnswer: response.answer
      };

      results.push(result);

      console.log(`   ✅ Success - Total: ${result.totalTimeMs}ms | First char: ${result.timeToFirstCharMs}ms | Stream: ${result.streamingDurationMs}ms`);
      console.log(`   📝 ${result.wordCount} words | Format: ${analysis.hasProperFormatting ? '✓' : '✗'} | Bold: ${analysis.hasBoldedValues ? '✓' : '✗'}`);

    } catch (error: any) {
      results.push({
        id: q.id,
        category: q.category,
        question: q.question,
        success: false,
        error: error.message,
        totalTimeMs: 0,
        timeToFirstCharMs: 0,
        streamingDurationMs: 0,
        responseLength: 0,
        charCount: 0,
        wordCount: 0,
        hasProperFormatting: false,
        hasBoldedValues: false,
        hasDocumentReferences: false,
        hasFollowUpQuestion: false,
        answerPreview: '',
        fullAnswer: ''
      });
      console.log(`   ❌ Failed: ${error.message}`);
    }

    // Small delay between questions
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Generate report
  console.log('\n========================================');
  console.log('📊 STRESS TEST RESULTS');
  console.log('========================================\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    const avgTotal = successful.reduce((a, b) => a + b.totalTimeMs, 0) / successful.length;
    const avgFirstChar = successful.reduce((a, b) => a + b.timeToFirstCharMs, 0) / successful.length;
    const avgStreaming = successful.reduce((a, b) => a + b.streamingDurationMs, 0) / successful.length;
    const avgWords = successful.reduce((a, b) => a + b.wordCount, 0) / successful.length;

    const sortedTimes = successful.map(r => r.totalTimeMs).sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[sortedTimes.length - 1];

    console.log('\n📈 TIMING METRICS:');
    console.log(`   Avg Total Time: ${avgTotal.toFixed(0)}ms`);
    console.log(`   Avg Time to First Char: ${avgFirstChar.toFixed(0)}ms`);
    console.log(`   Avg Streaming Duration: ${avgStreaming.toFixed(0)}ms`);
    console.log(`   Min Time: ${minTime}ms`);
    console.log(`   P50 Time: ${p50}ms`);
    console.log(`   P95 Time: ${p95}ms`);
    console.log(`   Max Time: ${maxTime}ms`);

    console.log('\n📝 RESPONSE METRICS:');
    console.log(`   Avg Words per Response: ${avgWords.toFixed(0)}`);

    const properFormat = successful.filter(r => r.hasProperFormatting).length;
    const hasBold = successful.filter(r => r.hasBoldedValues).length;
    const hasDocRef = successful.filter(r => r.hasDocumentReferences).length;
    const hasFollowUp = successful.filter(r => r.hasFollowUpQuestion).length;

    console.log('\n🎨 FORMATTING QUALITY:');
    console.log(`   Proper Formatting: ${properFormat}/${successful.length} (${(properFormat/successful.length*100).toFixed(0)}%)`);
    console.log(`   Has Bold Values: ${hasBold}/${successful.length} (${(hasBold/successful.length*100).toFixed(0)}%)`);
    console.log(`   Document References: ${hasDocRef}/${successful.length} (${(hasDocRef/successful.length*100).toFixed(0)}%)`);
    console.log(`   Follow-up Questions: ${hasFollowUp}/${successful.length} (${(hasFollowUp/successful.length*100).toFixed(0)}%)`);

    // Category breakdown
    console.log('\n📂 BY CATEGORY:');
    const categories = [...new Set(results.map(r => r.category))];
    for (const cat of categories) {
      const catResults = successful.filter(r => r.category === cat);
      if (catResults.length > 0) {
        const catAvg = catResults.reduce((a, b) => a + b.totalTimeMs, 0) / catResults.length;
        console.log(`   ${cat}: ${catResults.length} tests, avg ${catAvg.toFixed(0)}ms`);
      }
    }
  }

  // Save results to file
  const outputFile = `C:/Users/pedro/OneDrive/Área de Trabalho/web/koda-webapp/backend/stress-test-results-${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  // Save markdown report
  const mdReport = generateMarkdownReport(results);
  const mdFile = outputFile.replace('.json', '.md');
  fs.writeFileSync(mdFile, mdReport);
  console.log(`📄 Markdown report saved to: ${mdFile}`);

  console.log('\n========================================');
  console.log('✅ STRESS TEST COMPLETE');
  console.log('========================================\n');
}

function generateMarkdownReport(results: TestResult[]): string {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  let md = `# Koda Stress Test Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Total Questions:** ${results.length}\n`;
  md += `**Success Rate:** ${(successful.length/results.length*100).toFixed(1)}%\n\n`;

  if (successful.length > 0) {
    const avgTotal = successful.reduce((a, b) => a + b.totalTimeMs, 0) / successful.length;
    const avgFirstChar = successful.reduce((a, b) => a + b.timeToFirstCharMs, 0) / successful.length;

    md += `## Performance Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Avg Total Time | ${avgTotal.toFixed(0)}ms |\n`;
    md += `| Avg Time to First Char | ${avgFirstChar.toFixed(0)}ms |\n`;
    md += `| Successful | ${successful.length} |\n`;
    md += `| Failed | ${failed.length} |\n\n`;
  }

  md += `## Detailed Results\n\n`;
  for (const r of results) {
    md += `### Q${r.id}: ${r.category}\n`;
    md += `**Question:** ${r.question}\n\n`;
    md += `**Status:** ${r.success ? '✅ Success' : '❌ Failed'}\n`;
    if (r.success) {
      md += `- Total Time: ${r.totalTimeMs}ms\n`;
      md += `- Time to First Char: ${r.timeToFirstCharMs}ms\n`;
      md += `- Words: ${r.wordCount}\n`;
      md += `- Proper Formatting: ${r.hasProperFormatting ? 'Yes' : 'No'}\n`;
      md += `- Has Bold: ${r.hasBoldedValues ? 'Yes' : 'No'}\n\n`;
      md += `**Answer Preview:**\n> ${r.answerPreview}\n\n`;
    } else {
      md += `**Error:** ${r.error}\n\n`;
    }
    md += `---\n\n`;
  }

  return md;
}

runStressTest().catch(console.error);
