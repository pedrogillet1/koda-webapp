import twilio from 'twilio';
import { config } from '../config/env';
import crypto from 'crypto';

// Initialize Twilio client
let twilioClient: twilio.Twilio | null = null;

if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN &&
    config.TWILIO_ACCOUNT_SID !== 'your-twilio-account-sid') {
  twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
}

export interface PhoneVerificationData {
  phoneNumber: string;
  code: string;
  expiresAt: Date;
}

/**
 * Generate a 6-digit verification code for SMS
 * @returns 6-digit numeric code
 */
export const generateSMSCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Format phone number to E.164 format
 * @param phoneNumber - Phone number in various formats
 * @returns Formatted phone number with country code
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // If it doesn't start with country code, assume US (+1)
  if (!cleaned.startsWith('1') && cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it already has country code but no +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If it already has +
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  // Default: add + to the number
  return `+${cleaned}`;
};

/**
 * Validate phone number format
 * @param phoneNumber - Phone number to validate
 * @returns True if valid E.164 format
 */
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
};

/**
 * Send SMS verification code
 * @param phoneNumber - Phone number in E.164 format
 * @param code - 6-digit verification code
 * @returns Promise with send result
 */
export const sendVerificationSMS = async (
  phoneNumber: string,
  code: string
): Promise<void> => {
  try {
    // Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidPhoneNumber(formattedPhone)) {
      throw new Error('Invalid phone number format');
    }

    // If Twilio is not configured, just log
    if (!twilioClient || !config.TWILIO_PHONE_NUMBER ||
        config.TWILIO_PHONE_NUMBER === 'your-twilio-phone-number') {
      console.warn('⚠️  Twilio not configured. SMS not sent.');
      console.log(`📱 Would send SMS code ${code} to ${formattedPhone}`);
      return;
    }

    // Send SMS via Twilio
    await twilioClient.messages.create({
      body: `Your Koda verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message.`,
      from: config.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ SMS verification code sent to ${formattedPhone}`);
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw new Error('Failed to send SMS verification code');
  }
};

/**
 * Send SMS notification for security events
 * @param phoneNumber - Phone number in E.164 format
 * @param message - Notification message
 */
export const sendSecurityNotification = async (
  phoneNumber: string,
  message: string
): Promise<void> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidPhoneNumber(formattedPhone)) {
      throw new Error('Invalid phone number format');
    }

    if (!twilioClient || !config.TWILIO_PHONE_NUMBER ||
        config.TWILIO_PHONE_NUMBER === 'your-twilio-phone-number') {
      console.warn('⚠️  Twilio not configured. SMS not sent.');
      console.log(`📱 Would send security notification to ${formattedPhone}: ${message}`);
      return;
    }

    await twilioClient.messages.create({
      body: `Koda Security Alert: ${message}`,
      from: config.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ Security notification sent to ${formattedPhone}`);
  } catch (error) {
    console.error('Error sending security notification:', error);
    // Don't throw - security notifications are not critical
  }
};

/**
 * Send 2FA code via SMS (alternative to TOTP)
 * @param phoneNumber - Phone number in E.164 format
 * @param code - 6-digit 2FA code
 */
export const send2FACode = async (
  phoneNumber: string,
  code: string
): Promise<void> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidPhoneNumber(formattedPhone)) {
      throw new Error('Invalid phone number format');
    }

    if (!twilioClient || !config.TWILIO_PHONE_NUMBER ||
        config.TWILIO_PHONE_NUMBER === 'your-twilio-phone-number') {
      console.warn('⚠️  Twilio not configured. SMS not sent.');
      console.log(`📱 Would send 2FA code ${code} to ${formattedPhone}`);
      return;
    }

    await twilioClient.messages.create({
      body: `Your Koda 2FA code is: ${code}\n\nThis code will expire in 5 minutes.`,
      from: config.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ 2FA code sent to ${formattedPhone}`);
  } catch (error) {
    console.error('Error sending 2FA SMS:', error);
    throw new Error('Failed to send 2FA code');
  }
};

/**
 * Send password reset code via SMS
 * @param phoneNumber - Phone number in E.164 format
 * @param code - 6-digit reset code
 */
export const sendPasswordResetSMS = async (
  phoneNumber: string,
  code: string
): Promise<void> => {
  try {
    const formattedPhone = formatPhoneNumber(phoneNumber);

    if (!isValidPhoneNumber(formattedPhone)) {
      throw new Error('Invalid phone number format');
    }

    if (!twilioClient || !config.TWILIO_PHONE_NUMBER ||
        config.TWILIO_PHONE_NUMBER === 'your-twilio-phone-number') {
      console.warn('⚠️  Twilio not configured. SMS not sent.');
      console.log(`📱 Would send password reset code ${code} to ${formattedPhone}`);
      return;
    }

    await twilioClient.messages.create({
      body: `Your Koda password reset code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this, please ignore this message.`,
      from: config.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ Password reset code sent to ${formattedPhone}`);
  } catch (error) {
    console.error('Error sending password reset SMS:', error);
    throw new Error('Failed to send password reset SMS');
  }
};
