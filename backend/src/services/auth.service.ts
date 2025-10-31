import prisma from '../config/database';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/encryption';

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Register a new user (creates pending user, no tokens until fully verified)
 */
export const registerUser = async ({ email, password }: RegisterInput) => {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message || 'Invalid password');
  }

  // Check if user already exists in main users table
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const { hash, salt } = await hashPassword(password);

  // Import pending user service
  const pendingUserService = await import('./pendingUser.service');

  // Create pending user with email code
  const { pendingUser, emailCode } = await pendingUserService.createPendingUser({
    email,
    passwordHash: hash,
    salt,
  });

  // Send email verification code
  try {
    const emailService = await import('./email.service');
    await emailService.sendVerificationEmail(email, emailCode);
    console.log(`📧 Verification code sent to ${email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    console.log(`📧 Would send verification code ${emailCode} to ${email}`);
  }

  return {
    message: 'Please check your email for verification code',
    email: pendingUser.email,
    requiresVerification: true,
  };
};

/**
 * Login user
 */
export const loginUser = async ({ email, password }: LoginInput) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { twoFactorAuth: true },
  });

  console.log('🔐 Login attempt for:', email);
  console.log('👤 User found:', !!user);
  console.log('🔑 Has passwordHash:', !!user?.passwordHash);
  console.log('🧂 Has salt:', !!user?.salt);

  if (!user || !user.passwordHash || !user.salt) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash, user.salt);
  console.log('✅ Password valid:', isValid);

  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Check if 2FA is enabled
  const requires2FA = user.twoFactorAuth?.isEnabled || false;

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
      requires2FA,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string) => {
  const refreshTokenHash = hashToken(refreshToken);

  // Find session
  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash,
      expiresAt: { gte: new Date() },
    },
    include: { user: true },
  });

  if (!session) {
    throw new Error('Invalid or expired refresh token');
  }

  // Generate new access token
  const accessToken = generateAccessToken({
    userId: session.user.id,
    email: session.user.email,
  });

  return { accessToken };
};

/**
 * Logout user
 */
export const logoutUser = async (refreshToken: string) => {
  const refreshTokenHash = hashToken(refreshToken);

  // Delete session
  await prisma.session.deleteMany({
    where: { refreshTokenHash },
  });

  return { success: true };
};

/**
 * Verify email code for pending user and complete registration (create actual user)
 */
export const verifyPendingUserEmail = async (email: string, code: string) => {
  const pendingUserService = await import('./pendingUser.service');

  const pendingUser = await pendingUserService.verifyPendingEmail(email, code);

  // Create the actual user in the database (email verification is sufficient)
  const user = await prisma.user.create({
    data: {
      email: pendingUser.email,
      passwordHash: pendingUser.passwordHash,
      salt: pendingUser.salt,
      phoneNumber: null, // Phone is optional
      isEmailVerified: true,
      isPhoneVerified: false,
    },
  });

  // Delete the pending user
  await pendingUserService.deletePendingUser(email);

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
    success: true,
    message: 'Email verified! Registration complete.',
    email: user.email,
    user: {
      id: user.id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/**
 * Resend email verification code for pending user
 */
export const resendPendingUserEmail = async (email: string) => {
  const pendingUserService = await import('./pendingUser.service');

  // Get pending user and regenerate email code
  const { pendingUser, emailCode } = await pendingUserService.resendEmailCode(email);

  // Send email verification code
  try {
    const emailService = await import('./email.service');
    await emailService.sendVerificationEmail(email, emailCode);
    console.log(`📧 Verification code resent to ${email}`);
  } catch (error) {
    console.error('Failed to resend verification email:', error);
    console.log(`📧 Would resend verification code ${emailCode} to ${email}`);
  }

  return {
    success: true,
    message: 'Verification code resent to your email',
  };
};

/**
 * Add phone and send verification code for pending user
 */
export const addPhoneToPendingUser = async (email: string, phoneNumber: string) => {
  const pendingUserService = await import('./pendingUser.service');
  const smsService = await import('./sms.service');

  // Validate and format phone number
  const formattedPhone = smsService.formatPhoneNumber(phoneNumber);
  if (!smsService.isValidPhoneNumber(formattedPhone)) {
    throw new Error('Invalid phone number format');
  }

  // Check if phone is already in use
  const existingUser = await prisma.user.findFirst({
    where: { phoneNumber: formattedPhone },
  });

  if (existingUser) {
    throw new Error('Phone number already in use');
  }

  // Add phone to pending user
  const { pendingUser, phoneCode } = await pendingUserService.addPhoneToPending(
    email,
    formattedPhone
  );

  // Send SMS
  // Always log the code in development for easy testing
  console.log(`📱 SMS Verification Code: ${phoneCode} for ${formattedPhone}`);

  try {
    await smsService.sendVerificationSMS(formattedPhone, phoneCode);
    console.log(`✅ SMS sent successfully to ${formattedPhone}`);
  } catch (error) {
    console.error('⚠️  Failed to send SMS (code still valid for testing):', error.message);
  }

  return {
    success: true,
    message: 'Verification code sent to your phone',
  };
};

/**
 * Verify phone and create actual user (final step)
 */
export const verifyPendingUserPhone = async (email: string, code: string) => {
  const pendingUserService = await import('./pendingUser.service');

  // Verify phone code
  const pendingUser = await pendingUserService.verifyPendingPhone(email, code);

  // Allow phone-only verification (don't require email to be verified)
  if (!pendingUser.phoneVerified) {
    throw new Error('Phone verification required');
  }

  // Create the actual user in the database
  const user = await prisma.user.create({
    data: {
      email: pendingUser.email,
      passwordHash: pendingUser.passwordHash,
      salt: pendingUser.salt,
      phoneNumber: pendingUser.phoneNumber!,
      isEmailVerified: pendingUser.emailVerified || false, // Set based on actual verification status
      isPhoneVerified: true,
    },
  });

  // Delete the pending user
  await pendingUserService.deletePendingUser(email);

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
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

/**
 * Send email verification code
 */
export const sendEmailVerificationCode = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.isEmailVerified) {
    throw new Error('Email already verified');
  }

  // Import email service dynamically to avoid circular dependencies
  const emailService = await import('./email.service');

  // Generate verification code
  const code = emailService.generateVerificationCode();

  // Store code in database with 10-minute expiry
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Delete any existing unused codes
  await prisma.verificationCode.deleteMany({
    where: {
      userId,
      type: 'email',
      isUsed: false,
    },
  });

  // Create new verification code
  await prisma.verificationCode.create({
    data: {
      userId,
      type: 'email',
      code,
      expiresAt,
    },
  });

  // Send email
  await emailService.sendVerificationEmail(user.email, code);

  return { success: true };
};

/**
 * Verify email code
 */
export const verifyEmailCode = async (userId: string, code: string) => {
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      userId,
      type: 'email',
      code,
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!verificationCode) {
    throw new Error('Invalid or expired verification code');
  }

  // Mark code as used
  await prisma.verificationCode.update({
    where: { id: verificationCode.id },
    data: { isUsed: true },
  });

  // Update user
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  });

  // Send welcome email
  const emailService = await import('./email.service');
  await emailService.sendWelcomeEmail(user.email, user.email.split('@')[0]);

  return { success: true };
};

/**
 * Send phone verification code
 */
export const sendPhoneVerificationCode = async (userId: string, phoneNumber: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Import SMS service dynamically
  const smsService = await import('./sms.service');

  // Validate phone number format
  const formattedPhone = smsService.formatPhoneNumber(phoneNumber);
  if (!smsService.isValidPhoneNumber(formattedPhone)) {
    throw new Error('Invalid phone number format');
  }

  // Check if phone number is already in use by another user
  const existingUser = await prisma.user.findFirst({
    where: {
      phoneNumber: formattedPhone,
      id: { not: userId },
    },
  });

  if (existingUser) {
    throw new Error('Phone number already in use');
  }

  // Generate verification code
  const code = smsService.generateSMSCode();

  // Store code in database with 10-minute expiry
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Delete any existing unused codes
  await prisma.verificationCode.deleteMany({
    where: {
      userId,
      type: 'phone',
      isUsed: false,
    },
  });

  // Create new verification code
  await prisma.verificationCode.create({
    data: {
      userId,
      type: 'phone',
      code,
      expiresAt,
    },
  });

  // Update user's phone number (unverified)
  await prisma.user.update({
    where: { id: userId },
    data: {
      phoneNumber: formattedPhone,
      isPhoneVerified: false,
    },
  });

  // Send SMS
  await smsService.sendVerificationSMS(formattedPhone, code);

  return { success: true };
};

/**
 * Verify phone code
 */
export const verifyPhoneCode = async (userId: string, code: string) => {
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      userId,
      type: 'phone',
      code,
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!verificationCode) {
    throw new Error('Invalid or expired verification code');
  }

  // Mark code as used
  await prisma.verificationCode.update({
    where: { id: verificationCode.id },
    data: { isUsed: true },
  });

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: { isPhoneVerified: true },
  });

  return { success: true };
};

/**
 * Request password reset (send code to email or phone)
 */
export const requestPasswordReset = async ({
  email,
  phoneNumber,
}: {
  email?: string;
  phoneNumber?: string;
}) => {
  // Find user by email or phone number
  const user = await prisma.user.findFirst({
    where: email
      ? { email: email.toLowerCase() }
      : { phoneNumber },
  });

  if (!user) {
    // For security, don't reveal if user exists or not
    return {
      success: true,
      message: 'If an account exists, a reset code will be sent',
    };
  }

  // Generate verification code
  const emailService = await import('./email.service');
  const code = emailService.generateVerificationCode();

  // Store code in database with 10-minute expiry
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // Delete any existing unused password reset codes
  await prisma.verificationCode.deleteMany({
    where: {
      userId: user.id,
      type: 'password_reset',
      isUsed: false,
    },
  });

  // Create new verification code
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      type: 'password_reset',
      code,
      expiresAt,
    },
  });

  // Send code via email or SMS
  if (email && user.email) {
    try {
      await emailService.sendPasswordResetEmail(user.email, code);
      console.log(`📧 Password reset code sent to ${user.email}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      console.log(`📧 Would send reset code ${code} to ${user.email}`);
    }
  } else if (phoneNumber && user.phoneNumber) {
    try {
      const smsService = await import('./sms.service');
      await smsService.sendPasswordResetSMS(user.phoneNumber, code);
      console.log(`📱 Password reset code sent to ${user.phoneNumber}`);
    } catch (error) {
      console.error('Failed to send password reset SMS:', error);
      console.log(`📱 Would send reset code ${code} to ${user.phoneNumber}`);
    }
  }

  return {
    success: true,
    message: 'If an account exists, a reset code will be sent',
  };
};

