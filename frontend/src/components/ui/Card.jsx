import React, { useState } from 'react';
import { colors, spacing, radius, shadows, transitions } from '../../constants/designTokens';

/**
 * Canonical Card Component
 * Replaces scattered card implementations with consistent styling
 *
 * @param {React.ReactNode} children - Card content
 * @param {string} padding - Padding size: 'none' | 'sm' | 'md' | 'lg'
 * @param {boolean} shadow - Whether to show shadow (default: true)
 * @param {boolean} hover - Whether to show hover effect (default: false)
 * @param {boolean} border - Whether to show border (default: true)
 * @param {function} onClick - Click handler (makes card interactive)
 * @param {boolean} selected - Whether card is selected
 */
export default function Card({
  children,
  padding = 'md',
  shadow = true,
  hover = false,
  border = true,
  onClick,
  selected = false,
  className = '',
  style: customStyle = {},
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);

  const paddingSizes = {
    none: 0,
    sm: spacing.md,
    md: spacing.lg,
    lg: spacing.xl,
  };

  const paddingValue = paddingSizes[padding] ?? paddingSizes.md;

  const isInteractive = !!onClick || hover;

  const getBackground = () => {
    if (selected) return colors.gray[100];
    if (isHovered && isInteractive) return colors.gray[100];
    return colors.white;
  };

  const getBorderColor = () => {
    if (selected) return colors.primary;
    return colors.gray[300];
  };

  const getShadow = () => {
    if (!shadow) return 'none';
    if (isHovered && isInteractive) return shadows.xl;
    return shadows.lg;
  };

  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        padding: paddingValue,
        borderRadius: radius.lg,
        border: border ? `1px solid ${getBorderColor()}` : 'none',
        background: getBackground(),
        boxShadow: getShadow(),
        transition: transitions.normal,
        cursor: onClick ? 'pointer' : 'default',
        ...customStyle,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
    </div>
  );
}

// Convenience exports for common card types
export const InteractiveCard = (props) => <Card hover {...props} />;

export const CardHeader = ({ children, style: customStyle = {}, ...props }) => (
  <div
    style={{
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottom: `1px solid ${colors.gray[300]}`,
      ...customStyle,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({ children, style: customStyle = {}, ...props }) => (
  <h3
    style={{
      margin: 0,
      fontSize: 18,
      fontWeight: 600,
      color: colors.gray[900],
      ...customStyle,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({ children, style: customStyle = {}, ...props }) => (
  <p
    style={{
      margin: 0,
      marginTop: spacing.xs,
      fontSize: 14,
      color: colors.gray[500],
      ...customStyle,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent = ({ children, style: customStyle = {}, ...props }) => (
  <div style={{ ...customStyle }} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, style: customStyle = {}, ...props }) => (
  <div
    style={{
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTop: `1px solid ${colors.gray[300]}`,
      display: 'flex',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      ...customStyle,
    }}
    {...props}
  >
    {children}
  </div>
);
