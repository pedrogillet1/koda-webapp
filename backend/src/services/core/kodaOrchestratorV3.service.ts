/**
 * KODA V3 Orchestrator Service
 *
 * Central traffic cop for all intents
 * Handles ALL 25 intent types with proper routing
 *
 * Based on: pasted_content_21.txt Layer 5 and pasted_content_22.txt Section 2 specifications
 */

import { KodaIntentEngineV3 } from './kodaIntentEngineV3.service';
import { FallbackConfigService } from './fallbackConfig.service';
import { KodaProductHelpServiceV3 } from './kodaProductHelpV3.service';
import { KodaFormattingPipelineV3Service } from './kodaFormattingPipelineV3.service';
import KodaRetrievalEngineV3 from './kodaRetrievalEngineV3.service';
import KodaAnswerEngineV3 from './kodaAnswerEngineV3.service';
import prisma from '../../config/database';

// Multi-intent and override services - TYPES ONLY for DI
// NOTE: Instances are injected via container.ts, NOT imported as singletons
import { MultiIntentService } from './multiIntent.service';
import { OverrideService } from './override.service';

// Service types for DI - these are injected via container.ts
import { UserPreferencesService } from '../user/userPreferences.service';
import { ConversationMemoryService } from '../memory/conversationMemory.service';
import { FeedbackLoggerService } from '../analytics/feedbackLogger.service';
import { AnalyticsEngineService } from '../analytics/analyticsEngine.service';
import { DocumentSearchService } from '../analytics/documentSearch.service';
import {
  IntentName,
  LanguageCode,
  PredictedIntent,
  IntentHandlerResponse,
} from '../../types/intentV3.types';

import {
  IntentDomain,
  QuestionType,
  QueryScope,
} from '../../types/ragV3.types';

import type {
  IntentClassificationV3,
  DocumentTarget,
} from '../../types/ragV3.types';

import type {
  StreamEvent,
  ContentEvent,
  StreamingResult,
  StreamGenerator,
} from '../../types/streaming.types';

// ============================================================================
// INTENT TYPE ADAPTER
// ============================================================================

/**
 * Convert PredictedIntent (from intent engine) to IntentClassificationV3 (for RAG services)
 * This bridges the gap between the lightweight intent classification and the full RAG type.
 */
function adaptPredictedIntent(predicted: PredictedIntent, request: OrchestratorRequest): IntentClassificationV3 {
  const intent = predicted.primaryIntent;

  // Determine domain based on intent (using enum values)
  const getDomain = (): IntentDomain => {
    if (intent.startsWith('DOC_')) return IntentDomain.DOCUMENTS;
    if (intent.startsWith('PRODUCT_')) return IntentDomain.PRODUCT;
    if (intent.startsWith('ONBOARDING_')) return IntentDomain.ONBOARDING;
    if (intent === 'CHITCHAT') return IntentDomain.CHITCHAT;
    return IntentDomain.GENERAL; // Default for general queries
  };

  // Determine question type based on intent (using enum values)
  const getQuestionType = (): QuestionType => {
    switch (intent) {
      case 'DOC_QA': return QuestionType.OTHER;
      case 'DOC_ANALYTICS': return QuestionType.LIST;
      case 'DOC_SUMMARIZE': return QuestionType.SUMMARY;
      case 'DOC_SEARCH': return QuestionType.LIST;
      case 'REASONING_TASK': return QuestionType.WHY;
      case 'TEXT_TRANSFORM': return QuestionType.EXTRACT;
      default: return QuestionType.OTHER;
    }
  };

  // Determine scope based on context (using enum values)
  const getScope = (): QueryScope => {
    if (request.context?.attachedDocumentIds?.length === 1) return QueryScope.SINGLE_DOC;
    if (request.context?.attachedDocumentIds?.length > 1) return QueryScope.MULTI_DOC;
    return QueryScope.ALL_DOCS;
  };

  // Determine document target (returns interface object)
  const getTarget = (): DocumentTarget => {
    if (request.context?.attachedDocumentIds?.length > 0) {
      return {
        type: 'BY_ID',
        documentIds: request.context.attachedDocumentIds,
      };
    }
    return { type: 'NONE' };
  };

  // Determine if RAG is required
  const requiresRAG = [
    'DOC_QA', 'DOC_ANALYTICS', 'DOC_SEARCH', 'DOC_SUMMARIZE', 'DOC_MANAGEMENT'
  ].includes(intent);

  // Determine if product help is required
  const requiresProductHelp = ['PRODUCT_HELP', 'ONBOARDING_HELP', 'FEATURE_REQUEST'].includes(intent);

  return {
    primaryIntent: intent,
    domain: getDomain(),
    questionType: getQuestionType(),
    scope: getScope(),
    language: predicted.language,
    requiresRAG,
    requiresProductHelp,
    target: getTarget(),
    documentTargets: request.context?.attachedDocumentIds || [],
    rawQuery: request.text,
    confidence: predicted.confidence,
    matchedPattern: predicted.matchedPattern,
    matchedKeywords: predicted.matchedKeywords,
    metadata: {
      queryLength: request.text.length,
      hasContext: !!request.context,
      classificationTimeMs: 0, // Not tracked at this level
    },
  };
}

export interface OrchestratorRequest {
  text: string;
  userId: string;
  conversationId?: string;
  language?: LanguageCode;
  context?: any;
}

// Handler context type
interface HandlerContext {
  request: OrchestratorRequest;
  intent: PredictedIntent;
  language: LanguageCode;
}

export class KodaOrchestratorV3 {
  // Core services - REQUIRED
  private readonly intentEngine: KodaIntentEngineV3;
  private readonly fallbackConfig: FallbackConfigService;
  private readonly productHelp: KodaProductHelpServiceV3;
  private readonly formattingPipeline: KodaFormattingPipelineV3Service;
  private readonly retrievalEngine: KodaRetrievalEngineV3;
  private readonly answerEngine: KodaAnswerEngineV3;

  // Multi-intent and override services - REQUIRED (from container.ts DI)
  private readonly multiIntent: MultiIntentService;
  private readonly override: OverrideService;

