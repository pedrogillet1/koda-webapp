/**
 * RAG Service Adapter - Compatibility Layer
 *
 * This adapter provides the same interface as the original rag.service.ts
 * but uses the new A+ RAG orchestrator under the hood.
 *
 * This allows for a drop-in replacement without modifying chat.service.ts
 *
 * Usage:
 *   // In chat.service.ts, change:
 *   import ragService from './rag.service';
 *   // To:
 *   import ragService from './rag/rag-service-adapter';
 */

import { ragOrchestratorService } from "./core/rag-orchestrator.service";
import { logger, logError } from "./utils/logger.service";

interface LegacySource {
  id: string;
  documentId: string;
  filename: string;
  documentName: string;
  content: string;
  pageNumber?: number;
  section?: string;
}

interface LegacyRagResult {
  answer: string;
  sources: LegacySource[];
  metadata?: {
    tier: string;
    intent: string;
    executionTimeMs: number;
  };
}

/**
 * Compatibility wrapper for generateAnswer
 * Matches the old signature: generateAnswer(userId, query, conversationId, answerLength, attachedDocumentId)
 */
async function generateAnswer(
  userId: string,
  query: string,
  conversationId: string,
  answerLength?: 'short' | 'medium' | 'summary' | 'long',
  attachedDocumentId?: string | string[]
): Promise<LegacyRagResult> {
  logger.info({ userId, query: query.substring(0, 50), conversationId }, "A+ RAG adapter: generateAnswer called");

  try {
    // Convert attachedDocumentId to array format
    const attachedDocumentIds = attachedDocumentId
      ? Array.isArray(attachedDocumentId)
        ? attachedDocumentId
        : [attachedDocumentId]
      : undefined;

    // Call the new A+ orchestrator
    const result = await ragOrchestratorService.generateAnswer({
      query,
      userId,
      attachedDocumentIds,
      answerLength: answerLength || 'medium',
    });

    // Convert to legacy format with additional fields for compatibility
    const legacySources: LegacySource[] = result.sources.map(s => ({
      id: s.id,
      documentId: s.documentId,
      filename: s.filename,
      documentName: s.filename, // Use filename as documentName
      content: '', // Content is not available from the new orchestrator response
      pageNumber: s.pageNumber,
      section: s.section,
    }));

    return {
      answer: result.content,
      sources: legacySources,
      metadata: {
        tier: result.queryAnalysis.tier,
        intent: result.queryAnalysis.intent,
        executionTimeMs: result.performance.totalDurationMs,
      },
    };

  } catch (error) {
    logError(error as Error, { userId, query }, "A+ RAG adapter: generateAnswer failed");
    return {
      answer: "Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.",
      sources: [],
    };
  }
}

/**
 * Compatibility wrapper for generateAnswerStream
 * Note: The A+ implementation doesn't have streaming yet, so this falls back to non-streaming
 */
async function generateAnswerStream(
  userId: string,
  query: string,
  conversationId: string,
  onChunk: (chunk: string) => void,
  attachedDocumentId?: string | string[],
  conversationHistory?: Array<{ role: string; content: string }>,
  onStage?: (stage: string, message: string) => void,
  memoryContext?: string,
  fullConversationContext?: string,
  isFirstMessage?: boolean,
  detectedLanguage?: string,
  profilePrompt?: string,
  ragConfig?: any
): Promise<{ sources: any[] }> {
  logger.info({ userId, query: query.substring(0, 50) }, "A+ RAG adapter: generateAnswerStream called (using non-streaming fallback)");

  try {
    // Signal start
    if (onStage) {
      onStage("analyzing", "Analyzing query...");
    }

    // Convert attachedDocumentId to array format
    const attachedDocumentIds = attachedDocumentId
      ? Array.isArray(attachedDocumentId)
        ? attachedDocumentId
        : [attachedDocumentId]
      : undefined;

    // Call the new A+ orchestrator
    const result = await ragOrchestratorService.generateAnswer({
      query,
      userId,
      attachedDocumentIds,
      answerLength: 'medium',
    });

    // Signal generation
    if (onStage) {
      onStage("generating", "Generating response...");
    }

    // Simulate streaming by sending the full response as one chunk
    // In a real implementation, this would use the streaming API
    onChunk(result.content);

    // Signal completion
    if (onStage) {
      onStage("complete", "Response generated");
    }

    // Convert sources to legacy format
    const legacySources: LegacySource[] = result.sources.map(s => ({
      id: s.id,
      documentId: s.documentId,
      filename: s.filename,
      documentName: s.filename,
      content: '',
      pageNumber: s.pageNumber,
      section: s.section,
    }));

    return {
      sources: legacySources,
    };

  } catch (error) {
    logError(error as Error, { userId, query }, "A+ RAG adapter: generateAnswerStream failed");
    onChunk("Desculpe, ocorreu um erro ao processar sua solicitação.");
    return { sources: [] };
  }
}

/**
 * Compatibility wrapper for generateAnswerStreaming (alias)
 */
const generateAnswerStreaming = generateAnswerStream;

/**
 * Compatibility wrapper for getContext
 */
async function getContext(
  userId: string,
  query: string,
  attachedDocumentId?: string
): Promise<{ context: string; sources: any[] }> {
  logger.info({ userId, query: query.substring(0, 50) }, "A+ RAG adapter: getContext called");

  // For now, return empty context - this can be expanded later
  return {
    context: "",
    sources: [],
  };
}

// Export with the same interface as the original rag.service.ts
export default {
  generateAnswer,
  generateAnswerStream,
  generateAnswerStreaming,
  getContext,
};

// Also export named for flexibility
export {
  generateAnswer,
  generateAnswerStream,
  generateAnswerStreaming,
  getContext,
};
