/**
 * Presentation Routes
 */

import express from 'express';
import * as presentationController from '../controllers/presentation.controller';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Initialize new presentation
router.post('/initialize', presentationController.initializePresentation);

// List user's presentations
router.get('/', presentationController.listPresentations);

// Get specific presentation
router.get('/:presentationId', presentationController.getPresentation);

// View presentation (HTML viewer)
router.get('/:presentationId/view', presentationController.viewPresentation);

// Generate slide content
router.post('/:presentationId/slides/:slideId', presentationController.generateSlide);

// Delete presentation
router.delete('/:presentationId', presentationController.deletePresentation);

export default router;
