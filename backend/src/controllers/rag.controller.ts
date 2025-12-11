/**
 * RAG Controller V1
 *
 * Clean RAG implementation using the V1 pipeline:
 * - Intent classification via kodaIntentEngineV1
 * - Retrieval via kodaRetrievalEngineV1 (Pinecone + BM25)
 * - Answer generation via kodaAnswerEngineV1 (Gemini)
 * - 4-layer formatting pipeline
 *
 * Supports 8 flows:
 * 1. Analytics (metadata queries)
 * 2. Simple factual (single doc)
 * 3. Multi-point extraction
 * 4. Multi-doc search
 * 5. Multi-doc comparison
 * 6. Follow-up
 * 7. Fallback (no docs/no match)
 * 8. Generic chat
 */

import { Request, Response } from 'express';
import prisma from '../config/database';
import cacheService from '../services/cache.service';
import { generateConversationTitle } from '../services/openai.service';

// V1 Services
import { ragServiceV1 } from '../services/core/ragV1.service';
import { kodaIntentEngineV1 } from '../services/core/kodaIntentEngineV1.service';
import { kodaRetrievalEngineV1 } from '../services/retrieval/kodaRetrievalEngineV1.service';
import type { AnswerRequest, ConversationContext } from '../types/ragV1.types';

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
    console.log(`[RAG] Creating conversation ${conversationId}`);
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

/**
 * Build conversation context from history
 */
async function buildConversationContext(
  conversationId: string,
  userId: string
): Promise<ConversationContext> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      role: true,
      content: true,
    },
  });

  messages.reverse(); // Chronological order

  return {
    sessionId: conversationId,
    userId,
    lastNTurns: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content || '',
    })),
    activeDocIds: [],
    lastCitations: [],
  };
}

// ============================================================================
// Main RAG Endpoint
// ============================================================================

/**
 * POST /api/rag/query
 * Generate an answer using RAG V1
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
      answerLength = 'medium',
      attachedDocuments = [],
      documentId,
    } = req.body;

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    console.log(`[RAG V1] Query: "${query.substring(0, 50)}..."`);

    // Handle document attachments
    let attachedDocumentIds: string[] = [];
    if (attachedDocuments && attachedDocuments.length > 0) {
      attachedDocumentIds = attachedDocuments
        .map((doc: any) => (typeof doc === 'string' ? doc : doc.id))
        .filter(Boolean);
      console.log(`[RAG V1] ${attachedDocumentIds.length} documents attached`);
    } else if (documentId) {
      attachedDocumentIds = [documentId];
      console.log(`[RAG V1] Single document attached: ${documentId}`);
    }

    // Ensure conversation exists
    await ensureConversationExists(conversationId, userId);

    // Build conversation context
    const conversationContext = await buildConversationContext(conversationId, userId);

    // Build request
    const request: AnswerRequest = {
      query,
      userId,
      sessionId: conversationId,
      conversationContext,
      attachedDocumentIds,
      answerLength: answerLength as 'short' | 'medium' | 'long',
    };

    // Call RAG V1 service
    const response = await ragServiceV1.handleQuery(request);

    console.log(`[RAG V1] Status: ${response.metadata.ragStatus}, Time: ${Date.now() - startTime}ms`);

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
        content: response.text,
        metadata: JSON.stringify({
          ragStatus: response.metadata.ragStatus,
          answerType: response.answerType,
          docsUsed: response.docsUsed,
          citations: response.citations,
          totalTimeMs: response.metadata.totalTimeMs,
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
        console.log(`[RAG V1] Generated title: "${title}"`);
      } catch (err) {
        console.warn('[RAG V1] Title generation failed:', err);
      }
    }

    // Invalidate cache
    const cacheKey = cacheService.generateKey('conversation', conversationId, userId);
    await cacheService.set(cacheKey, null, { ttl: 0 });

    // Return response
    res.status(200).json({
      answer: response.text,
      sources: response.citations.map((c) => ({
        id: c.documentId,
        filename: c.filename,
        title: c.title,
      })),
      intent: response.metadata.ragStatus,
      answerType: response.answerType,
      userMessage: {
        id: userMessage.id,
        content: userMessage.content,
      },
      assistantMessage: {
        id: assistantMessage.id,
        content: assistantMessage.content,
      },
      metadata: {
        ragStatus: response.metadata.ragStatus,
        totalTimeMs: response.metadata.totalTimeMs,
        retrievalTimeMs: response.metadata.retrievalTimeMs,
        generationTimeMs: response.metadata.generationTimeMs,
      },
    });
  } catch (error: any) {
    console.error('[RAG V1] Error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      answer: 'Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente.',
    });
  }
};

// ============================================================================
// Context Endpoint
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

    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter is required' });
      return;
    }

    // Classify intent
    const intent = kodaIntentEngineV1.classifyIntent(query);

    // Retrieve context
    const { context, status } = await kodaRetrievalEngineV1.retrieve(query, userId, intent);

    res.status(200).json({
      intent,
      status,
      context: {
        documentsUsed: context.documentsUsed,
        chunkCount: context.rawSourceData.length,
        chunks: context.rawSourceData.slice(0, 5), // First 5 chunks
      },
    });
  } catch (error: any) {
    console.error('[RAG V1] Context error:', error);
    res.status(500).json({ error: error.message });
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

    const { query, conversationId } = req.body;
    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // Build context with follow-up flag
    const conversationContext = await buildConversationContext(conversationId, userId);

    const request: AnswerRequest = {
      query,
      userId,
      sessionId: conversationId,
      conversationContext,
      intent: {
        domain: 'doc_content',
        questionType: 'follow_up',
        scope: 'multiple_documents',
        complexity: 'simple',
        isFollowUp: true,
      },
    };

    const response = await ragServiceV1.handleQuery(request);

    res.status(200).json({
      answer: response.text,
      sources: response.citations,
      metadata: response.metadata,
    });
  } catch (error: any) {
    console.error('[RAG V1] Follow-up error:', error);
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

    const { query, conversationId } = req.body;
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

    // Build context
    const conversationContext = await buildConversationContext(conversationId, userId);

    const request: AnswerRequest = {
      query,
      userId,
      sessionId: conversationId,
      conversationContext,
    };

    // Get response (non-streaming for V1)
    const response = await ragServiceV1.handleQuery(request);

    // Stream the response in chunks
    const chunks = response.text.split(' ');
    for (let i = 0; i < chunks.length; i += 5) {
      const chunk = chunks.slice(i, i + 5).join(' ') + ' ';
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
        content: response.text,
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
    console.error('[RAG V1] Streaming error:', error);
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
    const { query } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const intent = kodaIntentEngineV1.classifyIntent(query);

    res.status(200).json(intent);
  } catch (error: any) {
    console.error('[RAG V1] Classify error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// Retrieve Chunks Endpoint (for debugging)
// ============================================================================

/**
 * POST /api/rag/retrieve
 * Retrieve chunks only (for debugging)
 */
export const retrieveChunks = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const intent = kodaIntentEngineV1.classifyIntent(query);
    const { context, status } = await kodaRetrievalEngineV1.retrieve(query, userId, intent);

    res.status(200).json({
      status,
      intent,
      chunksRetrieved: context.rawSourceData.length,
      documentsUsed: context.documentsUsed,
      chunks: context.rawSourceData,
    });
  } catch (error: any) {
    console.error('[RAG V1] Retrieve error:', error);
    res.status(500).json({ error: error.message });
  }
};
