import { Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import * as oauthService from '../services/oauth.service';
import { config } from '../config/env';
import appleSignin from 'apple-signin-auth';

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

/**
 * Initiate Apple OAuth - redirect to Apple authorization URL
 */
export const appleAuth = (req: Request, res: Response) => {
  const authUrl = appleSignin.getAuthorizationUrl({
    clientID: config.APPLE_CLIENT_ID,
    redirectUri: config.APPLE_CALLBACK_URL,
    scope: 'name email',
    responseMode: 'form_post',
  } as any);
  res.redirect(authUrl);
};

/**
 * Apple OAuth callback - POST request with form data
 */
export const appleCallback = async (req: Request, res: Response) => {
  try {
    const { code, id_token, user: userStr } = req.body;

    if (!id_token) {
      console.error('Apple OAuth: No id_token received');
      res.redirect(`${config.FRONTEND_URL}/login?error=no_token`);
      return;
    }

    // Parse user data if provided (only sent on first authorization)
    let userData;
    if (userStr) {
      try {
        userData = JSON.parse(userStr);
      } catch (e) {
        console.log('Could not parse user data from Apple');
      }
    }

    // Process Apple OAuth login
    const result = await oauthService.appleOAuth({
      idToken: id_token,
      user: userData,
    });

    // Redirect to frontend with tokens
    const redirectUrl = `${config.FRONTEND_URL}/auth/callback?accessToken=${result.tokens.accessToken}&refreshToken=${result.tokens.refreshToken}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Apple OAuth error:', error);
    res.redirect(`${config.FRONTEND_URL}/login?error=apple_oauth_error`);
  }
};
