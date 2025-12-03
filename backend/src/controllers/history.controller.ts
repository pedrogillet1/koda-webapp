/**
 * Chat History Controller
 * Handles HTTP requests for conversation history management
 */

import { Request, Response } from 'express';
import historyService from '../services/history.service';

/**
 * Get conversation history
 * GET /api/history
 */
export async function getHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const includeDeleted = req.query.includeDeleted === 'true';

    const conversations = await historyService.getConversationHistory(userId, {
      limit,
      offset,
      includeDeleted,
    });

    res.json({
      success: true,
      conversations,
      pagination: {
        limit,
        offset,
        count: conversations.length,
      },
    });
  } catch (error: any) {
    console.error('Error getting history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Search conversations
 * GET /api/history/search?q=query
 */
export async function searchHistory(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    const results = await historyService.searchConversations(userId, query, limit);

    res.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error searching history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Pin a conversation
 * POST /api/history/:conversationId/pin
 */
export async function pinConversation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const success = await historyService.pinConversation(userId, conversationId);

    if (success) {
      res.json({
        success: true,
        message: 'Conversation pinned',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to pin conversation',
      });
    }
  } catch (error: any) {
    console.error('Error pinning conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Unpin a conversation
 * POST /api/history/:conversationId/unpin
 */
export async function unpinConversation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const success = await historyService.unpinConversation(userId, conversationId);

    if (success) {
      res.json({
        success: true,
        message: 'Conversation unpinned',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to unpin conversation',
      });
    }
  } catch (error: any) {
    console.error('Error unpinning conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Soft delete a conversation
 * DELETE /api/history/:conversationId
 */
export async function deleteConversation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const success = await historyService.softDeleteConversation(userId, conversationId);

    if (success) {
      res.json({
        success: true,
        message: 'Conversation deleted',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation',
      });
    }
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Restore a deleted conversation
 * POST /api/history/:conversationId/restore
 */
export async function restoreConversation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { conversationId } = req.params;

    const success = await historyService.restoreConversation(userId, conversationId);

    if (success) {
      res.json({
        success: true,
        message: 'Conversation restored',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to restore conversation',
      });
    }
  } catch (error: any) {
    console.error('Error restoring conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Generate or regenerate conversation title
 * POST /api/history/:conversationId/title
 */
export async function generateTitle(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId } = req.params;

    const title = await historyService.generateConversationTitle(conversationId);

    res.json({
      success: true,
      title,
    });
  } catch (error: any) {
    console.error('Error generating title:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Generate conversation summary
 * POST /api/history/:conversationId/summary
 */
export async function generateSummary(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId } = req.params;

    const summary = await historyService.generateConversationSummary(conversationId);

    if (summary) {
      res.json({
        success: true,
        summary,
      });
    } else {
      res.json({
        success: true,
        summary: null,
        message: 'Conversation too short for summary',
      });
    }
  } catch (error: any) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
