import React, { createContext, useContext, useState } from 'react';
import { ReactComponent as CheckIcon } from '../assets/check.svg';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [notificationMessage, setNotificationMessage] = useState('');

  const showToast = (message, type = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 5000);
  };

  const showSuccess = (message) => {
    showToast(message, 'success');
  };

  const showError = (message) => {
    showToast(message, 'error');
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}

      {/* Global Toast Notification - Matches UniversalUploadModal design */}
      {showNotification && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 700px)',
          maxWidth: '960px',
          minWidth: '400px',
          zIndex: 99999,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{
            width: '100%',
            padding: '6px 16px',
            background: '#181818',
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            display: 'inline-flex'
          }}>
            {notificationType === 'success' ? (
              <>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#34A853',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckIcon style={{width: 12, height: 12}} />
                </div>
                <div style={{
                  flex: '1 1 0',
                  color: 'white',
                  fontSize: 13,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400',
                  lineHeight: '18px',
                  wordWrap: 'break-word'
                }}>
                  {notificationMessage}
                </div>
              </>
            ) : (
              <>
                <div style={{width: 24, height: 24, position: 'relative', flexShrink: 0}}>
                  <div style={{width: 20.57, height: 20.57, left: 1.71, top: 1.71, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                  <div style={{width: 24, height: 24, left: 0, top: 0, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                  <div style={{width: 17.14, height: 17.14, left: 3.43, top: 3.43, position: 'absolute', background: '#D92D20', overflow: 'hidden', borderRadius: 8.57, outline: '1.07px #D92D20 solid', outlineOffset: '-1.07px'}}>
                    <div style={{width: 9.33, height: 9.33, left: 3.91, top: 3.91, position: 'absolute'}}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5.83333 2.5H4.16667V5.83333H5.83333V2.5ZM5.83333 7.5H4.16667V9.16667H5.83333V7.5Z" fill="white"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div style={{
                  flex: '1 1 0',
                  color: 'white',
                  fontSize: 13,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400',
                  lineHeight: '18px',
                  wordWrap: 'break-word'
                }}>
                  {notificationMessage}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
