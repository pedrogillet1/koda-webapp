/**
 * RAG Controller V3
 *
 * Clean RAG implementation using the V3 pipeline:
 * - Central orchestration via KodaOrchestratorV3
 * - Intent classification via KodaIntentEngineV3
 * - Retrieval via KodaRetrievalEngineV3
 * - Answer generation via KodaAnswerEngineV3
 * - Formatting via KodaFormattingPipelineV3
 *
 * Supports 25 intents (V3):
 * DOC_QA, DOC_ANALYTICS, DOC_MANAGEMENT, DOC_SEARCH, DOC_SUMMARIZE,
 * PREFERENCE_UPDATE, MEMORY_STORE, MEMORY_RECALL,
 * ANSWER_REWRITE, ANSWER_EXPAND, ANSWER_SIMPLIFY,
 * FEEDBACK_POSITIVE, FEEDBACK_NEGATIVE,
 * PRODUCT_HELP, ONBOARDING_HELP, FEATURE_REQUEST,
 * GENERIC_KNOWLEDGE, REASONING_TASK, TEXT_TRANSFORM,
 * CHITCHAT, META_AI, OUT_OF_SCOPE, AMBIGUOUS, SAFETY_CONCERN, MULTI_INTENT, UNKNOWN
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import cacheService from '../services/cache.service';
import { generateConversationTitle } from '../services/openai.service';

// V3 Services
import { KodaOrchestratorV3, kodaOrchestratorV3, OrchestratorRequest } from '../services/core/kodaOrchestratorV3.service';
import { KodaIntentEngineV3, kodaIntentEngineV3 } from '../services/core/kodaIntentEngineV3.service';
import { LanguageCode } from '../types/intentV3.types';

// Use singleton instances
const orchestrator = kodaOrchestratorV3;
const intentEngine = kodaIntentEngineV3;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure conversation exists before creating messages
 */
async function ensureConversationExists(conversationId: string, userId: string) {
  let conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    console.log(`[RAG V3] Creating conversation ${conversationId}`);
    conversation = await prisma.conversation.create({
      data: {
        id: conversationId,
        userId,
        title: 'New Chat',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  return conversation;
}

// ============================================================================
// Main RAG Endpoint
// ============================================================================

/**
 * POST /api/rag/query
 * Generate an answer using RAG V3
 */
export const queryWithRAG = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      query,
      conversationId,
      language = 'en',
      attachedDocuments = [],
      documentId,
    } = req.body;

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    console.log(`[RAG V3] Query: "${query.substring(0, 50)}..."`);

    // Handle document attachments
    let attachedDocumentIds: string[] = [];
    if (attachedDocuments && attachedDocuments.length > 0) {
      attachedDocumentIds = attachedDocuments
        .map((doc: any) => (typeof doc === 'string' ? doc : doc.id))
        .filter(Boolean);
      console.log(`[RAG V3] ${attachedDocumentIds.length} documents attached`);
    } else if (documentId) {
      attachedDocumentIds = [documentId];
      console.log(`[RAG V3] Single document attached: ${documentId}`);
    }

    // Ensure conversation exists
    await ensureConversationExists(conversationId, userId);

    // Build V3 request
    const request: OrchestratorRequest = {
      userId,
      text: query,
      language: (language as LanguageCode) || 'en',
      conversationId,
      context: attachedDocumentIds.length > 0 ? { attachedDocumentIds } : undefined,
    };

    // Call V3 orchestrator
    const response = await orchestrator.orchestrate(request);

    console.log(`[RAG V3] Intent: ${response.metadata?.intent}, Time: ${Date.now() - startTime}ms`);

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: query,
        metadata: attachedDocumentIds.length > 0
          ? JSON.stringify({ attachedFiles: attachedDocumentIds })
          : null,
      },
    });

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: response.answer,
        metadata: JSON.stringify({
          primaryIntent: response.metadata?.intent,
          language: request.language,
          sourceDocuments: response.metadata?.documentsUsed ? [] : [],
          confidenceScore: response.metadata?.confidence,
        }),
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Generate title if first message
    const messageCount = await prisma.message.count({ where: { conversationId } });
    if (messageCount <= 2) {
      try {
        const title = await generateConversationTitle(query);
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { title },
        });
        console.log(`[RAG V3] Generated title: "${title}"`);
      } catch (err) {
        console.warn('[RAG V3] Title generation failed:', err);
      }
    }

    // Invalidate cache
    const cacheKey = cacheService.generateKey('conversation', conversationId, userId);
    await cacheService.set(cacheKey, null, { ttl: 0 });

    // Return response
    res.status(200).json({
      answer: response.answer,
      sources: [], // V3 handles sources differently via metadata
      intent: response.metadata?.intent,
      userMessage: {
        id: userMessage.id,
        content: userMessage.content,
      },
      assistantMessage: {
        id: assistantMessage.id,
        content: assistantMessage.content,
      },
      metadata: {
        primaryIntent: response.metadata?.intent,
        language: request.language,
        confidenceScore: response.metadata?.confidence,
        totalTimeMs: Date.now() - startTime,
      },
    });
  } catch (error: any) {
    console.error('[RAG V3] Error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      answer: 'Sorry, an error occurred while processing your question. Please try again.',
    });
  }
};

