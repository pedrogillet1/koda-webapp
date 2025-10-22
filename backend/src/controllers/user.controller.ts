import { Request, Response } from 'express';
import prisma from '../config/database';
import crypto from 'crypto';

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { firstName, lastName, phoneNumber, profileImage } = req.body;

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        phoneNumber: phoneNumber || null,
        profileImage: profileImage || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        profileImage: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error updating profile:', error);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Change user password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    // Get user with password hash and salt
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        salt: true,
        googleId: true,
        appleId: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isOAuthUser = !user.passwordHash || !user.salt;

    // If user has a password, verify current password
    if (!isOAuthUser) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required' });
        return;
      }

      if (!user.salt) {
        res.status(400).json({ error: 'User account has no password set' });
        return;
      }

      // Verify current password
      const currentPasswordHash = crypto
        .pbkdf2Sync(currentPassword, user.salt, 1000, 64, 'sha512')
        .toString('hex');

      if (currentPasswordHash !== user.passwordHash) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    // Validate new password
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>0-9]/.test(newPassword)) {
      res.status(400).json({ error: 'New password must contain a symbol or number' });
      return;
    }

    // Check if password contains name or email
    const email = user.email.toLowerCase();
    const firstName = user.firstName?.toLowerCase() || '';
    const lastName = user.lastName?.toLowerCase() || '';
    const passwordLower = newPassword.toLowerCase();

    if (
      email.includes(passwordLower) ||
      passwordLower.includes(email.split('@')[0]) ||
      (firstName && passwordLower.includes(firstName)) ||
      (lastName && passwordLower.includes(lastName))
    ) {
      res.status(400).json({ error: 'Password must not contain your name or email' });
      return;
    }

    // Generate new salt and hash
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newPasswordHash = crypto
      .pbkdf2Sync(newPassword, newSalt, 1000, 64, 'sha512')
      .toString('hex');

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: newPasswordHash,
        salt: newSalt,
      },
    });

    const message = isOAuthUser
      ? 'Password set successfully! You can now login with email and password.'
      : 'Password changed successfully';

    res.status(200).json({ message });
  } catch (error) {
    const err = error as Error;
    console.error('Error changing password:', error);
    res.status(500).json({ error: err.message });
  }
};
