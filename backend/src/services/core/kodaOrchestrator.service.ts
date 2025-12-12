/**
 * Koda Orchestrator Service V3 - Central Orchestrator for RAG Requests
 *
 * This service is the single entry point for all Retrieval-Augmented Generation (RAG) chat requests.
 * It orchestrates the entire flow: intent classification, routing, retrieval, answering, formatting,
 * fallback handling, and analytics logging.
 *
 * Supported Primary Intents:
 * - ANALYTICS: Routes to analytics engine and formatting pipeline
 * - SEARCH: Routes to document search and formatting pipeline
 * - DOCUMENT_QNA: Routes through retrieval, answer, and formatting pipelines
 * - CHITCHAT: Light LLM or chitchat path
 * - META_AI: Answers from capabilities catalog via answer engine
 * - PRODUCT_HELP: Answers from product help service
 *
 * Error handling and low confidence fallback logic is integrated.
 *
 * Multilingual support (English, Portuguese, Spanish) is supported via intent classification and formatting.
 *
 * Usage:
 * - Controllers call `handleChat` for standard requests
 * - Streaming support via `handleChatStreaming`
 *
 * Performance:
 * - Designed for low latency and high throughput
 *
 * Dependencies:
 * - All dependencies are injected via constructor for testability and modularity
 * - Uses only ragV3.types.ts types
 */

import type {
  IntentClassificationV3,
  PrimaryIntent,
  AnswerRequest,
  AnswerResponse,
} from '../../types/ragV3.types';

import { KodaIntentEngineService } from './kodaIntentEngine.service';
import { KodaRetrievalEngineV3 } from './kodaRetrievalEngineV3.service';
import { KodaAnswerEngineV3 } from './kodaAnswerEngineV3.service';
import { KodaFallbackEngineService } from './kodaFallbackEngine.service';
import { KodaProductHelpService } from './kodaProductHelp.service';
import { KodaDocumentListingFormatterService } from './kodaDocumentListingFormatter.service';

import { Writable } from 'stream';

// Re-export PrimaryIntent for external use
export { PrimaryIntent } from '../../types/ragV3.types';

export interface RagChatRequestV3 {
  userId: string;
  query: string;
  language?: 'en' | 'pt' | 'es';
  context?: any;
  conversationId?: string;
  attachedDocumentIds?: string[];
}

export interface RagChatResponseV3 {
  userId: string;
  query: string;
  language: string;
  primaryIntent: PrimaryIntent;
  answer: string;
  sourceDocuments: any[];
  confidenceScore: number;
  timestamp: string;
}

export class KodaOrchestratorService {
  private intentEngine: KodaIntentEngineService;
  private retrievalEngine: KodaRetrievalEngineV3;
  private answerEngine: KodaAnswerEngineV3;
  private fallbackEngine: KodaFallbackEngineService;
  private productHelp: KodaProductHelpService;
  private docListFormatter: KodaDocumentListingFormatterService;

  constructor(deps?: {
    intentEngine?: KodaIntentEngineService;
    retrievalEngine?: KodaRetrievalEngineV3;
    answerEngine?: KodaAnswerEngineV3;
    fallbackEngine?: KodaFallbackEngineService;
    productHelp?: KodaProductHelpService;
    docListFormatter?: KodaDocumentListingFormatterService;
  }) {
    this.intentEngine = deps?.intentEngine ?? new KodaIntentEngineService();
    this.retrievalEngine = deps?.retrievalEngine ?? new KodaRetrievalEngineV3();
    this.answerEngine = deps?.answerEngine ?? new KodaAnswerEngineV3();
    this.fallbackEngine = deps?.fallbackEngine ?? new KodaFallbackEngineService();
    this.productHelp = deps?.productHelp ?? new KodaProductHelpService();
    this.docListFormatter = deps?.docListFormatter ?? new KodaDocumentListingFormatterService();
  }

