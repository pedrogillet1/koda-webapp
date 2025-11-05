/** SMS Service - Twilio Integration for Verification and Password Reset */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;
let smsServiceEnabled = false;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('⚠️  Twilio credentials not configured. SMS service will be disabled.');
} else {
  twilioClient = twilio(accountSid, authToken);
  smsServiceEnabled = true;
  console.log('✅ Twilio SMS service initialized');
}

class SmsService {
  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!smsServiceEnabled || !twilioClient) {
      console.log(`📱 [DEV MODE] SMS to ${to}: ${message}`);
      return false;
    }

    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: to,
      });
      console.log(`✅ SMS sent successfully to ${to} (SID: ${result.sid})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${to}:`, error);
      return false;
    }
  }
}

/**
 * Format phone number to E.164 format (+1234567890)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except '+'
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it doesn't start with '+', assume US number and add +1
  if (!cleaned.startsWith('+')) {
    return `+1${cleaned}`;
  }

  return cleaned;
}

/**
 * Validate phone number format (basic validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Check if phone number is in E.164 format: + followed by 10-15 digits
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Generate 6-digit SMS verification code
 */
export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification SMS
 */
export async function sendVerificationSMS(phoneNumber: string, code: string): Promise<void> {
  if (!smsServiceEnabled || !twilioClient) {
    console.log(`📱 [DEV MODE] Verification code for ${phoneNumber}: ${code}`);
    return Promise.resolve();
  }

  try {
    const message = `Your Koda verification code is: ${code}\n\nThis code expires in 10 minutes.`;

    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    console.log(`✅ Verification SMS sent to ${phoneNumber} (SID: ${result.sid})`);
  } catch (error) {
    console.error(`❌ Failed to send verification SMS to ${phoneNumber}:`, error);
    throw new Error('Failed to send verification SMS');
  }
}

/**
 * Send password reset SMS with link (NOT CODE)
 * @param phoneNumber - User's phone number
 * @param resetLink - Password reset link
 */
export async function sendPasswordResetSMS(
  phoneNumber: string,
  resetLink: string
): Promise<void> {
  if (!smsServiceEnabled || !twilioClient) {
    console.log(`📱 [DEV MODE] Password reset SMS for ${phoneNumber}:`);
    console.log(`   Link: ${resetLink}`);
    return Promise.resolve();
  }

  try {
    const message = `Reset your Koda password: ${resetLink}\n\n⚠️ This link expires in 15 minutes.\n\nIf you didn't request this, please ignore this message.`;

    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    console.log(`✅ Password reset SMS sent to ${phoneNumber} (SID: ${result.sid})`);
  } catch (error) {
    console.error(`❌ Failed to send password reset SMS to ${phoneNumber}:`, error);
    throw new Error('Failed to send password reset SMS');
  }
}

export default new SmsService();
