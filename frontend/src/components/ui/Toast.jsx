import React, { useEffect, useState } from 'react';
import { colors, spacing, radius, zIndex, typography, transitions } from '../../constants/designTokens';

/**
 * Canonical Toast Component
 * Replaces ToastContext and ErrorBanner with single consistent notification system
 *
 * @param {string} type - Toast type: 'success' | 'error' | 'warning' | 'info'
 * @param {string} message - Notification message
 * @param {number} duration - Auto-dismiss duration in ms (default: 5000)
 * @param {function} onClose - Function to call when toast is dismissed
 * @param {object} action - Optional action button: {label, onClick}
 */
export default function Toast({
  type = 'success',
  message,
  duration = 5000,
  onClose,
  action,
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 200); // Wait for exit animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const typeStyles = {
    success: {
      background: colors.primary,
      color: colors.white,
      iconBg: colors.success,
    },
    error: {
      background: colors.primary,
      color: colors.white,
      iconBg: colors.error,
    },
    warning: {
      background: colors.warning,
      color: colors.gray[900],
      iconBg: colors.warning,
    },
    info: {
      background: colors.primary,
      color: colors.white,
      iconBg: colors.gray[500],
    },
  };

  const style = typeStyles[type] || typeStyles.success;

  return (
    <div
      style={{
        position: 'fixed',
        top: spacing.xl,
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? 0 : -20}px)`,
        width: 'calc(100% - 40px)',
        maxWidth: 960,
        minWidth: 400,
        zIndex: zIndex.toast,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          padding: `${spacing.md}px ${spacing.lg}px`,
          background: style.background,
          borderRadius: radius.xl,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          fontFamily: typography.fontFamily,
        }}
      >
        {/* Icon */}
        <ToastIcon type={type} iconBg={style.iconBg} />

        {/* Message */}
        <div
          style={{
            flex: 1,
            color: style.color,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.regular,
            lineHeight: typography.lineHeights.sm,
            wordWrap: 'break-word',
          }}
        >
          {message}
        </div>

        {/* Action Button */}
        {action && (
          <button
            onClick={action.onClick}
            style={{
              background: 'transparent',
              border: 'none',
              color: style.color,
              cursor: 'pointer',
              fontWeight: typography.weights.semibold,
              textDecoration: 'underline',
              fontSize: typography.sizes.sm,
              fontFamily: typography.fontFamily,
              padding: 0,
              transition: transitions.fast,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'none')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          >
            {action.label}
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={handleClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: style.color,
            cursor: 'pointer',
            fontSize: 20,
            padding: 0,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.8,
            transition: transitions.fast,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.8)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function ToastIcon({ type, iconBg }) {
  if (type === 'success') {
    return (
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M10 3L4.5 8.5L2 6"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 4V6.5M6 8.5H6.005M10.5 6C10.5 8.48528 8.48528 10.5 6 10.5C3.51472 10.5 1.5 8.48528 1.5 6C1.5 3.51472 3.51472 1.5 6 1.5C8.48528 1.5 10.5 3.51472 10.5 6Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (type === 'warning') {
    return (
      <div
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 7V10M10 13H10.01M3.86 16H16.14C17.26 16 17.98 14.78 17.42 13.82L11.28 3.5C10.72 2.54 9.28 2.54 8.72 3.5L2.58 13.82C2.02 14.78 2.74 16 3.86 16Z"
            stroke={colors.gray[900]}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  // Info icon
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M6 8V6M6 4H6.005M10.5 6C10.5 8.48528 8.48528 10.5 6 10.5C3.51472 10.5 1.5 8.48528 1.5 6C1.5 3.51472 3.51472 1.5 6 1.5C8.48528 1.5 10.5 3.51472 10.5 6Z"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
