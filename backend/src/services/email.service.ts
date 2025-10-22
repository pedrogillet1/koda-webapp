import sgMail from '@sendgrid/mail';
import { config } from '../config/env';
import crypto from 'crypto';

// Initialize SendGrid client
if (config.SENDGRID_API_KEY && config.SENDGRID_API_KEY !== 'your-sendgrid-api-key-here') {
  sgMail.setApiKey(config.SENDGRID_API_KEY);
}

export interface EmailVerificationData {
  email: string;
  code: string;
  expiresAt: Date;
}

/**
 * Generate a 6-digit verification code
 * @returns 6-digit numeric code
 */
export const generateVerificationCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Generate verification token (for email links)
 * @returns Random hex token
 */
export const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send email verification code
 * @param email - User's email address
 * @param code - 6-digit verification code
 * @returns Promise with send result
 */
export const sendVerificationEmail = async (
  email: string,
  code: string
): Promise<void> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email not sent.');
      console.log(`📧 Would send verification code ${code} to ${email}`);
      return;
    }

    const msg = {
      to: email,
      from: 'support@kodapda.com',
      subject: 'Verify your Koda account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #32302C; font-size: 24px; font-weight: 600; margin: 0;">Verify Your Email</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px; padding-bottom: 30px;">
                      <p>Thanks for signing up for Koda! Please enter the following verification code to complete your registration:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <div style="background-color: #F5F5F5; border-radius: 14px; padding: 20px; display: inline-block;">
                        <span style="font-size: 32px; font-weight: 700; color: #181818; letter-spacing: 8px;">${code}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 14px; line-height: 20px; padding-top: 20px;">
                      <p>This code will expire in <strong>10 minutes</strong>.</p>
                      <p>If you didn't request this code, you can safely ignore this email.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 12px; line-height: 18px; padding-top: 30px; border-top: 1px solid #E6E6EC; margin-top: 30px;">
                      <p>© 2025 Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    console.log(`✅ Verification email sent to ${email}`);
  } catch (error: any) {
    console.error('❌ SendGrid Error sending verification email:', error);
    if (error.response) {
      console.error('SendGrid Response Body:', error.response.body);
    }
    // Log the code for development
    console.log(`📧 Development: Verification code is ${code}`);
    // Don't throw error, just log it for now
  }
};

/**
 * Send welcome email after successful verification
 * @param email - User's email address
 * @param name - User's name
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<void> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email not sent.');
      console.log(`📧 Would send welcome email to ${email}`);
      return;
    }

    const msg = {
      to: email,
      from: 'support@kodapda.com',
      subject: 'Welcome to Koda!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Koda</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #32302C; font-size: 24px; font-weight: 600; margin: 0;">Welcome to Koda, ${name}!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px;">
                      <p>Your account has been successfully verified. You're all set to start managing your documents with Koda!</p>
                      <p>Here's what you can do next:</p>
                      <ul>
                        <li>Upload your first document</li>
                        <li>Enable two-factor authentication for extra security</li>
                        <li>Organize documents with folders and tags</li>
                        <li>Use OCR to extract text from images and PDFs</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="${config.FRONTEND_URL}/upload" style="background-color: #181818; color: white; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 600; display: inline-block;">Get Started</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 12px; line-height: 18px; padding-top: 30px; border-top: 1px solid #E6E6EC; margin-top: 30px;">
                      <p>© 2025 Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email - it's not critical
  }
};

/**
 * Send password reset email
 * @param email - User's email address
 * @param resetToken - Password reset token
 */
