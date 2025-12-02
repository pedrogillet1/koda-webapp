import express from 'express';
import { agentController } from '../controllers/agent.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Simple solve endpoint - ReAct agent with language detection
router.post('/solve', agentController.solve.bind(agentController));

// Agent execution endpoints
router.post('/execute', agentController.execute.bind(agentController));
router.post('/execute/stream', agentController.executeStream.bind(agentController));

// Tool endpoints
router.post('/tool', agentController.executeTool.bind(agentController));
router.get('/tools', agentController.getTools.bind(agentController));

// Utility endpoints
router.post('/should-use', agentController.shouldUseAgent.bind(agentController));

export default router;
