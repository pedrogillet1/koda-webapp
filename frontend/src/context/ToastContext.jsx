import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/ui/Toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const rateLimitShownRef = useRef(false);
  const deleteCounterRef = useRef(0);

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
    setToasts((prev) => {
      const newToasts = prev.filter((t) => t.id !== id);
      // Reset delete counter when all toasts are dismissed
      if (newToasts.length === 0) {
        deleteCounterRef.current = 0;
      }
      return newToasts;
    });
  }, []);

  const showToast = useCallback((message, type = 'success', options = {}) => {
    if (typeof options === 'number') {
      return addToast(type, message, { duration: options });
    }
    return addToast(type, message, options);
  }, [addToast]);

  const showSuccess = useCallback((message, options = {}) => {
    return addToast('success', message, options);
  }, [addToast]);

  const showError = useCallback((message, options = {}) => {
    const defaultDuration = options.details ? 0 : 7000;
    return addToast('error', message, { duration: defaultDuration, ...options });
  }, [addToast]);

  const showWarning = useCallback((message, options = {}) => {
    return addToast('warning', message, { duration: 6000, ...options });
  }, [addToast]);

  const showInfo = useCallback((message, options = {}) => {
    return addToast('info', message, { duration: 5000, ...options });
  }, [addToast]);

  const showUploadSuccess = useCallback((count) => {
    const message = count + ' document' + (count > 1 ? 's have' : ' has') + ' been successfully uploaded.';
    return showSuccess(message);
  }, [showSuccess]);

  const showUploadError = useCallback((errorMessage, details, onRetry) => {
    return showError(errorMessage || 'Upload failed. Please try again.', {
      details,
      duration: 0,
      action: onRetry ? { label: 'Retry', onClick: onRetry } : null,
    });
  }, [showError]);

  const showRateLimitWarning = useCallback(() => {
    if (rateLimitShownRef.current) return null;
    rateLimitShownRef.current = true;
    setTimeout(() => { rateLimitShownRef.current = false; }, 30000);
    return showWarning('Too many requests. Please wait a moment before trying again.', {
      details: 'The server is temporarily limiting requests. Your data is safe.',
      duration: 8000,
    });
  }, [showWarning]);

  const showDeleteSuccess = useCallback((itemType = 'file') => {
    deleteCounterRef.current += 1;
    const count = deleteCounterRef.current;
    const message = `${count} ${itemType}${count > 1 ? 's have' : ' has'} been deleted`;
    return showSuccess(message);
  }, [showSuccess]);

  // Reset delete counter (call when all delete toasts are dismissed or after a delay)
  const resetDeleteCounter = useCallback(() => {
    deleteCounterRef.current = 0;
  }, []);

  return (
    <ToastContext.Provider value={{
      showToast, showSuccess, showError, showWarning, showInfo,
      showUploadSuccess, showUploadError, showRateLimitWarning, showDeleteSuccess, resetDeleteCounter, removeToast,
    }}>
      {children}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 99999 }}>
        {toasts.map((toast, index) => (
          <div key={toast.id} style={{
            position: 'fixed', top: 20 + index * 80, left: '50%',
            transform: 'translateX(-50%)', width: 'calc(100% - 40px)',
            maxWidth: 960, minWidth: 400, zIndex: 99999 - index, pointerEvents: 'auto',
          }}>
            <Toast type={toast.type} message={toast.message} details={toast.details}
              duration={toast.duration} action={toast.action} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