  // Analytics & utility services - REQUIRED (from container.ts DI)
  private readonly documentSearch: DocumentSearchService;
  private readonly userPreferences: UserPreferencesService;
  private readonly conversationMemory: ConversationMemoryService;
  private readonly feedbackLogger: FeedbackLoggerService;
  private readonly analyticsEngine: AnalyticsEngineService;

  // Logger
  private readonly logger: Console;

  constructor(
    services: {
      // Core RAG services - ALL REQUIRED
      intentEngine: KodaIntentEngineV3;
      fallbackConfig: FallbackConfigService;
      productHelp: KodaProductHelpServiceV3;
      formattingPipeline: KodaFormattingPipelineV3Service;
      retrievalEngine: KodaRetrievalEngineV3;
      answerEngine: KodaAnswerEngineV3;
      // Multi-intent and override services - ALL REQUIRED
      multiIntent: MultiIntentService;
      override: OverrideService;
      // Analytics & utility services - ALL REQUIRED
      documentSearch: DocumentSearchService;
      userPreferences: UserPreferencesService;
      conversationMemory: ConversationMemoryService;
      feedbackLogger: FeedbackLoggerService;
      analyticsEngine: AnalyticsEngineService;
    },
    logger?: Console
  ) {
    // CRITICAL: ALL services MUST be provided (fail-fast pattern)
    // No optional services - container.ts guarantees all are provided
    if (!services.intentEngine) throw new Error('[Orchestrator] intentEngine is REQUIRED');
    if (!services.fallbackConfig) throw new Error('[Orchestrator] fallbackConfig is REQUIRED');
    if (!services.productHelp) throw new Error('[Orchestrator] productHelp is REQUIRED');
    if (!services.formattingPipeline) throw new Error('[Orchestrator] formattingPipeline is REQUIRED');
    if (!services.retrievalEngine) throw new Error('[Orchestrator] retrievalEngine is REQUIRED');
    if (!services.answerEngine) throw new Error('[Orchestrator] answerEngine is REQUIRED');
    if (!services.multiIntent) throw new Error('[Orchestrator] multiIntent is REQUIRED');
    if (!services.override) throw new Error('[Orchestrator] override is REQUIRED');
    if (!services.documentSearch) throw new Error('[Orchestrator] documentSearch is REQUIRED');
    if (!services.userPreferences) throw new Error('[Orchestrator] userPreferences is REQUIRED');
    if (!services.conversationMemory) throw new Error('[Orchestrator] conversationMemory is REQUIRED');
    if (!services.feedbackLogger) throw new Error('[Orchestrator] feedbackLogger is REQUIRED');
    if (!services.analyticsEngine) throw new Error('[Orchestrator] analyticsEngine is REQUIRED');

    // Assign all services (no optional chains needed - all guaranteed)
    this.intentEngine = services.intentEngine;
    this.fallbackConfig = services.fallbackConfig;
    this.productHelp = services.productHelp;
    this.formattingPipeline = services.formattingPipeline;
    this.retrievalEngine = services.retrievalEngine;
    this.answerEngine = services.answerEngine;
    this.multiIntent = services.multiIntent;
    this.override = services.override;
    this.documentSearch = services.documentSearch;
    this.userPreferences = services.userPreferences;
    this.conversationMemory = services.conversationMemory;
    this.feedbackLogger = services.feedbackLogger;
    this.analyticsEngine = services.analyticsEngine;
    this.logger = logger || console;
  }

  /**
   * Main orchestration entry point
   * Routes request to appropriate handler based on intent
   *
   * Flow:
   * 1. Classify intent
   * 2. Detect multi-intent (if multiple segments, process sequentially)
   * 3. Apply override rules based on workspace context
   * 4. Route to appropriate handler
   */
  async orchestrate(request: OrchestratorRequest): Promise<IntentHandlerResponse> {
    const startTime = Date.now();

    try {
      // 1. Classify primary intent
      const intent = await this.intentEngine.predict({
        text: request.text,
        language: request.language,
        context: request.context,
      });

      this.logger.info(
        `[Orchestrator] userId=${request.userId} intent=${intent.primaryIntent} confidence=${intent.confidence.toFixed(2)}`
      );

      // 2. Multi-intent detection (using injected service)
      const multiIntentResult = this.multiIntent.detect(request.text);
      if (multiIntentResult.isMultiIntent && multiIntentResult.segments.length > 1) {
        this.logger.info(
          `[Orchestrator] Multi-intent detected: ${multiIntentResult.segments.length} segments`
        );
        // Process segments sequentially and combine responses
        return this.processMultiIntentSequentially(request, multiIntentResult.segments, startTime);
      }

      // 3. Get workspace stats for override rules
      const docCount = await this.getDocumentCount(request.userId);
      const workspaceStats = { docCount };

      // 4. Apply override rules (e.g., no docs + help query → PRODUCT_HELP)
      const adaptedIntent = adaptPredictedIntent(intent, request);
      const overriddenIntent = await this.override.override({
        intent: adaptedIntent,
        userId: request.userId,
        query: request.text,
        workspaceStats,
      });

      // Log if override was applied
      if (overriddenIntent.overrideReason) {
        this.logger.info(
          `[Orchestrator] Override applied: ${intent.primaryIntent} → ${overriddenIntent.primaryIntent} (${overriddenIntent.overrideReason})`
        );
      }

      // 5. Create PredictedIntent from overridden intent for routing
      const finalIntent: PredictedIntent = {
        ...intent,
        primaryIntent: overriddenIntent.primaryIntent as any,
        confidence: overriddenIntent.confidence,
      };

      // 6. Route to appropriate handler based on (possibly overridden) intent
      const response = await this.routeIntent(request, finalIntent);

      // 7. Add metadata
      response.metadata = {
        ...response.metadata,
        intent: finalIntent.primaryIntent,
        confidence: finalIntent.confidence,
        processingTime: Date.now() - startTime,
        overrideApplied: !!overriddenIntent.overrideReason,
      };

      return response;

    } catch (error) {
      this.logger.error('[Orchestrator] Error processing request:', error);
      return this.buildErrorResponse(request, error);
    }
  }

