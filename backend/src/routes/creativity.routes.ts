import { Router } from 'express';
import { creativityController } from '../controllers/creativity.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/creativity/personas
 * Get all available personas
 */
router.get('/personas', creativityController.getPersonas.bind(creativityController));

/**
 * GET /api/creativity/personas/:name
 * Get a specific persona by name
 */
router.get('/personas/:name', creativityController.getPersona.bind(creativityController));

/**
 * GET /api/creativity/personas/:name/temperature
 * Get recommended temperature for a specific persona
 */
router.get('/personas/:name/temperature', creativityController.getRecommendedTemperature.bind(creativityController));

/**
 * POST /api/creativity/message
 * Send a message with creativity controls (temperature and persona)
 * Body: { message, conversationId, temperature?, persona? }
 */
router.post('/message', aiLimiter, creativityController.sendCreativeMessage.bind(creativityController));

/**
 * POST /api/creativity/validate-temperature
 * Validate a temperature value
 * Body: { temperature }
 */
router.post('/validate-temperature', creativityController.validateTemperature.bind(creativityController));

export default router;
