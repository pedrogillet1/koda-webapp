/**
 * Koda Complex Query Integration Service
 *
 * This service provides the integration layer between:
 * - kodaComplexQueryPlanner.service.ts (query decomposition)
 * - kodaPlanDrivenRetrieval.service.ts (plan-driven retrieval)
 * - kodaAnswerValidationEngine.COMPLEX_EXTENSION.ts (complex answer validation)
 *
 * Usage in rag.service.ts:
 * 1. Import this service
 * 2. Call checkComplexQuery() early in generateAnswerStream
 * 3. If isComplex, use handleComplexQuery() instead of normal RAG pipeline
 *
 * @version 1.0.0
 * @date 2025-12-09
 */

import {
  createQueryPlan,
  detectQueryComplexity,
  needsPlanDrivenRetrieval,
  getPlanningPrompt,
  QueryPlan,
  QueryComplexity,
} from './kodaComplexQueryPlanner.service';

import {
  executePlanDrivenRetrieval,
  buildContextFromRetrieval,
  getChunkStatistics,
  PlanDrivenRetrievalResult,
  RetrievalOptions,
} from './kodaPlanDrivenRetrieval.service';

import {
  validateComplexAnswer,
  quickComplexCheck,
  ComplexValidationContext,
  ComplexValidationResult,
} from './kodaAnswerValidationEngine.COMPLEX_EXTENSION';

import geminiClient from './geminiClient.service';
import { detectLanguage } from './languageDetection.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ComplexQueryCheckResult {
  isComplex: boolean;
  complexity: QueryComplexity;
  queryPlan: QueryPlan | null;
  shouldUsePlanDrivenRetrieval: boolean;
}

export interface ComplexQueryHandlerOptions {
  userId: string;
  conversationId: string;
  onChunk?: (chunk: string) => void;
  onStage?: (stage: string, message: string) => void;
  documentIds?: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  profilePrompt?: string;
}

