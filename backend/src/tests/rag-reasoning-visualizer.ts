/**
 * RAG Reasoning Visualizer
 *
 * Helps you think like Koda by visualizing the logical decision tree
 * for any query through the RAG pipeline.
 *
 * Usage: npm run visualize-reasoning "your question here"
 */

import { detectIntent } from '../services/simpleIntentDetection.service';
import fallbackDetectionService from '../services/fallback/fallbackDetection.service';

// Color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

interface ReasoningStep {
  stage: string;
  decision: string;
  confidence: number;
  reasoning: string[];
  nextStage: string;
}

/**
 * Visualize Koda's reasoning for a query
 */
async function visualizeReasoning(query: string, documentCount: number = 18) {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║           KODA REASONING VISUALIZER                                ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║           Think Like Koda: Logical Decision Tree                   ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.bright}Query:${colors.reset} "${query}"`);
  console.log(`${colors.dim}Document count: ${documentCount}${colors.reset}\n`);

  const steps: ReasoningStep[] = [];

  // ============================================
  // STAGE 1: INTENT DETECTION
  // ============================================
  console.log(`${colors.bright}${colors.blue}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}│ STAGE 1: INTENT DETECTION                                       │${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}└─────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  const intentResult = detectIntent(query);

  console.log(`${colors.cyan}🤔 Analyzing query structure...${colors.reset}`);
  console.log(`   └─ Checking for action verbs: ${colors.yellow}${intentResult.type}${colors.reset}`);
  console.log(`   └─ Needs documents: ${intentResult.needsDocuments}`);
  console.log(`   └─ Calculating confidence: ${colors.green}${(intentResult.confidence * 100).toFixed(0)}%${colors.reset}\n`);

  console.log(`${colors.bright}Decision:${colors.reset} ${colors.green}Intent = ${intentResult.type}${colors.reset}`);
  console.log(`${colors.dim}Reasoning: Query matches pattern for ${intentResult.type}${colors.reset}\n`);

  steps.push({
    stage: 'Intent Detection',
    decision: intentResult.type,
    confidence: intentResult.confidence,
    reasoning: [
      `Query pattern matches ${intentResult.type}`,
      `Needs documents: ${intentResult.needsDocuments}`,
    ],
    nextStage: 'Context Analysis',
  });

  // ============================================
  // STAGE 2: CONTEXT ANALYSIS
  // ============================================
  console.log(`${colors.bright}${colors.blue}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}│ STAGE 2: CONTEXT ANALYSIS                                       │${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}└─────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  console.log(`${colors.cyan}🔍 Checking available context...${colors.reset}`);
  console.log(`   └─ Document count: ${colors.green}${documentCount}${colors.reset}`);
  console.log(`   └─ Conversation history: ${colors.yellow}Empty (fresh query)${colors.reset}`);
  console.log(`   └─ Attached document: ${colors.yellow}None${colors.reset}\n`);

  const needsRAG = intentResult.type !== 'greeting' &&
                   intentResult.type !== 'general' &&
                   documentCount > 0;

  console.log(`${colors.bright}Decision:${colors.reset} ${needsRAG ? colors.green + 'Proceed to RAG' : colors.yellow + 'Skip RAG'}${colors.reset}`);
  console.log(`${colors.dim}Reasoning: ${needsRAG ? 'Query requires document context' : 'Query is conversational'}${colors.reset}\n`);

  steps.push({
    stage: 'Context Analysis',
    decision: needsRAG ? 'Proceed to RAG' : 'Skip RAG',
    confidence: 1.0,
    reasoning: [
      `Document count: ${documentCount}`,
      `Intent requires documents: ${needsRAG}`,
    ],
    nextStage: needsRAG ? 'Early Fallback Check' : 'Response Generation',
  });

  if (!needsRAG) {
    console.log(`${colors.yellow}⚠️  Skipping RAG pipeline (conversational query)${colors.reset}\n`);
    displayDecisionTree(steps);
    return;
  }

  // ============================================
  // STAGE 3: EARLY FALLBACK CHECK
  // ============================================
  console.log(`${colors.bright}${colors.blue}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}│ STAGE 3: EARLY FALLBACK DETECTION                              │${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}└─────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  const earlyFallback = fallbackDetectionService.detectFallback({
    query,
    documentCount,
    ragResults: [],
    ragScore: undefined,
    conversationHistory: [],
  });

  console.log(`${colors.cyan}🚦 Checking if RAG should be skipped...${colors.reset}`);
  console.log(`   └─ Fallback type: ${colors.yellow}${earlyFallback.fallbackType || 'None'}${colors.reset}`);
  console.log(`   └─ Confidence: ${colors.green}${(earlyFallback.confidence * 100).toFixed(0)}%${colors.reset}`);
  console.log(`   └─ Threshold: ${colors.dim}85%${colors.reset}\n`);

  const shouldSkipRAG = earlyFallback.needsFallback &&
                        earlyFallback.confidence > 0.85 &&
                        (earlyFallback.fallbackType === 'clarification' ||
                         earlyFallback.fallbackType === 'refusal');

  if (shouldSkipRAG) {
    console.log(`${colors.bright}Decision:${colors.reset} ${colors.yellow}Skip RAG (early fallback)${colors.reset}`);
    console.log(`${colors.dim}Reasoning: Query is ${earlyFallback.fallbackType} with high confidence${colors.reset}\n`);

    steps.push({
      stage: 'Early Fallback Check',
      decision: 'Skip RAG',
      confidence: earlyFallback.confidence,
      reasoning: [
        `Fallback type: ${earlyFallback.fallbackType}`,
        `Confidence above threshold (${(earlyFallback.confidence * 100).toFixed(0)}% > 85%)`,
      ],
      nextStage: 'Response Generation',
    });

    displayDecisionTree(steps);
    return;
  }

  console.log(`${colors.bright}Decision:${colors.reset} ${colors.green}Proceed to RAG${colors.reset}`);
  console.log(`${colors.dim}Reasoning: No early fallback triggered${colors.reset}\n`);

  steps.push({
    stage: 'Early Fallback Check',
    decision: 'Proceed to RAG',
    confidence: 1 - earlyFallback.confidence,
    reasoning: [
      `Fallback confidence too low (${(earlyFallback.confidence * 100).toFixed(0)}% < 85%)`,
      'OR fallback type is not clarification/refusal',
    ],
    nextStage: 'RAG Execution',
  });

  // ============================================
  // STAGE 4: RAG EXECUTION
  // ============================================
  console.log(`${colors.bright}${colors.blue}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}│ STAGE 4: RAG EXECUTION                                          │${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}└─────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  console.log(`${colors.cyan}📚 Executing RAG pipeline...${colors.reset}`);
  console.log(`   ${colors.dim}1. Generate embedding for query${colors.reset}`);
  console.log(`   ${colors.dim}2. Search Pinecone (topK=10)${colors.reset}`);
  console.log(`   ${colors.dim}3. Score and rank results${colors.reset}`);
  console.log(`   ${colors.dim}4. Filter by relevance threshold${colors.reset}\n`);

  // Simulate RAG results based on query patterns
  let simulatedSourceCount = 0;
  let simulatedRAGScore = 0;

  if (query.toLowerCase().includes('trabalho projeto')) {
    simulatedSourceCount = 1;
    simulatedRAGScore = 0.92;
  } else if (query.toLowerCase().includes('scrum')) {
    simulatedSourceCount = 1;
    simulatedRAGScore = 0.88;
  } else if (query.toLowerCase().includes('project management')) {
    simulatedSourceCount = 3;
    simulatedRAGScore = 0.78;
  } else if (query.toLowerCase().includes('list files') || query.toLowerCase().includes('trampo')) {
    simulatedSourceCount = 4;
    simulatedRAGScore = 0.95;
  } else if (query.toLowerCase().includes('budget') || query.toLowerCase().includes('q3 revenue')) {
    simulatedSourceCount = 0;
    simulatedRAGScore = 0.15;
  } else {
    // Default: some results
    simulatedSourceCount = Math.floor(Math.random() * 3) + 1;
    simulatedRAGScore = 0.6 + Math.random() * 0.3;
  }

  console.log(`${colors.bright}Results:${colors.reset}`);
  console.log(`   └─ Sources found: ${simulatedSourceCount > 0 ? colors.green : colors.yellow}${simulatedSourceCount}${colors.reset}`);
  console.log(`   └─ RAG score: ${simulatedRAGScore > 0.7 ? colors.green : colors.yellow}${simulatedRAGScore.toFixed(2)}${colors.reset}\n`);

  steps.push({
    stage: 'RAG Execution',
    decision: `Found ${simulatedSourceCount} sources`,
    confidence: simulatedRAGScore,
    reasoning: [
      `Pinecone search returned ${simulatedSourceCount} matches`,
      `Average relevance score: ${simulatedRAGScore.toFixed(2)}`,
    ],
    nextStage: 'Post-RAG Fallback Check',
  });

  // ============================================
  // STAGE 5: POST-RAG FALLBACK CHECK
  // ============================================
  console.log(`${colors.bright}${colors.blue}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}│ STAGE 5: POST-RAG FALLBACK DETECTION                           │${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}└─────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  const postFallback = fallbackDetectionService.detectFallback({
    query,
    documentCount,
    ragResults: simulatedSourceCount > 0 ? [{ score: simulatedRAGScore }] : [],
    ragScore: simulatedRAGScore,
    conversationHistory: [],
  });

  console.log(`${colors.cyan}🎯 Evaluating RAG results quality...${colors.reset}`);
  console.log(`   └─ Fallback needed: ${postFallback.needsFallback ? colors.yellow + 'YES' : colors.green + 'NO'}${colors.reset}`);
  console.log(`   └─ Fallback type: ${colors.yellow}${postFallback.fallbackType || 'None'}${colors.reset}`);
  console.log(`   └─ Confidence: ${colors.green}${(postFallback.confidence * 100).toFixed(0)}%${colors.reset}\n`);

  if (postFallback.needsFallback) {
    console.log(`${colors.bright}Decision:${colors.reset} ${colors.yellow}Use fallback response${colors.reset}`);
    console.log(`${colors.dim}Reasoning: ${postFallback.fallbackType} - insufficient RAG results${colors.reset}\n`);

    steps.push({
      stage: 'Post-RAG Fallback Check',
      decision: 'Use Fallback',
      confidence: postFallback.confidence,
      reasoning: [
        `Fallback type: ${postFallback.fallbackType}`,
        simulatedSourceCount === 0 ? 'No sources found' : 'RAG score too low',
      ],
      nextStage: 'Response Generation (Fallback)',
    });
  } else {
    console.log(`${colors.bright}Decision:${colors.reset} ${colors.green}Use RAG context${colors.reset}`);
    console.log(`${colors.dim}Reasoning: Sufficient high-quality sources found${colors.reset}\n`);

    steps.push({
      stage: 'Post-RAG Fallback Check',
      decision: 'Use RAG Context',
      confidence: 1 - postFallback.confidence,
      reasoning: [
        `${simulatedSourceCount} high-quality sources found`,
        `RAG score above threshold (${simulatedRAGScore.toFixed(2)})`,
      ],
      nextStage: 'Response Generation (RAG)',
    });
  }

  // ============================================
  // STAGE 6: RESPONSE GENERATION
  // ============================================
  console.log(`${colors.bright}${colors.blue}┌─────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}│ STAGE 6: RESPONSE GENERATION                                    │${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}└─────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  const useRAG = !postFallback.needsFallback && simulatedSourceCount > 0;

  console.log(`${colors.cyan}✍️  Generating response...${colors.reset}`);
  console.log(`   └─ Context: ${useRAG ? colors.green + 'RAG documents' : colors.yellow + 'Fallback template'}${colors.reset}`);
  console.log(`   └─ Format: ${useRAG ? colors.green + 'WITH title/sections' : colors.yellow + 'WITHOUT title/sections'}${colors.reset}`);
  console.log(`   └─ Sources: ${useRAG ? colors.green + 'Attached' : colors.yellow + 'None'}${colors.reset}\n`);

  console.log(`${colors.bright}Final Decision:${colors.reset} ${useRAG ? colors.green + 'RAG Response' : colors.yellow + 'Fallback Response'}${colors.reset}\n`);

  steps.push({
    stage: 'Response Generation',
    decision: useRAG ? 'RAG Response' : 'Fallback Response',
    confidence: useRAG ? simulatedRAGScore : postFallback.confidence,
    reasoning: [
      useRAG ? 'Using retrieved document context' : 'Using fallback template',
      useRAG ? 'Applying format enforcement (title + sections)' : 'Natural paragraph format',
      useRAG ? `Attaching ${simulatedSourceCount} source(s)` : 'No sources to attach',
    ],
    nextStage: 'Complete',
  });

  // Display decision tree
  displayDecisionTree(steps);
}

/**
 * Display the decision tree visualization
 */
function displayDecisionTree(steps: ReasoningStep[]) {
  console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║                    DECISION TREE                                   ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  steps.forEach((step, index) => {
    const isLast = index === steps.length - 1;
    const connector = isLast ? '└─' : '├─';
    const line = isLast ? '  ' : '│ ';

    console.log(`${colors.dim}${connector}${colors.reset} ${colors.bright}${step.stage}${colors.reset}`);
    console.log(`${colors.dim}${line}${colors.reset}   ${colors.cyan}Decision:${colors.reset} ${step.decision}`);
    console.log(`${colors.dim}${line}${colors.reset}   ${colors.yellow}Confidence:${colors.reset} ${(step.confidence * 100).toFixed(0)}%`);

    step.reasoning.forEach((reason, idx) => {
      const isLastReason = idx === step.reasoning.length - 1;
      console.log(`${colors.dim}${line}${colors.reset}   ${colors.dim}${isLastReason ? '└─' : '├─'} ${reason}${colors.reset}`);
    });

    if (!isLast) {
      console.log(`${colors.dim}${line}${colors.reset}   ${colors.green}↓${colors.reset}`);
      console.log(`${colors.dim}${line}${colors.reset}   ${colors.dim}Next: ${step.nextStage}${colors.reset}`);
      console.log(`${colors.dim}${line}${colors.reset}`);
    }
  });

  console.log(`\n${colors.bright}${colors.green}✓ Reasoning complete!${colors.reset}\n`);
}

// CLI interface
const query = process.argv[2];
const documentCount = parseInt(process.argv[3]) || 18;

if (!query) {
  console.log(`\n${colors.red}Error: Please provide a query${colors.reset}`);
  console.log(`\nUsage: npm run visualize-reasoning "your question here" [documentCount]\n`);
  console.log(`Example: npm run visualize-reasoning "what is trabalho projeto about" 18\n`);
  process.exit(1);
}

visualizeReasoning(query, documentCount)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(`${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  });
