import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/encryption';

export interface GoogleOAuthInput {
  id: string;
  email: string;
  displayName: string;
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
        isEmailVerified: true, // Google has already verified the email
        isPhoneVerified: false,
        passwordHash: null,
        salt: null,
        phoneNumber: null,
      },
    });

    console.log('✅ New user created:', user.id);
  } else {
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
