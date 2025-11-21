import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  generateBulkPresignedUrls,
  completeBatchUpload
} from '../controllers/presigned-url.controller';

const router = express.Router();

// Generate presigned URLs for bulk upload
router.post('/bulk', authenticateToken, generateBulkPresignedUrls);

// Mark batch upload as complete
router.post('/complete', authenticateToken, completeBatchUpload);

export default router;