export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<void> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email not sent.');
      console.log(`📧 Would send password reset email to ${email}`);
      return;
    }

    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const msg = {
      to: email,
      from: 'support@kodapda.com',
      subject: 'Reset your Koda password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #32302C; font-size: 24px; font-weight: 600; margin: 0;">Reset Your Password</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px; padding-bottom: 30px;">
                      <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="${resetUrl}" style="background-color: #181818; color: white; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 14px; line-height: 20px; padding-top: 20px;">
                      <p>This link will expire in <strong>1 hour</strong>.</p>
                      <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 12px; line-height: 18px; padding-top: 30px; border-top: 1px solid #E6E6EC; margin-top: 30px;">
                      <p>© 2025 Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send notification email to user
 * @param userId - User's ID
 * @param subject - Email subject
 * @param message - Email message
 */
export const sendEmailNotification = async (
  userId: string,
  subject: string,
  message: string
): Promise<boolean> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email notification not sent.');
      return false;
    }

    // Get user from database
    const prisma = (await import('../config/database')).default;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.error('User not found for email notification');
      return false;
    }

    const userName = user.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user.email;

    const msg = {
      to: user.email,
      from: 'support@kodapda.com',
      subject: `[KODA] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td style="padding-bottom: 20px;">
                      <p style="color: #6C6B6E; margin: 0;">Hi ${userName},</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 30px;">
                      <h1 style="color: #32302C; font-size: 20px; font-weight: 600; margin: 0;">${subject}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px; padding-bottom: 30px;">
                      <p>${message}</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="${config.FRONTEND_URL}/notifications" style="background-color: #181818; color: white; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 600; display: inline-block;">View in KODA</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #999; font-size: 12px; line-height: 18px; padding-top: 20px; border-top: 1px solid #E6E6EC;">
                      <p style="margin-bottom: 10px;">You're receiving this because you have notifications enabled in KODA.</p>
                      <p style="margin: 0;">
                        <a href="${config.FRONTEND_URL}/settings/notifications" style="color: #666; text-decoration: underline;">Manage preferences</a> |
                        <a href="${config.FRONTEND_URL}" style="color: #666; text-decoration: underline;">Visit KODA</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #999; font-size: 12px; line-height: 18px; padding-top: 20px; text-align: center;">
                      <p style="margin: 0;">© ${new Date().getFullYear()} Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);
    console.log(`✅ Notification email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error('Error sending notification email:', error);
    return false;
  }
};

/**
 * Send document share email
 * @param email - Recipient's email address
 * @param documentName - Name of the document being shared
 * @param senderName - Name of the person sharing
 * @param downloadUrl - URL to download the document
 */
export const sendDocumentShareEmail = async (
  email: string,
  documentName: string,
  senderName: string,
  downloadUrl: string
): Promise<void> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email not sent.');
      console.log(`📧 Would send document share email to ${email}`);
      return;
    }

    const msg = {
      to: email,
      from: 'support@kodapda.com',
      subject: `${senderName} shared a document with you`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Shared</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #32302C; font-size: 24px; font-weight: 600; margin: 0;">Document Shared With You</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px; padding-bottom: 30px;">
                      <p><strong>${senderName}</strong> has shared a document with you via Koda.</p>
                      <p style="background-color: #F5F5F5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <strong>Document:</strong> ${documentName}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="${downloadUrl}" style="background-color: #181818; color: white; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 600; display: inline-block;">Download Document</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 14px; line-height: 20px; padding-top: 20px;">
                      <p>This link will allow you to download the shared document. If you have any questions, please contact ${senderName}.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 12px; line-height: 18px; padding-top: 30px; border-top: 1px solid #E6E6EC; margin-top: 30px;">
                      <p>© 2025 Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    console.log(`✅ Document share email sent to ${email}`);
  } catch (error) {
    console.error('Error sending document share email:', error);
    throw new Error('Failed to send document share email');
  }
};

/**
 * Send document processing completion email
 * @param email - User's email address
 * @param documentName - Name of the processed document
 * @param documentId - Document ID for linking
 */