  /**
   * Process multiple intent segments sequentially.
   * IMPORTANT: Calls routeIntent directly per segment to avoid recursion.
   */
  private async processMultiIntentSequentially(
    request: OrchestratorRequest,
    segments: string[],
    startTime: number
  ): Promise<IntentHandlerResponse> {
    const responses: string[] = [];
    let lastIntent: PredictedIntent | null = null;

    for (const segment of segments) {
      // Classify each segment
      const segmentIntent = await this.intentEngine.predict({
        text: segment,
        language: request.language,
        context: request.context,
      });

      lastIntent = segmentIntent;

      // Create segment request
      const segmentRequest: OrchestratorRequest = {
        ...request,
        text: segment,
      };

      // Route directly (no recursion into orchestrate)
      const segmentResponse = await this.routeIntent(segmentRequest, segmentIntent);
      responses.push(segmentResponse.answer);
    }

    // Combine responses with separator
    const combinedAnswer = responses.join('\n\n---\n\n');

    return {
      answer: combinedAnswer,
      formatted: combinedAnswer,
      metadata: {
        intent: lastIntent?.primaryIntent || 'MULTI_INTENT',
        confidence: lastIntent?.confidence || 0,
        processingTime: Date.now() - startTime,
        multiIntent: true,
        segmentCount: segments.length,
      },
    };
  }

  /**
   * Get document count for user (for override rules).
   */
  private async getDocumentCount(userId: string): Promise<number> {
    try {
      return await prisma.document.count({
        where: {
          userId,
          status: 'completed',
        },
      });
    } catch (error) {
      this.logger.error('[Orchestrator] Error getting document count:', error);
      return 0;
    }
  }

