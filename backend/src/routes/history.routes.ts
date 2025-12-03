/**
 * Chat History Routes
 * API endpoints for conversation history management
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as historyController from '../controllers/history.controller';

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

/**
 * GET /api/history
 * Get conversation history with pagination
 * Query params: limit, offset, includeDeleted
 */
router.get('/', historyController.getHistory);

/**
 * GET /api/history/search
 * Search conversations by content
 * Query params: q (required), limit
 */
router.get('/search', historyController.searchHistory);

/**
 * POST /api/history/:conversationId/pin
 * Pin a conversation to the top
 */
router.post('/:conversationId/pin', historyController.pinConversation);

/**
 * POST /api/history/:conversationId/unpin
 * Unpin a conversation
 */
router.post('/:conversationId/unpin', historyController.unpinConversation);

/**
 * DELETE /api/history/:conversationId
 * Soft delete a conversation
 */
router.delete('/:conversationId', historyController.deleteConversation);

/**
 * POST /api/history/:conversationId/restore
 * Restore a deleted conversation
 */
router.post('/:conversationId/restore', historyController.restoreConversation);

/**
 * POST /api/history/:conversationId/title
 * Generate or regenerate conversation title
 */
router.post('/:conversationId/title', historyController.generateTitle);

/**
 * POST /api/history/:conversationId/summary
 * Generate conversation summary
 */
router.post('/:conversationId/summary', historyController.generateSummary);

export default router;
