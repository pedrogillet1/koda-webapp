import React, { useState, forwardRef } from 'react';
import { colors, spacing, radius, typography, transitions } from '../../constants/designTokens';

/**
 * Canonical Input Component
 * Replaces scattered input implementations with consistent styling
 *
 * @param {string} type - Input type: 'text' | 'email' | 'password' | 'search' | 'number'
 * @param {string} placeholder - Placeholder text
 * @param {string} value - Input value
 * @param {function} onChange - Change handler
 * @param {boolean} disabled - Whether input is disabled
 * @param {boolean} error - Whether input has error
 * @param {string} errorMessage - Error message to display
 * @param {React.ReactNode} leftIcon - Icon to display on left
 * @param {React.ReactNode} rightIcon - Icon to display on right
 * @param {string} size - Input size: 'sm' | 'md' | 'lg'
 * @param {boolean} fullWidth - Whether input takes full width
 */
const Input = forwardRef(function Input({
  type = 'text',
  placeholder = '',
  value = '',
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  disabled = false,
  error = false,
  errorMessage = '',
  leftIcon,
  rightIcon,
  size = 'md',
  fullWidth = true,
  autoFocus = false,
  name,
  id,
  className = '',
  style: customStyle = {},
  ...props
}, ref) {
  const [isFocused, setIsFocused] = useState(false);

  const sizes = {
    sm: {
      padding: `${spacing.sm}px ${spacing.md}px`,
      fontSize: typography.sizes.xs,
      height: 32,
    },
    md: {
      padding: `${spacing.md}px ${spacing.md}px`,
      fontSize: typography.sizes.sm,
      height: 40,
    },
    lg: {
      padding: `${spacing.lg}px ${spacing.lg}px`,
      fontSize: typography.sizes.md,
      height: 48,
    },
  };

  const sizeStyle = sizes[size] || sizes.md;

  const getBorderColor = () => {
    if (error) return colors.error;
    if (isFocused) return colors.primary;
    return colors.gray[300];
  };

  const getBoxShadow = () => {
    if (isFocused && !error) {
      return `0 0 0 2px rgba(24, 24, 24, 0.1)`;
    }
    if (isFocused && error) {
      return `0 0 0 2px rgba(217, 45, 32, 0.1)`;
    }
    return 'none';
  };

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const inputStyle = {
    width: fullWidth ? '100%' : 'auto',
    height: sizeStyle.height,
    padding: sizeStyle.padding,
    paddingLeft: leftIcon ? 40 : sizeStyle.padding.split(' ')[1],
    paddingRight: rightIcon ? 40 : sizeStyle.padding.split(' ')[1],
    borderRadius: radius.md,
    border: `1px solid ${getBorderColor()}`,
    boxShadow: getBoxShadow(),
    fontSize: sizeStyle.fontSize,
    fontFamily: typography.fontFamily,
    fontWeight: typography.weights.regular,
    background: disabled ? colors.gray[200] : colors.white,
    color: colors.gray[900],
    transition: transitions.normal,
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'text',
    opacity: disabled ? 0.6 : 1,
    ...customStyle,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, width: fullWidth ? '100%' : 'auto' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        {leftIcon && (
          <span
            style={{
              position: 'absolute',
              left: spacing.md,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.gray[500],
              pointerEvents: 'none',
            }}
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          name={name}
          id={id}
          className={className}
          style={inputStyle}
          {...props}
        />

        {rightIcon && (
          <span
            style={{
              position: 'absolute',
              right: spacing.md,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.gray[500],
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>

      {error && errorMessage && (
        <span
          style={{
            fontSize: typography.sizes.xs,
            color: colors.error,
          }}
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
});

export default Input;

// Convenience exports for common input types
export const SearchInput = forwardRef((props, ref) => (
  <Input
    ref={ref}
    type="search"
    placeholder="Search..."
    leftIcon={
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path
          d="M15.75 15.75L12.525 12.525M14.25 8.25C14.25 11.5637 11.5637 14.25 8.25 14.25C4.93629 14.25 2.25 11.5637 2.25 8.25C2.25 4.93629 4.93629 2.25 8.25 2.25C11.5637 2.25 14.25 4.93629 14.25 8.25Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    }
    {...props}
  />
));

export const PasswordInput = forwardRef((props, ref) => (
  <Input ref={ref} type="password" placeholder="Enter password" {...props} />
));

export const EmailInput = forwardRef((props, ref) => (
  <Input ref={ref} type="email" placeholder="Enter email" {...props} />
));
