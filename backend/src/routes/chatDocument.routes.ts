import { Router } from 'express';
import * as chatDocumentController from '../controllers/chatDocument.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Chat document routes
router.get('/:id', chatDocumentController.getChatDocument);
router.get('/:id/export/:format', chatDocumentController.exportChatDocument);
router.get('/conversation/:conversationId', chatDocumentController.getChatDocumentsByConversation);

export default router;
