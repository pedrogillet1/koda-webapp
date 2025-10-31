/** Notification Service - Minimal Stub (Non-MVP) */
class NotificationService {
  async send() { return true; }
  async sendBulk() { return true; }
  async markAsRead() { return true; }
  async getUnreadCount() { return 0; }
}
export default new NotificationService();
