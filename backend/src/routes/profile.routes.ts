import { Router } from 'express';
import { profileController } from '../controllers/profile.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/profile
 * Get the current user's profile
 */
router.get('/', profileController.getProfile.bind(profileController));

/**
 * PUT /api/profile
 * Update the current user's profile
 *
 * Body: {
 *   name?: string,
 *   role?: string,
 *   organization?: string,
 *   expertiseLevel?: string,
 *   customInstructions?: string,
 *   writingStyle?: string,
 *   preferredTone?: string,
 *   coreGoals?: string
 * }
 */
router.put('/', profileController.updateProfile.bind(profileController));

/**
 * DELETE /api/profile
 * Delete the current user's profile
 */
router.delete('/', profileController.deleteProfile.bind(profileController));

/**
 * GET /api/profile/stats
 * Get profile completion statistics
 */
router.get('/stats', profileController.getProfileStats.bind(profileController));

/**
 * GET /api/profile/system-prompt
 * Get the system prompt generated from the user's profile
 */
router.get('/system-prompt', profileController.getSystemPrompt.bind(profileController));

/**
 * GET /api/profile/options
 * Get available options for profile fields (writing styles, tones, etc.)
 */
router.get('/options', profileController.getProfileOptions.bind(profileController));

/**
 * POST /api/profile/analyze
 * Analyze conversation history and suggest profile improvements
 *
 * Body: {
 *   conversationHistory: string
 * }
 */
router.post('/analyze', profileController.analyzeConversation.bind(profileController));

export default router;
