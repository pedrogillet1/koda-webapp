/**
 * Koda RAG Service V2
 *
 * Main entry point for all query handling.
 * Routes to kodaOrchestrator for intent classification and response generation.
 *
 * Performance Targets:
 * - Analytics: <1s (was 7.8s)
 * - Product Help: <2s (was 8.3s)
 * - Chitchat: <0.5s (was 1.9s)
 * - Doc Content: 5-7s (was 8-10s)
 */

import cacheService from './cache.service';
import { kodaOrchestrator, OrchestratorRequest, OrchestratorResponse } from './kodaOrchestrator.service';
import { PrimaryIntent } from '../types/intentV2.types';
import type {
  AnswerRequest,
  AnswerResponse,
  RagStatus,
  AnswerType,
  Citation,
  ConversationContext
} from '../types/ragV1.types';

// ============================================================================
// RAG Service Class
// ============================================================================

class RagServiceV2 {
  /**
   * Main entry point - handles all query types
   * Uses kodaOrchestrator for intent classification and routing
   */
  async handleQuery(request: AnswerRequest): Promise<AnswerResponse> {
    const startTime = Date.now();

    try {
      // Build orchestrator request
      const orchestratorRequest: OrchestratorRequest = {
        query: request.query,
        userId: request.userId,
        conversationId: request.sessionId,
        previousMessages: this.convertConversationContext(request.conversationContext),
        hasDocuments: true // TODO: Check actual document count
      };

      // Call kodaOrchestrator
      const orchestratorResponse = await kodaOrchestrator.handleQuery(orchestratorRequest);

      // Convert to AnswerResponse format
      const answerResponse = this.convertToAnswerResponse(
        request,
        orchestratorResponse,
        Date.now() - startTime
      );

      console.log('[RagService] Query handled:', {
        intent: orchestratorResponse.intent.primaryIntent,
        handler: orchestratorResponse.metadata.handler,
        wasPatternMatched: orchestratorResponse.metadata.wasPatternMatched,
        totalTimeMs: orchestratorResponse.metadata.totalTimeMs
      });

      return answerResponse;

    } catch (error) {
      console.error('[RagService] Error:', error);
      return this.buildErrorResponse(request, error, Date.now() - startTime);
    }
  }

  /**
   * Convert conversation context to previous messages format
   */
  private convertConversationContext(
    context?: ConversationContext
  ): Array<{ role: string; content: string }> | undefined {
    if (!context?.lastNTurns) return undefined;

    return context.lastNTurns.map(turn => ({
      role: turn.role,
      content: turn.content
    }));
  }

  /**
   * Convert orchestrator response to AnswerResponse format
   */
  private convertToAnswerResponse(
    request: AnswerRequest,
    response: OrchestratorResponse,
    totalTimeMs: number
  ): AnswerResponse {
    // Map intent to answer type
    const answerType = this.mapIntentToAnswerType(response.intent.primaryIntent);

    // Map intent to RAG status
    const ragStatus = this.mapIntentToRagStatus(response.intent.primaryIntent, response.sources);

    // Build citations from sources
    const citations = this.buildCitations(response.sources);

    return {
      text: response.answer,
      answerType,
      citations,
      docsUsed: response.sources?.map(s => s.documentId) || [],
      conversationContext: request.conversationContext || {
        lastNTurns: [],
        sessionId: '', userId: ''
      },
      metadata: {
        ragStatus,
        retrievalTimeMs: response.metadata.handlerTimeMs,
        generationTimeMs: response.metadata.handlerTimeMs,
        totalTimeMs: response.metadata.totalTimeMs
      }
    };
  }

  /**
   * Map PrimaryIntent to AnswerType
   */
  private mapIntentToAnswerType(intent: PrimaryIntent): AnswerType {
    switch (intent) {
      case PrimaryIntent.DOC_ANALYTICS:
        return 'analytics';
      case PrimaryIntent.DOC_QA:
        return 'doc_factual_single';
      case PrimaryIntent.CHITCHAT:
      case PrimaryIntent.META_AI:
      case PrimaryIntent.PRODUCT_HELP:
      case PrimaryIntent.ONBOARDING_HELP:
      case PrimaryIntent.GENERIC_KNOWLEDGE:
      case PrimaryIntent.REASONING_TASK:
      case PrimaryIntent.TEXT_TRANSFORM:
        return 'generic_chat';
      case PrimaryIntent.OUT_OF_SCOPE:
      case PrimaryIntent.AMBIGUOUS:
        return 'fallback_no_match';
      default:
        return 'generic_chat';
    }
  }

  /**
   * Map intent to RAG status
   */
  private mapIntentToRagStatus(intent: PrimaryIntent, sources?: any[]): RagStatus {
    // If we have sources, RAG was successful
    if (sources && sources.length > 0) {
      return 'SUCCESS';
    }

    // If no RAG was needed (non-document intents)
    switch (intent) {
      case PrimaryIntent.CHITCHAT:
      case PrimaryIntent.META_AI:
      case PrimaryIntent.PRODUCT_HELP:
      case PrimaryIntent.ONBOARDING_HELP:
      case PrimaryIntent.GENERIC_KNOWLEDGE:
      case PrimaryIntent.REASONING_TASK:
      case PrimaryIntent.TEXT_TRANSFORM:
      case PrimaryIntent.DOC_ANALYTICS:
      case PrimaryIntent.FEEDBACK_POSITIVE:
      case PrimaryIntent.FEEDBACK_NEGATIVE:
        return 'SUCCESS'; // No RAG needed, so "success"
      case PrimaryIntent.DOC_QA:
        return sources?.length ? 'SUCCESS' : 'NO_MATCH';
      default:
        return 'SUCCESS';
    }
  }

  /**
   * Build citations from sources
   */
  private buildCitations(sources?: Array<{ documentId: string; documentName: string; chunk: string }>): Citation[] {
    if (!sources || sources.length === 0) return [];

    return sources.map((source, index) => ({
      id: String(index + 1),
      documentId: source.documentId,
      title: source.documentName,
      filename: source.documentName,
      type: 'inline' as const,
      occurrences: 1
    }));
  }

  /**
   * Build error response
   */
  private buildErrorResponse(request: AnswerRequest, error: unknown, totalTimeMs: number): AnswerResponse {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      text: 'I apologize, but I encountered an error processing your request. Please try again.',
      answerType: 'fallback_error',
      citations: [],
      docsUsed: [],
      conversationContext: request.conversationContext || {
        lastNTurns: [],
        sessionId: '', userId: ''
      },
      metadata: {
        ragStatus: 'ERROR',
        totalTimeMs
      }
    };
  }
}

// Create singleton instance
export const ragServiceV2 = new RagServiceV2();
export const ragService = ragServiceV2;
export default ragServiceV2;

// Re-export types for consumers
export type { AnswerRequest, AnswerResponse } from '../types/ragV1.types';

// Cache invalidation helper used by document.service.ts
export function invalidateFileListingCache(userId: string): void {
  const cacheKey = cacheService.generateKey('file-listing', userId);
  cacheService.set(cacheKey, null, { ttl: 0 });
}
