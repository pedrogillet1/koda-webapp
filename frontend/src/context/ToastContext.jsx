import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/ui/Toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * ToastProvider - Unified notification system for Koda
 *
 * Usage:
 *   const { showSuccess, showError, showWarning, showInfo } = useToast();
 *
 *   // Simple usage
 *   showSuccess('File uploaded successfully');
 *
 *   // With options
 *   showError('Upload failed', {
 *     details: 'File size exceeds 500MB limit',
 *     duration: 0, // Don't auto-dismiss
 *     action: { label: 'Retry', onClick: () => retryUpload() }
 *   });
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, options = {}) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      type,
      message,
      details: options.details || null,
      duration: options.duration !== undefined ? options.duration : (type === 'error' ? 7000 : 5000),
      action: options.action || null,
    };

    setToasts((prev) => [...prev, toast]);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', options = {}) => {
    // Support both old API (message, type, duration) and new API (message, type, options)
    if (typeof options === 'number') {
      return addToast(type, message, { duration: options });
    }
    return addToast(type, message, options);
  }, [addToast]);

  const showSuccess = useCallback((message, options = {}) => {
    return addToast('success', message, options);
  }, [addToast]);

  const showError = useCallback((message, options = {}) => {
    // Error notifications stay longer by default and don't auto-dismiss if they have details
    const defaultDuration = options.details ? 0 : 7000;
    return addToast('error', message, {
      duration: defaultDuration,
      ...options,
    });
  }, [addToast]);

  const showWarning = useCallback((message, options = {}) => {
    return addToast('warning', message, {
      duration: 6000,
      ...options,
    });
  }, [addToast]);

  const showInfo = useCallback((message, options = {}) => {
    return addToast('info', message, {
      duration: 5000,
      ...options,
    });
  }, [addToast]);

  // Helper to show upload success
  const showUploadSuccess = useCallback((count) => {
    const message = `${count} document${count > 1 ? 's have' : ' has'} been successfully uploaded.`;
    return showSuccess(message);
  }, [showSuccess]);

  // Helper to show upload error with retry
  const showUploadError = useCallback((errorMessage, details, onRetry) => {
    return showError(errorMessage || 'Upload failed. Please try again.', {
      details,
      duration: 0, // Don't auto-dismiss errors with retry
      action: onRetry ? { label: 'Retry', onClick: onRetry } : null,
    });
  }, [showError]);

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showUploadSuccess,
      showUploadError,
      removeToast,
    }}>
      {children}

      {/* Toast container with stacking support */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 99999 }}>
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              position: 'fixed',
              top: 20 + index * 80,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 40px)',
              maxWidth: 960,
              minWidth: 400,
              zIndex: 99999 - index,
              pointerEvents: 'auto',
            }}
          >
            <Toast
              type={toast.type}
              message={toast.message}
              details={toast.details}
              duration={toast.duration}
              action={toast.action}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
