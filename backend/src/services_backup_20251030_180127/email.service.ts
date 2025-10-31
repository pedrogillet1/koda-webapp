/**
 * Email Service - Minimal Stub
 * NOTE: Emails are logged but not sent in this stub
 */
class EmailService {
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    console.log(`[EMAIL STUB] Would send verification email to ${email} with token ${token}`);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    console.log(`[EMAIL STUB] Would send password reset email to ${email}`);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    console.log(`[EMAIL STUB] Would send welcome email to ${email}`);
  }

  async sendNotification(email: string, subject: string, message: string): Promise<void> {
    console.log(`[EMAIL STUB] Would send email to ${email}: ${subject}`);
  }
}

export default new EmailService();
