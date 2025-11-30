import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationsStore';

/**
 * Toast - Single toast notification component
 * Auto-dismiss with hover pause
 */
const Toast = ({ notification, onDismiss }) => {
  const navigate = useNavigate();
  const { undoLastAction, isUndoAvailable } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const remainingTimeRef = useRef(null);

  // Auto-dismiss durations by type
  const getDuration = () => {
    switch (notification.type) {
      case 'error': return 8000;
      case 'warning': return 7000;
      default: return 5000;
    }
  };

  const duration = getDuration();

  // Type-based styling
  const getTypeStyles = () => {
    switch (notification.type) {
      case 'error':
        return { borderColor: '#EF4444', iconBg: '#FEE2E2', iconColor: '#DC2626' };
      case 'warning':
        return { borderColor: '#F59E0B', iconBg: '#FEF3C7', iconColor: '#D97706' };
      case 'security':
        return { borderColor: '#6366F1', iconBg: '#EEF2FF', iconColor: '#4F46E5' };
      default:
        return { borderColor: '#3B82F6', iconBg: '#DBEAFE', iconColor: '#2563EB' };
    }
  };

  const typeStyles = getTypeStyles();

  // Type icons
  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke={typeStyles.iconColor} strokeWidth="2"/>
            <path d="M12 8V12M12 16H12.01" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.55 19C1.55 19.36 1.64 19.7 1.82 20C2 20.3 2.26 20.56 2.56 20.74C2.86 20.92 3.2 21.01 3.56 21.01H20.44C20.8 21.01 21.14 20.92 21.44 20.74C21.74 20.56 22 20.3 22.18 20C22.36 19.7 22.45 19.36 22.45 19C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.3 12.97 3.12C12.67 2.94 12.33 2.85 11.97 2.85C11.61 2.85 11.27 2.94 10.97 3.12C10.67 3.3 10.41 3.56 10.29 3.86Z" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'security':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke={typeStyles.iconColor} strokeWidth="2"/>
            <path d="M12 16V12M12 8H12.01" stroke={typeStyles.iconColor} strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
    }
  };

  // Start timer
  const startTimer = (time) => {
    startTimeRef.current = Date.now();
    remainingTimeRef.current = time;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const progressPercent = (remaining / duration) * 100;
      setProgress(progressPercent);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleDismiss();
      }
    }, 50);
  };

  // Pause timer
  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  };

  // Resume timer
  const resumeTimer = () => {
    if (remainingTimeRef.current > 0) {
      startTimer(remainingTimeRef.current);
    }
  };

  // Handle dismiss
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  // Handle click
  const handleClick = () => {
    if (notification.action?.type === 'navigate' && notification.action?.target) {
      navigate(notification.action.target);
      handleDismiss();
    }
  };

  // Handle undo
  const handleUndo = async (e) => {
    e.stopPropagation();
    const undoData = await undoLastAction(notification.id);
    if (undoData) {
      // The parent component or service should handle the actual undo logic
      // For now, just dismiss the toast
      handleDismiss();
    }
  };

  // Initialize
  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Start auto-dismiss timer
    startTimer(duration);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle hover pause
  useEffect(() => {
    if (isPaused) {
      pauseTimer();
    } else {
      resumeTimer();
    }
  }, [isPaused]);

  const showUndo = notification.action?.type === 'undo' && isUndoAvailable(notification.id);

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        background: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E3E3E7',
        borderLeft: `3px solid ${typeStyles.borderColor}`,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        padding: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        cursor: notification.action?.type === 'navigate' ? 'pointer' : 'default',
        transform: isVisible ? 'translateX(0)' : 'translateX(120%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Icon */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: typeStyles.iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {getIcon()}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: '#171717',
          fontSize: 14,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '600',
          lineHeight: '20px',
          marginBottom: 2
        }}>
          {notification.title}
        </div>
        <div style={{
          color: '#6C6B6E',
          fontSize: 13,
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '400',
          lineHeight: '18px'
        }}>
          {notification.text}
        </div>

        {/* Undo button */}
        {showUndo && (
          <button
            onClick={handleUndo}
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: '#F5F5F7',
              border: '1px solid #E6E6EC',
              borderRadius: 8,
              color: '#171717',
              fontSize: 13,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#ECECEF'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F7'}
          >
            Undo
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F7'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 12M4 4L12 12" stroke="#6C6B6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
        width: `${progress}%`,
        background: typeStyles.borderColor,
        transition: 'width 0.05s linear',
        borderRadius: '0 0 0 16px'
      }} />
    </div>
  );
};

export default Toast;
