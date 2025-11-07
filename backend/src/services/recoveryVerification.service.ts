/** Recovery Verification Service - Magic Link Verification for Email and Phone */

import prisma from '../config/database';
import crypto from 'crypto';
import { sendEmail } from './email.service';
import { sendVerificationSMS, formatPhoneNumber, isValidPhoneNumber } from './sms.service';
import { config } from '../config/env';

/**
 * Generate a secure magic link token
 */
function generateMagicToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Mask email for display (e.g., j***@example.com)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 5))}@${domain}`;
}

/**
 * Mask phone number for display (e.g., +1 *** *** 1234)
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return '***';
  const lastFour = cleaned.slice(-4);
  return `+${cleaned[0]} *** *** ${lastFour}`;
}

/**
 * Send email verification magic link
 */
export async function sendEmailVerificationLink(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, isEmailVerified: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.isEmailVerified) {
    throw new Error('Email is already verified');
  }

  // Generate magic token
  const token = generateMagicToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

  // Store verification token in database
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      code: token,
      type: 'email_recovery',
      expiresAt,
    },
  });

  // Create magic link
  const verificationLink = `${config.FRONTEND_URL}/verify-recovery-email?token=${token}`;

  // Send email
  const subject = 'Verify Your Recovery Email - Koda';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #181818; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: #181818;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
            font-weight: 600;
          }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🛡️ Verify Your Recovery Email</h1>
          </div>
          <div class="content">
            <p>Hi ${user.firstName || 'there'},</p>
            <p>You're adding a second way to recover your Koda account. Click the button below to verify your email address:</p>
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">Verify Email</a>
            </p>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationLink}</p>
            <p style="color: #D92D20; font-weight: 600; margin-top: 20px;">⚠️ This link will expire in 15 minutes.</p>
            <p style="margin-top: 20px;">If you didn't request this verification, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Koda. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail(user.email, subject, html);
  console.log(`✅ Recovery email verification link sent to ${user.email}`);
}

/**
 * Send phone verification magic link via SMS
 */
export async function sendPhoneVerificationLink(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phoneNumber: true, isPhoneVerified: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.phoneNumber) {
    throw new Error('Phone number not set');
  }

  if (user.isPhoneVerified) {
    throw new Error('Phone is already verified');
  }

  // Generate magic token
  const token = generateMagicToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes expiry

  // Store verification token in database
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      code: token,
      type: 'phone_recovery',
      expiresAt,
    },
  });

  // Create magic link
  const verificationLink = `${config.FRONTEND_URL}/verify-recovery-phone?token=${token}`;

  // Send SMS
  const message = `Verify your Koda recovery phone:\n\n${verificationLink}\n\n⚠️ This link expires in 15 minutes.`;
  await sendVerificationSMS(user.phoneNumber, message);

  console.log(`✅ Recovery phone verification link sent to ${user.phoneNumber}`);
}

/**
 * Verify email using magic link token
 */
export async function verifyEmailWithToken(token: string): Promise<{ success: boolean; message: string }> {
  // Find verification code
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      code: token,
      type: 'email_recovery',
      expiresAt: { gte: new Date() },
    },
    include: { user: true },
  });

  if (!verificationCode) {
    return { success: false, message: 'Invalid or expired verification link' };
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: verificationCode.userId },
    data: { isEmailVerified: true },
  });

  // Delete used verification code
  await prisma.verificationCode.delete({
    where: { id: verificationCode.id },
  });

  console.log(`✅ Email verified for user ${verificationCode.userId}`);
  return { success: true, message: 'Email verified successfully' };
}

/**
 * Verify phone using magic link token
 */
export async function verifyPhoneWithToken(token: string): Promise<{ success: boolean; message: string }> {
  // Find verification code
  const verificationCode = await prisma.verificationCode.findFirst({
    where: {
      code: token,
      type: 'phone_recovery',
      expiresAt: { gte: new Date() },
    },
    include: { user: true },
  });

  if (!verificationCode) {
    return { success: false, message: 'Invalid or expired verification link' };
  }

  // Mark phone as verified
  await prisma.user.update({
    where: { id: verificationCode.userId },
    data: { isPhoneVerified: true },
  });

  // Delete used verification code
  await prisma.verificationCode.delete({
    where: { id: verificationCode.id },
  });

  console.log(`✅ Phone verified for user ${verificationCode.userId}`);
  return { success: true, message: 'Phone verified successfully' };
}

/**
 * Add phone number to user profile
 */
export async function addPhoneNumber(userId: string, phoneNumber: string): Promise<void> {
  // Validate phone number format
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!isValidPhoneNumber(formattedPhone)) {
    throw new Error('Invalid phone number format');
  }

  // Check if phone number is already in use
  const existingUser = await prisma.user.findFirst({
    where: {
      phoneNumber: formattedPhone,
      id: { not: userId },
    },
  });

  if (existingUser) {
    throw new Error('Phone number is already in use');
  }

  // Update user with phone number
  await prisma.user.update({
    where: { id: userId },
    data: {
      phoneNumber: formattedPhone,
      isPhoneVerified: false, // Not verified yet
    },
  });

  console.log(`✅ Phone number added for user ${userId}: ${formattedPhone}`);
}

/**
 * Get user verification status
 */
export async function getUserVerificationStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phoneNumber: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const status = {
    email: user.email,
    maskedEmail: maskEmail(user.email),
    phoneNumber: user.phoneNumber,
    maskedPhone: user.phoneNumber ? maskPhoneNumber(user.phoneNumber) : null,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    hasPhone: !!user.phoneNumber,
  };

  console.log('📊 [Recovery Verification] Status returned:', JSON.stringify(status, null, 2));

  return status;
}
