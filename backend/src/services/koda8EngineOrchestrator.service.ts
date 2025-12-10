/**
 * ============================================================================
 * KODA 8-ENGINE ORCHESTRATOR - MAIN PIPELINE
 * ============================================================================
 *
 * This is the main orchestrator that coordinates all 8 engines.
 *
 * PIPELINE:
 * 1. Intent Engine → Detect intent, skill, complexity
 * 2. Memory Engine → Load conversation context, resolve references
 * 3. Retrieval Engine → Retrieve relevant chunks
 * 4. Context Engine → Build optimized prompt
 * 5. Answer Engine → Generate answer
 * 6. Format Engine → Format answer beautifully
 * 7. Quality Engine → Verify answer quality
 * 8. Fallback Engine → Handle errors gracefully
 *
 * @version 2.0.0
 * @date 2025-12-08
 */

import KodaIntentEngine, { IntentAnalysis, QueryIntent, SkillType, QueryComplexity } from './kodaIntentEngine.service';
import { getConversationMemory, KodaMemory } from './kodaMemoryEngine.service';
import KodaRetrievalEngine from './kodaRetrievalEngine.service';
import { buildContext, BuiltContext } from './kodaContextEngine.service';
import { generateAnswer, AnswerResult } from './kodaAnswerEngine.service';
import { formatAnswer, formatDocumentList, formatGreeting, FormattedAnswer } from './kodaFormatEngine.service';
import { checkQuality, QualityCheckResult } from './kodaQualityEngine.service';
import { generateFallback, needsFallback, FallbackResult } from './kodaFallbackEngine.service';
// ✅ CENTRALIZED LANGUAGE SERVICE - Single source of truth for language detection
import {
  detectLanguage,
  loadConversationLanguage,
  updateConversationLanguage,
  getLanguageSystemPrompt,
  type SupportedLanguage,
} from './kodaLanguage.service';

// Initialize Engines
const intentEngine = new KodaIntentEngine();
const retrievalEngine = new KodaRetrievalEngine();

export interface QueryOptions {
  query: string;
  userId: string;
  conversationId: string;
  documents?: any[];
}

export interface QueryResult {
  answer: string;
  sources: any[];
  metadata: {
    intent: string;
    skill: string;
    retrievalTime: number;
    generationTime: number;
    totalTime: number;
    fastPath: boolean;
    qualityScore?: number;
    tokenCount?: number;
  };
}

// Document list state for reference resolution
const documentListState = new Map<string, {
  documentList: string[];
  timestamp: number;
}>();

export function saveDocumentList(conversationId: string, documents: string[]): void {
  documentListState.set(conversationId, {
    documentList: documents,
    timestamp: Date.now(),
  });
}

export function getDocumentList(conversationId: string): string[] | null {
  const state = documentListState.get(conversationId);
  if (!state) return null;

  // Expire after 10 minutes
  if (Date.now() - state.timestamp > 600000) {
    documentListState.delete(conversationId);
    return null;
  }

  return state.documentList;
}

/**
 * Resolve document reference like "the first one", "the second document"
 */
export function resolveDocumentReference(
  query: string,
  conversationId: string
): string | null {
  const queryLower = query.toLowerCase();
  const docList = getDocumentList(conversationId);

  if (!docList || docList.length === 0) return null;

  // "primeiro" / "first"
  if (queryLower.match(/primeiro|first|1º|1st/)) {
    return docList[0];
  }

  // "segundo" / "second"
  if (queryLower.match(/segundo|second|2º|2nd/)) {
    return docList[1] || null;
  }

  // "terceiro" / "third"
  if (queryLower.match(/terceiro|third|3º|3rd/)) {
    return docList[2] || null;
  }

  // "último" / "last"
  if (queryLower.match(/último|last/)) {
    return docList[docList.length - 1];
  }

  return null;
}

/**
 * Check if query is eligible for fast-path processing
 */
function isFastPathEligible(query: string): boolean {
  const queryLower = query.toLowerCase().trim();

  // Greetings
  const greetings = ['olá', 'oi', 'hello', 'hi', 'hey', 'bom dia', 'boa tarde', 'boa noite'];
  if (greetings.some(g => queryLower === g || queryLower.startsWith(g + ' ') || queryLower.startsWith(g + '!'))) {
    return true;
  }

  // Document count
  if (queryLower.match(/quantos documentos|how many documents|count.*documents/)) return true;

  // Document list
  if (queryLower.match(/liste (meus )?documentos|list (my )?documents|mostre.*documentos|show.*documents/)) return true;

  return false;
}

