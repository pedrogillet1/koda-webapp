/**
 * SMS Service - Minimal Stub
 * NOTE: SMS messages are logged but not sent
 */
class SmsService {
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    console.log(`[SMS STUB] Would send verification code ${code} to ${phone}`);
  }

  async sendNotification(phone: string, message: string): Promise<void> {
    console.log(`[SMS STUB] Would send SMS to ${phone}: ${message}`);
  }
}

export default new SmsService();
