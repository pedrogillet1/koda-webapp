import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  generateBulkPresignedUrls,
  completeBatchUpload,
  retriggerStuckDocuments
} from '../controllers/presigned-url.controller';

const router = express.Router();

// Generate presigned URLs for bulk upload
router.post('/bulk', authenticateToken, generateBulkPresignedUrls);

// Mark batch upload as complete
router.post('/complete', authenticateToken, completeBatchUpload);

// Retrigger processing for stuck documents
router.post('/retrigger-stuck', authenticateToken, retriggerStuckDocuments);

export default router;
