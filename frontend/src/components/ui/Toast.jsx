import React, { useEffect, useState } from 'react';
import { colors, spacing, radius, zIndex, typography, transitions } from '../../constants/designTokens';

/**
 * Canonical Toast Component
 * Replaces ToastContext and ErrorBanner with single consistent notification system
 *
 * @param {string} type - Toast type: 'success' | 'error' | 'warning' | 'info'
 * @param {string} message - Notification message
 * @param {string} details - Optional secondary message with more details
 * @param {number} duration - Auto-dismiss duration in ms (default: 5000, 0 = no auto-dismiss)
 * @param {function} onClose - Function to call when toast is dismissed
 * @param {object} action - Optional action button: {label, onClick}
 */
export default function Toast({
  type = 'success',
  message,
  details,
  duration = 5000,
  onClose,
  action,
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Only auto-dismiss if duration > 0
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

  const handleAction = () => {
    if (action?.onClick) {
      action.onClick();
    }
    // Don't auto-close on action - let the action decide
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
      background: colors.primary,
      color: colors.white,
      iconBg: '#FBBC04', // Warning yellow
    },
    info: {
      background: colors.primary,
      color: colors.white,
      iconBg: '#2563EB', // Info blue
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
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          padding: `${spacing.md}px ${spacing.lg}px`,
          background: style.background,
          borderRadius: radius.xl,
          display: 'flex',
          alignItems: details ? 'flex-start' : 'center',
          gap: spacing.md,
          fontFamily: typography.fontFamily,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Icon */}
        <ToastIcon type={type} iconBg={style.iconBg} />

        {/* Message Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: style.color,
              fontSize: typography.sizes.sm,
              fontWeight: typography.weights.regular,
              lineHeight: typography.lineHeights.sm,
              wordWrap: 'break-word',
            }}
          >
            {message}
          </div>
          {details && (
            <div
              style={{
                color: style.color,
                fontSize: typography.sizes.xs,
                fontWeight: typography.weights.regular,
                lineHeight: '16px',
                marginTop: spacing.xs,
                opacity: 0.8,
                wordWrap: 'break-word',
              }}
            >
              {details}
            </div>
          )}
        </div>

        {/* Action Button */}
        {action && (
          <button
            onClick={handleAction}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: style.color,
              cursor: 'pointer',
              fontWeight: typography.weights.semibold,
              fontSize: typography.sizes.xs,
              fontFamily: typography.fontFamily,
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radius.md,
              transition: transitions.fast,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
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
            opacity: 0.7,
            transition: transitions.fast,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.7)}
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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 4.5V7.5M7 10H7.005"
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
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 5V7M7 9H7.005"
            stroke="#000"
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
          d="M6 8V6M6 4H6.005"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