export const sendDocumentProcessedEmail = async (
  email: string,
  documentName: string,
  documentId: string
): Promise<void> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email not sent.');
      console.log(`📧 Would send document processed email to ${email}`);
      return;
    }

    const msg = {
      to: email,
      from: 'support@kodapda.com',
      subject: `Document Ready: ${documentName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Ready</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: #32302C; font-size: 24px; font-weight: 600; margin: 0;">Your document is ready! ✅</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px; padding-bottom: 30px;">
                      <p><strong>${documentName}</strong> has been successfully processed and is now ready to use.</p>
                      <p style="background-color: #F5F5F5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        You can now:
                        <ul style="margin: 12px 0 0 0; padding-left: 20px;">
                          <li>Ask AI questions about the content</li>
                          <li>Extract key information automatically</li>
                          <li>Share with your team</li>
                          <li>Search within the document</li>
                        </ul>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="${config.FRONTEND_URL}/documents/${documentId}" style="background-color: #181818; color: white; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 600; display: inline-block;">View Document</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 12px; line-height: 18px; padding-top: 30px; border-top: 1px solid #E6E6EC; margin-top: 30px;">
                      <p>© 2025 Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    console.log(`✅ Document processed email sent to ${email}`);
  } catch (error) {
    console.error('Error sending document processed email:', error);
    // Don't throw - notification emails shouldn't break the app
  }
};

/**
 * Send usage limit warning email
 * @param email - User's email address
 * @param usagePercentage - Current usage as percentage (0-100)
 * @param costUSD - Current cost in USD
 * @param tier - User's subscription tier
 */
export const sendUsageLimitWarning = async (
  email: string,
  usagePercentage: number,
  costUSD: number,
  tier: string
): Promise<void> => {
  try {
    if (!config.SENDGRID_API_KEY || config.SENDGRID_API_KEY === 'your-sendgrid-api-key-here') {
      console.warn('⚠️  SendGrid API key not configured. Email not sent.');
      console.log(`📧 Would send usage warning email to ${email}`);
      return;
    }

    const severity = usagePercentage >= 95 ? 'Critical' : 'Warning';
    const warningColor = usagePercentage >= 95 ? '#dc3545' : '#ffc107';
    const warningIcon = usagePercentage >= 95 ? '🚨' : '⚠️';

    const msg = {
      to: email,
      from: 'support@kodapda.com',
      subject: `${severity}: ${usagePercentage.toFixed(0)}% of Monthly API Quota Used`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>API Usage Alert</title>
        </head>
        <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 16px; padding: 40px;">
                  <tr>
                    <td align="center" style="padding-bottom: 30px;">
                      <h1 style="color: ${warningColor}; font-size: 24px; font-weight: 600; margin: 0;">${warningIcon} API Usage Alert</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 16px; line-height: 24px; padding-bottom: 30px;">
                      <p>You've used <strong style="color: ${warningColor};">${usagePercentage.toFixed(1)}%</strong> of your monthly API quota.</p>
                      <div style="background-color: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Current Usage:</strong> $${costUSD.toFixed(2)} USD</p>
                        <p style="margin: 8px 0;"><strong>Current Plan:</strong> ${tier}</p>
                        <p style="margin: 8px 0;"><strong>Usage:</strong> ${usagePercentage.toFixed(1)}%</p>
                      </div>
                      <p style="margin-top: 20px;">
                        ${usagePercentage >= 95
                          ? '<strong style="color: #dc3545;">⚠️ Action Required:</strong> To avoid service interruption, please upgrade your plan. Your usage will be limited when you reach 100%.'
                          : 'Monitor your usage to avoid hitting the limit. Consider upgrading your plan for higher quotas.'
                        }
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px 0;">
                      <a href="${config.FRONTEND_URL}/settings/billing" style="background-color: #181818; color: white; padding: 14px 32px; border-radius: 14px; text-decoration: none; font-weight: 600; display: inline-block;">View Usage & Upgrade</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #6C6B6E; font-size: 12px; line-height: 18px; padding-top: 30px; border-top: 1px solid #E6E6EC; margin-top: 30px;">
                      <p>© 2025 Koda Document Management. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await sgMail.send(msg);

    console.log(`✅ Usage warning email sent to ${email}`);
  } catch (error) {
    console.error('Error sending usage warning email:', error);
    // Don't throw - notification emails shouldn't break the app
  }
};