export interface ComplexQueryResult {
  answer: string;
  sources: Array<{ documentId: string; documentTitle: string; content: string }>;
  validation: ComplexValidationResult | null;
  metadata: {
    totalLatencyMs: number;
    retrievalLatencyMs: number;
    generationLatencyMs: number;
    validationLatencyMs: number;
    subQuestionsCount: number;
    chunksRetrieved: number;
    uniqueDocuments: string[];
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const ENABLE_COMPLEX_QUERY_HANDLING = process.env.ENABLE_COMPLEX_QUERY === 'true';
const MAX_GENERATION_TOKENS = 4000;
const TEMPERATURE = 0.3;

// ═══════════════════════════════════════════════════════════════════════════
// Check Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a query is complex and should use plan-driven retrieval
 *
 * Call this early in the RAG pipeline (after basic checks but before retrieval)
 *
 * @param query - User's query
 * @returns ComplexQueryCheckResult
 */
export function checkComplexQuery(query: string): ComplexQueryCheckResult {
  if (!ENABLE_COMPLEX_QUERY_HANDLING) {
    return {
      isComplex: false,
      complexity: 'simple',
      queryPlan: null,
      shouldUsePlanDrivenRetrieval: false,
    };
  }

  // Quick complexity check
  const complexity = detectQueryComplexity(query);

  // Only create full plan for complex queries
  if (complexity === 'complex') {
    const queryPlan = createQueryPlan(query);

    return {
      isComplex: true,
      complexity,
      queryPlan,
      shouldUsePlanDrivenRetrieval: needsPlanDrivenRetrieval(queryPlan),
    };
  }

  return {
    isComplex: false,
    complexity,
    queryPlan: null,
    shouldUsePlanDrivenRetrieval: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// System Prompt for Complex Queries
// ═══════════════════════════════════════════════════════════════════════════

function buildComplexQuerySystemPrompt(queryPlan: QueryPlan, language: string): string {
  const languageInstruction = {
    en: 'Respond in English.',
    pt: 'Responda em Português.',
    es: 'Responde en Español.',
  }[language] || 'Respond in the same language as the query.';

  const subQuestionsSection = queryPlan.subQuestions
    .map((sq, i) => `${i + 1}. ${sq.text}`)
    .join('\n');

  return `You are Koda, an expert document analyst. The user has asked a complex multi-part question.

## QUERY STRUCTURE
The query has been decomposed into ${queryPlan.subQuestions.length} parts:
${subQuestionsSection}

## RESPONSE REQUIREMENTS
1. **Address ALL parts systematically** - Do not skip any sub-question
2. **Use clear structure** - Use headers (##) or numbered sections for each part
3. **Cite sources** - Reference document names when providing information
4. **Be comprehensive** - This is a ${queryPlan.responseProfile} response
5. **Stay grounded** - Only use information from the provided context

## RESPONSE PROFILE: ${queryPlan.responseProfile.toUpperCase()}
${queryPlan.responseProfile === 'comparison' ? 'Create a side-by-side comparison format' : ''}
${queryPlan.responseProfile === 'deep_analysis' ? 'Provide detailed analysis with supporting evidence' : ''}
${queryPlan.responseProfile === 'list' ? 'Use bullet points or numbered lists' : ''}

## LANGUAGE
${languageInstruction}

## IMPORTANT
- Do NOT say "I don't have access to documents" - you DO have context below
- Do NOT ask for more information - answer with what's provided
- Do NOT mention being an AI or language model
- DO address each sub-question clearly`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handle a complex query using plan-driven retrieval and structured answer generation
 *
 * @param query - User's original query
 * @param queryPlan - Pre-computed query plan
 * @param options - Handler options
 * @returns ComplexQueryResult
 */
export async function handleComplexQuery(
  query: string,
  queryPlan: QueryPlan,
  options: ComplexQueryHandlerOptions
): Promise<ComplexQueryResult> {
  const startTime = Date.now();
  const { userId, onChunk, onStage, documentIds, conversationHistory } = options;

  console.log('[COMPLEX-HANDLER] ═══════════════════════════════════════════');
  console.log('[COMPLEX-HANDLER] Handling complex query');
  console.log(`[COMPLEX-HANDLER] Sub-questions: ${queryPlan.subQuestions.length}`);
  console.log(`[COMPLEX-HANDLER] Response profile: ${queryPlan.responseProfile}`);
  console.log('[COMPLEX-HANDLER] ═══════════════════════════════════════════');

  // Step 1: Plan-Driven Retrieval
  if (onStage) onStage('retrieving', 'Searching documents for each part of your question...');

  const retrievalStartTime = Date.now();
  const retrievalResult = await executePlanDrivenRetrieval(queryPlan, {
    userId,
    topK: 5,
    includeDocumentRouting: true,
    useMicroSummaryReranking: true,
    useChunkTypeReranking: true,
    documentIds,
  });
  const retrievalLatencyMs = Date.now() - retrievalStartTime;

  console.log(`[COMPLEX-HANDLER] Retrieved ${retrievalResult.mergedChunks.length} chunks in ${retrievalLatencyMs}ms`);

  // Step 2: Build Context
  const context = buildContextFromRetrieval(retrievalResult);
  const stats = getChunkStatistics(retrievalResult);

  // Step 3: Generate Answer
  if (onStage) onStage('generating', 'Analyzing and composing comprehensive response...');

  const generationStartTime = Date.now();
  const systemPrompt = buildComplexQuerySystemPrompt(queryPlan, queryPlan.language);

  const userPrompt = `## QUERY
${query}

## DOCUMENT CONTEXT
${context}

## YOUR RESPONSE
Provide a comprehensive response that addresses each part of the query. Use the document context above to ground your answer.`;

  try {
    const model = geminiClient.getModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_GENERATION_TOKENS,
      },
    });

    const streamResult = await model.generateContentStream(userPrompt);
    let fullAnswer = '';

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      fullAnswer += chunkText;
      if (onChunk) onChunk(chunkText);
    }

    const generationLatencyMs = Date.now() - generationStartTime;
    console.log(`[COMPLEX-HANDLER] Generated answer in ${generationLatencyMs}ms`);

    // Step 4: Validate Answer
    if (onStage) onStage('validating', 'Verifying answer completeness...');

    const validationStartTime = Date.now();
    let validation: ComplexValidationResult | null = null;

    try {
      validation = await validateComplexAnswer(fullAnswer, {
        query,
        queryPlan,
        documents: stats.uniqueDocuments.map(title => ({ id: '', name: title })),
        conversationHistory,
        userId,
        language: queryPlan.language,
      });

      console.log(`[COMPLEX-HANDLER] Validation: ${validation.isValid ? 'PASSED' : 'NEEDS IMPROVEMENT'}`);
      console.log(`[COMPLEX-HANDLER] Coverage: ${validation.coverageScore}%`);

      if (!validation.isValid && validation.missingParts.length > 0) {
        console.warn(`[COMPLEX-HANDLER] Missing parts: ${validation.missingParts.join(', ')}`);
      }
    } catch (validationError) {
      console.error('[COMPLEX-HANDLER] Validation failed:', validationError);
    }

    const validationLatencyMs = Date.now() - validationStartTime;

    // Step 5: Build sources
    const sources = retrievalResult.mergedChunks.map(chunk => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      content: chunk.content.substring(0, 200) + '...',
    }));

