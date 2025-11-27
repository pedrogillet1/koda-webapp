import React, { useEffect, useRef, useState } from 'react';
import { colors, spacing, radius, shadows, zIndex, typography, transitions } from '../../constants/designTokens';

/**
 * Canonical Dropdown Component
 * Replaces all 24+ dropdown/menu implementations with consistent styling
 *
 * @param {boolean} isOpen - Whether dropdown is visible
 * @param {function} onClose - Function to call when dropdown should close
 * @param {Array} items - Menu items: [{label, icon, onClick, divider, disabled, trailing}]
 * @param {string} position - Position relative to trigger: 'bottom' | 'top' | 'bottom-left' | 'bottom-right'
 * @param {number} minWidth - Minimum width of dropdown (default: 160)
 * @param {React.ReactNode} trigger - Trigger element (if using controlled mode)
 */
export default function Dropdown({
  isOpen,
  onClose,
  items = [],
  position = 'bottom-right',
  minWidth = 160,
  style: customStyle = {},
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const positionStyles = {
    'bottom': { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: spacing.sm },
    'bottom-left': { top: '100%', left: 0, marginTop: spacing.sm },
    'bottom-right': { top: '100%', right: 0, marginTop: spacing.sm },
    'top': { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: spacing.sm },
    'top-left': { bottom: '100%', left: 0, marginBottom: spacing.sm },
    'top-right': { bottom: '100%', right: 0, marginBottom: spacing.sm },
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        ...positionStyles[position],
        background: colors.white,
        boxShadow: shadows.lg,
        borderRadius: radius.lg,
        border: `1px solid ${colors.gray[300]}`,
        zIndex: zIndex.dropdown,
        minWidth: minWidth,
        overflow: 'hidden',
        animation: 'dropdownFadeIn 0.15s ease-out',
        ...customStyle,
      }}
    >
      <div
        style={{
          padding: spacing.xs,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            {item.divider ? (
              <div
                style={{
                  height: 1,
                  background: colors.gray[300],
                  margin: `${spacing.xs}px 0`,
                }}
              />
            ) : (
              <DropdownItem
                item={item}
                onClose={onClose}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <style>{`
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
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

function DropdownItem({ item, onClose }) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (!item.disabled) {
      item.onClick?.();
      onClose?.();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={item.disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.md}px`,
        background: isHovered && !item.disabled ? colors.gray[100] : 'transparent',
        border: 'none',
        borderRadius: radius.sm,
        cursor: item.disabled ? 'not-allowed' : 'pointer',
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily,
        fontWeight: typography.weights.medium,
        color: item.disabled ? colors.gray[500] : item.danger ? colors.error : colors.gray[900],
        transition: transitions.fast,
        textAlign: 'left',
        width: '100%',
        opacity: item.disabled ? 0.5 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {item.icon && (
        <span
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {item.icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.trailing && (
        <span
          style={{
            color: colors.gray[500],
            fontSize: typography.sizes.xs,
          }}
        >
          {item.trailing}
        </span>
      )}
    </button>
  );
}

// Export for standalone menu item usage
export { DropdownItem };