/**
 * Handle fast-path queries without full RAG pipeline
 */
async function handleFastPath(
  query: string,
  conversationId: string,
  userId: string,
  documents: any[],
  startTime: number
): Promise<QueryResult> {
  const queryLower = query.toLowerCase();

  // ✅ Use centralized language detection with conversation context
  const langResult = await detectLanguage(query, conversationId);
  const language = langResult.language;
  console.log(`🌍 [FAST-PATH] Language: ${language} (source: ${langResult.source}, confidence: ${langResult.confidence.toFixed(2)})`);

  let answer = '';

  // Handle greetings
  if (queryLower.match(/olá|oi|hello|hi|hey|bom dia|boa tarde|boa noite/)) {
    answer = formatGreeting(language);
  }
  // Handle document count
  else if (queryLower.match(/quantos documentos|how many documents/)) {
    const count = documents?.length || 0;
    answer = language === 'pt-BR'
      ? `Você tem **${count}** documento(s) carregado(s).`
      : `You have **${count}** document(s) uploaded.`;
  }
  // Handle document list
  else if (queryLower.match(/liste.*documentos|list.*documents|mostre.*documentos|show.*documents/)) {
    answer = formatDocumentList(documents || [], language);

    // Save document list for future reference resolution
    if (documents && documents.length > 0) {
      const docNames = documents.map(d => d.name || d.fileName || d.originalName || 'Unnamed');
      saveDocumentList(conversationId, docNames);
    }
  }

  return {
    answer,
    sources: [],
    metadata: {
      intent: 'fast_path',
      skill: 'greeting',
      retrievalTime: 0,
      generationTime: 0,
      totalTime: Date.now() - startTime,
      fastPath: true,
    },
  };
}

/**
 * Main query processing pipeline
 */
