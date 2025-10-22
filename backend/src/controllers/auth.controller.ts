import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import prisma from '../config/database';

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await authService.registerUser({ email, password });

    // New flow: returns { message, email, requiresVerification } without tokens
    res.status(201).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🎯 LOGIN CONTROLLER HIT - Email:', req.body.email);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    console.log('✅ Calling authService.loginUser');
    const result = await authService.loginUser({ email, password });

    res.status(200).json({
      message: 'Login successful',
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  } catch (error) {
    const err = error as Error;
    res.status(401).json({ error: err.message });
  }
};

/**
 * Refresh access token
 */
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      accessToken: result.accessToken,
    });
  } catch (error) {
    const err = error as Error;
    res.status(401).json({ error: err.message });
  }
};

/**
 * Logout user
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    await authService.logoutUser(refreshToken);

    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Send email verification code
 */
export const sendEmailVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await authService.sendEmailVerificationCode(userId);

    res.status(200).json({ message: 'Verification code sent to your email' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Verify email with code
 */
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    await authService.verifyEmailCode(userId, code);

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Send phone verification code
 */
export const sendPhoneVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { phoneNumber } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    await authService.sendPhoneVerificationCode(userId, phoneNumber);

    res.status(200).json({ message: 'Verification code sent to your phone' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Verify phone with code
 */
export const verifyPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { code } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    await authService.verifyPhoneCode(userId, code);

    res.status(200).json({ message: 'Phone verified successfully' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Verify email for pending user (new registration flow)
 */
export const verifyPendingEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ error: 'Email and code are required' });
      return;
    }

    const result = await authService.verifyPendingUserEmail(email, code);

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Resend email verification code for pending user (new registration flow)
 */
export const resendPendingEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await authService.resendPendingUserEmail(email);

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Add phone to pending user (new registration flow)
 */
export const addPendingPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email || !phoneNumber) {
      res.status(400).json({ error: 'Email and phone number are required' });
      return;
    }

    const result = await authService.addPhoneToPendingUser(email, phoneNumber);

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Verify phone for pending user and complete registration (new registration flow)
 */
export const verifyPendingPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('📱 verifyPendingPhone called');
    console.log('📱 Request body:', JSON.stringify(req.body, null, 2));

    const { email, code } = req.body;

    if (!email || !code) {
      console.log('❌ Missing email or code');
      res.status(400).json({ error: 'Email and code are required' });
      return;
    }

    console.log(`📱 Verifying phone for pending user: ${email}`);
    const result = await authService.verifyPendingUserPhone(email, code);

    console.log('✅ Phone verification successful, registration complete!');
    res.status(200).json({
      message: 'Registration complete!',
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
  } catch (error) {
    const err = error as Error;
    console.error('❌ Error in verifyPendingPhone:', err.message);
    console.error('❌ Full error:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Request password reset (send code to email or phone)
 */
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      res.status(400).json({ error: 'Email or phone number is required' });
      return;
    }

    const result = await authService.requestPasswordReset({ email, phoneNumber });

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Verify password reset code
 */
export const verifyPasswordResetCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber, code } = req.body;

    if ((!email && !phoneNumber) || !code) {
      res.status(400).json({ error: 'Email/phone number and code are required' });
      return;
    }

    const result = await authService.verifyPasswordResetCode({ email, phoneNumber, code });

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Reset password with verified code
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber, code, newPassword } = req.body;

    if ((!email && !phoneNumber) || !code || !newPassword) {
      res.status(400).json({ error: 'Email/phone number, code, and new password are required' });
      return;
    }

    const result = await authService.resetPassword({ email, phoneNumber, code, newPassword });

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Get current user data
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch full user data from database using the ID from the token
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        isEmailVerified: true,
        phoneNumber: true,
        isPhoneVerified: true,
        twoFactorAuth: {
          select: {
            isEnabled: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
        emailVerified: user.isEmailVerified,
        phoneNumber: user.phoneNumber,
        phoneVerified: user.isPhoneVerified,
        twoFactorEnabled: user.twoFactorAuth?.isEnabled || false,
      }
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};
