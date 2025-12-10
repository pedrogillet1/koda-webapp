// @ts-nocheck
/**
 * RAG Orchestrator - Main Entry Point for All Queries
 *
 * Replaces: rag.service.ts (10,824 lines → 300 lines)
 *
 * This is the ONLY public API for answering queries.
 * All other services are internal implementation details.
 *
 * Flow:
 * 1. Check L1/L2 cache
 * 2. Detect intent & answer type
 * 3. Route to appropriate handler
 * 4. Cache result & return
 */

import { detectAnswerType, type IntentDetectionResult } from './kodaIntentEngine.service';
import { detectLanguage } from './languageDetection.service';
import { KodaRetrievalEngine, type RetrievalResult } from './kodaRetrievalEngine.service';
import { KodaMemoryEngine } from './kodaMemoryEngine.service';
import { buildContext } from './contextManager.service';
import { generateAdaptiveAnswer, type GeneratedAnswer } from './answerGenerator.service';
import { formatAnswer, type FormattedAnswer } from './answerFormatter.service';
import { validateAnswer, type ValidationResult } from './answerValidator.service';
import { KodaStreamingController } from './kodaStreamingController.service';
import { calculationEngine } from './calculationEngine.service';
import crypto from 'crypto';
import { withBudget, getBudgetForQueryType, getAdaptiveBudget } from '../utils/budgetEnforcer';
import { recordMetric, recordCacheEvent, recordQueryType } from './performanceMonitor.service';

// ✅ 4-LAYER ANSWER PIPELINE - Unified formatting system
import { kodaAnswerPipeline, type PrimaryIntent, type AnswerMode, type Language } from '../koda-4-layer-pipeline';

// ✅ CENTRALIZED PATTERN SYSTEM - Single source of truth for patterns
import { centralizedPatternMatcher, QueryIntent as CentralizedIntent } from '../centralized';

// ═══════════════════════════════════════════════════════════════════════════════
// L1 CACHE: In-Memory (fastest, ~1ms)
// ═══════════════════════════════════════════════════════════════════════════════

interface CacheEntry {
  result: QueryResult;
  timestamp: number;
}

// L1: In-memory cache (Map for fast lookups)
const L1_CACHE = new Map<string, CacheEntry>();
const L1_TTL = 5 * 60 * 1000; // 5 minutes
const L1_MAX_SIZE = 500; // Max entries

// L1 cache stats for monitoring
const cacheStats = {
  l1Hits: 0,
  l1Misses: 0,
  l2Hits: 0,
  l2Misses: 0,
};

/**
 * Generate cache key from query + userId
 */
function generateCacheKey(query: string, userId: string): string {
  const normalized = query.toLowerCase().trim();
  return crypto.createHash('md5').update(`${userId}:${normalized}`).digest('hex');
}

/**
 * Check L1 cache (in-memory)
 */
function checkL1Cache(key: string): QueryResult | null {
  const startTime = Date.now();
  const entry = L1_CACHE.get(key);

  if (entry && (Date.now() - entry.timestamp) < L1_TTL) {
    cacheStats.l1Hits++;
    const latency = Date.now() - startTime;
    recordMetric('CACHE', 'L1_CACHE', latency, { hit: true });
    recordCacheEvent('l1', true);
    console.log(`✅ [L1 CACHE HIT] Key: ${key.substring(0, 8)}... (${cacheStats.l1Hits} total hits, ${latency}ms)`);
    return entry.result;
  }

  if (entry) {
    // Expired, remove it
    L1_CACHE.delete(key);
  }

  cacheStats.l1Misses++;
  recordCacheEvent('l1', false);
  return null;
}

/**
 * Set L1 cache entry
 */
