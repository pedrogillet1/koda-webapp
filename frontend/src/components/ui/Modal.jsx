import React, { useEffect } from 'react';
import { colors, spacing, radius, zIndex, typography, transitions } from '../../constants/designTokens';
import { useIsMobile } from '../../hooks/useIsMobile';

/**
 * Canonical Modal Component
 * Replaces all 17+ modal implementations with a single consistent component
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {function} onClose - Function to call when modal should close
 * @param {string} title - Modal title text
 * @param {React.ReactNode} children - Modal content
 * @param {Array} actions - Array of action buttons [{label, onClick, variant}]
 * @param {number} maxWidth - Maximum width of modal (default: 400)
 * @param {boolean} showCloseButton - Whether to show the close button (default: true)
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions = [],
  maxWidth = 400,
  showCloseButton = true,
}) {
  const isMobile = useIsMobile();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: colors.overlay,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: zIndex.modal,
        animation: 'fadeIn 0.2s ease-out',
        padding: isMobile ? 16 : spacing.lg,
        paddingBottom: isMobile ? `calc(16px + env(safe-area-inset-bottom, 0px))` : spacing.lg,
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: maxWidth,
          margin: 0,
          maxHeight: isMobile ? '85vh' : '85vh',
          background: colors.white,
          borderRadius: radius.xl,
          border: `1px solid ${colors.gray[300]}`,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: isMobile ? `calc(${spacing.lg}px + env(safe-area-inset-bottom, 0px))` : spacing.lg,
          animation: 'slideUp 0.2s ease-out',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            alignSelf: 'stretch',
            paddingLeft: spacing.lg,
            paddingRight: spacing.lg,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Left spacer for centering title */}
          <div style={{ width: 30, height: 30, opacity: showCloseButton ? 1 : 0 }} />

          {/* Title */}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              color: colors.gray[900],
              fontSize: typography.sizes.lg,
              fontFamily: typography.fontFamily,
              fontWeight: typography.weights.bold,
              lineHeight: typography.lineHeights.lg,
            }}
          >
            {title}
          </div>

          {/* Close button - circular */}
          {showCloseButton && (
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                padding: 0,
                background: colors.white,
                border: `1px solid ${colors.gray[300]}`,
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: 18,
                color: colors.gray[600],
                transition: transitions.normal,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.gray[100])}
              onMouseLeave={(e) => (e.currentTarget.style.background = colors.white)}
            >
              ×
            </button>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            paddingLeft: spacing.lg,
            paddingRight: spacing.lg,
          }}
        >
          {children}
        </div>

        {/* Actions - centered with pill-shaped buttons */}
        {actions.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: spacing.md,
              justifyContent: 'center',
              paddingLeft: spacing.lg,
              paddingRight: spacing.lg,
            }}
          >
            {actions.map((action, idx) => {
              const isPrimary = action.variant === 'primary' || (!action.variant && idx === actions.length - 1);
              const isDanger = action.variant === 'danger';
              const isSecondary = action.variant === 'secondary' || action.variant === 'cancel';

              let bgColor = colors.primary;
              let hoverColor = colors.primaryDark;
              let textColor = colors.white;
              let border = 'none';

              if (isDanger) {
                bgColor = colors.error;
                hoverColor = '#B82415';
              } else if (isSecondary) {
                bgColor = '#F5F5F5';
                hoverColor = '#ECECEC';
                textColor = colors.gray[900];
                border = `1px solid ${colors.gray[300]}`;
              }

              return (
                <button
                  key={idx}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  style={{
                    flex: 1,
                    height: 52,
                    padding: `${spacing.md}px ${spacing.lg}px`,
                    background: bgColor,
                    color: textColor,
                    border: border,
                    borderRadius: 100,
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    fontSize: typography.sizes.md,
                    fontFamily: typography.fontFamily,
                    fontWeight: typography.weights.bold,
                    transition: transitions.normal,
                    opacity: action.disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!action.disabled) {
                      e.currentTarget.style.background = hoverColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = bgColor;
                  }}
                >
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
