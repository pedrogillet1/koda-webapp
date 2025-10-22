import { Router } from 'express';
import * as tagController from '../controllers/tag.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', tagController.createTag);
router.get('/', tagController.getUserTags);
router.post('/add-to-document', tagController.addTagToDocument);
router.post('/remove-from-document', tagController.removeTagFromDocument);
router.delete('/:id', tagController.deleteTag);
router.get('/:id/documents', tagController.searchByTag);

export default router;