export async function processQuery(options: QueryOptions): Promise<QueryResult> {
  const startTime = Date.now();
  const { query, userId, conversationId, documents } = options;

  console.log(`🎯 [ORCHESTRATOR] Processing query: "${query.slice(0, 50)}..."`);

  try {
    // STEP 0: Fast-path check
    if (isFastPathEligible(query)) {
      console.log(`⚡ [ORCHESTRATOR] Fast-path eligible`);
      return await handleFastPath(query, conversationId, userId, documents || [], startTime);
    }

    // STEP 0.5: Centralized Language Detection (with conversation context)
    const langResult = await detectLanguage(query, conversationId);
    const conversationLanguage = langResult.language;
    console.log(`🌍 [ORCHESTRATOR] Language: ${conversationLanguage} (source: ${langResult.source}, confidence: ${langResult.confidence.toFixed(2)})`);

    // STEP 1: Intent Engine
    console.log(`🧠 [ORCHESTRATOR] Step 1: Analyzing intent...`);
    const intentAnalysis = await intentEngine.analyzeQuery(query, null, userId);
    // Override intent language with centralized language detection
    intentAnalysis.language = conversationLanguage;

    console.log(`   Intent: ${intentAnalysis.intent}, Skill: ${intentAnalysis.skill}, Complexity: ${intentAnalysis.complexity}`);

    // Check for document reference resolution
    const documentRef = resolveDocumentReference(query, conversationId);
    if (documentRef) {
      console.log(`   Resolved document reference: ${documentRef}`);
    }

    // STEP 2: Memory Engine
    console.log(`🧠 [ORCHESTRATOR] Step 2: Loading memory...`);
    let memoryContext: KodaMemory;
    try {
      memoryContext = await getConversationMemory(conversationId, userId);
    } catch (e) {
      console.log(`   Memory unavailable, using empty context`);
      memoryContext = {
        shortTermBuffer: [],
        rollingSummary: '',
        conversationState: null,
        infiniteMemorySnippets: [],
        formattedContext: '',
        totalMessages: 0,
        lastMessageAt: null,
        language: 'pt',  // Default to Portuguese
        languageInstruction: 'Responda sempre em português brasileiro.',
      };
    }

    // STEP 3: Retrieval Engine
    console.log(`🔍 [ORCHESTRATOR] Step 3: Retrieving chunks...`);
    const retrievalStart = Date.now();
    let retrievalResult: { chunks: any[] } = { chunks: [] };

    if (intentAnalysis.requiresRetrieval) {
      try {
        const result = await retrievalEngine.retrieve(
          query,
          userId,
          {
            topK: 10,
            skill: intentAnalysis.skill,
            filters: documentRef ? { documentIds: [documentRef] } : undefined,
          }
        );
        retrievalResult = { chunks: result.chunks };
        console.log(`   Retrieved ${result.chunks.length} chunks`);
      } catch (e) {
        console.log(`   Retrieval failed, continuing without chunks`);
      }
    }
    const retrievalTime = Date.now() - retrievalStart;

    // STEP 4: Context Engine
    console.log(`📝 [ORCHESTRATOR] Step 4: Building context...`);
    const context = await buildContext({
      query,
      retrievedChunks: retrievalResult.chunks,
      conversationHistory: memoryContext.shortTermBuffer,
      entities: {},
      skill: intentAnalysis.skill,
      language: intentAnalysis.language,
    });
    console.log(`   Context: ${context.tokenCount} tokens, ${context.includedChunks} chunks`);

    // STEP 5: Answer Engine
    console.log(`💬 [ORCHESTRATOR] Step 5: Generating answer...`);
    const generationStart = Date.now();
    const answerResult = await generateAnswer({
      prompt: context.prompt,
      skill: intentAnalysis.skill,
    });
    const generationTime = Date.now() - generationStart;
    console.log(`   Generated in ${generationTime}ms using ${answerResult.model}`);

    // STEP 6: Format Engine
    console.log(`✨ [ORCHESTRATOR] Step 6: Formatting answer...`);
    const formatted = formatAnswer({
      content: answerResult.content,
      language: intentAnalysis.language,
      sources: retrievalResult.chunks,
    });

    // STEP 7: Quality Engine
    console.log(`✅ [ORCHESTRATOR] Step 7: Checking quality...`);
    const qualityCheck = await checkQuality({
      answer: formatted.content,
      query,
      retrievedChunks: retrievalResult.chunks,
      sources: retrievalResult.chunks,
    });
    console.log(`   Quality score: ${qualityCheck.score}, Passed: ${qualityCheck.passed}`);

    // STEP 8: Fallback Engine (if quality check fails)
    if (!qualityCheck.passed || needsFallback(formatted.content)) {
      console.log(`⚠️ [ORCHESTRATOR] Step 8: Generating fallback...`);
      const fallback = generateFallback({
        query,
        language: intentAnalysis.language,
        errorType: 'empty',
      });

      return {
        answer: fallback.message,
        sources: [],
        metadata: {
          intent: intentAnalysis.intent,
          skill: intentAnalysis.skill,
          retrievalTime,
          generationTime,
          totalTime: Date.now() - startTime,
          fastPath: false,
          qualityScore: qualityCheck.score,
        },
      };
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [ORCHESTRATOR] Complete in ${totalTime}ms`);

    return {
      answer: formatted.content,
      sources: retrievalResult.chunks,
      metadata: {
        intent: intentAnalysis.intent,
        skill: intentAnalysis.skill,
        retrievalTime,
        generationTime,
        totalTime,
        fastPath: false,
        qualityScore: qualityCheck.score,
        tokenCount: context.tokenCount,
      },
    };

  } catch (error) {
    // STEP 8: Fallback Engine (on error)
    console.error(`❌ [ORCHESTRATOR] Error:`, error);

    const fallback = generateFallback({
      error: error as Error,
      query,
      language: 'pt-BR',
    });

    return {
      answer: fallback.message,
      sources: [],
      metadata: {
        intent: 'unknown',
        skill: 'unknown',
        retrievalTime: 0,
        generationTime: 0,
        totalTime: Date.now() - startTime,
        fastPath: false,
      },
    };
  }
}

// Export for integration
export default {
  processQuery,
  saveDocumentList,
  getDocumentList,
  resolveDocumentReference,
  isFastPathEligible,
};