// ============================================================================
// Follow-up Endpoint
// ============================================================================

/**
 * POST /api/rag/follow-up
 * Answer a follow-up question
 */
export const answerFollowUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, conversationId, language = 'en' } = req.body;
    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    const request: OrchestratorRequest = {
      userId,
      text: query,
      language: (language as LanguageCode) || 'en',
      conversationId,
    };

    const response = await orchestrator.orchestrate(request);

    res.status(200).json({
      answer: response.answer,
      sources: [],
      metadata: {
        primaryIntent: response.metadata?.intent,
        confidenceScore: response.metadata?.confidence,
      },
    });
  } catch (error: any) {
    console.error('[RAG V3] Follow-up error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// Streaming Endpoint
// ============================================================================

/**
 * POST /api/rag/query/stream
 * Generate answer with SSE streaming
 */
export const queryWithRAGStreaming = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, conversationId, language = 'en' } = req.body;
    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send thinking indicator
    res.write(`data: ${JSON.stringify({ type: 'thinking', message: 'Processing...' })}\n\n`);

    // Ensure conversation exists
    await ensureConversationExists(conversationId, userId);

    const request: OrchestratorRequest = {
      userId,
      text: query,
      language: (language as LanguageCode) || 'en',
      conversationId,
    };

    // Get response
    const response = await orchestrator.orchestrate(request);

    // Stream the response in chunks
    const words = response.answer.split(' ');
    for (let i = 0; i < words.length; i += 5) {
      const chunk = words.slice(i, i + 5).join(' ') + ' ';
      res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
    }

    // Save messages
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: query,
      },
    });

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: response.answer,
      },
    });

    // Send done event
    res.write(
      `data: ${JSON.stringify({
        type: 'done',
        messageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        conversationId,
      })}\n\n`
    );

    res.end();
  } catch (error: any) {
    console.error('[RAG V3] Streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
};

// ============================================================================
// Intent Classification Endpoint (for debugging)
// ============================================================================

/**
 * POST /api/rag/classify
 * Classify intent only (for debugging)
 */
export const classifyIntent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { query, language = 'en' } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const intent = await intentEngine.predict({
      text: query,
      language: (language as LanguageCode) || 'en',
      context: { userId: userId || 'anonymous' },
    });

    res.status(200).json(intent);
  } catch (error: any) {
    console.error('[RAG V3] Classify error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// Context Endpoint (for debugging)
// ============================================================================

/**
 * GET /api/rag/context
 * Get RAG context for debugging
 */
export const getContext = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, language = 'en' } = req.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }

    // Classify intent using V3
    const intent = await intentEngine.predict({
      text: query,
      language: ((language as string) || 'en') as LanguageCode,
      context: { userId },
    });

    res.status(200).json({
      intent,
      primaryIntent: intent.primaryIntent,
      language: intent.language,
      confidence: intent.confidence,
    });
  } catch (error: any) {
    console.error('[RAG V3] Context error:', error);
    res.status(500).json({ error: error.message });
  }
};