  /**
   * TRUE STREAMING orchestration entry point.
   * Yields StreamEvent chunks in real-time as they arrive from LLM.
   *
   * TTFT (Time To First Token) should be <300-800ms.
   *
   * Flow:
   * 1. Classify intent
   * 2. Log multi-intent if detected (skip processing for streaming)
   * 3. Apply override rules
   * 4. Route to streaming handler
   */
  async *orchestrateStream(request: OrchestratorRequest): StreamGenerator {
    const startTime = Date.now();

    try {
      // Step 1: Classify intent (fast, non-streaming)
      const intent = await this.intentEngine.predict({
        text: request.text,
        language: request.language,
        context: request.context,
      });

      const language = intent.language || request.language || 'en';

      this.logger.info(
        `[Orchestrator] STREAMING userId=${request.userId} intent=${intent.primaryIntent} confidence=${intent.confidence.toFixed(2)}`
      );

      // Step 2: Multi-intent detection (log only for streaming, use primary intent)
      const multiIntentResult = this.multiIntent.detect(request.text);
      if (multiIntentResult.isMultiIntent && multiIntentResult.segments.length > 1) {
        this.logger.info(
          `[Orchestrator] Multi-intent detected in stream (${multiIntentResult.segments.length} segments) - using primary intent only`
        );
      }

      // Step 3: Get workspace stats and apply override rules
      const docCount = await this.getDocumentCount(request.userId);
      const workspaceStats = { docCount };

      const adaptedIntent = adaptPredictedIntent(intent, request);
      const overriddenIntent = await this.override.override({
        intent: adaptedIntent,
        userId: request.userId,
        query: request.text,
        workspaceStats,
      });

      // Log if override was applied
      if (overriddenIntent.overrideReason) {
        this.logger.info(
          `[Orchestrator] Stream override applied: ${intent.primaryIntent} → ${overriddenIntent.primaryIntent} (${overriddenIntent.overrideReason})`
        );
      }

      // Create final intent for routing
      const finalIntent: PredictedIntent = {
        ...intent,
        primaryIntent: overriddenIntent.primaryIntent as any,
        confidence: overriddenIntent.confidence,
        language,
      };

      // Yield intent event (with possibly overridden intent)
      yield {
        type: 'intent',
        intent: finalIntent.primaryIntent,
        confidence: finalIntent.confidence,
      } as StreamEvent;

      // Step 4: Route to streaming handler based on (possibly overridden) intent
      let result: StreamingResult;

      if (finalIntent.primaryIntent === 'DOC_QA' || finalIntent.primaryIntent === 'DOC_SEARCH' || finalIntent.primaryIntent === 'DOC_SUMMARIZE') {
        // Document-related intents use TRUE streaming
        result = yield* this.streamDocumentQnA(request, finalIntent, language);
      } else if (finalIntent.primaryIntent === 'CHITCHAT' || finalIntent.primaryIntent === 'META_AI') {
        // Simple intents - generate once and yield
        result = yield* this.streamSimpleResponse(request, finalIntent, language);
      } else {
        // Other intents - use non-streaming then yield the result
        const response = await this.routeIntent(request, finalIntent);
        yield { type: 'content', content: response.answer } as ContentEvent;
        result = {
          fullAnswer: response.answer,
          intent: finalIntent.primaryIntent,
          confidence: finalIntent.confidence,
          documentsUsed: response.metadata?.documentsUsed || 0,
          processingTime: Date.now() - startTime,
        };
      }

      // Yield metadata event
      yield {
        type: 'metadata',
        processingTime: result.processingTime,
        documentsUsed: result.documentsUsed,
      } as StreamEvent;

      // Yield done event - REQUIRED for proper stream completion
      yield {
        type: 'done',
        fullAnswer: result.fullAnswer,
      } as StreamEvent;

      return result;

    } catch (error: any) {
      this.logger.error('[Orchestrator] Streaming error:', error);

      // Yield error
      yield {
        type: 'error',
        error: error.message || 'An error occurred',
      } as StreamEvent;

      return {
        fullAnswer: 'Sorry, an error occurred. Please try again.',
        intent: 'UNKNOWN',
        confidence: 0,
        documentsUsed: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Stream DOC_QA response using TRUE streaming from answer engine.
   * Event order: intent → retrieving → generating → content* → citations → metadata → done
   */
  private async *streamDocumentQnA(
    request: OrchestratorRequest,
    intent: PredictedIntent,
    language: LanguageCode
  ): StreamGenerator {
    const startTime = Date.now();

    // Check if user has documents
    const hasDocuments = await this.checkUserHasDocuments(request.userId);
    if (!hasDocuments) {
      const fallback = this.fallbackConfig.getFallback('NO_DOCUMENTS', 'short_guidance', language);
      yield { type: 'content', content: fallback.text } as ContentEvent;
      yield { type: 'done', fullAnswer: fallback.text } as StreamEvent;
      return {
        fullAnswer: fallback.text,
        intent: intent.primaryIntent,
        confidence: intent.confidence,
        documentsUsed: 0,
        processingTime: Date.now() - startTime,
      };
    }

    // Yield retrieving event
    yield { type: 'retrieving', message: 'Searching documents...' } as StreamEvent;

    // Convert PredictedIntent to IntentClassificationV3 for RAG services
    const adaptedIntent = adaptPredictedIntent(intent, request);

    // Retrieve documents with metadata (non-streaming - fast)
    const retrievalResult = await this.retrievalEngine.retrieveWithMetadata({
      query: request.text,
      userId: request.userId,
      language,
      intent: adaptedIntent,
    });

    if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
      const noDocsMsg = this.getNoResultsMessage(language);
      yield { type: 'content', content: noDocsMsg } as ContentEvent;
      yield { type: 'done', fullAnswer: noDocsMsg } as StreamEvent;
      return {
        fullAnswer: noDocsMsg,
        intent: intent.primaryIntent,
        confidence: intent.confidence,
        documentsUsed: 0,
        processingTime: Date.now() - startTime,
      };
    }

    // Yield generating event with document count
    yield {
      type: 'generating',
      message: `Generating answer from ${retrievalResult.chunks.length} document chunks...`,
    } as StreamEvent;

    // TRUE STREAMING: Use answer engine's async generator
    const answerStream = this.answerEngine.streamAnswerWithDocsAsync({
      userId: request.userId,
      query: request.text,
      intent: adaptedIntent,
      documents: retrievalResult.chunks,
      language,
    });

    // FIXED: Manually iterate to capture generator return value
    // (for await doesn't give access to return value after completion)
    let fullAnswer = '';
    let tokensUsed = 0;
    let iterResult = await answerStream.next();

    while (!iterResult.done) {
      const event = iterResult.value;
      yield event;

      if (event.type === 'content') {
        fullAnswer += (event as ContentEvent).content;
      }

      iterResult = await answerStream.next();
    }

    // Capture generator return value (when iterResult.done === true)
    const generatorReturn = iterResult.value as StreamingResult | undefined;
    if (generatorReturn) {
      fullAnswer = generatorReturn.fullAnswer || fullAnswer;
      tokensUsed = generatorReturn.tokensUsed || 0;
    }

    // Extract citations from retrieval chunks
    const citations = this.extractCitationsFromChunks(retrievalResult.chunks);
    if (citations.length > 0) {
      yield {
        type: 'citation',
        citations,
      } as StreamEvent;
    }

    // Build final result with all metadata
    const result: StreamingResult = {
      fullAnswer,
      intent: intent.primaryIntent,
      confidence: intent.confidence,
      documentsUsed: retrievalResult.chunks.length,
      tokensUsed,
      processingTime: Date.now() - startTime,
      citations,
    };

    // Emit single done event with full metadata
    yield {
      type: 'done',
      fullAnswer,
      intent: result.intent,
      confidence: result.confidence,
      documentsUsed: result.documentsUsed,
      tokensUsed: result.tokensUsed,
      processingTime: result.processingTime,
      citations,
    } as StreamEvent;

    return result;
  }

  /**
   * Extract citations from retrieved chunks for the citation event.
   */
  private extractCitationsFromChunks(chunks: any[]): Array<{
    documentId: string;
    documentName: string;
    pageNumber?: number;
    snippet?: string;
  }> {
    const seen = new Set<string>();
    const citations: Array<{
      documentId: string;
      documentName: string;
      pageNumber?: number;
      snippet?: string;
    }> = [];

    for (const chunk of chunks.slice(0, 5)) {
      const docId = chunk.documentId || chunk.metadata?.documentId;
      if (!docId || seen.has(docId)) continue;
      seen.add(docId);

      citations.push({
        documentId: docId,
        documentName: chunk.documentName || chunk.metadata?.filename || 'Document',
        pageNumber: chunk.pageNumber || chunk.metadata?.pageNumber,
        snippet: chunk.content?.substring(0, 100),
      });
    }

    return citations;
  }

  /**
   * Stream simple responses (chitchat, meta AI).
   */
  private async *streamSimpleResponse(
    request: OrchestratorRequest,
    intent: PredictedIntent,
    language: LanguageCode
  ): StreamGenerator {
    const startTime = Date.now();

    // Generate the response
    const response = await this.routeIntent(request, intent);

    // Yield the content as a single chunk (these are short responses)
    yield { type: 'content', content: response.answer } as ContentEvent;

    return {
      fullAnswer: response.answer,
      intent: intent.primaryIntent,
      confidence: intent.confidence,
      documentsUsed: 0,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Get no results message in appropriate language.
   */
  private getNoResultsMessage(language: LanguageCode): string {
    const messages: Record<LanguageCode, string> = {
      en: "I couldn't find relevant information in your documents. Try rephrasing your question.",
      pt: "Não encontrei informações relevantes nos seus documentos. Tente reformular sua pergunta.",
      es: "No encontré información relevante en tus documentos. Intenta reformular tu pregunta.",
    };
    return messages[language] || messages.en;
  }

  /**
   * Route intent to appropriate handler
   * CRITICAL: Must have a case for ALL 25 intent types
   */
  private async routeIntent(
    request: OrchestratorRequest,
    intent: PredictedIntent
  ): Promise<IntentHandlerResponse> {

    // Pass intent object through to all handlers
    const handlerContext = {
      request,
      intent,
      language: intent.language,
    };

    switch (intent.primaryIntent) {
      // ========== DOCUMENT-RELATED INTENTS ==========

      case 'DOC_QA':
        return this.handleDocumentQnA(handlerContext);

      case 'DOC_ANALYTICS':
        return this.handleDocAnalytics(handlerContext);

      case 'DOC_MANAGEMENT':
        return this.handleDocManagement(handlerContext);

      case 'DOC_SEARCH':
        return this.handleDocSearch(handlerContext);

      case 'DOC_SUMMARIZE':
        return this.handleDocSummarize(handlerContext);

      // ========== USER PREFERENCES & MEMORY ==========

      case 'PREFERENCE_UPDATE':
        return this.handlePreferenceUpdate(handlerContext);

      case 'MEMORY_STORE':
        return this.handleMemoryStore(handlerContext);

      case 'MEMORY_RECALL':
        return this.handleMemoryRecall(handlerContext);

      // ========== META-CONTROL OVER ANSWERS ==========

      case 'ANSWER_REWRITE':
        return this.handleAnswerRewrite(handlerContext);

      case 'ANSWER_EXPAND':
        return this.handleAnswerExpand(handlerContext);

      case 'ANSWER_SIMPLIFY':
        return this.handleAnswerSimplify(handlerContext);

      // ========== FEEDBACK ==========

      case 'FEEDBACK_POSITIVE':
        return this.handlePositiveFeedback(handlerContext);

      case 'FEEDBACK_NEGATIVE':
        return this.handleNegativeFeedback(handlerContext);

      // ========== PRODUCT HELP & ONBOARDING ==========

      case 'PRODUCT_HELP':
        return this.handleProductHelp(handlerContext);

      case 'ONBOARDING_HELP':
        return this.handleOnboardingHelp(handlerContext);

      case 'FEATURE_REQUEST':
        return this.handleFeatureRequest(handlerContext);

      // ========== GENERAL KNOWLEDGE & REASONING ==========

      case 'GENERIC_KNOWLEDGE':
        return this.handleGenericKnowledge(handlerContext);

      case 'REASONING_TASK':
        return this.handleReasoningTask(handlerContext);

      case 'TEXT_TRANSFORM':
        return this.handleTextTransform(handlerContext);

      // ========== CONVERSATIONAL ==========

      case 'CHITCHAT':
        return this.handleChitchat(handlerContext);

      case 'META_AI':
        return this.handleMetaAI(handlerContext);

      // ========== EDGE CASES & SAFETY ==========

      case 'OUT_OF_SCOPE':
        return this.handleOutOfScope(handlerContext);

      case 'AMBIGUOUS':
        return this.handleAmbiguous(handlerContext);

      case 'SAFETY_CONCERN':
        return this.handleSafetyConcern(handlerContext);

      case 'MULTI_INTENT':
        return this.handleMultiIntent(handlerContext);

      case 'UNKNOWN':
      default:
        return this.buildFallbackResponse(
          handlerContext,
          'UNSUPPORTED_INTENT',
          `Intent not fully implemented: ${intent.primaryIntent}`
        );
    }
  }

  // ========== HANDLER IMPLEMENTATIONS ==========

  /**
   * Handle DOC_QA: Answer questions using uploaded documents
   * FAIL-FAST: Services are guaranteed by container - no optional chains
   */
  private async handleDocumentQnA(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, intent, language } = context;

    // Pre-check: Does user have documents?
    const hasDocuments = await this.checkUserHasDocuments(request.userId);
    if (!hasDocuments) {
      return this.buildFallbackResponse(context, 'NO_DOCUMENTS');
    }

    // Convert PredictedIntent to IntentClassificationV3 for RAG services
    const adaptedIntent = adaptPredictedIntent(intent, request);

    // Retrieve documents - pass adapted intent for intent-aware boosting
    const retrievalResult = await this.retrievalEngine.retrieveWithMetadata({
      query: request.text,
      userId: request.userId,
      language,
      intent: adaptedIntent,
    });

    // Check if we got chunks
    if (!retrievalResult.chunks || retrievalResult.chunks.length === 0) {
      return this.buildFallbackResponse(context, 'NO_RELEVANT_DOCS');
    }

    // Generate answer - pass adapted intent for question-type formatting
    const answerResult = await this.answerEngine.answerWithDocs({
      userId: request.userId,
      query: request.text,
      intent: adaptedIntent,
      documents: retrievalResult.chunks,
      language,
    });

    // Convert citations from RAG format to formatting pipeline format
    const convertedCitations = answerResult.citations?.map(c => ({
      docId: c.documentId,
      docName: c.documentName,
      pageNumber: c.pageNumber,
      chunkId: c.chunkId,
      relevanceScore: c.confidence,
    }));

    // Format with citations via formatting pipeline
    const formatted = await this.formattingPipeline.format({
      text: answerResult.answer,
      citations: convertedCitations,
      language,
    });

    return {
      answer: formatted.text || answerResult.answer,
      formatted: formatted.text || answerResult.answer,
      metadata: {
        documentsUsed: retrievalResult.chunks.length,
        confidence: answerResult.confidenceScore,
      },
    };
  }

  /**
   * Handle DOC_ANALYTICS: Counts, lists, statistics
   */
  private async handleDocAnalytics(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Use getDocumentCounts for analytics
    const counts = await this.documentSearch.getDocumentCounts(request.userId);

    const analyticsMessages: Record<LanguageCode, string> = {
      en: `You have ${counts.total} document${counts.total !== 1 ? 's' : ''}. ${counts.completed} completed, ${counts.processing} processing, ${counts.failed} failed.`,
      pt: `Você tem ${counts.total} documento${counts.total !== 1 ? 's' : ''}. ${counts.completed} completo${counts.completed !== 1 ? 's' : ''}, ${counts.processing} processando, ${counts.failed} com falha.`,
      es: `Tienes ${counts.total} documento${counts.total !== 1 ? 's' : ''}. ${counts.completed} completado${counts.completed !== 1 ? 's' : ''}, ${counts.processing} procesando, ${counts.failed} fallido${counts.failed !== 1 ? 's' : ''}.`,
    };

    const answer = analyticsMessages[language] || analyticsMessages['en'];

    return {
      answer,
      formatted: answer,
      metadata: {
        documentsUsed: counts.total,
      },
    };
  }

  /**
   * Handle DOC_MANAGEMENT: Delete, tag, move, rename
   */
  private async handleDocManagement(context: HandlerContext): Promise<IntentHandlerResponse> {
    // Not yet fully implemented - return graceful message
    return this.buildFallbackResponse(
      context,
      'UNSUPPORTED_INTENT',
      'Document management features are coming soon!'
    );
  }

  /**
   * Handle DOC_SEARCH: Search across documents
   */
  private async handleDocSearch(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    const searchResult = await this.documentSearch.search({
      query: request.text,
      userId: request.userId,
    });

    const documents = searchResult.items || [];
    const total = searchResult.total || 0;

    // Format document listing
    const formatted = await this.formattingPipeline.formatDocumentListing(
      documents.map(d => ({ id: d.documentId, filename: d.filename, fileType: d.fileType })),
      total,
      documents.length
    );

    const summaryMessages: Record<LanguageCode, string> = {
      en: `Found ${total} document${total !== 1 ? 's' : ''}${request.text ? ' matching "' + request.text + '"' : ''}.`,
      pt: `Encontrado${total !== 1 ? 's' : ''} ${total} documento${total !== 1 ? 's' : ''}${request.text ? ' correspondendo a "' + request.text + '"' : ''}.`,
      es: `Encontrado${total !== 1 ? 's' : ''} ${total} documento${total !== 1 ? 's' : ''}${request.text ? ' que coinciden con "' + request.text + '"' : ''}.`,
    };

    return {
      answer: summaryMessages[language] || summaryMessages['en'],
      formatted: formatted.text,
      metadata: {
        documentsUsed: documents.length,
      },
    };
  }

  /**
   * Handle DOC_SUMMARIZE: Summarize documents
   * NOTE: Full document summarization requires document retrieval first.
   * This is handled as a DOC_QA with summarization intent.
   */
  private async handleDocSummarize(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Extract document reference from query
    const docRef = await this.extractDocumentReference(request.text, request.userId);

    if (!docRef) {
      return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'Which document would you like me to summarize?');
    }

    // Route through DOC_QA with the document context
    const summaryRequest = {
      ...context,
      request: {
        ...request,
        text: `Summarize the document "${docRef.filename}"`,
        context: {
          ...request.context,
          attachedDocumentIds: [docRef.id],
        },
      },
    };

    return this.handleDocumentQnA(summaryRequest);
  }

  /**
   * Handle PREFERENCE_UPDATE: User settings, language, tone
   * NOTE: Full preference parsing not yet implemented - returns acknowledgment.
   */
  private async handlePreferenceUpdate(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const confirmationMessages: Record<LanguageCode, string> = {
      en: "I've noted your preference. Settings will be updated in a future release.",
      pt: "Anotei sua preferência. As configurações serão atualizadas em uma versão futura.",
      es: "He anotado tu preferencia. La configuración se actualizará en una versión futura.",
    };

    return {
      answer: confirmationMessages[language] || confirmationMessages['en'],
      formatted: confirmationMessages[language] || confirmationMessages['en'],
    };
  }

  /**
   * Handle MEMORY_STORE: Store user context
   * NOTE: Memory is automatically stored via conversation history.
   */
  private async handleMemoryStore(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Add to conversation memory via addMessage (if conversation exists)
    if (request.conversationId) {
      await this.conversationMemory.addMessage(
        request.conversationId,
        'user',
        request.text
      );
    }

    const confirmationMessages: Record<LanguageCode, string> = {
      en: "I'll remember that!",
      pt: "Vou me lembrar disso!",
      es: "¡Lo recordaré!",
    };

    return {
      answer: confirmationMessages[language] || confirmationMessages['en'],
      formatted: confirmationMessages[language] || confirmationMessages['en'],
    };
  }

  /**
   * Handle MEMORY_RECALL: Recall stored information
   * Uses conversation context to recall recent messages.
   */
  private async handleMemoryRecall(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (request.conversationId) {
      const conversationContext = await this.conversationMemory.getContext(request.conversationId);

      if (conversationContext && conversationContext.messages.length > 0) {
        // Get recent context summary
        const recentMessages = conversationContext.messages.slice(-5);
        const summary = recentMessages
          .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
          .join('\n');

        const recallMessages: Record<LanguageCode, string> = {
          en: `Here's what I remember from our recent conversation:\n${summary}`,
          pt: `Aqui está o que lembro da nossa conversa recente:\n${summary}`,
          es: `Esto es lo que recuerdo de nuestra conversación reciente:\n${summary}`,
        };

        return {
          answer: recallMessages[language] || recallMessages['en'],
          formatted: recallMessages[language] || recallMessages['en'],
        };
      }
    }

    const noMemoryMessages: Record<LanguageCode, string> = {
      en: "I don't have any previous conversation context to recall.",
      pt: "Não tenho nenhum contexto de conversa anterior para lembrar.",
      es: "No tengo ningún contexto de conversación anterior que recordar.",
    };

    return {
      answer: noMemoryMessages[language] || noMemoryMessages['en'],
      formatted: noMemoryMessages[language] || noMemoryMessages['en'],
    };
  }

  /**
   * Handle ANSWER_REWRITE: Explain better, more details, simplify
   * NOTE: Rewrite functionality requires last answer context - not yet implemented.
   */
  private async handleAnswerRewrite(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Get conversation context to find last answer
    if (request.conversationId) {
      const conversationContext = await this.conversationMemory.getContext(request.conversationId);

      if (conversationContext) {
        const lastAssistant = [...conversationContext.messages]
          .reverse()
          .find(m => m.role === 'assistant');

        if (lastAssistant) {
          // For now, return acknowledgment with the original
          const messages: Record<LanguageCode, string> = {
            en: "I understand you'd like me to explain differently. Here's what I said before:\n\n" + lastAssistant.content,
            pt: "Entendo que você gostaria que eu explicasse de forma diferente. Aqui está o que eu disse antes:\n\n" + lastAssistant.content,
            es: "Entiendo que te gustaría que lo explicara de manera diferente. Esto es lo que dije antes:\n\n" + lastAssistant.content,
          };

          return {
            answer: messages[language] || messages['en'],
            formatted: messages[language] || messages['en'],
          };
        }
      }
    }

    return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'What would you like me to rewrite?');
  }

  /**
   * Handle ANSWER_EXPAND: Add more details
   * NOTE: Expansion functionality requires context - routes to DOC_QA for elaboration.
   */
  private async handleAnswerExpand(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Get conversation context to find what to expand
    if (request.conversationId) {
      const conversationContext = await this.conversationMemory.getContext(request.conversationId);

      if (conversationContext) {
        const lastAssistant = [...conversationContext.messages]
          .reverse()
          .find(m => m.role === 'assistant');

        if (lastAssistant) {
          // Route as follow-up question for more details
          const expandedContext = {
            ...context,
            request: {
              ...request,
              text: `Please provide more details about: ${lastAssistant.content.substring(0, 200)}`,
            },
          };
          return this.handleDocumentQnA(expandedContext);
        }
      }
    }

    return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'What would you like me to expand on?');
  }

