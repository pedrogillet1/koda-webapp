import api from './api';

/**
 * NotificationService - Handles API calls to /api/notifications
 * Uses localStorage as fallback if backend not ready
 */

// Fetch all notifications
export const fetchNotifications = async () => {
  try {
    const response = await api.get('/api/notifications');
    return response.data.notifications || [];
  } catch (error) {
    console.error('Failed to fetch notifications from API, using localStorage:', error);
    // Fallback to localStorage
    const userId = getUserId();
    const stored = localStorage.getItem(`koda_notifications_${userId}`);
    return stored ? JSON.parse(stored) : [];
  }
};

// Mark a notification as read
export const markAsRead = async (notificationId) => {
  try {
    await api.post(`/api/notifications/${notificationId}/read`);
    return true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    // Will be handled by local state update
    return false;
  }
};

// Mark all notifications as read
export const markAllAsRead = async () => {
  try {
    await api.post('/api/notifications/mark-all-read');
    return true;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return false;
  }
};

// Delete a notification
export const deleteNotification = async (notificationId) => {
  try {
    await api.delete(`/api/notifications/${notificationId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return false;
  }
};

// Create a notification (for backend persistence)
export const createNotification = async (notification) => {
  try {
    const response = await api.post('/api/notifications', notification);
    return response.data.notification;
  } catch (error) {
    console.error('Failed to create notification on server:', error);
    return null;
  }
};

// Helper to get user ID
const getUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

export default {
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification
};
