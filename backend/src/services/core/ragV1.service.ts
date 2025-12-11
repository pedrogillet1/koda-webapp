/**
 * Koda RAG Service V1 - Main Orchestrator
 *
 * Single golden path for all 8 flows:
 * 1. Analytics (metadata queries)
 * 2. Simple factual (single doc)
 * 3. Multi-point extraction
 * 4. Multi-doc search
 * 5. Multi-doc comparison
 * 6. Follow-up
 * 7. Fallback (no docs/no match)
 * 8. Generic chat (optional)
 *
 * Theme 1 from notes: Centralize the RAG pipeline
 */

import type {
  AnswerRequest,
  AnswerResponse,
  IntentClassification,
  RagContext,
  RagStatus,
  AnswerType,
} from '../../types/ragV1.types';

import { kodaIntentEngineV1 } from './kodaIntentEngineV1.service';
import { kodaRetrievalEngineV1 } from '../retrieval/kodaRetrievalEngineV1.service';
import { kodaAnswerEngineV1 } from './kodaAnswerEngineV1.service';
import { kodaFallbackEngineV1 } from './kodaFallbackEngineV1.service';
import { formattingPipelineV1 } from '../formatting/formattingPipelineV1.service';

// ============================================================================
// RAG Service Class
// ============================================================================

class RagServiceV1 {
  /**
   * Main entry point - handles all query types
   */
  async handleQuery(request: AnswerRequest): Promise<AnswerResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Classify intent
      const intent = request.intent || kodaIntentEngineV1.classifyIntent(
        request.query,
        request.conversationContext
      );

      console.log('[RagServiceV1] Intent:', intent.domain, intent.questionType);

      // Step 2: Route to appropriate handler
      let response: AnswerResponse;

      switch (intent.domain) {
        case 'analytics':
          response = await this.handleAnalyticsQuery(request, intent);
          break;

        case 'doc_search':
          response = await this.handleDocSearchQuery(request, intent);
          break;

        case 'doc_content':
          response = await this.handleDocContentQuery(request, intent);
          break;

        case 'generic':
          response = await this.handleGenericQuery(request, intent);
          break;

        default:
          response = await this.handleFallbackQuery(request, intent, 'ERROR');
      }

      // Add total time
      response.metadata.totalTimeMs = Date.now() - startTime;

