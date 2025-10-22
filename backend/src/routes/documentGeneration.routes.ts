import express, { Request, Response } from 'express';
import { authenticateToken as authenticate } from '../middleware/auth.middleware';
import documentGenerationService from '../services/documentGeneration.service';

const router = express.Router();

/**
 * @route   POST /api/documents/compare
 * @desc    Compare multiple documents with AI analysis
 * @access  Private
 */
router.post('/compare', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { documentIds, options } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
      return res.status(400).json({
        error: 'At least 2 document IDs required for comparison',
      });
    }

    const result = await documentGenerationService.compareDocuments(
      userId,
      documentIds,
      options
    );

    return res.status(200).json({
      message: 'Document comparison completed successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in document comparison route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to compare documents',
    });
  }
});

/**
 * @route   POST /api/documents/generate
 * @desc    Generate document from natural language prompt
 * @access  Private
 */
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { prompt, options } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Prompt is required',
      });
    }

    if (prompt.length > 5000) {
      return res.status(400).json({
        error: 'Prompt is too long (max 5000 characters)',
      });
    }

    const result = await documentGenerationService.generateFromPrompt(
      userId,
      prompt,
      options || {}
    );

    return res.status(201).json({
      message: 'Document generated successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error in document generation route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate document',
    });
  }
});

/**
 * @route   GET /api/documents/:id/preview
 * @desc    Get renderable preview content for a document
 * @access  Private
 */
router.get('/:id/preview', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const renderableContent = await documentGenerationService.generateRenderableContent(id);

    return res.status(200).json({
      documentId: id,
      renderableContent,
    });
  } catch (error: any) {
    console.error('Error in document preview route:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate preview',
    });
  }
});

/**
 * @route   GET /api/documents/generated/:id
 * @desc    Get generated document details
 * @access  Private
 */
router.get('/generated/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const generatedDoc = await documentGenerationService.getGeneratedDocument(id);

    if (!generatedDoc) {
      return res.status(404).json({
        error: 'Generated document not found',
      });
    }

    // Verify ownership
    if (generatedDoc.userId !== req.user!.id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    return res.status(200).json(generatedDoc);
  } catch (error: any) {
    console.error('Error getting generated document:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get generated document',
    });
  }
});

/**
 * @route   GET /api/documents/generated
 * @desc    Get all generated documents for current user
 * @access  Private
 */
router.get('/generated', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const generatedDocs = await documentGenerationService.getGeneratedDocumentsByUser(userId);

    return res.status(200).json({
      count: generatedDocs.length,
      documents: generatedDocs,
    });
  } catch (error: any) {
    console.error('Error getting generated documents:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get generated documents',
    });
  }
});

export default router;
