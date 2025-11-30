import React from 'react';
import { useNotifications } from '../../context/NotificationsStore';
import Toast from './Toast';

/**
 * ToastStack - Container for multiple toasts
 * Manages max 3 toasts, stacking logic
 * Positioned bottom-right
 */
const ToastStack = () => {
  const { toasts, removeToast } = useNotifications();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100, // Above the chat bubble
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 12,
        pointerEvents: 'none'
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <Toast notification={toast} onDismiss={removeToast} />
        </div>
      ))}
    </div>
  );
};

export default ToastStack;
