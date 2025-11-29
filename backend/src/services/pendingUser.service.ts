/** Pending User Service - Email and Phone Verification */

import prisma from '../config/database';
import { generateVerificationCode } from './email.service';
import { generateSMSCode } from './sms.service';

/**
 * Verify pending user's email with verification code
 */
export const verifyPendingEmail = async (email: string, code: string) => {
  const pendingUser = await prisma.pending_users.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!pendingUser) {
    throw new Error('No pending registration found for this email');
  }

  // Check if code has expired (10 minutes)
  if (pendingUser.expiresAt < new Date()) {
    await prisma.pending_users.delete({
      where: { email: email.toLowerCase() },
    });
    throw new Error('Verification code has expired. Please sign up again.');
  }

  // Verify the email code
  if (!pendingUser.emailCode || pendingUser.emailCode !== code) {
    throw new Error('Invalid verification code');
  }

  // Mark email as verified and return the updated object
  const updatedPendingUser = await prisma.pending_users.update({
    where: { email: email.toLowerCase() },
    data: { emailVerified: true },
  });

  return updatedPendingUser;
};

/**
 * Resend email verification code
 */
export const resendEmailCode = async (email: string) => {
  const pendingUser = await prisma.pending_users.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!pendingUser) {
    throw new Error('No pending registration found for this email');
  }

  // Generate new email code
  const emailCode = generateVerificationCode();

  // Update pending user with new code and extend expiration
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes

  const updatedPendingUser = await prisma.pending_users.update({
    where: { email: email.toLowerCase() },
    data: {
      emailCode,
      expiresAt,
    },
  });

  return { pending_users: updatedPendingUser, emailCode };
};

/**
 * Add phone number to pending user and send verification code
 */
export const addPhoneToPending = async (email: string, phoneNumber: string) => {
  const pendingUser = await prisma.pending_users.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!pendingUser) {
    throw new Error('No pending registration found for this email');
  }

  // Generate phone verification code
  const phoneCode = generateSMSCode();

  // Update pending user with phone number and code
  const updatedPendingUser = await prisma.pending_users.update({
    where: { email: email.toLowerCase() },
    data: {
      phoneNumber,
      phoneCode,
    },
  });

  return { pending_users: updatedPendingUser, phoneCode };
};

/**
 * Verify pending user's phone with verification code
 */
export const verifyPendingPhone = async (email: string, code: string) => {
  const pendingUser = await prisma.pending_users.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!pendingUser) {
    throw new Error('No pending registration found for this email');
  }

  // Check if code has expired
  if (pendingUser.expiresAt < new Date()) {
    await prisma.pending_users.delete({
      where: { email: email.toLowerCase() },
    });
    throw new Error('Verification code has expired. Please sign up again.');
  }

  // Verify the phone code
  if (!pendingUser.phoneCode || pendingUser.phoneCode !== code) {
    throw new Error('Invalid verification code');
  }

  // Mark phone as verified and return the updated object
  const updatedPendingUser = await prisma.pending_users.update({
    where: { email: email.toLowerCase() },
    data: { phoneVerified: true },
  });

  return updatedPendingUser;
};

/**
 * Delete pending user
 */
export const deletePendingUser = async (email: string) => {
  await prisma.pending_users.delete({
    where: { email: email.toLowerCase() },
  });
  console.log(`🗑️  Deleted pending user: ${email}`);
};

/** Legacy class for compatibility */
class PendingUserService {
  async createPendingUser(userData: any) {
    // Legacy stub - not used
    return { id: '', email: '' };
  }
  async getPendingUser(id: string) {
    // Legacy stub - not used
    return null;
  }
  async deletePendingUser(id: string) {
    // Legacy stub - not used
    return true;
  }
}

export default new PendingUserService();
