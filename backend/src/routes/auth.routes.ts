import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import * as twoFactorController from '../controllers/twoFactor.controller';
import * as oauthController from '../controllers/oauth.controller';
import { authLimiter, twoFactorLimiter } from '../middleware/rateLimit.middleware';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Auth routes with rate limiting
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticateToken, authController.getCurrentUser);

// Pending User Verification routes (new registration flow)
router.post('/pending/verify-email', authLimiter, authController.verifyPendingEmail);
router.post('/pending/resend-email', authLimiter, authController.resendPendingEmail);
router.post('/pending/add-phone', authLimiter, authController.addPendingPhone);
router.post('/pending/verify-phone', authLimiter, authController.verifyPendingPhone);

// Google OAuth routes
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);

// Email and Phone Verification routes (protected)
router.post('/verify/send-email', authenticateToken, authController.sendEmailVerification);
router.post('/verify/email', authenticateToken, authController.verifyEmail);
router.post('/verify/send-phone', authenticateToken, authController.sendPhoneVerification);
router.post('/verify/phone', authenticateToken, authController.verifyPhone);

// 2FA routes (protected)
router.post('/2fa/enable', authenticateToken, twoFactorController.enable2FA);
router.post('/2fa/verify', authenticateToken, twoFactorLimiter, twoFactorController.verify2FA);
router.post('/2fa/verify-login', twoFactorLimiter, twoFactorController.verify2FALogin);
router.post('/2fa/disable', authenticateToken, twoFactorController.disable2FA);
router.get('/2fa/backup-codes', authenticateToken, twoFactorController.getBackupCodes);

// Password reset routes (CODE-BASED - OLD)
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/verify-reset-code', authLimiter, authController.verifyPasswordResetCode);
router.post('/reset-password', authLimiter, authController.resetPassword);

// PASSWORD RECOVERY ROUTES (LINK-BASED - NEW)
router.post('/forgot-password-init', authLimiter, authController.initiateForgotPasswordController);
router.post('/send-reset-link', authLimiter, authController.sendResetLinkController);
router.post('/reset-password-with-token', authLimiter, authController.resetPasswordWithTokenController);

export default router;
