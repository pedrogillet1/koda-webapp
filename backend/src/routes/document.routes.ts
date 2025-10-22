import { Router } from 'express';
import * as documentController from '../controllers/document.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { uploadSingle, uploadMultiple, uploadWithThumbnail } from '../middleware/upload.middleware';
import { uploadLimiter, downloadLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Direct upload routes (for signed URL workflow)
router.post('/upload-url', documentController.getUploadUrl);
router.post('/confirm-upload', documentController.confirmUpload);

// Document routes (legacy upload via backend)
router.post('/upload', uploadLimiter, uploadWithThumbnail, documentController.uploadDocument);
router.post('/upload-multiple', uploadLimiter, uploadMultiple, documentController.uploadMultipleDocuments);

// Bulk operations (MUST be before /:id routes to avoid matching)
router.post('/reindex-all', documentController.reindexAllDocuments);
router.delete('/delete-all', documentController.deleteAllDocuments);

// List and specific document routes
router.get('/', documentController.listDocuments);
router.get('/:id/download', downloadLimiter, documentController.getDownloadUrl);
router.get('/:id/stream', downloadLimiter, documentController.streamDocument);
router.get('/:id/preview', downloadLimiter, documentController.getPreview);
router.get('/:id/status', documentController.getDocumentStatus);
router.get('/:id/thumbnail', documentController.getThumbnail);
router.get('/:id/slides', documentController.getPPTXSlides);
router.post('/:id/regenerate-slides', documentController.regeneratePPTXSlides);
router.patch('/:id', documentController.updateDocument);
router.patch('/:id/markdown', documentController.updateMarkdown);
router.post('/:id/export', documentController.exportDocument);
router.delete('/:id', documentController.deleteDocument);
router.post('/:id/share', documentController.shareDocument);
router.post('/:id/search', documentController.searchInDocument);
router.post('/:id/reprocess', documentController.reprocessDocument);

// Version control
router.post('/:id/version', uploadLimiter, uploadSingle, documentController.uploadVersion);
router.get('/:id/versions', documentController.getVersions);

export default router;
