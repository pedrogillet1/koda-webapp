import express, { Request, Response } from 'express';
import { authenticateToken as authenticate } from '../middleware/auth.middleware';
import documentEditingService from '../services/documentEditing.service';

const router = express.Router();

/**
 * @route   POST /api/documents/:id/edit/ai
 * @desc    Apply AI-powered edit command to document
 * @access  Private
 */
router.post('/:id/edit/ai', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { command, targetSection, parameters } = req.body;

    if (!command || typeof command !== 'string' || command.trim().length === 0) {
      return res.status(400).json({
        error: 'Edit command is required',
      });
    }

    if (command.length > 2000) {
      return res.status(400).json({
        error: 'Edit command is too long (max 2000 characters)',
      });
    }

    const result = await documentEditingService.applyAIEdit(userId, id, {
      command,
      targetSection,
      parameters,
    });

    return res.status(200).json({
      message: 'AI edit applied successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in AI edit route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to apply AI edit',
    });
  }
});

/**
 * @route   POST /api/documents/:id/edit/manual
 * @desc    Apply manual edit to document
 * @access  Private
 */
router.post('/:id/edit/manual', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { editedContent } = req.body;

    if (!editedContent || !Array.isArray(editedContent)) {
      return res.status(400).json({
        error: 'Edited content is required and must be an array',
      });
    }

    const result = await documentEditingService.applyManualEdit(
      userId,
      id,
      editedContent
    );

    return res.status(200).json({
      message: 'Manual edit applied successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in manual edit route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to apply manual edit',
    });
  }
});

/**
 * @route   GET /api/documents/:id/edit/history
 * @desc    Get edit history for a document
 * @access  Private
 */
router.get('/:id/edit/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const history = await documentEditingService.getEditHistory(userId, id, limit);

    return res.status(200).json({
      documentId: id,
      editCount: history.length,
      history,
    });
  } catch (error: any) {
    console.error('Error getting edit history:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get edit history',
    });
  }
});

/**
 * @route   POST /api/documents/:id/edit/rollback
 * @desc    Rollback document to a previous edit
 * @access  Private
 */
router.post('/:id/edit/rollback', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { targetEditNumber } = req.body;

    if (!targetEditNumber || typeof targetEditNumber !== 'number') {
      return res.status(400).json({
        error: 'Target edit number is required and must be a number',
      });
    }

    const result = await documentEditingService.rollbackToEdit(
      userId,
      id,
      targetEditNumber
    );

    return res.status(200).json({
      message: `Rolled back to edit #${targetEditNumber}`,
      ...result,
    });
  } catch (error: any) {
    console.error('Error rolling back document:', error);
    return res.status(500).json({
      error: error.message || 'Failed to rollback document',
    });
  }
});

/**
 * @route   GET /api/documents/:id/preview/live
 * @desc    Get live HTML preview of document
 * @access  Private
 */
router.get('/:id/preview/live', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const preview = await documentEditingService.generateLivePreview(userId, id);

    return res.status(200).json({
      documentId: id,
      ...preview,
    });
  } catch (error: any) {
    console.error('Error generating live preview:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate preview',
    });
  }
});

export default router;
