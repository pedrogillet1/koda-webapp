import { Router } from 'express';
import * as folderController from '../controllers/folder.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', folderController.createFolder);
router.post('/bulk', folderController.bulkCreateFolders); // Bulk folder creation for folder upload
router.get('/', folderController.getFolderTree);
router.get('/:id', folderController.getFolder);
router.patch('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder);

export default router;