/**
 * Verify password reset code
 */
export const verifyPasswordResetCode = async ({
  email,
  phoneNumber,
  code,
}: {
  email?: string;
  phoneNumber?: string;
  code: string;
}) => {
  // Find user by email or phone number
  const user = await prisma.user.findFirst({
    where: email
      ? { email: email.toLowerCase() }
      : { phoneNumber },
  });

  if (!user) {
    throw new Error('Invalid verification code');
  }

  // Find valid verification code
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      userId: user.id,
      type: 'password_reset',
      code,
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!verificationCode) {
    throw new Error('Invalid or expired verification code');
  }

  return {
    success: true,
    message: 'Code verified successfully',
  };
};

/**
 * Reset password with verified code
 */
export const resetPassword = async ({
  email,
  phoneNumber,
  code,
  newPassword,
}: {
  email?: string;
  phoneNumber?: string;
  code: string;
  newPassword: string;
}) => {
  // Validate password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message || 'Invalid password');
  }

  // Find user by email or phone number
  const user = await prisma.user.findFirst({
    where: email
      ? { email: email.toLowerCase() }
      : { phoneNumber },
  });

  if (!user) {
    throw new Error('Invalid verification code');
  }

  // Find valid verification code
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      userId: user.id,
      type: 'password_reset',
      code,
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
  });

  if (!verificationCode) {
    throw new Error('Invalid or expired verification code');
  }

  // Hash new password
  const { hash, salt } = await hashPassword(newPassword);

  // Update user password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hash,
      salt,
    },
  });

  // Mark verification code as used
  await prisma.verificationCode.update({
    where: { id: verificationCode.id },
    data: { isUsed: true },
  });

  // Invalidate all existing sessions for security
  await prisma.session.deleteMany({
    where: { userId: user.id },
  });

  return {
    success: true,
    message: 'Password reset successfully',
  };
};
