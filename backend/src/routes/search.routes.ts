import { Router } from 'express';
import * as searchController from '../controllers/search.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Semantic search endpoint
router.post('/semantic', authenticateToken, searchController.semanticSearch);

export default router;
