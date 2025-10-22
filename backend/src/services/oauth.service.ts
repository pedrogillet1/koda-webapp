import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/encryption';

export interface GoogleProfile {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * Handle Google OAuth login/signup
 */
export const googleOAuth = async (profile: GoogleProfile) => {
  // Check if user exists with this Google ID
  let user = await prisma.user.findUnique({
    where: { googleId: profile.id },
  });

  // If not found by Google ID, check by email
  if (!user) {
    user = await prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });

    // If user exists with this email, link Google account
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id, isEmailVerified: true },
      });
    }
  }

  // If still no user, create new one
  if (!user) {
    // Parse displayName into firstName and lastName
    let firstName: string | undefined;
    let lastName: string | undefined;

    if (profile.displayName) {
      const nameParts = profile.displayName.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
    }

    user = await prisma.user.create({
      data: {
        email: profile.email.toLowerCase(),
        googleId: profile.id,
        firstName,
        lastName,
        isEmailVerified: true,
      },
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  // Store refresh token
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};
