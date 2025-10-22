import prisma from '../config/database';
import { sendEmailNotification } from './email.service';

export type NotificationType = 'reminder' | 'system' | 'document_shared' | 'storage_warning';

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedDocumentId?: string;
  relatedReminderId?: string;
}

export const createNotification = async (data: CreateNotificationData) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        relatedDocumentId: data.relatedDocumentId || null,
        relatedReminderId: data.relatedReminderId || null,
      },
    });

    // Check if user wants email notifications
    const shouldEmail = await shouldSendEmailNotification(data.userId, data.type);
    if (shouldEmail) {
      await sendEmailNotification(data.userId, data.title, data.message);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const getUserNotifications = async (userId: string, limit: number = 50) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        relatedReminder: true,
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { notifications, unreadCount };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return result;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

export const deleteNotification = async (notificationId: string, userId: string) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// Notification triggers
export const triggerReminderNotification = async (reminderId: string) => {
  try {
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) {
      throw new Error('Reminder not found');
    }

    await createNotification({
      userId: reminder.userId,
      type: 'reminder',
      title: reminder.title,
      message: `Reminder: ${reminder.title} is due on ${reminder.dueDate.toLocaleDateString()}`,
      relatedReminderId: reminderId,
      relatedDocumentId: reminder.documentId || undefined,
    });

    // Mark reminder as notified
    await prisma.reminder.update({
      where: { id: reminderId },
      data: { notified: true },
    });
  } catch (error) {
    console.error('Error triggering reminder notification:', error);
    throw error;
  }
};

export const triggerStorageWarning = async (userId: string, percentageUsed: number) => {
  try {
    if (percentageUsed >= 90) {
      await createNotification({
        userId,
        type: 'storage_warning',
        title: 'Storage Almost Full',
        message: `You've used ${percentageUsed.toFixed(0)}% of your storage. Consider upgrading or deleting old documents.`,
      });
    } else if (percentageUsed >= 80) {
      await createNotification({
        userId,
        type: 'storage_warning',
        title: 'Storage Warning',
        message: `You've used ${percentageUsed.toFixed(0)}% of your storage.`,
      });
    }
  } catch (error) {
    console.error('Error triggering storage warning:', error);
    throw error;
  }
};

export const triggerSystemNotification = async (userId: string, title: string, message: string) => {
  try {
    await createNotification({
      userId,
      type: 'system',
      title,
      message,
    });
  } catch (error) {
    console.error('Error triggering system notification:', error);
    throw error;
  }
};

// Helper function to check user's email notification preferences
const shouldSendEmailNotification = async (userId: string, notificationType: NotificationType): Promise<boolean> => {
  try {
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      return true; // Default: send all notifications
    }

    if (!preferences.emailNotificationsEnabled) {
      return false;
    }

    if (preferences.emailNotificationTypes) {
      const allowedTypes = JSON.parse(preferences.emailNotificationTypes);
      return allowedTypes.includes(notificationType);
    }

    return true;
  } catch (error) {
    console.error('Error checking email preferences:', error);
    return true; // Default to sending on error
  }
};
