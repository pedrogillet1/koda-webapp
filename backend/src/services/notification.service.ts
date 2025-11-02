/** Notification Service - Minimal Stub (Non-MVP) */
class NotificationService {
  async send() { return true; }
  async sendBulk() { return true; }
  async markAsRead() { return true; }
  async getUnreadCount() { return 0; }
}

const service = new NotificationService();

export const getUserNotifications = async (userId: string, limit?: number) => {
  // Stub: Would get user notifications
  return { notifications: [], unreadCount: 0 };
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  // Stub: Would mark notification as read
  return true;
};

export const markAllNotificationsAsRead = async (userId: string) => {
  // Stub: Would mark all notifications as read
  return true;
};

export const deleteNotification = async (notificationId: string, userId: string) => {
  // Stub: Would delete notification
  return true;
};

export const triggerReminderNotification = async (userId: string, message: string) => {
  // Stub: Would trigger reminder notification
  return true;
};

export default service;
