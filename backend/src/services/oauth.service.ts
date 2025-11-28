import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/encryption';
import appleSignin from 'apple-signin-auth';
import { config } from '../config/env';

export interface GoogleOAuthInput {
  id: string;
  email: string;
  displayName: string;
}

export interface AppleOAuthInput {
  idToken: string;
  user?: {
    name?: {
      firstName?: string;
      lastName?: string;
    };
    email?: string;
  };
}

export interface OAuthResult {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Process Google OAuth login - find or create user
 */
export const googleOAuth = async ({
  id,
  email,
  displayName,
}: GoogleOAuthInput): Promise<OAuthResult> => {
  console.log('🔐 Google OAuth login:', email);

  // Find or create user
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    console.log('👤 Creating new user from Google OAuth');

    // Parse displayName into first and last names
    const nameParts = displayName.split(' ');
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    // Create new user (OAuth users don't have passwords)
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        googleId: id,
        isEmailVerified: true, // Google has already verified the email
        isPhoneVerified: false,
        passwordHash: null,
        salt: null,
        phoneNumber: null,
      },
    });

    console.log('✅ New user created:', user.id);
  } else {
    // Update googleId if not set
    if (!user.googleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleId: id },
      });
    }
    console.log('✅ Existing user found:', user.id);
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  // Store refresh token in session
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    },
  });

  console.log('✅ OAuth session created for user:', user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/**
 * Process Apple OAuth login - find or create user
 */
export const appleOAuth = async ({
  idToken,
  user: appleUser,
}: AppleOAuthInput): Promise<OAuthResult> => {
  console.log('🍎 Apple OAuth login');

  // Verify the Apple ID token
  const appleIdTokenClaims = await appleSignin.verifyIdToken(idToken, {
    audience: config.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });

  const appleId = appleIdTokenClaims.sub;
  const email = appleIdTokenClaims.email || appleUser?.email;

  if (!email) {
    throw new Error('Email not provided by Apple');
  }

  console.log('🔐 Apple OAuth verified:', email);

  // Find or create user
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email.toLowerCase() },
        { appleId: appleId },
      ],
    },
  });

  if (!user) {
    console.log('👤 Creating new user from Apple OAuth');

    const firstName = appleUser?.name?.firstName || null;
    const lastName = appleUser?.name?.lastName || null;

    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        appleId,
        isEmailVerified: true, // Apple has already verified the email
        isPhoneVerified: false,
        passwordHash: null,
        salt: null,
        phoneNumber: null,
      },
    });

    console.log('✅ New user created:', user.id);
  } else {
    // Update appleId if not set
    if (!user.appleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { appleId },
      });
    }
    console.log('✅ Existing user found:', user.id);
  }

  // Generate tokens
  const accessToken = generateAccessToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

  // Store refresh token in session
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    },
  });

  console.log('✅ Apple OAuth session created for user:', user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/** Legacy stub methods - kept for compatibility */
class OAuthService {
  async getAuthorizationUrl() {
    return '';
  }
  async handleCallback() {
    return null;
  }
  async refreshToken() {
    return null;
  }
}

export default new OAuthService();
