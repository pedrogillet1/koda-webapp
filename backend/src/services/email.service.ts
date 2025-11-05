import { Resend } from 'resend';

/** Email Service - Using Resend for email delivery */
const resend = new Resend(process.env.RESEND_API_KEY);

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
  try {
    console.log(`📧 Sending password reset email to ${email}...`);

    const { data, error } = await resend.emails.send({
      from: 'Koda <support@kodapda.com>',
      to: email,
      subject: 'Reset Your Password - Koda',
      html: `
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
                <h1 style="margin: 0;">Reset Your Password</h1>
              </div>
              <div class="content">
                <p>Hi ${firstName},</p>
                <p>We received a request to reset your password for your Koda account.</p>
                <p>Click the button below to reset your password:</p>
                <p style="text-align: center;">
                  <a href="${resetLink}" class="button">Reset Password</a>
                </p>
                <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
                <p style="color: #D92D20; font-weight: 600; margin-top: 20px;">⚠️ This link will expire in 15 minutes.</p>
                <p style="margin-top: 20px;">If you didn't request a password reset, you can safely ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Koda. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log(`✅ Password reset email sent successfully! ID: ${data?.id}`);
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    throw error;
  }
}

export default new EmailService();
