import React, { useState } from 'react';
import { spacing, radius, colors, typography } from '../../design/tokens';
import { ReactComponent as DotsIcon } from '../../assets/dots.svg';

/**
 * FileRow - Unified file row component for document lists
 * Specs:
 * - Padding: 12px
 * - Border radius: 12px
 * - Gap: 12px between elements
 * - Icon size: 40x40px
 * - Ellipsis button: 32x32px
 * - Consistent typography
 */
const FileRow = ({
  document,
  icon,
  onClick,
  onMenuClick,
  isMenuOpen = false,
  menuContent,
  isSelected = false,
  isSelectMode = false,
  draggable = true,
  onDragStart,
  onDragEnd,
  style = {},
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Determine background color based on state
  const getBackgroundColor = () => {
    if (isSelectMode && isSelected) {
      return colors.neutral[900];
    }
    if (isHovered) {
      return colors.neutral[200];
    }
    return colors.neutral[100];
  };

  // Determine text color based on state
  const getTextColor = () => {
    if (isSelectMode && isSelected) {
      return 'white';
    }
    return colors.neutral[900];
  };

  const getSubTextColor = () => {
    if (isSelectMode && isSelected) {
      return colors.neutral[300];
    }
    return colors.neutral[500];
  };

  return (
    <div
      draggable={draggable && !isSelectMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        background: getBackgroundColor(),
        cursor: isSelectMode ? 'pointer' : 'grab',
        transition: 'background 0.15s ease-out',
        ...style
      }}
      {...props}
    >
      {/* File icon - Fixed 40x40 */}
      <img
        src={icon}
        alt="File icon"
        style={{
          width: '40px',
          height: '40px',
          aspectRatio: '1/1',
          imageRendering: '-webkit-optimize-contrast',
          objectFit: 'contain',
          shapeRendering: 'geometricPrecision',
          flexShrink: 0
        }}
      />

      {/* File info */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          color: getTextColor(),
          fontSize: typography.body.size,
          fontFamily: typography.body.family,
          fontWeight: typography.bodyStrong.weight,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {document?.filename}
        </div>
        <div style={{
          color: getSubTextColor(),
          fontSize: typography.caption.size,
          fontFamily: typography.caption.family,
          fontWeight: typography.body.weight,
          marginTop: '4px'
        }}>
          {formatBytes(document?.fileSize)} • {formatDate(document?.createdAt)}
        </div>
      </div>

      {/* Ellipsis menu button - only show when not in select mode */}
      {!isSelectMode && (
        <div style={{ position: 'relative' }} data-dropdown>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick?.(e);
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = colors.neutral[200]}
            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            style={{
              width: '32px',
              height: '32px',
              background: 'white',
              borderRadius: '50%',
              border: `1px solid ${colors.neutral[200]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: '700',
              color: colors.neutral[900],
              transition: 'background 0.15s ease-out',
              flexShrink: 0
            }}
          >
            ⋯
          </button>
          {isMenuOpen && menuContent}
        </div>
      )}
    </div>
  );
};

export default FileRow;
