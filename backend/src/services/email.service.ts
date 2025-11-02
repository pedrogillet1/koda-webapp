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
  return true;
};

export default new EmailService();