  /**
   * Main entry point for handling a RAG chat request.
   * Orchestrates intent classification, routing, retrieval, answering, formatting, and fallback.
   *
   * @param request - Incoming chat request with userId, query, language, and context
   * @returns Promise resolving to a fully formatted RagChatResponseV3
   * @throws Error on invalid input or internal failures
   */
  public async handleChat(request: RagChatRequestV3): Promise<RagChatResponseV3> {
    const startTime = Date.now();

    // Step 1: Normalize & validate
    const normalizedQuery = request.query?.trim() ?? '';
    if (!normalizedQuery) {
      throw new Error('Query cannot be empty');
    }

    // Step 2: Intent Classification
    let intent: IntentClassificationV3;
    try {
      intent = await this.intentEngine.classify({
        userId: request.userId,
        query: normalizedQuery,
        userLanguageHint: request.language,
      });
    } catch (err) {
      // Intent classification failure fallback
      return this.buildFallbackResponse(request, `Intent classification failed: ${(err as Error).message}`);
    }

    // Step 3: Short-circuit intents with direct answers (CHITCHAT, META_AI, PRODUCT_HELP)
    switch (intent.primaryIntent) {
      case 'CHITCHAT':
        return this.handleChitchat(request, intent);

      case 'META_AI':
        return this.handleMetaAI(request, intent);

      case 'PRODUCT_HELP':
        return this.handleProductHelp(request, intent);

      default:
        break; // Continue to routing for other intents
    }

    // Step 4: Route by intent to analytics, search, or document QnA
    try {
      switch (intent.primaryIntent) {
        case 'ANALYTICS':
          return await this.handleAnalytics(request, intent);

        case 'SEARCH':
          return await this.handleSearch(request, intent);

        case 'DOCUMENT_QNA':
          return await this.handleDocumentQnA(request, intent);

        default:
          // Unknown or unsupported intent - fallback
          return this.buildFallbackResponse(request, `Unsupported intent: ${intent.primaryIntent}`);
      }
    } catch (err) {
      // Catch any internal errors and fallback
      return this.buildFallbackResponse(request, `Internal error: ${(err as Error).message}`);
    }
  }

  /**
   * Streaming version of handleChat.
   * Calls answerEngine in streaming mode and writes to provided stream.
   *
   * @param request - Incoming chat request
   * @param stream - Writable stream to write partial responses
   */
  public async handleChatStreaming(request: RagChatRequestV3, stream: Writable): Promise<void> {
    // Normalize query
    const normalizedQuery = request.query?.trim() ?? '';
    if (!normalizedQuery) {
      stream.write('Error: Query cannot be empty');
      stream.end();
      return;
    }

    // Intent classification
    let intent: IntentClassificationV3;
    try {
      intent = await this.intentEngine.classify({
        userId: request.userId,
        query: normalizedQuery,
        userLanguageHint: request.language,
      });
    } catch (err) {
      stream.write(`Error: Intent classification failed: ${(err as Error).message}`);
      stream.end();
      return;
    }

    // Handle short-circuit intents in streaming mode
    switch (intent.primaryIntent) {
      case 'CHITCHAT':
        // For streaming chitchat, delegate to answerEngine streaming with light prompt
        await this.answerEngine.streamAnswer({
          userId: request.userId,
          query: normalizedQuery,
          intent,
          stream,
          context: request.context,
          language: intent.language,
        });
        stream.end();
        return;

      case 'META_AI':
        // Meta AI streaming answer
        await this.answerEngine.streamAnswer({
          userId: request.userId,
          query: normalizedQuery,
          intent,
          stream,
          context: request.context,
          language: intent.language,
          metaMode: true,
        });
        stream.end();
        return;

      case 'PRODUCT_HELP':
        // Product help is static markdown, stream directly
        const helpMarkdown = this.productHelp.buildAnswer({
          query: normalizedQuery,
          language: intent.language,
        });
        stream.write(helpMarkdown);
        stream.end();
        return;

      default:
        break; // Continue to routing below
    }

    // For analytics, search, and document QnA intents, streaming is not supported yet
    stream.write('Streaming not supported for this intent. Please use standard chat.');
    stream.end();
  }

  /**
   * Handles CHITCHAT intent with a light LLM or chitchat path.
   */
  private async handleChitchat(request: RagChatRequestV3, intent: IntentClassificationV3): Promise<RagChatResponseV3> {
    try {
      const answer = await this.answerEngine.answer({
        userId: request.userId,
        query: request.query,
        intent,
        context: request.context,
        language: intent.language,
        chitchatMode: true,
      });

      return this.buildNonRagResponse(request, intent, answer);
    } catch (err) {
      return this.buildFallbackResponse(request, `Chitchat failed: ${(err as Error).message}`);
    }
  }

  /**
   * Handles META_AI intent by answering from capabilities catalog via answer engine.
   */
  private async handleMetaAI(request: RagChatRequestV3, intent: IntentClassificationV3): Promise<RagChatResponseV3> {
    try {
      const answer = await this.answerEngine.answer({
        userId: request.userId,
        query: request.query,
        intent,
        context: request.context,
        language: intent.language,
        metaMode: true,
      });

      return this.buildNonRagResponse(request, intent, answer);
    } catch (err) {
      return this.buildFallbackResponse(request, `Meta AI failed: ${(err as Error).message}`);
    }
  }

