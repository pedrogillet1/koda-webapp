import { Router, Request, Response } from 'express';
// REMOVED: chatDocumentController - deleted controller
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Stub routes - service removed
router.get('/:id', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Chat document service removed' });
});
router.get('/:id/export/:format', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Chat document export service removed' });
});
router.get('/conversation/:conversationId', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Chat document service removed' });
});

export default router;