      return response;

    } catch (error) {
      console.error('[RagServiceV1] Error:', error);
      return this.buildErrorResponse(request, error);
    }
  }

  /**
   * Flow 1: Analytics (metadata queries)
   * No RAG - direct DB queries
   */
  private async handleAnalyticsQuery(
    request: AnswerRequest,
    intent: IntentClassification
  ): Promise<AnswerResponse> {
    // TODO: Integrate with documentAnalytics.service
    const answer = `Você tem **X documentos** na sua conta.`;

    return {
      text: answer,
      answerType: 'analytics',
      citations: [],
      docsUsed: [],
      conversationContext: request.conversationContext || this.buildEmptyContext(request),
      metadata: {
        ragStatus: 'SUCCESS',
        totalTimeMs: 0,
      },
    };
  }

  /**
   * Flow 4: Document search
   * Find documents by title/tags - no RAG
   */
  private async handleDocSearchQuery(
    request: AnswerRequest,
    intent: IntentClassification
  ): Promise<AnswerResponse> {
    // TODO: Integrate with document search
    const answer = `Encontrei **X documentos** sobre "${request.query}".`;

    return {
      text: answer,
      answerType: 'doc_search_results',
      citations: [],
      docsUsed: [],
      conversationContext: request.conversationContext || this.buildEmptyContext(request),
      metadata: {
        ragStatus: 'SUCCESS',
        totalTimeMs: 0,
      },
    };
  }

  /**
   * Flows 2, 3, 5, 6: Document content queries
   * Main RAG path
   */
  private async handleDocContentQuery(
    request: AnswerRequest,
    intent: IntentClassification
  ): Promise<AnswerResponse> {
    const retrievalStart = Date.now();

    // Step 1: Retrieve chunks
    const { context, status } = await kodaRetrievalEngineV1.retrieve(
      request.query,
      request.userId,
      intent
    );

    const retrievalTimeMs = Date.now() - retrievalStart;

    // Step 2: Check if we should skip Gemini
    if (kodaFallbackEngineV1.shouldSkipGemini(status)) {
      return this.handleFallbackQuery(request, intent, status);
    }

    // Step 3: Generate answer
    const generationStart = Date.now();
    const { answer, usage } = await kodaAnswerEngineV1.generateAnswer(
      request.query,
      context,
      status,
      intent
    );
    const generationTimeMs = Date.now() - generationStart;

    // Step 4: Check for fallback marker in answer
    const parsed = kodaAnswerEngineV1.parseGeminiResponse(answer);
    if (parsed.hasFallbackMarker) {
      return this.handleFallbackQuery(request, intent, status);
    }

    // Step 5: Format answer (4-layer pipeline)
    const formattedAnswer = await this.formatAnswer(
      answer,
      context,
      intent,
      status
    );

    // Step 6: Build response
    const answerType = this.determineAnswerType(intent);

    return {
      text: formattedAnswer.text,
      answerType,
      citations: formattedAnswer.citations,
      docsUsed: context.documentsUsed,
      conversationContext: this.updateContext(request, context),
      metadata: {
        ragStatus: status,
        retrievalTimeMs,
        generationTimeMs,
        totalTimeMs: 0,
      },
    };
  }

  /**
   * Flow 7: Fallback (no docs, no match, processing, error)
   */
  private async handleFallbackQuery(
    request: AnswerRequest,
    intent: IntentClassification,
    ragStatus: RagStatus
  ): Promise<AnswerResponse> {
    const fallback = kodaFallbackEngineV1.buildFallbackResponse(
      ragStatus,
      intent,
      intent.targetDocId ? 'Document Title' : undefined
    );

    const answerType = this.determineFallbackAnswerType(ragStatus);

    return {
      text: fallback.message,
      answerType,
      citations: [],
      docsUsed: [],
      conversationContext: request.conversationContext || this.buildEmptyContext(request),
      metadata: {
        ragStatus,
        totalTimeMs: 0,
      },
    };
  }

  /**
   * Flow 8: Generic chat (optional)
   */
  private async handleGenericQuery(
    request: AnswerRequest,
    intent: IntentClassification
  ): Promise<AnswerResponse> {
    // For V1, disable generic chat
    const fallback = kodaFallbackEngineV1.buildFallbackResponse(
      'NO_MATCH',
      intent
    );

    return {
      text: fallback.message,
      answerType: 'fallback_no_match',
      citations: [],
      docsUsed: [],
      conversationContext: request.conversationContext || this.buildEmptyContext(request),
      metadata: {
        ragStatus: 'NO_MATCH',
        totalTimeMs: 0,
      },
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Format answer through 4-layer pipeline
   */
  private async formatAnswer(
    rawAnswer: string,
    context: RagContext,
    intent: IntentClassification,
    ragStatus: RagStatus
  ): Promise<{ text: string; citations: any[] }> {
    try {
      const formatted = await formattingPipelineV1.process(rawAnswer, {
        intent,
        ragStatus,
        citations: [],
        answerType: this.determineAnswerType(intent),
      });

      return {
        text: formatted.text,
        citations: formatted.citations,
      };
    } catch (error) {
      console.error('[RagServiceV1] Formatting error:', error);
      return { text: rawAnswer, citations: [] };
    }
  }

  private determineAnswerType(intent: IntentClassification): AnswerType {
    switch (intent.questionType) {
      case 'simple_factual':
        return 'doc_factual_single';
      case 'multi_point_extraction':
        return 'doc_multi_extract';
      case 'comparison':
        return 'doc_comparison';
      case 'follow_up':
        return 'follow_up';
      default:
        return 'doc_factual_single';
    }
  }

  private determineFallbackAnswerType(ragStatus: RagStatus): AnswerType {
    switch (ragStatus) {
      case 'NO_DOCUMENTS':
        return 'fallback_no_docs';
      case 'NO_MATCH':
      case 'NO_MATCH_SINGLE_DOC':
        return 'fallback_no_match';
      case 'PROCESSING':
        return 'fallback_processing';
      default:
        return 'fallback_error';
    }
  }

  private updateContext(request: AnswerRequest, ragContext: RagContext): any {
    const context = request.conversationContext || this.buildEmptyContext(request);
    context.activeDocIds = ragContext.documentsUsed;
    context.lastQuery = request.query;
    return context;
  }

  private buildEmptyContext(request: AnswerRequest): any {
    return {
      sessionId: request.sessionId || 'default',
      userId: request.userId,
      lastNTurns: [],
      activeDocIds: [],
      lastCitations: [],
    };
  }

  private buildErrorResponse(request: AnswerRequest, error: any): AnswerResponse {
    const fallback = kodaFallbackEngineV1.buildFallbackResponse('ERROR');

    return {
      text: fallback.message,
      answerType: 'fallback_error',
      citations: [],
      docsUsed: [],
      conversationContext: request.conversationContext || this.buildEmptyContext(request),
      metadata: {
        ragStatus: 'ERROR',
        totalTimeMs: 0,
      },
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const ragServiceV1 = new RagServiceV1();
export default ragServiceV1;
