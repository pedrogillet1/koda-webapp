/**
 * ============================================================================
 * QUERY EXECUTOR SERVICE
 * ============================================================================
 *
 * Handles execution of complex multi-part queries by:
 * 1. Executing each sub-question sequentially
 * 2. Assembling results into a structured multi-part answer
 * 3. Maintaining context between sub-questions
 *
 * This is what enables Koda to handle queries like:
 * "For these 5 documents, summarize the key risks, then compare the costs
 *  and finally tell me which one is most favorable."
 */

import { IntentResult, SubQuestion } from './hierarchicalIntentClassifier.service';
import { PipelineConfig, AnswerPlan } from './pipelineConfiguration.service';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface SubQuestionResult {
  subQuestion: SubQuestion;
  answer: string;
  context: string;
  metadata: {
    retrievedChunks: number;
    usedChunks: number;
    latency: number;
  };
}

export interface MultiPartAnswer {
  answer: string;
  subAnswers: SubQuestionResult[];
  metadata: {
    totalSubQuestions: number;
    totalLatency: number;
    totalChunks: number;
  };
}

// ============================================================================
// SUB-QUESTION EXECUTOR
// ============================================================================

export async function executeSubQuestion(
  subQuestion: SubQuestion,
  userId: string,
  pipelineConfig: PipelineConfig,
  services: {
    documentRouter: any;
    hybridSearch: any;
    chunkTypeReranker: any;
    microSummaryReranker: any;
    generateLLMResponse: any;
  }
): Promise<SubQuestionResult> {
  const startTime = Date.now();

  console.log(`[QUERY_EXECUTOR] Executing sub-question ${subQuestion.order}: "${subQuestion.question}"`);

  // Step 1: Document routing (if targetDocuments specified)
  let documentIds: string[] | undefined = subQuestion.targetDocuments;
  if (!documentIds) {
    if (pipelineConfig.routing === 'multi-document') {
      const routing = await services.documentRouter.routeToMultipleDocuments(userId, subQuestion.question);
      documentIds = routing.map((r: any) => r.documentId);
    } else if (pipelineConfig.routing === 'single') {
      const routing = await services.documentRouter.routeToDocument(userId, subQuestion.question);
      documentIds = routing ? [routing.documentId] : undefined;
    }
  }

  // Step 2: Retrieval
  const results = await services.hybridSearch.hybridSearch(subQuestion.question, {
    userId,
    documentIds,
    topK: pipelineConfig.retrieval.topK,
    queryIntent: subQuestion.intent,
    chunkTypeBoosts: pipelineConfig.retrieval.chunkTypeBoosts,
  });

  console.log(`[QUERY_EXECUTOR] Retrieved ${results.length} chunks for sub-question ${subQuestion.order}`);

  // Step 3: Reranking (if enabled)
  let rerankedResults = results;
  if (pipelineConfig.reranking.enabled) {
    for (const method of pipelineConfig.reranking.methods) {
      if (method === 'micro-summary' && services.microSummaryReranker) {
        rerankedResults = await services.microSummaryReranker.rerankWithMicroSummaries(rerankedResults, {
          query: subQuestion.question,
          queryIntent: subQuestion.intent,
        });
      } else if (method === 'chunk-type' && services.chunkTypeReranker) {
        rerankedResults = await services.chunkTypeReranker.rerankByChunkType(rerankedResults, {
          query: subQuestion.question,
          queryIntent: subQuestion.intent,
        });
      }
    }
  }

  // Step 4: Context packaging
  const topChunks = rerankedResults.slice(0, 10);
  const context = packageContext(topChunks);

  // Step 5: Answer generation
  const prompt = buildSubQuestionPrompt(subQuestion, context);
  const answer = await services.generateLLMResponse(prompt, {
    temperature: 0.3,
    maxTokens: 500,  // Sub-answers are shorter
  });

  const latency = Date.now() - startTime;
  console.log(`[QUERY_EXECUTOR] Sub-question ${subQuestion.order} completed in ${latency}ms`);

  return {
    subQuestion,
    answer,
    context,
    metadata: {
      retrievedChunks: results.length,
      usedChunks: topChunks.length,
      latency,
    },
  };
}

// ============================================================================
// MULTI-PART ANSWER ASSEMBLER
// ============================================================================

