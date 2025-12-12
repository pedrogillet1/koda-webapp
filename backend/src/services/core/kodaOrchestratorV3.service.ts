/**
 * KODA V3 Orchestrator Service
 *
 * Central traffic cop for all intents
 * Handles ALL 25 intent types with proper routing
 *
 * Based on: pasted_content_21.txt Layer 5 and pasted_content_22.txt Section 2 specifications
 */

import { KodaIntentEngineV3, kodaIntentEngineV3 } from './kodaIntentEngineV3.service';
import { FallbackConfigService, fallbackConfigService } from './fallbackConfig.service';
import { KodaProductHelpServiceV3, kodaProductHelpServiceV3 } from './kodaProductHelpV3.service';
import { KodaFormattingPipelineV3Service, kodaFormattingPipelineV3 } from './kodaFormattingPipelineV3.service';
import KodaRetrievalEngineV3 from './kodaRetrievalEngineV3.service';
import KodaAnswerEngineV3 from './kodaAnswerEngineV3.service';
import prisma from '../../config/database';
// Services are now injected via container.ts - no direct imports needed
import {
  IntentName,
  LanguageCode,
  PredictedIntent,
  IntentHandlerResponse,
} from '../../types/intentV3.types';

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
  private readonly intentEngine: KodaIntentEngineV3;
  private readonly fallbackConfig: FallbackConfigService;
  private readonly productHelp: KodaProductHelpServiceV3;
  private readonly formattingPipeline: KodaFormattingPipelineV3Service;
  private readonly logger: any;

  // Injected services - REQUIRED (from container.ts DI)
  private readonly retrievalEngine: any;
  private readonly answerEngine: any;
  private readonly documentSearch: any;
  private readonly userPreferences: any;
  private readonly conversationMemory: any;
  private readonly feedbackLogger: any;
  private readonly analyticsEngine: any;

  constructor(
    services: {
      intentEngine: KodaIntentEngineV3;
      fallbackConfig: FallbackConfigService;
      productHelp: KodaProductHelpServiceV3;
      formattingPipeline: KodaFormattingPipelineV3Service;
      retrievalEngine: any;
      answerEngine: any;
      documentSearch?: any;
      userPreferences?: any;
      conversationMemory?: any;
      feedbackLogger?: any;
      analyticsEngine?: any;
    },
    logger?: any
  ) {
    // CRITICAL: All core services MUST be provided (fail-fast pattern)
    if (!services.intentEngine) throw new Error('[Orchestrator] intentEngine is required');
    if (!services.fallbackConfig) throw new Error('[Orchestrator] fallbackConfig is required');
    if (!services.productHelp) throw new Error('[Orchestrator] productHelp is required');
    if (!services.formattingPipeline) throw new Error('[Orchestrator] formattingPipeline is required');
    if (!services.retrievalEngine) throw new Error('[Orchestrator] retrievalEngine is required');
    if (!services.answerEngine) throw new Error('[Orchestrator] answerEngine is required');

    this.intentEngine = services.intentEngine;
    this.fallbackConfig = services.fallbackConfig;
    this.productHelp = services.productHelp;
    this.formattingPipeline = services.formattingPipeline;
    this.logger = logger || console;

    // Inject optional services (analytics, etc.)
    this.retrievalEngine = services.retrievalEngine;
    this.answerEngine = services.answerEngine;
    this.documentSearch = services.documentSearch;
    this.userPreferences = services.userPreferences;
    this.conversationMemory = services.conversationMemory;
    this.feedbackLogger = services.feedbackLogger;
    this.analyticsEngine = services.analyticsEngine;
  }

  /**
   * Main orchestration entry point
   * Routes request to appropriate handler based on intent
   */
  async orchestrate(request: OrchestratorRequest): Promise<IntentHandlerResponse> {
    const startTime = Date.now();

    try {
      // 1. Classify intent
      const intent = await this.intentEngine.predict({
        text: request.text,
        language: request.language,
        context: request.context,
      });

      this.logger.info(
        `[Orchestrator] userId=${request.userId} intent=${intent.primaryIntent} confidence=${intent.confidence.toFixed(2)}`
      );

      // 2. Route to appropriate handler based on intent
      const response = await this.routeIntent(request, intent);

      // 3. Add metadata
      response.metadata = {
        ...response.metadata,
        intent: intent.primaryIntent,
        confidence: intent.confidence,
        processingTime: Date.now() - startTime,
      };

      return response;

    } catch (error) {
      this.logger.error('[Orchestrator] Error processing request:', error);
      return this.buildErrorResponse(request, error);
    }
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
   */
  private async handleDocumentQnA(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Pre-check: Does user have documents?
    const hasDocuments = await this.checkUserHasDocuments(request.userId);
    if (!hasDocuments) {
      return this.buildFallbackResponse(context, 'NO_DOCUMENTS');
    }

    // If retrieval engine is available, use it
    if (this.retrievalEngine && this.answerEngine) {
      const retrievalResult = await this.retrievalEngine.retrieve({
        query: request.text,
        userId: request.userId,
        language,
        intent: context.intent, // FIX: Pass intent for intent-aware retrieval
      });

      const answerResult = await this.answerEngine.generate({
        query: request.text,
        chunks: retrievalResult.chunks,
        language,
        intent: 'DOC_QA',
      });

      const formatted = await this.formattingPipeline.format({
        text: answerResult.text,
        documents: retrievalResult.documents,
        language,
      });

      return {
        answer: answerResult.text,
        formatted: formatted.text,
        metadata: {
          documentsUsed: retrievalResult.documents?.length || 0,
          tokensUsed: answerResult.tokensUsed,
        },
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Document Q&A service is currently unavailable.');
  }

  /**
   * Handle DOC_ANALYTICS: Counts, lists, statistics
   */
  private async handleDocAnalytics(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.documentSearch) {
      const analyticsResult = await this.documentSearch.getAnalytics({
        query: request.text,
        userId: request.userId,
        language,
      });

      const formatted = await this.formattingPipeline.formatAnalytics(
        request.text,
        analyticsResult.results || []
      );

      return {
        answer: analyticsResult.summary,
        formatted: formatted.text,
        metadata: {
          documentsUsed: analyticsResult.count,
        },
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Document Analytics service is currently unavailable.');
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

    if (this.documentSearch) {
      const searchResult = await this.documentSearch.search({
        query: request.text,
        userId: request.userId,
        language,
      });

      const formatted = await this.formattingPipeline.formatDocumentListing(
        searchResult.documents || [],
        searchResult.total || searchResult.documents?.length || 0,
        searchResult.documents?.length || 0
      );

      return {
        answer: searchResult.summary,
        formatted: formatted.text,
        metadata: {
          documentsUsed: searchResult.documents?.length || 0,
        },
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Document Search service is currently unavailable.');
  }

  /**
   * Handle DOC_SUMMARIZE: Summarize documents
   */
  private async handleDocSummarize(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    // Extract document reference from query
    const docRef = await this.extractDocumentReference(request.text, request.userId);

    if (!docRef) {
      return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'Which document would you like me to summarize?');
    }

    if (this.answerEngine) {
      const summary = await this.answerEngine.summarize({
        documentId: docRef.id,
        language,
      });

      return {
        answer: summary.text,
        formatted: summary.text,
        metadata: {
          documentsUsed: 1,
        },
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Summarization service is currently unavailable.');
  }

  /**
   * Handle PREFERENCE_UPDATE: User settings, language, tone
   */
  private async handlePreferenceUpdate(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.userPreferences) {
      const preference = await this.userPreferences.update({
        userId: request.userId,
        text: request.text,
        language,
      });

      const confirmationMessages: Record<LanguageCode, string> = {
        en: `Got it! I've updated your preferences: ${preference.summary}`,
        pt: `Entendido! Atualizei suas preferências: ${preference.summary}`,
        es: `¡Entendido! He actualizado tus preferencias: ${preference.summary}`,
      };

      return {
        answer: confirmationMessages[language] || confirmationMessages['en'],
        formatted: confirmationMessages[language] || confirmationMessages['en'],
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The User Preferences service is currently unavailable.');
  }

  /**
   * Handle MEMORY_STORE: Store user context
   */
  private async handleMemoryStore(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.conversationMemory) {
      await this.conversationMemory.store({
        userId: request.userId,
        text: request.text,
        language,
      });

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
    
    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Conversation Memory service is currently unavailable.');
  }

  /**
   * Handle MEMORY_RECALL: Recall stored information
   */
  private async handleMemoryRecall(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.conversationMemory) {
      const memory = await this.conversationMemory.recall({
        userId: request.userId,
        query: request.text,
        language,
      });

      return {
        answer: memory.text,
        formatted: memory.text,
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Conversation Memory service is currently unavailable.');
  }

  /**
   * Handle ANSWER_REWRITE: Explain better, more details, simplify
   */
  private async handleAnswerRewrite(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (!this.conversationMemory || !this.answerEngine) {
      return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Answer Rewrite service is currently unavailable.');
    }

    const lastAnswer = await this.conversationMemory.getLastAssistantMessage(
      request.conversationId || request.userId
    );

    if (!lastAnswer) {
      return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'What would you like me to rewrite?');
    }

    // TODO: The AnswerEngine should have a distinct `rewrite` method.
    const rewritten = await this.answerEngine.rewrite({
      originalAnswer: lastAnswer.text,
      instruction: request.text,
      language,
    });

    return {
      answer: rewritten.text,
      formatted: rewritten.text,
    };
  }

  /**
   * Handle ANSWER_EXPAND: Add more details
   */
  private async handleAnswerExpand(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (!this.conversationMemory || !this.answerEngine) {
      return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Answer Expand service is currently unavailable.');
    }

    const lastAnswer = await this.conversationMemory.getLastAssistantMessage(
      request.conversationId || request.userId
    );

    if (!lastAnswer) {
      return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'What would you like me to expand on?');
    }

    // TODO: The AnswerEngine needs an `expand` method with appropriate logic.
    const expanded = await this.answerEngine.expand({
      originalAnswer: lastAnswer.text,
      instruction: request.text,
      language,
    });

    return {
      answer: expanded.text,
      formatted: expanded.text,
    };
  }

  /**
   * Handle ANSWER_SIMPLIFY: Make simpler
   */
  private async handleAnswerSimplify(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (!this.conversationMemory || !this.answerEngine) {
      return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Answer Simplify service is currently unavailable.');
    }

    const lastAnswer = await this.conversationMemory.getLastAssistantMessage(
      request.conversationId || request.userId
    );

    if (!lastAnswer) {
      return this.buildFallbackResponse(context, 'AMBIGUOUS_QUESTION', 'What would you like me to simplify?');
    }

    // TODO: The AnswerEngine needs a `simplify` method with appropriate logic.
    const simplified = await this.answerEngine.simplify({
      originalAnswer: lastAnswer.text,
      instruction: request.text,
      language,
    });

    return {
      answer: simplified.text,
      formatted: simplified.text,
    };
  }


  /**
   * Handle FEEDBACK_POSITIVE: "Perfect", "Thanks"
   */
  private async handlePositiveFeedback(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.feedbackLogger) {
      await this.feedbackLogger.logPositive({
        userId: request.userId,
        conversationId: request.conversationId,
        text: request.text,
      });
    }

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

    if (this.feedbackLogger) {
      await this.feedbackLogger.logNegative({
        userId: request.userId,
        conversationId: request.conversationId,
        text: request.text,
      });
    }

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
   */
  private async handleGenericKnowledge(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.answerEngine) {
      const answer = await this.answerEngine.generate({
        query: request.text,
        chunks: [], // No document context
        language,
        intent: 'GENERIC_KNOWLEDGE',
        systemPrompt: 'generic_assistant',
      });

      return {
        answer: answer.text,
        formatted: answer.text,
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The General Knowledge service is currently unavailable.');
  }

  /**
   * Handle REASONING_TASK: Math, logic
   */
  private async handleReasoningTask(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.answerEngine) {
      const answer = await this.answerEngine.generate({
        query: request.text,
        chunks: [],
        language,
        intent: 'REASONING_TASK',
        systemPrompt: 'reasoning_assistant',
      });

      return {
        answer: answer.text,
        formatted: answer.text,
      };
    }

    return this.handleGenericKnowledge(context);
  }

  /**
   * Handle TEXT_TRANSFORM: Translate, summarize, rewrite
   */
  private async handleTextTransform(context: HandlerContext): Promise<IntentHandlerResponse> {
    const { request, language } = context;

    if (this.answerEngine) {
      const answer = await this.answerEngine.transform({
        text: request.text,
        language,
      });

      return {
        answer: answer.text,
        formatted: answer.text,
      };
    }

    return this.buildFallbackResponse(context, 'SERVICE_UNAVAILABLE', 'The Text Transform service is currently unavailable.');
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
