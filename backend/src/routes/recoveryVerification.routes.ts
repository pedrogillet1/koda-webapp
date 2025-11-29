/** Recovery Verification Routes - Magic Link Verification for Email and Phone */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
// Force reload
import {
  sendEmailVerificationLink,
  sendPhoneVerificationLink,
  verifyEmailWithToken,
  verifyPhoneWithToken,
  addPhoneNumber,
  getUserVerificationStatus,
} from '../services/recoveryVerification.service';

const router = Router();

/**
 * GET /api/recovery-verification/status
 * Get user's verification status
 */
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).users.id;
    console.log('🔍 [Recovery Verification] Getting status for userId:', userId);
    const status = await getUserVerificationStatus(userId);
    res.json(status);
  } catch (error: any) {
    console.error('Error getting verification status:', error);
    res.status(500).json({ error: error.message || 'Failed to get verification status' });
  }
});

/**
 * POST /api/recovery-verification/send-email-link
 * Send email verification magic link
 */
router.post('/send-email-link', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).users.id;
    await sendEmailVerificationLink(userId);
    res.json({ success: true, message: 'Verification email sent' });
  } catch (error: any) {
    console.error('Error sending email verification link:', error);
    res.status(400).json({ error: error.message || 'Failed to send verification email' });
  }
});

/**
 * POST /api/recovery-verification/send-phone-link
 * Send phone verification magic link via SMS
 */
router.post('/send-phone-link', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).users.id;
    await sendPhoneVerificationLink(userId);
    res.json({ success: true, message: 'Verification SMS sent' });
  } catch (error: any) {
    console.error('Error sending phone verification link:', error);
    res.status(400).json({ error: error.message || 'Failed to send verification SMS' });
  }
});

/**
 * POST /api/recovery-verification/add-phone
 * Add phone number to user profile
 */
router.post('/add-phone', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).users.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    await addPhoneNumber(userId, phoneNumber);
    res.json({ success: true, message: 'Phone number added successfully' });
  } catch (error: any) {
    console.error('Error adding phone number:', error);
    res.status(400).json({ error: error.message || 'Failed to add phone number' });
  }
});

/**
 * GET /api/recovery-verification/verify-email
 * Verify email using magic link token (public route)
 */
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await verifyEmailWithToken(token);
    res.json(result);
  } catch (error: any) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: error.message || 'Failed to verify email' });
  }
});

/**
 * GET /api/recovery-verification/verify-phone
 * Verify phone using magic link token (public route)
 */
router.get('/verify-phone', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const result = await verifyPhoneWithToken(token);
    res.json(result);
  } catch (error: any) {
    console.error('Error verifying phone:', error);
    res.status(500).json({ error: error.message || 'Failed to verify phone' });
  }
});

export default router;