  /**
   * Handles PRODUCT_HELP intent by calling productHelp service.
   */
  private handleProductHelp(request: RagChatRequestV3, intent: IntentClassificationV3): RagChatResponseV3 {
    const helpMarkdown = this.productHelp.buildAnswer({
      query: request.query,
      language: intent.language,
    });

    return this.buildNonRagResponse(request, intent, helpMarkdown);
  }

  /**
   * Handles ANALYTICS intent by querying analytics engine and formatting the answer.
   */
  private async handleAnalytics(request: RagChatRequestV3, intent: IntentClassificationV3): Promise<RagChatResponseV3> {
    const formattedAnswer = this.docListFormatter.formatAnalyticsAnswer({
      userId: request.userId,
      query: request.query,
      intent,
      language: intent.language,
    });

    return this.buildNonRagResponse(request, intent, formattedAnswer);
  }

  /**
   * Handles SEARCH intent by querying document search engine and formatting the results.
   */
  private async handleSearch(request: RagChatRequestV3, intent: IntentClassificationV3): Promise<RagChatResponseV3> {
    const formattedAnswer = this.docListFormatter.formatSearchResults({
      userId: request.userId,
      query: request.query,
      intent,
      language: intent.language,
    });

    return this.buildNonRagResponse(request, intent, formattedAnswer);
  }

  /**
   * Handles DOCUMENT_QNA intent by running retrieval, answer, and formatting pipelines.
   * Falls back to fallbackEngine on errors or low confidence.
   */
  private async handleDocumentQnA(request: RagChatRequestV3, intent: IntentClassificationV3): Promise<RagChatResponseV3> {
    try {
      // Step 1: Retrieve relevant documents
      const retrievedDocs = await this.retrievalEngine.retrieve({
        userId: request.userId,
        query: request.query,
        intent,
        context: request.context,
        language: intent.language,
      });

      if (!retrievedDocs || retrievedDocs.length === 0) {
        // No docs found - fallback
        return this.fallbackEngine.handleFallback(request, intent, 'NO_RELEVANT_CONTENT');
      }

      // Step 2: Generate answer using answer engine
      const answerResult = await this.answerEngine.answerWithDocs({
        userId: request.userId,
        query: request.query,
        intent,
        documents: retrievedDocs,
        context: request.context,
        language: intent.language,
      });

      // Step 3: Check confidence and fallback if low
      if (answerResult.confidenceScore !== undefined && answerResult.confidenceScore < 0.5) {
        return this.fallbackEngine.handleFallback(request, intent, 'NO_RELEVANT_CONTENT');
      }

      // Step 4: Format final answer with documents and metadata
      const formattedAnswer = this.docListFormatter.formatAnswer({
        answer: answerResult.answer,
        documents: retrievedDocs,
        intent,
        language: intent.language,
      });

      return {
        userId: request.userId,
        query: request.query,
        language: intent.language,
        primaryIntent: intent.primaryIntent as PrimaryIntent,
        answer: formattedAnswer,
        sourceDocuments: retrievedDocs,
        confidenceScore: answerResult.confidenceScore ?? 1.0,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      // On any error, fallback
      return this.fallbackEngine.handleFallback(request, intent, 'ERROR_GENERATION');
    }
  }

  /**
   * Builds a standard non-RAG response with a markdown answer.
   * Used for CHITCHAT, META_AI, PRODUCT_HELP, ANALYTICS, SEARCH.
   */
  private buildNonRagResponse(
    request: RagChatRequestV3,
    intent: IntentClassificationV3,
    markdownAnswer: string,
  ): RagChatResponseV3 {
    return {
      userId: request.userId,
      query: request.query,
      language: intent.language,
      primaryIntent: intent.primaryIntent as PrimaryIntent,
      answer: markdownAnswer,
      sourceDocuments: [],
      confidenceScore: 1.0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Builds a fallback response using fallback engine or a simple error message.
   */
  private buildFallbackResponse(request: RagChatRequestV3, errorMessage: string): RagChatResponseV3 {
    const fallbackAnswer = `I'm sorry, I couldn't process your request. ${errorMessage}`;

    return {
      userId: request.userId,
      query: request.query,
      language: request.language ?? 'en',
      primaryIntent: 'DOCUMENT_QNA' as PrimaryIntent,
      answer: fallbackAnswer,
      sourceDocuments: [],
      confidenceScore: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

export default KodaOrchestratorService;
