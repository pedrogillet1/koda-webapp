import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
// REMOVED: storageController - deleted controller

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stub routes - service removed
router.get('/', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Storage service removed' });
});

router.post('/check-capacity', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Storage service removed' });
});

router.post('/recalculate', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Storage service removed' });
});

export default router;
