/**
 * kodaOrchestratorV3.service.ts
 * 
 * Central orchestrator service - single entry point for all queries.
 * Routes requests by primary intent after gathering workspace stats,
 * classifying intent, applying overrides, detecting multi-intent,
 * and routing accordingly.
 * 
 * Supports intents: ANALYTICS, SEARCH, DOCUMENT_QNA, CHITCHAT, META_AI, and fallback.
 * 
 * Implements robust error handling, logging, and extensible architecture.
 */

import { Logger } from 'tslog';
import { WorkspaceStatsService } from './workspaceStats.service';
import { IntentClassifierService, Intent, IntentClassificationResult } from './intentClassifier.service';
import { OverridesService } from './overrides.service';
import { MultiIntentDetectorService, MultiIntentDetectionResult } from './multiIntentDetector.service';
import { AnalyticsHandler } from './handlers/analytics.handler';
import { SearchHandler } from './handlers/search.handler';
import { DocumentQnAHandler } from './handlers/documentQnA.handler';
import { ChitChatHandler } from './handlers/chitchat.handler';
import { MetaAIHandler } from './handlers/metaAI.handler';
import { FallbackHandler } from './handlers/fallback.handler';

export interface OrchestratorRequest {
  workspaceId: string;
  userId: string;
  query: string;
  metadata?: Record<string, any>;
}

export interface OrchestratorResponse {
  intent: Intent | 'MULTI_INTENT' | 'FALLBACK';
  response: any;
  confidence?: number;
  multiIntentDetails?: MultiIntentDetectionResult;
}

export class KodaOrchestratorV3Service {
  private logger: Logger;

  constructor(
    private workspaceStatsService: WorkspaceStatsService,
    private intentClassifierService: IntentClassifierService,
    private overridesService: OverridesService,
    private multiIntentDetectorService: MultiIntentDetectorService,
    private analyticsHandler: AnalyticsHandler,
    private searchHandler: SearchHandler,
    private documentQnAHandler: DocumentQnAHandler,
    private chitChatHandler: ChitChatHandler,
    private metaAIHandler: MetaAIHandler,
    private fallbackHandler: FallbackHandler,
  ) {
    this.logger = new Logger({ name: 'KodaOrchestratorV3Service' });
  }

  /**
   * Orchestrates the entire flow for a given user query.
   * 
   * Steps:
   * 1. Retrieve workspace stats.
   * 2. Classify the primary intent of the query.
   * 3. Apply any overrides based on workspace/user metadata.
   * 4. Detect if multiple intents are present.
   * 5. Route the query to the appropriate handler based on intent.
   * 
   * @param request OrchestratorRequest containing workspaceId, userId, query, and optional metadata.
   * @returns Promise resolving to OrchestratorResponse with intent and handler response.
   * @throws Error if any step fails or unhandled exceptions occur.
   */
  public async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const { workspaceId, userId, query, metadata } = request;

    this.logger.debug(`Orchestration started for workspace: ${workspaceId}, user: ${userId}`);

