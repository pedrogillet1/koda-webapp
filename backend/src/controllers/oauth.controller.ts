import { Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import * as oauthService from '../services/oauth.service';
import { config } from '../config/env';

/**
 * Initiate Google OAuth
 */
export const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

/**
 * Google OAuth callback
 */
export const googleCallback = [
  passport.authenticate('google', { session: false, failureRedirect: `${config.FRONTEND_URL}/login?error=oauth_failed` }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const googleProfile = req.user as any;

      if (!googleProfile || !googleProfile.email) {
        res.redirect(`${config.FRONTEND_URL}/login?error=no_email`);
        return;
      }

      // Process OAuth login
      const result = await oauthService.googleOAuth({
        id: googleProfile.id,
        email: googleProfile.email,
        displayName: googleProfile.displayName,
      });

      // Redirect to frontend with tokens
      const redirectUrl = `${config.FRONTEND_URL}/auth/callback?accessToken=${result.tokens.accessToken}&refreshToken=${result.tokens.refreshToken}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('OAuth error:', error);
      res.redirect(`${config.FRONTEND_URL}/login?error=oauth_error`);
    }
  },
];
