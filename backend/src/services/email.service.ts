/** Email Service - Minimal Stub (Non-MVP) */
class EmailService {
  async sendEmail(to: string, subject: string, body: string) { return true; }
  async sendBulkEmail(recipients: string[], subject: string, body: string) { return true; }
}

export const sendDocumentShareEmail = async (to: string, documentName: string, sharedBy: string) => {
  // Stub: Would send document share email
  return true;
};

export const sendVerificationEmail = async (to: string, code: string) => {
  // Stub: Would send verification email
  return true;
};

export const generateVerificationCode = () => {
  // Stub: Would generate verification code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendWelcomeEmail = async (to: string, name: string) => {
  // Stub: Would send welcome email
  return true
};

/**
 * Send password reset email with link (NOT CODE)
 * @param email - User's email address
 * @param resetLink - Password reset link
 * @param firstName - User's first name
 */
export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  firstName: string = 'User'
): Promise<void> {
  // In production, this would send actual email via SendGrid or similar service
  // For now, log the reset link for development/testing
  console.log(`📧 Password reset link for ${email}:`);
  console.log(`   Link: ${resetLink}`);
  console.log(`   Recipient: ${firstName}`);

  // Stub: In production, send via SendGrid:
  // const msg = {
  //   to: email,
  //   from: process.env.SENDGRID_FROM_EMAIL || 'noreply@koda.app',
  //   subject: 'Reset Your Password',
  //   html: `<h2>Password Reset Request</h2>
  //     <p>Hi ${firstName},</p>
  //     <p>Click the button below to reset your password:</p>
  //     <a href="${resetLink}">Reset Password</a>
  //     <p>This link will expire in 15 minutes.</p>`
  // };
  // await sgMail.send(msg);

  return Promise.resolve();
}

export default new EmailService();