    try {
      // Step 1: Retrieve workspace statistics to inform intent classification and routing.
      const workspaceStats = await this.getWorkspaceStats(workspaceId);

      // Step 2: Classify primary intent of the query.
      let classificationResult = await this.classifyIntent(query, workspaceStats);

      // Step 3: Apply overrides based on workspace/user context and metadata.
      classificationResult = await this.applyOverrides(classificationResult, workspaceId, userId, metadata);

      // Step 4: Detect if multiple intents are present in the query.
      const multiIntentResult = await this.detectMultiIntent(query, classificationResult);

      if (multiIntentResult.isMultiIntent) {
        this.logger.info(`Multi-intent detected for workspace: ${workspaceId}, user: ${userId}`, multiIntentResult);

        // For multi-intent, route to a dedicated multi-intent handler or return combined results.
        // Here, we return a combined response with details.
        return {
          intent: 'MULTI_INTENT',
          response: multiIntentResult.responses,
          multiIntentDetails: multiIntentResult,
        };
      }

      // Step 5: Route by primary intent.
      const response = await this.routeByIntent(classificationResult.intent, query, workspaceId, userId, metadata);

      this.logger.debug(`Orchestration completed for workspace: ${workspaceId}, user: ${userId}, intent: ${classificationResult.intent}`);

      return {
        intent: classificationResult.intent,
        response,
        confidence: classificationResult.confidence,
      };
    } catch (error) {
      this.logger.error('Orchestration failed', error);

      // On error, route to fallback handler to ensure graceful degradation.
      const fallbackResponse = await this.fallbackHandler.handle({
        workspaceId,
        userId,
        query,
        metadata,
        error,
      });

      return {
        intent: 'FALLBACK',
        response: fallbackResponse,
      };
    }
  }

  /**
   * Retrieves workspace statistics for the given workspaceId.
   * These stats may include usage metrics, enabled features, user roles, etc.
   * 
   * @param workspaceId Unique identifier for the workspace.
   * @returns Promise resolving to workspace statistics object.
   * @throws Error if retrieval fails.
   */
  private async getWorkspaceStats(workspaceId: string): Promise<Record<string, any>> {
    try {
      const stats = await this.workspaceStatsService.getStats(workspaceId);
      this.logger.debug(`Workspace stats retrieved for workspace: ${workspaceId}`, stats);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to retrieve workspace stats for workspace: ${workspaceId}`, error);
      throw new Error(`Workspace stats retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Classifies the primary intent of the query using the IntentClassifierService.
   * 
   * @param query User query string.
   * @param workspaceStats Workspace statistics to inform classification.
   * @returns Promise resolving to IntentClassificationResult containing intent and confidence.
   * @throws Error if classification fails.
   */
  private async classifyIntent(query: string, workspaceStats: Record<string, any>): Promise<IntentClassificationResult> {
    try {
      const classificationResult = await this.intentClassifierService.classify(query, workspaceStats);
      this.logger.debug(`Intent classified: ${classificationResult.intent} with confidence ${classificationResult.confidence}`);
      return classificationResult;
    } catch (error) {
      this.logger.error('Intent classification failed', error);
      throw new Error(`Intent classification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Applies any overrides to the classified intent based on workspace/user metadata.
   * Overrides can enforce or modify intents based on business rules or user preferences.
   * 
   * @param classificationResult Initial classification result.
   * @param workspaceId Workspace identifier.
   * @param userId User identifier.
   * @param metadata Optional metadata that may influence overrides.
   * @returns Promise resolving to possibly modified IntentClassificationResult.
   * @throws Error if override application fails.
   */
  private async applyOverrides(
    classificationResult: IntentClassificationResult,
    workspaceId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<IntentClassificationResult> {
    try {
      const overriddenResult = await this.overridesService.applyOverrides(
        classificationResult,
        { workspaceId, userId, metadata }
      );
      if (overriddenResult.intent !== classificationResult.intent) {
        this.logger.info(`Intent override applied: ${classificationResult.intent} -> ${overriddenResult.intent}`);
      }
      return overriddenResult;
    } catch (error) {
      this.logger.error('Applying overrides failed', error);
      throw new Error(`Overrides application failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detects if the query contains multiple intents.
   * If multi-intent is detected, returns detailed results including responses for each intent.
   * 
   * @param query User query string.
   * @param classificationResult Primary intent classification result.
   * @returns Promise resolving to MultiIntentDetectionResult.
   * @throws Error if detection fails.
   */
  private async detectMultiIntent(
    query: string,
    classificationResult: IntentClassificationResult
  ): Promise<MultiIntentDetectionResult> {
    try {
      const multiIntentResult = await this.multiIntentDetectorService.detect(query, classificationResult);
      return multiIntentResult;
    } catch (error) {
      this.logger.error('Multi-intent detection failed', error);
      // Fail silently and treat as single intent if detection fails.
      return {
        isMultiIntent: false,
        intents: [classificationResult.intent],
        responses: [],
      };
    }
  }

  /**
   * Routes the query to the appropriate handler based on the detected intent.
   * 
   * @param intent Detected primary intent.
   * @param query User query string.
   * @param workspaceId Workspace identifier.
   * @param userId User identifier.
   * @param metadata Optional metadata.
   * @returns Promise resolving to handler response.
   * @throws Error if routing or handling fails.
   */
  private async routeByIntent(
    intent: Intent,
    query: string,
    workspaceId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    switch (intent) {
      case 'ANALYTICS':
        return this.analyticsHandler.handle({ workspaceId, userId, query, metadata });

      case 'SEARCH':
        return this.searchHandler.handle({ workspaceId, userId, query, metadata });

      case 'DOCUMENT_QNA':
        return this.documentQnAHandler.handle({ workspaceId, userId, query, metadata });

      case 'CHITCHAT':
        return this.chitChatHandler.handle({ workspaceId, userId, query, metadata });

      case 'META_AI':
        return this.metaAIHandler.handle({ workspaceId, userId, query, metadata });

      default:
        this.logger.warn(`Unknown intent '${intent}', routing to fallback handler.`);
        return this.fallbackHandler.handle({ workspaceId, userId, query, metadata });
    }
  }
}
