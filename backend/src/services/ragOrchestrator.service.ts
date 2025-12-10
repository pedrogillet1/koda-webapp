/**
 * RAG Orchestrator - Main Entry Point for All Queries
 * 
 * Replaces: rag.service.ts (10,824 lines → 300 lines)
 * 
 * This is the ONLY public API for answering queries.
 * All other services are internal implementation details.
 * 
 * Flow:
 * 1. Detect intent & answer type
 * 2. Route to appropriate handler
 * 3. Return formatted answer with streaming support
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
 */
export async function answerQuery(options: QueryOptions): Promise<QueryResult> {
  const startTime = Date.now();
  const { query, userId, conversationId, streamingCallback } = options;

  // Phase 1: Language & Intent Detection (< 10ms)
  const language = detectLanguage(query);
  const intent = await detectAnswerType({
    query,
    userId,
    conversationHistory: conversationId ? await getConversationHistory(conversationId) : [],
  });

  console.log(`[RAG] Query: "${query}" | Type: ${intent.answerType} | Lang: ${language}`);

  // Phase 2: Route to appropriate handler
  let result: QueryResult;

  switch (intent.answerType) {
    case 'ULTRA_FAST_GREETING':
      result = await handleGreeting(query, language, startTime);
      break;

    case 'DOC_COUNT':
      result = await handleDocCount(userId, language, startTime);
      break;

    case 'FILE_NAVIGATION':
    case 'FOLDER_NAVIGATION':
      result = await handleNavigation(query, userId, intent, language, startTime);
      break;

    case 'APP_HELP':
      result = await handleAppHelp(query, language, startTime);
      break;

    case 'CALCULATION':
      result = await handleCalculation(query, userId, intent, language, startTime, streamingCallback);
      break;

    case 'MEMORY':
    case 'SINGLE_DOC_RAG':
    case 'CROSS_DOC_RAG':
    case 'COMPLEX_ANALYSIS':
    case 'STANDARD_QUERY':
    default:
      result = await handleRAG(query, userId, conversationId, intent, language, startTime, streamingCallback);
      break;
  }

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
  // TODO: Import and use calculationEngine
  // const { calculate } = await import('./calculationEngine.service');
  
  // Placeholder
  return {
    answer: 'Calculation handler not yet implemented',
    answerType: 'CALCULATION',
    language,
    documentReferences: [],
    metadata: {
      totalTime: Date.now() - startTime,
    },
  };
}

/**
 * Handle RAG queries (1.5s - 5s)
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

/**
 * Build document map from chunks
 */
function buildDocumentMap(chunks: any[]): Map<string, { id: string; name: string; displayTitle?: string }> {
  const map = new Map();
  
  chunks.forEach(chunk => {
    if (!map.has(chunk.documentId)) {
      map.set(chunk.documentId, {
        id: chunk.documentId,
        name: chunk.documentName,
        displayTitle: chunk.metadata?.displayTitle,
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
 * Get document count (placeholder)
 */
async function getDocumentCount(userId: string): Promise<number> {
  // TODO: Implement actual document count
  return 0;
}
