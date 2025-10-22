import express, { Request, Response } from 'express';
import { authenticateToken as authenticate } from '../middleware/auth.middleware';
import chatDocumentAnalysisService from '../services/chatDocumentAnalysis.service';

const router = express.Router();

/**
 * @route   POST /api/chat/analyze-documents
 * @desc    Analyze documents and create attachment on assistant message
 * @access  Private
 *
 * This creates an attachment on the specified message that stays in chat.
 * The document does NOT appear in the Documents page unless explicitly exported.
 *
 * Example use cases:
 * - "Can you compare these 3 contracts?"
 * - "Create a summary of all my research papers"
 * - "Analyze these documents and write an essay"
 */
router.post('/analyze-documents', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      conversationId,
      messageId,
      analysisType,
      sourceDocumentIds,
      userPrompt,
      options,
    } = req.body;

    // Validation
    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({
        error: 'Conversation ID is required',
      });
    }

    if (!messageId || typeof messageId !== 'string') {
      return res.status(400).json({
        error: 'Message ID is required (the assistant message to attach to)',
      });
    }

    if (!analysisType || !['comparison', 'summary', 'analysis', 'essay'].includes(analysisType)) {
      return res.status(400).json({
        error: 'Valid analysis type is required (comparison, summary, analysis, essay)',
      });
    }

    if (!sourceDocumentIds || !Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
      return res.status(400).json({
        error: 'At least one source document ID is required',
      });
    }

    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
      return res.status(400).json({
        error: 'User prompt is required',
      });
    }

    if (userPrompt.length > 5000) {
      return res.status(400).json({
        error: 'User prompt is too long (max 5000 characters)',
      });
    }

    // Perform analysis
    const result = await chatDocumentAnalysisService.analyzeDocuments(userId, {
      conversationId,
      messageId,
      analysisType,
      sourceDocumentIds,
      userPrompt,
      options: options || {},
    });

    return res.status(200).json({
      message: 'Document analysis completed successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in analyze-documents route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze documents',
    });
  }
});

/**
 * @route   POST /api/chat/edit-attachment
 * @desc    Edit a message attachment and create new version on new message
 * @access  Private
 *
 * User asks AI to modify the attached document:
 * - "Make the introduction more formal"
 * - "Add a conclusion section"
 * - "Simplify the technical jargon"
 *
 * This creates a NEW attachment on a NEW message with the edited content.
 */
router.post('/edit-attachment', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      attachmentId,
      conversationId,
      messageId,
      editCommand,
      targetSection,
    } = req.body;

    // Validation
    if (!attachmentId || typeof attachmentId !== 'string') {
      return res.status(400).json({
        error: 'Attachment ID is required',
      });
    }

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({
        error: 'Conversation ID is required',
      });
    }

    if (!messageId || typeof messageId !== 'string') {
      return res.status(400).json({
        error: 'Message ID is required (the new assistant message to attach the edited version to)',
      });
    }

    if (!editCommand || typeof editCommand !== 'string' || editCommand.trim().length === 0) {
      return res.status(400).json({
        error: 'Edit command is required',
      });
    }

    if (editCommand.length > 2000) {
      return res.status(400).json({
        error: 'Edit command is too long (max 2000 characters)',
      });
    }

    // Perform edit - creates new attachment on new message
    const result = await chatDocumentAnalysisService.editAttachment(userId, {
      attachmentId,
      conversationId,
      messageId,
      editCommand,
      targetSection,
    });

    return res.status(200).json({
      message: 'Attachment edited successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in edit-attachment route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to edit attachment',
    });
  }
});

/**
 * @route   POST /api/chat/export-attachment
 * @desc    Export message attachment to Documents page
 * @access  Private
 *
 * User clicks "Export to Documents" button in chat:
 * - Creates a permanent document record in Documents page
 * - Attachment remains in chat
 * - Optionally specify folder and custom filename
 */
router.post('/export-attachment', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      attachmentId,
      folderId,
      customFilename,
    } = req.body;

    // Validation
    if (!attachmentId || typeof attachmentId !== 'string') {
      return res.status(400).json({
        error: 'Attachment ID is required',
      });
    }

    if (customFilename && (typeof customFilename !== 'string' || customFilename.trim().length === 0)) {
      return res.status(400).json({
        error: 'Custom filename must be a non-empty string',
      });
    }

    if (customFilename && customFilename.length > 255) {
      return res.status(400).json({
        error: 'Custom filename is too long (max 255 characters)',
      });
    }

    // Export attachment to Documents page
    const result = await chatDocumentAnalysisService.exportToDocuments(userId, {
      attachmentId,
      folderId,
      customFilename,
    });

    return res.status(200).json({
      message: 'Attachment exported to Documents successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in export-attachment route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to export attachment',
    });
  }
});

/**
 * @route   GET /api/chat/attachment/:id
 * @desc    Get message attachment details
 * @access  Private
 *
 * Retrieve details of a message attachment for display in chat
 */
router.get('/attachment/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Attachment ID is required',
      });
    }

    // Get attachment
    const result = await chatDocumentAnalysisService.getAttachment(userId, id);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error getting attachment:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get attachment',
    });
  }
});

export default router;
