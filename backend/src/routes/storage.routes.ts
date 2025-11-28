import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import * as storageController from '../controllers/storage.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/storage
 * Get current storage usage and limits
 */
router.get('/', storageController.getStorageInfo);

/**
 * POST /api/storage/check-capacity
 * Check if user has capacity for a file before upload
 * Body: { fileSize: number } (in bytes)
 */
router.post('/check-capacity', storageController.checkCapacity);

/**
 * POST /api/storage/recalculate
 * Recalculate storage from actual documents (repair/sync)
 */
router.post('/recalculate', storageController.recalculateStorage);

export default router;
