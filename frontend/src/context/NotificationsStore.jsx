import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const NotificationsContext = createContext(null);

/**
 * NotificationsProvider - Global state for all notifications
 * Manages read/unread, filtering, persistence
 */
export const NotificationsProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [undoStack, setUndoStack] = useState([]);

  // Get user ID for localStorage key
  const getUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      return user?.id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  };

  // Load notifications from localStorage on mount
  useEffect(() => {
    const userId = getUserId();
    const stored = localStorage.getItem(`koda_notifications_${userId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
      } catch (e) {
        console.error('Failed to parse stored notifications:', e);
      }
    }
  }, []);

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    const userId = getUserId();
    localStorage.setItem(`koda_notifications_${userId}`, JSON.stringify(notifications));
  }, [notifications]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Add a new notification
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: uuidv4(),
      timestamp: Date.now(),
      isRead: false,
      ...notification
    };

    // Check for duplicate (same type and title within last 5 seconds)
    const isDuplicate = notifications.some(
      n => n.type === newNotification.type &&
           n.title === newNotification.title &&
           Date.now() - n.timestamp < 5000
    );

    if (isDuplicate) {
      return null;
    }

    // Add to notifications if not toastOnly
    if (!notification.toastOnly) {
      setNotifications(prev => [newNotification, ...prev]);
    }

    // Add to toasts (max 3)
    setToasts(prev => {
      const updated = [newNotification, ...prev].slice(0, 3);
      return updated;
    });

    // If has undo action, add to undo stack
    if (notification.action?.type === 'undo') {
      setUndoStack(prev => [...prev, {
        notificationId: newNotification.id,
        data: notification.action.data,
        expiresAt: Date.now() + (notification.undoWindow || 6000)
      }].slice(-5)); // Keep max 5 undo actions
    }

    return newNotification.id;
  }, [notifications]);

  // Remove a toast
  const removeToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );

    // TODO: Call API when backend is ready
    // await notificationService.markAsRead(notificationId);
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    // TODO: Call API when backend is ready
    // await notificationService.markAllAsRead();
  }, []);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    // TODO: Call API when backend is ready
    // await notificationService.deleteNotification(notificationId);
  }, []);

  // Get unread notifications
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.isRead);
  }, [notifications]);

  // Get read notifications
  const getReadNotifications = useCallback(() => {
    return notifications.filter(n => n.isRead);
  }, [notifications]);

  // Undo last action
  const undoLastAction = useCallback(async (notificationId) => {
    const undoItem = undoStack.find(u => u.notificationId === notificationId);

    if (!undoItem || Date.now() > undoItem.expiresAt) {
      return false;
    }

    // Remove from undo stack
    setUndoStack(prev => prev.filter(u => u.notificationId !== notificationId));

    // Remove the toast
    removeToast(notificationId);

    // Return the undo data for the caller to handle
    return undoItem.data;
  }, [undoStack, removeToast]);

  // Check if undo is available for a notification
  const isUndoAvailable = useCallback((notificationId) => {
    const undoItem = undoStack.find(u => u.notificationId === notificationId);
    return undoItem && Date.now() < undoItem.expiresAt;
  }, [undoStack]);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    notifications,
    toasts,
    unreadCount,
    addNotification,
    removeToast,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadNotifications,
    getReadNotifications,
    undoLastAction,
    isUndoAvailable,
    clearAllNotifications
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

// Hook to access notifications context
export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export default NotificationsContext;