function setL1Cache(key: string, result: QueryResult): void {
  // Evict oldest entries if cache is full
  if (L1_CACHE.size >= L1_MAX_SIZE) {
    const oldestKey = L1_CACHE.keys().next().value;
    L1_CACHE.delete(oldestKey);
  }

  L1_CACHE.set(key, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const l1Total = cacheStats.l1Hits + cacheStats.l1Misses;
  const l2Total = cacheStats.l2Hits + cacheStats.l2Misses;

  return {
    l1: {
      hits: cacheStats.l1Hits,
      misses: cacheStats.l1Misses,
      hitRate: l1Total > 0 ? ((cacheStats.l1Hits / l1Total) * 100).toFixed(2) + '%' : '0%',
      size: L1_CACHE.size,
      maxSize: L1_MAX_SIZE,
    },
    l2: {
      hits: cacheStats.l2Hits,
      misses: cacheStats.l2Misses,
      hitRate: l2Total > 0 ? ((cacheStats.l2Hits / l2Total) * 100).toFixed(2) + '%' : '0%',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANSWER TYPES THAT SHOULD NOT BE CACHED
// ═══════════════════════════════════════════════════════════════════════════════

const NON_CACHEABLE_TYPES = new Set([
  'DOC_COUNT',  // Always fetch fresh count
  'FILE_NAVIGATION',
  'FOLDER_NAVIGATION',
]);

export interface QueryOptions {
  query: string;
  userId: string;
  conversationId?: string;
  streamingCallback?: (chunk: string) => void;
}

export interface QueryResult {
  answer: string;
  answerType: string;
  language: string;
  documentReferences: Array<{ id: string; name: string; displayTitle?: string }>;
  metadata: {
    retrievalTime?: number;
    generationTime?: number;
    totalTime: number;
    tokensUsed?: number;
    model?: string;
    validationScore?: number;
  };
}

/**
 * Main entry point: Answer any query
 *
 * Performance targets:
 * - ULTRA_FAST_GREETING: < 50ms
 * - DOC_COUNT: < 500ms
 * - APP_HELP: < 1.5s
 * - CALCULATION: < 3s
 * - RAG queries: < 5s
 * - Cache hits: < 5ms
 */
export async function answerQuery(options: QueryOptions): Promise<QueryResult> {
  const startTime = Date.now();
  const { query, userId, conversationId, streamingCallback } = options;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🚀 [RAG] Query: "${query.substring(0, 50)}..."`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 0: Cache Check (L1 in-memory → L2 Redis)
  // Target: < 5ms for cache hit
  // ═══════════════════════════════════════════════════════════════════════════

  const cacheKey = generateCacheKey(query, userId);

  // Check L1 (in-memory) first - fastest
  const l1Cached = checkL1Cache(cacheKey);
  if (l1Cached && !streamingCallback) {
    console.log(`⚡ [CACHE] L1 hit in ${Date.now() - startTime}ms`);
    console.log(`${'═'.repeat(60)}\n`);
    return {
      ...l1Cached,
      metadata: {
        ...l1Cached.metadata,
        totalTime: Date.now() - startTime,
        cacheHit: 'L1',
      },
    };
  }

  // TODO: L2 Redis cache check would go here
  // const l2Cached = await checkL2Cache(cacheKey);
  // if (l2Cached && !streamingCallback) { ... }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Language & Intent Detection (< 10ms)
  // ═══════════════════════════════════════════════════════════════════════════

  const language = detectLanguage(query);
  const intent = await detectAnswerType({
    query,
    userId,
    conversationHistory: conversationId ? await getConversationHistory(conversationId) : [],
  });

  console.log(`🎯 [INTENT] ${intent.answerType} (confidence: ${(intent.confidence * 100).toFixed(0)}%)`);

  // Record query type for monitoring
  recordQueryType(intent.answerType);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Route to appropriate handler
  // ═══════════════════════════════════════════════════════════════════════════

  let result: QueryResult;

  switch (intent.answerType) {
    case 'ULTRA_FAST_GREETING':
      console.log(`⚡ [ROUTE] → Greeting handler`);
      result = await handleGreeting(query, language, startTime);
      break;

    case 'DOC_COUNT':
      console.log(`📊 [ROUTE] → Doc count handler`);
      result = await handleDocCount(userId, language, startTime);
      break;

    case 'FILE_NAVIGATION':
    case 'FOLDER_NAVIGATION':
      console.log(`📁 [ROUTE] → Navigation handler`);
      result = await handleNavigation(query, userId, intent, language, startTime);
      break;

    case 'APP_HELP':
      console.log(`❓ [ROUTE] → App help handler`);
      result = await handleAppHelp(query, language, startTime);
      break;

    case 'CALCULATION':
      console.log(`🧮 [ROUTE] → Calculation handler`);
      result = await handleCalculation(query, userId, intent, language, startTime, streamingCallback);
      break;

    case 'MEMORY':
    case 'SINGLE_DOC_RAG':
    case 'CROSS_DOC_RAG':
    case 'COMPLEX_ANALYSIS':
    case 'STANDARD_QUERY':
    default:
      console.log(`📚 [ROUTE] → RAG handler (${intent.answerType})`);
      result = await handleRAG(query, userId, conversationId, intent, language, startTime, streamingCallback);
      break;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Cache result (if cacheable)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!NON_CACHEABLE_TYPES.has(intent.answerType) && !streamingCallback) {
    setL1Cache(cacheKey, result);
    console.log(`💾 [CACHE] Stored in L1 (key: ${cacheKey.substring(0, 8)}...)`);
  }

  // Record total request metric for monitoring
  recordMetric('RAG', 'TOTAL_REQUEST', result.metadata.totalTime, {
    answerType: result.answerType,
    language: result.language,
    cacheHit: false,
  });

  console.log(`✅ [COMPLETE] ${result.metadata.totalTime}ms (type: ${result.answerType})`);
  console.log(`${'═'.repeat(60)}\n`);

  return result;
}

/**
 * Handle greeting (< 50ms)
 */
async function handleGreeting(query: string, language: string, startTime: number): Promise<QueryResult> {
  const greetings: Record<string, string> = {
    en: `Hello! I'm Koda, your AI assistant for document analysis. I can help you find information in your documents, answer questions, and analyze data.

What would you like to know?`,
    
    pt: `Olá! Sou o Koda, seu assistente de IA para análise de documentos. Posso ajudá-lo a encontrar informações nos seus documentos, responder perguntas e analisar dados.

O que gostaria de saber?`,

    es: `¡Hola! Soy Koda, tu asistente de IA para análisis de documentos. Puedo ayudarte a encontrar información en tus documentos, responder preguntas y analizar datos.

¿Qué te gustaría saber?`,
  };

  return {
    answer: greetings[language] || greetings.en,
    answerType: 'ULTRA_FAST_GREETING',
    language,
    documentReferences: [],
    metadata: {
      totalTime: Date.now() - startTime,
    },
  };
}

/**
 * Handle document count (< 500ms)
 */
async function handleDocCount(userId: string, language: string, startTime: number): Promise<QueryResult> {
  // TODO: Implement actual document count from database
  const count = await getDocumentCount(userId);

  const answers: Record<string, string> = {
    en: `You have **${count} documents** in your workspace.

Would you like to see a list of your documents or search for something specific?`,
    
    pt: `Você tem **${count} documentos** no seu workspace.

Gostaria de ver a lista dos seus documentos ou buscar algo específico?`,

    es: `Tienes **${count} documentos** en tu workspace.

¿Te gustaría ver la lista de tus documentos o buscar algo específico?`,
  };

  return {
    answer: answers[language] || answers.en,
    answerType: 'DOC_COUNT',
    language,
    documentReferences: [],
    metadata: {
      totalTime: Date.now() - startTime,
    },
  };
}

/**
 * Handle file/folder navigation (< 500ms)
 */
async function handleNavigation(
  query: string,
  userId: string,
  intent: IntentDetectionResult,
  language: string,
  startTime: number
): Promise<QueryResult> {
  // TODO: Import and use navigationOrchestrator
  // const { handleFileNavigation, handleFolderNavigation } = await import('./navigationOrchestrator.service');
  
  // Placeholder
  return {
    answer: 'Navigation handler not yet implemented',
    answerType: intent.answerType,
    language,
    documentReferences: [],
    metadata: {
      totalTime: Date.now() - startTime,
    },
  };
}

/**
 * Handle app help (< 1.5s)
 */
async function handleAppHelp(query: string, language: string, startTime: number): Promise<QueryResult> {
  // TODO: Import and use appHelpEngine
  // const { getAppHelp } = await import('./appHelpEngine.service');
  
  // Placeholder
  return {
    answer: 'App help handler not yet implemented',
    answerType: 'APP_HELP',
    language,
    documentReferences: [],
    metadata: {
      totalTime: Date.now() - startTime,
    },
  };
}

/**
 * Handle calculation (< 3s)
 */
async function handleCalculation(
  query: string,
  userId: string,
  intent: IntentDetectionResult,
  language: string,
  startTime: number,
  streamingCallback?: (chunk: string) => void
): Promise<QueryResult> {
  try {
    // Use the calculation engine to parse, compute, and explain the result
    const calcResult = await calculationEngine.handleCalculation(query, language, userId);

    // Stream the explanation if streaming is enabled
    if (streamingCallback && calcResult.explanation) {
      streamingCallback(calcResult.explanation);
    }

    return {
      answer: calcResult.explanation,
      answerType: 'CALCULATION',
      language,
      documentReferences: [],
      metadata: {
        totalTime: Date.now() - startTime,
        numericResult: calcResult.numericResult,
      },
    };
  } catch (error: any) {
    console.error('[handleCalculation] Error:', error);

    // Fallback: if calculation engine fails, fall back to RAG for complex calculations
    if (intent.requiresRetrieval) {
      console.log('[handleCalculation] Falling back to RAG for document-based calculation');
      return handleRAG(query, userId, undefined, intent, language, startTime, streamingCallback);
    }

    // Return error message
    const errorMessages: Record<string, string> = {
      en: `I couldn't perform this calculation. Please try rephrasing your question or provide the numbers directly.`,
      pt: `Não consegui realizar este cálculo. Por favor, tente reformular sua pergunta ou forneça os números diretamente.`,
      es: `No pude realizar este cálculo. Por favor, intenta reformular tu pregunta o proporciona los números directamente.`,
    };

    return {
      answer: errorMessages[language] || errorMessages.en,
      answerType: 'CALCULATION',
      language,
      documentReferences: [],
      metadata: {
        totalTime: Date.now() - startTime,
        error: error.message,
      },
    };
  }
}

/**
 * Handle RAG queries (1.5s - 5s)
 * Includes budget enforcement with fallback
 */
async function handleRAG(
  query: string,
  userId: string,
  conversationId: string | undefined,
  intent: IntentDetectionResult,
  language: string,
  startTime: number,
  streamingCallback?: (chunk: string) => void
): Promise<QueryResult> {

  // Get budget for this query type (with adaptive adjustment)
  const baseBudget = getBudgetForQueryType(intent.answerType);
  const adaptiveBudget = getAdaptiveBudget(`RAG_${intent.answerType}`, baseBudget);

  console.log(`⏱️ [BUDGET] ${intent.answerType}: ${adaptiveBudget}ms (base: ${baseBudget}ms)`);

  // Fallback response for timeout
  const fallbackResponse = (): QueryResult => {
    const fallbackAnswers: Record<string, string> = {
      en: `I'm taking longer than expected to process your question. Please try again with a more specific query, or try asking about a specific document.`,
      pt: `Estou demorando mais do que o esperado para processar sua pergunta. Por favor, tente novamente com uma consulta mais específica, ou pergunte sobre um documento específico.`,
      es: `Estoy tardando más de lo esperado en procesar tu pregunta. Por favor, inténtalo de nuevo con una consulta más específica, o pregunta sobre un documento específico.`,
    };

    return {
      answer: fallbackAnswers[language] || fallbackAnswers.en,
      answerType: 'TIMEOUT_FALLBACK',
      language,
      documentReferences: [],
      metadata: {
        totalTime: Date.now() - startTime,
        budgetExceeded: true,
      },
    };
  };

  // Execute RAG with budget enforcement (skip for streaming - can't timeout streams)
  if (!streamingCallback) {
    const budgetResult = await withBudget(
      () => executeRAG(query, userId, conversationId, intent, language, startTime, undefined),
      {
        targetLatency: adaptiveBudget,
        context: `RAG_${intent.answerType}`,
        onBudgetWarning: () => {
          console.warn(`⚠️ [RAG] Query approaching budget limit`);
        },
        onBudgetExceeded: async () => {
          console.error(`🔴 [RAG] Budget exceeded, using fallback`);
          return fallbackResponse();
        },
      }
    );

    if (budgetResult.success && budgetResult.result) {
      return budgetResult.result;
    }

    return fallbackResponse();
  }

  // Streaming queries - execute directly (can't enforce budget on streams)
  return executeRAG(query, userId, conversationId, intent, language, startTime, streamingCallback);
}

/**
 * Execute RAG pipeline (internal)
 */
async function executeRAG(
  query: string,
  userId: string,
  conversationId: string | undefined,
  intent: IntentDetectionResult,
  language: string,
  startTime: number,
  streamingCallback?: (chunk: string) => void
): Promise<QueryResult> {
  // Step 1: Retrieval (if needed)
  let retrievalResult: RetrievalResult | null = null;
  let retrievalTime = 0;

  if (intent.requiresRetrieval) {
    const retrievalEngine = new KodaRetrievalEngine();
    retrievalResult = await retrievalEngine.retrieve(query, userId, {
      topK: 10,
      method: 'auto',
      rerank: true,
    });
    retrievalTime = retrievalResult.retrievalTime;
  }

  // Step 2: Memory (if needed)
  let memoryContext = '';

  if (intent.requiresMemory && conversationId) {
    const memoryEngine = new KodaMemoryEngine();
    const memory = await memoryEngine.getRelevantMemory({
      conversationId,
      query,
      maxTokens: 2000,
    });
    memoryContext = memory.context;
  }

  // Step 3: Build context
  const context = await buildContext({
    query,
    memoryContext,
    retrievedChunks: retrievalResult?.chunks || [],
    answerType: intent.answerType,
    languageCode: language,
  });

  // Step 4: Generate answer
  const generated = await generateAdaptiveAnswer({
    query,
    context: context.finalContext,
    languageCode: language,
    answerType: intent.answerType,
    streamingCallback,
  });

  // Step 5: Format answer
  const documentMap = buildDocumentMap(retrievalResult?.chunks || []);
  const formatted = formatAnswer({
    rawAnswer: generated.text,
    documentMap,
    languageCode: language,
  });

  // Step 6: Validate answer
  const validation = validateAnswer({
    answer: formatted.text,
    query,
    context: context.finalContext,
    answerType: intent.answerType,
    languageCode: language,
    documentReferences: formatted.documentReferences,
  });

  // Step 7: Regenerate if needed (max 1 retry)
  let finalAnswer = formatted.text;
  let finalValidation = validation;

  if (validation.shouldRegenerate && !streamingCallback) {
    console.log(`[RAG] Regenerating due to validation issues (score: ${validation.score})`);

    const regenerated = await generateAdaptiveAnswer({
      query,
      context: context.finalContext,
      languageCode: language,
      answerType: intent.answerType,
    });

    const reformatted = formatAnswer({
      rawAnswer: regenerated.text,
      documentMap,
      languageCode: language,
    });

    finalAnswer = reformatted.text;

    finalValidation = validateAnswer({
      answer: reformatted.text,
      query,
      context: context.finalContext,
      answerType: intent.answerType,
      languageCode: language,
      documentReferences: reformatted.documentReferences,
    });
  }

  // Step 8: Apply 4-layer pipeline for final polish
  const pipelineResult = await applyAnswerPipeline(
    finalAnswer,
    query,
    intent.answerType,
    language,
    documentMap
  );
  finalAnswer = pipelineResult.text;

  const totalTime = Date.now() - startTime;

  return {
    answer: finalAnswer,
    answerType: intent.answerType,
    language,
    documentReferences: formatted.documentReferences,
    metadata: {
      retrievalTime,
      generationTime: generated.generationTime,
      totalTime,
      tokensUsed: generated.tokensUsed,
      model: generated.model,
      validationScore: finalValidation.score,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4-LAYER PIPELINE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map AnswerType to PrimaryIntent for 4-layer pipeline
 */
function mapToPrimaryIntent(answerType: string): PrimaryIntent {
  const mapping: Record<string, PrimaryIntent> = {
    'ULTRA_FAST_GREETING': 'meta',
    'DOC_COUNT': 'meta',
    'DOC_LIST': 'meta',
    'FILE_NAVIGATION': 'file_action',
    'FOLDER_NAVIGATION': 'navigation',
    'APP_HELP': 'onboarding',
    'CALCULATION': 'calculation',
    'SINGLE_DOC_RAG': 'single_doc_factual',
    'CROSS_DOC_RAG': 'multi_doc_comparison',
    'COMPLEX_ANALYSIS': 'multi_doc_comparison',
    'MEMORY': 'single_doc_factual',
    'STANDARD_QUERY': 'single_doc_factual',
  };
  return mapping[answerType] || 'single_doc_factual';
}

/**
 * Determine AnswerMode based on PrimaryIntent
 */
function determineAnswerMode(primaryIntent: PrimaryIntent): AnswerMode {
  const mapping: Record<PrimaryIntent, AnswerMode> = {
    'meta': 'bullet_list',
    'file_action': 'direct_short',
    'doc_search': 'bullet_list',
    'single_doc_factual': 'direct_short',
    'multi_doc_comparison': 'structured_sections',
    'calculation': 'structured_sections',
    'navigation': 'direct_short',
    'summary': 'explanatory',
    'onboarding': 'steps',
    'no_docs_help': 'steps',
    'edge': 'direct_short',
  };
  return mapping[primaryIntent] || 'direct_short';
}

/**
 * Map language code to pipeline Language type
 */
function mapToLanguage(langCode: string): Language {
  const code = langCode.toLowerCase().substring(0, 2);
  if (code === 'pt') return 'pt';
  if (code === 'es') return 'es';
  if (code === 'fr') return 'fr';
  return 'en';
}

/**
 * Convert document map to Source array for pipeline
 */
function mapToSources(documentMap: Map<string, any>): Array<{ documentId: string; filename?: string; documentName?: string; title?: string; mimeType?: string }> {
  return Array.from(documentMap.values()).map(doc => ({
    documentId: doc.id,
    filename: doc.name,
    documentName: doc.name,
    title: doc.displayTitle,
    mimeType: doc.mimeType,
  }));
}

/**
 * Map centralized QueryIntent to PrimaryIntent
 */
function mapCentralizedToPrimaryIntent(intent: CentralizedIntent): PrimaryIntent {
  const mapping: Record<string, PrimaryIntent> = {
    'GREETING': 'meta',
    'COUNT_DOCUMENTS': 'meta',
    'LIST_DOCUMENTS': 'meta',
    'OPEN_DOCUMENT': 'file_action',
    'DELETE_DOCUMENT': 'file_action',
    'SEARCH_DOCUMENTS': 'doc_search',
    'FACTUAL_QUESTION': 'single_doc_factual',
    'COMPARISON_QUESTION': 'multi_doc_comparison',
    'SYNTHESIS_QUESTION': 'multi_doc_comparison',
    'ANALYTICAL_QUESTION': 'multi_doc_comparison',
    'CALCULATION': 'calculation',
    'FINANCIAL_ANALYSIS': 'calculation',
    'DATA_ANALYSIS': 'calculation',
    'NAVIGATE_TO_SECTION': 'navigation',
    'FIND_IN_DOCUMENT': 'navigation',
    'GENERATE_DOCUMENT': 'summary',
    'GENERATE_SUMMARY': 'summary',
    'GENERATE_REPORT': 'summary',
    'HELP': 'onboarding',
    'ONBOARDING': 'onboarding',
    'UNKNOWN': 'edge',
  };
  return mapping[intent] || 'single_doc_factual';
}

/**
 * Apply 4-layer pipeline to format answer
 * Uses centralized pattern system for enhanced detection
 */
async function applyAnswerPipeline(
  rawAnswer: string,
  query: string,
  answerType: string,
  language: string,
  documentMap: Map<string, any>
): Promise<{ text: string; pipelineResult?: any }> {
  try {
    // Use centralized pattern matcher for enhanced detection
    const centralizedLanguage = centralizedPatternMatcher.detectLanguage(query);
    const centralizedIntent = centralizedPatternMatcher.detectIntent(query, centralizedLanguage);

    // Prefer centralized detection if confidence is high, otherwise fall back to answerType mapping
    let primaryIntent: PrimaryIntent;
    if (centralizedIntent.confidence >= 0.7) {
      primaryIntent = mapCentralizedToPrimaryIntent(centralizedIntent.intent);
      console.log(`[Pipeline] Using centralized intent: ${centralizedIntent.intent} (confidence: ${centralizedIntent.confidence.toFixed(2)})`);
    } else {
      primaryIntent = mapToPrimaryIntent(answerType);
      console.log(`[Pipeline] Using mapped intent: ${primaryIntent} (centralized confidence too low: ${centralizedIntent.confidence.toFixed(2)})`);
    }

    const answerMode = determineAnswerMode(primaryIntent);
    const lang = mapToLanguage(centralizedLanguage || language);
    const sources = mapToSources(documentMap);

    const result = await kodaAnswerPipeline.processAnswer({
      rawAnswer,
      query,
      primaryIntent,
      answerMode,
      language: lang,
      sources,
      options: {
        addDocumentsUsedSection: false, // Already handled by existing formatter
        skipValidation: primaryIntent === 'meta', // Skip validation for meta queries
      },
    });

    console.log(`[Pipeline] Processed in ${result.totalTimeMs}ms (structure: ${result.structure.structureScore}, validation: ${result.validation?.score || 'skipped'})`);

    return {
      text: result.finalAnswer,
      pipelineResult: result,
    };
  } catch (error) {
    console.error('[Pipeline] Error, falling back to raw answer:', error);
    return { text: rawAnswer };
  }
}

/**
 * Build document map from chunks
 */
function buildDocumentMap(chunks: any[]): Map<string, { id: string; name: string; displayTitle?: string; mimeType?: string; size?: number; folderPath?: string }> {
  const map = new Map();

  chunks.forEach(chunk => {
    if (!map.has(chunk.documentId)) {
      map.set(chunk.documentId, {
        id: chunk.documentId,
        name: chunk.documentName || chunk.metadata?.filename || 'Document',
        displayTitle: chunk.metadata?.displayTitle,
        mimeType: chunk.metadata?.mimeType || chunk.mimeType || 'application/octet-stream',
        size: chunk.metadata?.fileSize || chunk.fileSize,
        folderPath: chunk.metadata?.folderPath || chunk.folderPath || '',
      });
    }
  });

  return map;
}

/**
 * Get conversation history (placeholder)
 */
async function getConversationHistory(conversationId: string): Promise<any[]> {
  // TODO: Implement actual history retrieval
  return [];
}

/**
 * Get document count from database
 */
async function getDocumentCount(userId: string): Promise<number> {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const count = await prisma.document.count({
      where: {
        userId,
        status: 'completed'
      }
    });
    return count;
  } catch (error) {
    console.error('[getDocumentCount] Error:', error);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}
