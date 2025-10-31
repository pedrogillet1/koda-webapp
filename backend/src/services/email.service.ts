/** Email Service - Minimal Stub (Non-MVP) */
class EmailService {
  async sendEmail(to: string, subject: string, body: string) { return true; }
  async sendBulkEmail(recipients: string[], subject: string, body: string) { return true; }
}
export default new EmailService();
