/**
 * Session Routes
 * API routes for session-based document analysis
 *
 * Endpoints:
 * - POST /sessions - Create new session
 * - GET /sessions/:sessionId - Get session details
 * - POST /sessions/:sessionId/upload - Upload document to session
 * - POST /sessions/:sessionId/query - Query documents in session
 * - POST /sessions/:sessionId/compare - Compare documents in session
 * - POST /sessions/:sessionId/save - Save session documents to library
 * - DELETE /sessions/:sessionId - Discard session
 * - GET /sessions/:sessionId/documents - List session documents
 */

import express from 'express';
import sessionController from '../controllers/session.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// All session routes require authentication
router.use(authenticateToken);

/**
 * @route POST /api/sessions
 * @desc Create a new analysis session
 * @access Private
 */
router.post('/', sessionController.createSession);

/**
 * @route GET /api/sessions/:sessionId
 * @desc Get session details and statistics
 * @access Private
 */
router.get('/:sessionId', sessionController.getSession);

/**
 * @route POST /api/sessions/:sessionId/upload
 * @desc Upload document to session
 * @access Private
 */
router.post(
  '/:sessionId/upload',
  sessionController.upload,
  sessionController.uploadToSession
);

/**
 * @route POST /api/sessions/:sessionId/query
 * @desc Query documents within a session
 * @access Private
 * @body { query: string, topK?: number }
 */
router.post('/:sessionId/query', sessionController.querySession);

/**
 * @route POST /api/sessions/:sessionId/compare
 * @desc Compare documents in session
 * @access Private
 * @body { documentIds: string[], comparisonType?: 'differences' | 'similarities' | 'summary' | 'full' }
 */
router.post('/:sessionId/compare', sessionController.compareSessionDocuments);

/**
 * @route POST /api/sessions/:sessionId/save
 * @desc Save session documents to permanent library
 * @access Private
 * @body { documentIds?: string[], folderId?: string }
 */
router.post('/:sessionId/save', sessionController.saveSessionToLibrary);

/**
 * @route DELETE /api/sessions/:sessionId
 * @desc Discard session and all temporary documents
 * @access Private
 */
router.delete('/:sessionId', sessionController.discardSession);

/**
 * @route GET /api/sessions/:sessionId/documents
 * @desc List all documents in session
 * @access Private
 */
router.get('/:sessionId/documents', sessionController.listSessionDocuments);

export default router;
