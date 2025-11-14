import { Router } from 'express';
import * as chatController from '../controllers/chat.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { uploadAudio } from '../middleware/upload.middleware';
import { aiLimiter, uploadLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Conversation routes
router.post('/conversations', chatController.createConversation);
router.get('/conversations', chatController.getConversations);
router.get('/conversations/:conversationId', chatController.getConversation);
router.delete('/conversations/:conversationId', chatController.deleteConversation);
router.delete('/conversations', chatController.deleteAllConversations);

// Message routes
router.post('/conversations/:conversationId/messages', aiLimiter, chatController.sendMessage);

// SSE Streaming endpoint for real-time responses (FASTER: 2-3s to first token!)
router.post('/conversations/:conversationId/messages/stream', aiLimiter, chatController.sendMessageStreaming);

// Adaptive AI endpoints - intelligent response based on query complexity
router.post('/conversations/:conversationId/messages/adaptive', aiLimiter, chatController.sendAdaptiveMessage);
router.post('/conversations/:conversationId/messages/adaptive/stream', aiLimiter, chatController.sendAdaptiveMessageStreaming);

// Research route - combines documents + web search
router.post('/conversations/:conversationId/research', aiLimiter, chatController.sendResearchQuery);

// Voice transcription
router.post('/transcribe', uploadLimiter, uploadAudio, chatController.transcribeAudio);

// Maintenance routes
router.delete('/cache/semantic', chatController.clearSemanticCache); // Clear semantic cache for all users
router.post('/regenerate-titles', chatController.regenerateTitles); // Regenerate titles for "New Chat" conversations
router.delete('/conversations/empty', chatController.deleteEmptyConversations); // Delete all empty conversations

export default router;
