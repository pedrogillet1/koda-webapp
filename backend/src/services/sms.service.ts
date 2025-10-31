import twilio from 'twilio';

/**
 * SMS Service - Twilio Integration
 */
class SmsService {
  private twilioClient: twilio.Twilio | null = null;
  private fromPhoneNumber: string;

  constructor() {
    // Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACaaffc6318b36cb5bea13c90a2b8553a0';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '9a900178475ecf983b28f0ccf632fec0';
    this.fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '+15404130672';

    try {
      this.twilioClient = twilio(accountSid, authToken);
      console.log('✅ Twilio SMS service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twilio:', error);
      console.log('⚠️  SMS messages will be logged only');
    }
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // If it already starts with +, return as is
    if (phoneNumber.startsWith('+')) {
      return phoneNumber;
    }

    // If it starts with country code, add +
    if (cleaned.startsWith('55')) {
      // Brazil
      return `+${cleaned}`;
    } else if (cleaned.startsWith('1')) {
      // US/Canada
      return `+${cleaned}`;
    } else if (cleaned.length === 11 && !cleaned.startsWith('0')) {
      // Assume Brazil if 11 digits without leading 0
      return `+55${cleaned}`;
    } else if (cleaned.length === 10) {
      // Assume US if 10 digits
      return `+1${cleaned}`;
    } else {
      // Default: add + if not present
      return `+${cleaned}`;
    }
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation: must start with + and have 10-15 digits
    const phoneRegex = /^\+[1-9]\d{9,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Generate 6-digit SMS verification code
   */
  generateSMSCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification code via SMS
   */
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    const message = `Your KODA verification code is: ${code}`;

    if (!this.twilioClient) {
      console.log(`[SMS STUB] 📱 Would send verification code ${code} to ${phone}`);
      console.log(`[SMS STUB] Message: "${message}"`);
      return;
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: phone,
      });
      console.log(`✅ SMS sent successfully to ${phone}. SID: ${result.sid}`);
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${phone}:`, error);
      throw new Error('Failed to send verification code via SMS');
    }
  }

  /**
   * Send verification SMS (alias for sendVerificationCode for compatibility)
   */
  async sendVerificationSMS(phone: string, code: string): Promise<void> {
    return this.sendVerificationCode(phone, code);
  }

  /**
   * Send password reset SMS
   */
  async sendPasswordResetSMS(phone: string, code: string): Promise<void> {
    const message = `Your KODA password reset code is: ${code}`;

    if (!this.twilioClient) {
      console.log(`[SMS STUB] 📱 Would send password reset code ${code} to ${phone}`);
      console.log(`[SMS STUB] Message: "${message}"`);
      return;
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: phone,
      });
      console.log(`✅ Password reset SMS sent to ${phone}. SID: ${result.sid}`);
    } catch (error) {
      console.error(`❌ Failed to send password reset SMS to ${phone}:`, error);
      throw new Error('Failed to send password reset code via SMS');
    }
  }

  /**
   * Send general SMS notification
   */
  async sendNotification(phone: string, message: string): Promise<void> {
    if (!this.twilioClient) {
      console.log(`[SMS STUB] 📱 Would send SMS to ${phone}: ${message}`);
      return;
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: phone,
      });
      console.log(`✅ Notification SMS sent to ${phone}. SID: ${result.sid}`);
    } catch (error) {
      console.error(`❌ Failed to send notification SMS to ${phone}:`, error);
      throw new Error('Failed to send SMS notification');
    }
  }
}

export default new SmsService();
