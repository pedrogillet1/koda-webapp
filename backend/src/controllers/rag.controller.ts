import { Request, Response } from 'express';
import ragService from '../services/rag.service';
import prisma from '../config/database';

/**
 * RAG Controller
 * Handles RAG-powered chat queries
 */

/**
 * POST /api/rag/query
 * Generate an answer using RAG
 */
export const queryWithRAG = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, conversationId, researchMode = false } = req.body;

    if (!query || !conversationId) {
      res.status(400).json({ error: 'Query and conversationId are required' });
      return;
    }

    // Save user message to database
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: query,
      },
    });

    // Generate RAG answer
    const result = await ragService.generateAnswer(
      userId,
      query,
      conversationId,
      researchMode
    );

    // Save assistant message to database with RAG metadata
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.answer,
        metadata: JSON.stringify({
          ragSources: result.sources,
          expandedQuery: result.expandedQuery,
          contextId: result.contextId,
          researchMode
        }),
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      expandedQuery: result.expandedQuery,
      contextId: result.contextId,
      userMessage,
      assistantMessage
    });
  } catch (error: any) {
    console.error('Error in RAG query:', error);
    res.status(500).json({ error: error.message || 'Failed to generate RAG answer' });
  }
};

/**
 * GET /api/rag/context/:contextId
 * Get context for a specific RAG response
 */
export const getContext = async (req: Request, res: Response) => {
  try {
    const { contextId } = req.params;

    const context = await ragService.getContext(contextId);

    res.json({
      success: true,
      context
    });
  } catch (error: any) {
    console.error('Error getting RAG context:', error);
    res.status(500).json({ error: error.message || 'Failed to get context' });
  }
};

/**
 * POST /api/rag/follow-up
 * Answer a follow-up question using existing context
 */
export const answerFollowUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { query, conversationId, previousContextId } = req.body;

    if (!query || !conversationId || !previousContextId) {
      res.status(400).json({ error: 'Query, conversationId, and previousContextId are required' });
      return;
    }

    const result = await ragService.answerFollowUp(
      userId,
      query,
      conversationId,
      previousContextId
    );

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      expandedQuery: result.expandedQuery,
      contextId: result.contextId
    });
  } catch (error: any) {
    console.error('Error in RAG follow-up:', error);
    res.status(500).json({ error: error.message || 'Failed to answer follow-up' });
  }
};