    if (onStage) onStage('complete', 'Complete');

    const totalLatencyMs = Date.now() - startTime;

    console.log('[COMPLEX-HANDLER] ═══════════════════════════════════════════');
    console.log('[COMPLEX-HANDLER] Complete:');
    console.log(`  • Total: ${totalLatencyMs}ms`);
    console.log(`  • Retrieval: ${retrievalLatencyMs}ms`);
    console.log(`  • Generation: ${generationLatencyMs}ms`);
    console.log(`  • Validation: ${validationLatencyMs}ms`);
    console.log(`  • Answer length: ${fullAnswer.length} chars`);
    console.log('[COMPLEX-HANDLER] ═══════════════════════════════════════════');

    return {
      answer: fullAnswer,
      sources,
      validation,
      metadata: {
        totalLatencyMs,
        retrievalLatencyMs,
        generationLatencyMs,
        validationLatencyMs,
        subQuestionsCount: queryPlan.subQuestions.length,
        chunksRetrieved: retrievalResult.totalChunksRetrieved,
        uniqueDocuments: stats.uniqueDocuments,
      },
    };
  } catch (error) {
    console.error('[COMPLEX-HANDLER] Error generating answer:', error);

    // Fallback: return error message
    const errorMessage = queryPlan.language === 'pt'
      ? 'Desculpe, ocorreu um erro ao processar sua pergunta complexa. Por favor, tente novamente.'
      : queryPlan.language === 'es'
        ? 'Lo siento, ocurrió un error al procesar tu pregunta compleja. Por favor, inténtalo de nuevo.'
        : 'Sorry, an error occurred while processing your complex question. Please try again.';

    if (onChunk) onChunk(errorMessage);
    if (onStage) onStage('complete', 'Complete');

    return {
      answer: errorMessage,
      sources: [],
      validation: null,
      metadata: {
        totalLatencyMs: Date.now() - startTime,
        retrievalLatencyMs,
        generationLatencyMs: 0,
        validationLatencyMs: 0,
        subQuestionsCount: queryPlan.subQuestions.length,
        chunksRetrieved: 0,
        uniqueDocuments: [],
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export const kodaComplexQueryIntegration = {
  checkComplexQuery,
  handleComplexQuery,
};

export default kodaComplexQueryIntegration;