  /**
   * Handle ANSWER_SIMPLIFY: Make simpler
   * NOTE: Simplification requires LLM post-processing - returns acknowledgment.
   */
  private async handleAnswerSimplify(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Get conversation context
    if (request.conversationId) {
      const conversationContext = await this.conversationMemory.getContext(request.conversationId);

      if (conversationContext) {
        const lastAssistant = [...conversationContext.messages]
          .reverse()
          .find(m => m.role === 'assistant');

        if (lastAssistant) {
          const messages: Record<LanguageCode, string> = {
            en: "I'll try to explain more simply. The key point is: " + lastAssistant.content.substring(0, 300) + "...",
            pt: "Vou tentar explicar de forma mais simples. O ponto principal é: " + lastAssistant.content.substring(0, 300) + "...",
            es: "Intentaré explicar de forma más simple. El punto clave es: " + lastAssistant.content.substring(0, 300) + "...",
          };

          return {
            answer: messages[language] || messages['en'],
            formatted: messages[language] || messages['en'],
          };
        }
      }
    }

    return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'What would you like me to simplify?');
  }


  /**
   * Handle FEEDBACK_POSITIVE: "Perfect", "Thanks"
   */
  private async handlePositiveFeedback(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Log positive feedback with correct signature
    await this.feedbackLogger.logPositive(
      request.userId,
      request.conversationId || '',
      undefined,
      request.text
    );

    const responses: Record<LanguageCode, string> = {
      en: "Glad I could help!",
      pt: "Fico feliz em ajudar!",
      es: "¡Me alegra poder ayudar!",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle FEEDBACK_NEGATIVE: "Wrong", "Not in the file"
   */
  private async handleNegativeFeedback(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Log negative feedback with correct signature
    await this.feedbackLogger.logNegative(
      request.userId,
      request.conversationId || '',
      undefined,
      request.text
    );

    const responses: Record<LanguageCode, string> = {
      en: "I apologize for the error. Could you tell me what was wrong, or paste the correct passage from the file?",
      pt: "Peço desculpas pelo erro. Você poderia me dizer o que estava errado ou colar a passagem correta do arquivo?",
      es: "Disculpa por el error. ¿Podrías decirme qué estaba mal o pegar el pasaje correcto del archivo?",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
      requiresFollowup: true,
    };
  }

  /**
   * Handle PRODUCT_HELP: How to use Koda
   * CRITICAL: This was missing in previous orchestrator!
   */
  private async handleProductHelp(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    const helpResult = await this.productHelp.getHelp({
      query: request.text,
      language,
    });

    return {
      answer: helpResult.text,
      formatted: helpResult.text,
      suggestedActions: helpResult.relatedTopics,
    };
  }

  /**
   * Handle ONBOARDING_HELP: Getting started
   */
  private async handleOnboardingHelp(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const onboardingMessages: Record<LanguageCode, string> = {
      en: "Welcome to Koda! Here's how to get started:\n\n1. Upload your documents\n2. Ask me questions about them\n3. I'll search and answer based on your files\n\nTry asking: 'What documents do I have?' or upload a file to begin!",
      pt: "Bem-vindo ao Koda! Veja como começar:\n\n1. Faça upload dos seus documentos\n2. Faça perguntas sobre eles\n3. Vou pesquisar e responder com base nos seus arquivos\n\nTente perguntar: 'Quais documentos eu tenho?' ou faça upload de um arquivo para começar!",
      es: "¡Bienvenido a Koda! Así es como empezar:\n\n1. Sube tus documentos\n2. Hazme preguntas sobre ellos\n3. Buscaré y responderé basándome en tus archivos\n\n¡Intenta preguntar: '¿Qué documentos tengo?' o sube un archivo para comenzar!",
    };

    return {
      answer: onboardingMessages[language] || onboardingMessages['en'],
      formatted: onboardingMessages[language] || onboardingMessages['en'],
    };
  }

  /**
   * Handle FEATURE_REQUEST: User requesting features
   */
  private async handleFeatureRequest(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const responses: Record<LanguageCode, string> = {
      en: "Thanks for the suggestion! I've noted your feature request. Our team reviews all feedback regularly.",
      pt: "Obrigado pela sugestão! Anotei sua solicitação de recurso. Nossa equipe revisa todos os feedbacks regularmente.",
      es: "¡Gracias por la sugerencia! He anotado tu solicitud de función. Nuestro equipo revisa todos los comentarios regularmente.",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle GENERIC_KNOWLEDGE: World facts
   * NOTE: Koda focuses on document-based answers. Generic knowledge is limited.
   */
  private async handleGenericKnowledge(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const responses: Record<LanguageCode, string> = {
      en: "I specialize in helping you with your documents. For general knowledge questions, I recommend using a general-purpose search engine. If you have documents about this topic, feel free to upload them and ask me!",
      pt: "Eu me especializo em ajudá-lo com seus documentos. Para perguntas de conhecimento geral, recomendo usar um mecanismo de busca geral. Se você tiver documentos sobre este tópico, fique à vontade para enviá-los e me perguntar!",
      es: "Me especializo en ayudarte con tus documentos. Para preguntas de conocimiento general, recomiendo usar un motor de búsqueda general. Si tienes documentos sobre este tema, ¡no dudes en subirlos y preguntarme!",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle REASONING_TASK: Math, logic
   * NOTE: Koda focuses on document Q&A. Complex reasoning is limited.
   */
  private async handleReasoningTask(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const responses: Record<LanguageCode, string> = {
      en: "I'm optimized for answering questions about your documents rather than general reasoning tasks. If you have documents containing calculations or data you'd like me to analyze, please upload them!",
      pt: "Sou otimizado para responder perguntas sobre seus documentos, em vez de tarefas de raciocínio geral. Se você tiver documentos contendo cálculos ou dados que gostaria que eu analisasse, por favor envie-os!",
      es: "Estoy optimizado para responder preguntas sobre tus documentos en lugar de tareas de razonamiento general. Si tienes documentos con cálculos o datos que te gustaría que analice, ¡por favor súbelos!",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle TEXT_TRANSFORM: Translate, summarize, rewrite
   * NOTE: Text transformation of user-provided text is limited.
   */
  private async handleTextTransform(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const responses: Record<LanguageCode, string> = {
      en: "I'm best at finding and summarizing information from your uploaded documents. For text transformation tasks, please upload a document and I can help extract or summarize specific parts.",
      pt: "Sou melhor em encontrar e resumir informações de seus documentos enviados. Para tarefas de transformação de texto, por favor envie um documento e posso ajudar a extrair ou resumir partes específicas.",
      es: "Soy mejor encontrando y resumiendo información de tus documentos subidos. Para tareas de transformación de texto, por favor sube un documento y puedo ayudar a extraer o resumir partes específicas.",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle CHITCHAT: Greetings, small talk
   */
  private async handleChitchat(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Simple chitchat responses
    const greetingPatterns = ['hello', 'hi', 'hey', 'olá', 'oi', 'hola'];
    const isGreeting = greetingPatterns.some(p => request.text.toLowerCase().includes(p));

    if (isGreeting) {
      const greetings: Record<LanguageCode, string> = {
        en: "Hello! I'm Koda, your document assistant. How can I help you today?",
        pt: "Olá! Sou o Koda, seu assistente de documentos. Como posso ajudá-lo hoje?",
        es: "¡Hola! Soy Koda, tu asistente de documentos. ¿Cómo puedo ayudarte hoy?",
      };

      return {
        answer: greetings[language] || greetings['en'],
        formatted: greetings[language] || greetings['en'],
      };
    }

    // Default chitchat response
    const responses: Record<LanguageCode, string> = {
      en: "I'm here to help with your documents! Feel free to ask me anything about them.",
      pt: "Estou aqui para ajudar com seus documentos! Fique à vontade para me perguntar qualquer coisa sobre eles.",
      es: "¡Estoy aquí para ayudar con tus documentos! No dudes en preguntarme cualquier cosa sobre ellos.",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle META_AI: About the AI
   */
  private async handleMetaAI(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { language } = context;

    const responses: Record<LanguageCode, string> = {
      en: "I'm Koda, an AI assistant specialized in helping you work with your documents. I use advanced language models to understand your questions and find answers in your uploaded files.",
      pt: "Sou Koda, um assistente de IA especializado em ajudá-lo a trabalhar com seus documentos. Uso modelos de linguagem avançados para entender suas perguntas e encontrar respostas em seus arquivos enviados.",
      es: "Soy Koda, un asistente de IA especializado en ayudarte a trabajar con tus documentos. Utilizo modelos de lenguaje avanzados para entender tus preguntas y encontrar respuestas en tus archivos subidos.",
    };

    return {
      answer: responses[language] || responses['en'],
      formatted: responses[language] || responses['en'],
    };
  }

  /**
   * Handle OUT_OF_SCOPE: Harmful/illegal requests
   */
  private async handleOutOfScope(context: HandlerContext): Promise<IntentHandlerResponse> {
    return this.buildFallbackResponse(context, 'OUT_OF_SCOPE');
  }

  /**
   * Handle AMBIGUOUS: Too vague
   */
  private async handleAmbiguous(context: HandlerContext): Promise<IntentHandlerResponse> {
    return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION');
  }

  /**
   * Handle SAFETY_CONCERN: Safety-related content
   */
  private async handleSafetyConcern(context: HandlerContext): Promise<IntentHandlerResponse> {
    return this.buildFallbackResponse(context, 'OUT_OF_SCOPE');
  }

  /**
   * Handle MULTI_INTENT: Multiple intents detected
   */
  private async handleMultiIntent(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { intent } = context;

    // Route to primary intent for now
    // In future, could handle multiple intents sequentially
    if (intent.secondaryIntents && intent.secondaryIntents.length > 0) {
      this.logger.info(
        `[Orchestrator] Multi-intent detected, routing to primary: ${intent.primaryIntent}`
      );
    }

    // Re-route to primary intent handler
    return this.routeIntent(context.request, intent);
  }

  // ========== HELPER METHODS ==========

  /**
   * Build fallback response using FallbackConfigService
   */
  private buildFallbackResponse(
    context: HandlerContext,
    scenarioKey: string,
    customMessage?: string
  ): IntentHandlerResponse {
    const language = context.language || context.intent?.language || 'en';

    if (customMessage) {
      return {
        answer: customMessage,
        formatted: customMessage,
      };
    }

    const fallback = this.fallbackConfig.getFallback(
      scenarioKey as any,
      'short_guidance',
      language
    );

    return {
      answer: fallback.text,
      formatted: fallback.text,
      metadata: fallback.metadata as any,
    };
  }

  /**
   * Build error response
   */
  private buildErrorResponse(request: OrchestratorRequest, error: any): IntentHandlerResponse {
    this.logger.error('[Orchestrator] Error:', error);

    const fallback = this.fallbackConfig.getFallback(
      'LLM_ERROR',
      'one_liner',
      request.language || 'en'
    );

    return {
      answer: fallback.text,
      formatted: fallback.text,
    };
  }

  /**
   * Check if user has documents
   */
  private async checkUserHasDocuments(userId: string): Promise<boolean> {
    const docCount = await prisma.document.count({
      where: {
        userId: userId,
        status: 'completed',
      },
    });
    return docCount > 0;
  }

  /**
   * Extract document reference from text
   */
  private async extractDocumentReference(text: string, userId: string): Promise<any> {
    // A simple implementation: look for a document name in double quotes
    const match = text.match(/"(.*?)"/);
    if (!match) {
      return null;
    }

    const docName = match[1];
    if (!docName) {
      return null;
    }

    // Find a document for the user that matches the extracted name
    const document = await prisma.document.findFirst({
      where: {
        userId,
        filename: {
          contains: docName,
          mode: 'insensitive',
        },
        status: 'completed',
      },
    });

    return document;
  }
}

// NOTE: Do NOT export singleton instance here!
// Controllers MUST get the orchestrator from bootstrap/container.ts
// This ensures proper dependency injection and fail-fast on missing services.

export default KodaOrchestratorV3;
