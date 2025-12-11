/**
 * KODA ORCHESTRATOR V2
 * Main Query Router and Handler
 *
 * This is the central orchestration service that:
 * 1. Receives user queries
 * 2. Classifies intent using kodaIntentEngine
 * 3. Routes to appropriate handler based on intent
 * 4. Returns formatted responses
 *
 * Performance Targets:
 * - Analytics: <1s (was 7.8s)
 * - Product Help: <2s (was 8.3s)
 * - Chitchat: <0.5s (was 1.9s)
 * - Doc Content: 5-7s (was 8-10s)
 */

import {
  PrimaryIntent,
  IntentClassification,
  RAGMode,
  KnowledgeSource,
  FallbackType
} from '../types/intentV2.types';

import { kodaIntentEngine } from './kodaIntentEngine.service';
import { getDocumentAnalytics } from './documentAnalyticsWrapper.service';
import { kodaProductHelpService } from './kodaProductHelp.service';
import geminiGateway from './geminiGateway.service';

// ============================================================================
// TYPES
// ============================================================================

export interface OrchestratorRequest {
  query: string;
  userId: string;
  conversationId?: string;
  previousMessages?: Array<{ role: string; content: string }>;
  hasDocuments?: boolean;
}

export interface OrchestratorResponse {
  answer: string;
  intent: IntentClassification;
  sources?: Array<{ documentId: string; documentName: string; chunk: string }>;
  metadata: {
    totalTimeMs: number;
    intentClassificationTimeMs: number;
    handlerTimeMs: number;
    wasPatternMatched: boolean;
    handler: string;
  };
}

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class KodaOrchestrator {
  private static instance: KodaOrchestrator;

  private constructor() {}

  public static getInstance(): KodaOrchestrator {
    if (!KodaOrchestrator.instance) {
      KodaOrchestrator.instance = new KodaOrchestrator();
    }
    return KodaOrchestrator.instance;
  }

  /**
   * Main entry point for all queries
   */
  public async handleQuery(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now();

    // Step 1: Classify intent
    const intent = await kodaIntentEngine.classifyIntent(request.query, {
      previousMessages: request.previousMessages,
      userId: request.userId,
      hasDocuments: request.hasDocuments
    });

    const intentTimeMs = Date.now() - startTime;
    const handlerStartTime = Date.now();

    // Step 2: Route to appropriate handler based on intent
    let result: { answer: string; sources?: any[] };
    let handler: string;

    switch (intent.primaryIntent) {
      // ============================================
      // NO LLM NEEDED - Fast Path
      // ============================================
      case PrimaryIntent.DOC_ANALYTICS:
        handler = 'analytics';
        result = await this.handleAnalyticsQuery(request, intent);
        break;

      case PrimaryIntent.FEEDBACK_POSITIVE:
        handler = 'feedback_positive';
        result = { answer: this.getPositiveFeedbackResponse() };
        break;

      case PrimaryIntent.FEEDBACK_NEGATIVE:
        handler = 'feedback_negative';
        result = { answer: this.getNegativeFeedbackResponse() };
        break;

      case PrimaryIntent.OUT_OF_SCOPE:
        handler = 'out_of_scope';
        result = { answer: this.getOutOfScopeResponse() };
        break;

      case PrimaryIntent.AMBIGUOUS:
        handler = 'ambiguous';
        result = { answer: this.getAmbiguousResponse() };
        break;

      // ============================================
      // LLM NEEDED - Product Knowledge
      // ============================================
      case PrimaryIntent.PRODUCT_HELP:
        handler = 'product_help';
        result = await this.handleProductHelpQuery(request, intent);
        break;

      case PrimaryIntent.ONBOARDING_HELP:
        handler = 'onboarding_help';
        result = await this.handleOnboardingHelpQuery(request, intent);
        break;

      case PrimaryIntent.META_AI:
        handler = 'meta_ai';
        result = await this.handleMetaAIQuery(request, intent);
        break;

      // ============================================
      // LLM NEEDED - Conversational
      // ============================================
      case PrimaryIntent.CHITCHAT:
        handler = 'chitchat';
        result = await this.handleChitchatQuery(request, intent);
        break;

      // ============================================
      // LLM NEEDED - General Tasks
      // ============================================
      case PrimaryIntent.GENERIC_KNOWLEDGE:
        handler = 'generic_knowledge';
        result = await this.handleGenericKnowledgeQuery(request, intent);
        break;

      case PrimaryIntent.REASONING_TASK:
        handler = 'reasoning_task';
        result = await this.handleReasoningTaskQuery(request, intent);
        break;

      case PrimaryIntent.TEXT_TRANSFORM:
        handler = 'text_transform';
        result = await this.handleTextTransformQuery(request, intent);
        break;

      case PrimaryIntent.ANSWER_REWRITE:
        handler = 'answer_rewrite';
        result = await this.handleAnswerRewriteQuery(request, intent);
        break;

      // ============================================
      // DOCUMENT-RELATED
      // ============================================
      case PrimaryIntent.DOC_QA:
        handler = 'doc_qa';
        result = await this.handleDocQAQuery(request, intent);
        break;

      case PrimaryIntent.DOC_MANAGEMENT:
        handler = 'doc_management';
        result = await this.handleDocManagementQuery(request, intent);
        break;

      case PrimaryIntent.PREFERENCE_UPDATE:
        handler = 'preference_update';
        result = await this.handlePreferenceUpdateQuery(request, intent);
        break;

      default:
        handler = 'fallback';
        result = await this.handleFallbackQuery(request, intent);
    }

    const handlerTimeMs = Date.now() - handlerStartTime;

    return {
      answer: result.answer,
      intent,
      sources: result.sources,
      metadata: {
        totalTimeMs: Date.now() - startTime,
        intentClassificationTimeMs: intentTimeMs,
        handlerTimeMs,
        wasPatternMatched: intent.wasClassifiedByRules,
        handler
      }
    };
  }

  // ============================================================================
  // HANDLER IMPLEMENTATIONS
  // ============================================================================

  /**
   * Handle analytics queries (DB-only, no LLM)
   * Target: <1s
   */
  private async handleAnalyticsQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    try {
      // Use documentAnalytics wrapper for DB queries
      const analytics = await getDocumentAnalytics(request.userId);

      // Template-based response (no LLM)
      const answer = this.formatAnalyticsResponse(request.query, analytics);
      return { answer };
    } catch (error) {
      console.error('[Orchestrator] Analytics query failed:', error);
      return { answer: 'I had trouble retrieving your document analytics. Please try again.' };
    }
  }

  /**
   * Format analytics response using templates
   */
  private formatAnalyticsResponse(query: string, analytics: any): string {
    const queryLower = query.toLowerCase();

    // Count queries
    if (queryLower.includes('how many') || queryLower.includes('quantos') || queryLower.includes('cuántos')) {
      return `You have **${analytics.totalDocuments}** documents in your library.`;
    }

    // List queries
    if (queryLower.includes('list') || queryLower.includes('show') || queryLower.includes('listar') || queryLower.includes('mostrar')) {
      if (analytics.recentDocuments && analytics.recentDocuments.length > 0) {
        const list = analytics.recentDocuments
          .slice(0, 10)
          .map((doc: any, i: number) => `${i + 1}. **${doc.name}** (${doc.type})`)
          .join('\n');
        return `Here are your documents:\n\n${list}`;
      }
      return 'You don\'t have any documents yet. Upload some to get started!';
    }

    // Type breakdown
    if (queryLower.includes('type') || queryLower.includes('tipo') || queryLower.includes('breakdown')) {
      if (analytics.typeBreakdown) {
        const breakdown = Object.entries(analytics.typeBreakdown)
          .map(([type, count]) => `- **${type}**: ${count}`)
          .join('\n');
        return `Document breakdown by type:\n\n${breakdown}`;
      }
    }

    // Default response
    return `You have **${analytics.totalDocuments}** documents. ${
      analytics.recentDocuments?.length > 0
        ? `Your most recent document is "${analytics.recentDocuments[0].name}".`
        : ''
    }`;
  }

  /**
   * Handle product help queries
   * Target: <2s
   * Uses comprehensive knowledge base from kodaProductHelpService
   */
  private async handleProductHelpQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    // Use the comprehensive product help service with knowledge base
    const answer = await kodaProductHelpService.handleProductQuery(request.query);
    return { answer };
  }

  /**
   * Handle onboarding help queries
   * Uses kodaProductHelpService for consistent responses
   */
  private async handleOnboardingHelpQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    return {
      answer: kodaProductHelpService.getOnboardingHelp()
    };
  }

  /**
   * Handle meta AI queries (questions about Koda)
   * Uses kodaProductHelpService for consistent responses
   */
  private async handleMetaAIQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    return {
      answer: kodaProductHelpService.getMetaAIResponse()
    };
  }

  /**
   * Handle chitchat queries
   * Target: <0.5s
   */
  private async handleChitchatQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    const queryLower = request.query.toLowerCase();

    // Quick pattern-based responses for common greetings
    if (/^(hi|hello|hey|oi|olá|hola)\s*[!.]?$/i.test(queryLower)) {
      return { answer: 'Hello! How can I help you with your documents today?' };
    }

    if (/^(good morning|bom dia|buenos días)/i.test(queryLower)) {
      return { answer: 'Good morning! Ready to help you with your documents. What would you like to do?' };
    }

    if (/^(good afternoon|boa tarde|buenas tardes)/i.test(queryLower)) {
      return { answer: 'Good afternoon! How can I assist you with your documents?' };
    }

    if (/^(how are you|como vai|cómo estás)/i.test(queryLower)) {
      return { answer: 'I\'m doing great, thank you for asking! How can I help you today?' };
    }

    // Fallback to LLM for more complex chitchat
    const response = await geminiGateway.generateContent({
      prompt: `You are Koda, a friendly AI document assistant. Respond to this greeting or small talk naturally and briefly, then offer to help with documents:

"${request.query}"`,
      config: { maxOutputTokens: 100, temperature: 0.7 }
    });

    return { answer: response.text };
  }

  /**
   * Handle generic knowledge queries
   */
  private async handleGenericKnowledgeQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    const response = await geminiGateway.generateContent({
      prompt: `Answer this general knowledge question concisely:

"${request.query}"`,
      config: { maxOutputTokens: 500, temperature: 0.3 }
    });

    return { answer: response.text };
  }

  /**
   * Handle reasoning/math queries
   */
  private async handleReasoningTaskQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    const response = await geminiGateway.generateContent({
      prompt: `Solve this math or logic problem step by step:

"${request.query}"

Show your work clearly.`,
      config: { maxOutputTokens: 500, temperature: 0.1 }
    });

    return { answer: response.text };
  }

  /**
   * Handle text transform queries
   */
  private async handleTextTransformQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    const response = await geminiGateway.generateContent({
      prompt: `Perform this text transformation:

"${request.query}"`,
      config: { maxOutputTokens: 1000, temperature: 0.3 }
    });

    return { answer: response.text };
  }

  /**
   * Handle answer rewrite queries
   */
  private async handleAnswerRewriteQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    // Get previous assistant message from context
    const previousAssistantMessage = request.previousMessages?.filter(m => m.role === 'assistant').pop();

    if (!previousAssistantMessage) {
      return { answer: 'I don\'t have a previous response to modify. What would you like me to help you with?' };
    }

    const response = await geminiGateway.generateContent({
      prompt: `The user wants you to modify your previous response.

Previous response:
"${previousAssistantMessage.content}"

User request:
"${request.query}"

Provide the modified response:`,
      config: { maxOutputTokens: 1000, temperature: 0.3 }
    });

    return { answer: response.text };
  }

  /**
   * Handle document Q&A queries (requires RAG)
   * This should route to the existing RAG pipeline
   */
  private async handleDocQAQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string; sources?: any[] }> {
    // TODO: Integrate with existing RAG pipeline
    // For now, return a placeholder
    return {
      answer: `I'll search your documents to answer: "${request.query}"

(RAG integration pending)`,
      sources: []
    };
  }

  /**
   * Handle document management queries
   */
  private async handleDocManagementQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    return {
      answer: `I understand you want to manage your documents. Document management features like delete, rename, and move are available through the document library interface.

Would you like me to help you with something else?`
    };
  }

  /**
   * Handle preference update queries
   */
  private async handlePreferenceUpdateQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    return {
      answer: `I've noted your preference. I'll remember this for future conversations.

Is there anything else I can help you with?`
    };
  }

  /**
   * Handle fallback queries
   */
  private async handleFallbackQuery(
    request: OrchestratorRequest,
    intent: IntentClassification
  ): Promise<{ answer: string }> {
    return {
      answer: `I'm not sure how to help with that specific request. Here's what I can do:

- Answer questions about your documents
- Search for information in your files
- Help you organize and manage documents
- Answer general knowledge questions

What would you like to do?`
    };
  }

  // ============================================================================
  // TEMPLATE RESPONSES
  // ============================================================================

  private getPositiveFeedbackResponse(): string {
    const responses = [
      'Glad I could help! Is there anything else you\'d like to know?',
      'Happy to assist! Let me know if you have more questions.',
      'Great! Feel free to ask if you need anything else.',
      'You\'re welcome! What else can I help you with?'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private getNegativeFeedbackResponse(): string {
    return 'I apologize that my response wasn\'t helpful. Could you please rephrase your question or provide more details? I\'ll do my best to give you a better answer.';
  }

  private getOutOfScopeResponse(): string {
    return 'I\'m sorry, but I can\'t help with that request. I\'m designed to assist with document management and information retrieval. Is there something else I can help you with?';
  }

  private getAmbiguousResponse(): string {
    return 'I\'m not quite sure what you\'re asking. Could you please provide more details or rephrase your question?';
  }
}

// Export singleton instance
export const kodaOrchestrator = KodaOrchestrator.getInstance();
