/** SMS Service - Minimal Stub with Password Reset (Non-MVP) */

class SmsService {
  async sendSMS(to: string, message: string) {
    // Stub: Would send SMS via Twilio or similar service
    console.log(`📱 SMS to ${to}: ${message}`);
    return true;
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
  // Stub: In production, send via Twilio
  console.log(`📱 Verification code for ${phoneNumber}: ${code}`);
  return Promise.resolve();
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
  // In production, this would send actual SMS via Twilio or similar service
  // For now, log the reset link for development/testing
  console.log(`📱 Password reset SMS for ${phoneNumber}:`);
  console.log(`   Link: ${resetLink}`);

  // Stub: In production, send via Twilio:
  // const twilioClient = twilio(
  //   process.env.TWILIO_ACCOUNT_SID,
  //   process.env.TWILIO_AUTH_TOKEN
  // );
  // await twilioClient.messages.create({
  //   body: `Reset your Koda password: ${resetLink}\n\nThis link expires in 15 minutes.`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });

  return Promise.resolve();
}

export default new SmsService();