export function assembleMultiPartAnswer(
  subAnswers: SubQuestionResult[],
  intent: IntentResult,
  pipelineConfig: PipelineConfig
): MultiPartAnswer {
  console.log(`[QUERY_EXECUTOR] Assembling ${subAnswers.length} sub-answers into final answer`);

  // Sort by order
  const sortedAnswers = subAnswers.sort((a, b) => a.subQuestion.order - b.subQuestion.order);

  // Build structured answer based on template
  let finalAnswer = '';

  switch (pipelineConfig.answer.template) {
    case 'comparison':
      finalAnswer = assembleComparisonAnswer(sortedAnswers, intent);
      break;

    case 'overview':
      finalAnswer = assembleOverviewAnswer(sortedAnswers, intent);
      break;

    case 'reasoning':
      finalAnswer = assembleReasoningAnswer(sortedAnswers, intent);
      break;

    default:
      finalAnswer = assembleDirectAnswer(sortedAnswers, intent);
      break;
  }

  const totalLatency = subAnswers.reduce((sum, sa) => sum + sa.metadata.latency, 0);
  const totalChunks = subAnswers.reduce((sum, sa) => sum + sa.metadata.usedChunks, 0);

  return {
    answer: finalAnswer,
    subAnswers: sortedAnswers,
    metadata: {
      totalSubQuestions: subAnswers.length,
      totalLatency,
      totalChunks,
    },
  };
}

function assembleComparisonAnswer(subAnswers: SubQuestionResult[], intent: IntentResult): string {
  let answer = '## Comparison Analysis\n\n';

  // Section 1: Per-document summaries
  answer += '### Per-Document Summary\n\n';
  subAnswers.forEach((sa, idx) => {
    if (sa.subQuestion.intent === 'summarization' || sa.subQuestion.intent === 'content_question') {
      answer += `**Document ${idx + 1}** (${sa.subQuestion.targetDimension || 'Overview'}):\n`;
      answer += `${sa.answer}\n\n`;
    }
  });

  // Section 2: Side-by-side comparison
  answer += '### Side-by-Side Comparison\n\n';
  const comparisonSubAnswer = subAnswers.find(sa => sa.subQuestion.intent === 'comparison');
  if (comparisonSubAnswer) {
    answer += `${comparisonSubAnswer.answer}\n\n`;
  }

  // Section 3: Recommendation
  answer += '### Recommendation\n\n';
  const recommendationSubAnswer = subAnswers.find(sa => sa.subQuestion.intent === 'explanation');
  if (recommendationSubAnswer) {
    answer += `${recommendationSubAnswer.answer}\n\n`;
  }

  return answer;
}

function assembleOverviewAnswer(subAnswers: SubQuestionResult[], intent: IntentResult): string {
  let answer = '## Summary\n\n';

  // Section 1: Overview
  answer += '### Overview\n\n';
  const overviewSubAnswer = subAnswers.find(sa => sa.subQuestion.intent === 'summarization');
  if (overviewSubAnswer) {
    answer += `${overviewSubAnswer.answer}\n\n`;
  }

  // Section 2: Key takeaways
  answer += '### Key Takeaways\n\n';
  subAnswers.forEach((sa, idx) => {
    if (sa.subQuestion.intent !== 'summarization') {
      answer += `${idx + 1}. ${sa.answer}\n`;
    }
  });

  return answer;
}

function assembleReasoningAnswer(subAnswers: SubQuestionResult[], intent: IntentResult): string {
  let answer = '## Explanation\n\n';

  // Section 1: Context
  answer += '### Context\n\n';
  if (subAnswers.length > 0) {
    answer += `${subAnswers[0].answer}\n\n`;
  }

  // Section 2: Detailed explanation
  answer += '### Detailed Explanation\n\n';
  subAnswers.slice(1).forEach((sa, idx) => {
    answer += `**${idx + 1}. ${sa.subQuestion.question}**\n\n`;
    answer += `${sa.answer}\n\n`;
  });

  return answer;
}

function assembleDirectAnswer(subAnswers: SubQuestionResult[], intent: IntentResult): string {
  let answer = '';

  subAnswers.forEach((sa, idx) => {
    if (subAnswers.length > 1) {
      answer += `**${idx + 1}. ${sa.subQuestion.question}**\n\n`;
    }
    answer += `${sa.answer}\n\n`;
  });

  return answer;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function packageContext(chunks: any[]): string {
  return chunks
    .map((chunk, idx) => {
      return `[${idx + 1}] ${chunk.content}\n(Source: ${chunk.documentTitle}, Page: ${chunk.pageNumber || 'N/A'})`;
    })
    .join('\n\n');
}

function buildSubQuestionPrompt(subQuestion: SubQuestion, context: string): string {
  return `You are answering a sub-question as part of a larger multi-part query.

Context from documents:
${context}

Sub-question: "${subQuestion.question}"

${subQuestion.targetDimension ? `Focus specifically on: ${subQuestion.targetDimension}` : ''}

Provide a concise answer (200-300 words) that directly addresses this sub-question.
Include citations in the format [Doc: filename, Page: X].

Answer:`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const queryExecutorService = {
  executeSubQuestion,
  assembleMultiPartAnswer,
};
