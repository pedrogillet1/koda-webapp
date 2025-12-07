import React from 'react';
import { getFileIcon } from '../utils/iconMapper';

/**
 * InlineDocumentButton Component
 *
 * Compact citation button - shows file icon and bold title
 * Matches "Show File" button style with larger icon and font
 *
 * Supports two variants:
 * - 'default': Standard size for standalone display
 * - 'inline': Smaller size for inline display within text
 */

const InlineDocumentButton = ({ document, onClick, variant = 'default', style = {} }) => {
  const {
    documentId,
    documentName,
    filename,
    mimeType,
    fileSize,
    size,
    folderPath,
  } = document;

  // Use documentName or filename
  const displayName = documentName || filename || 'Unknown Document';

  // Use fileSize or size
  const displaySize = fileSize || size;

  // Variant-based sizing
  const isInline = variant === 'inline';

  const handleClick = () => {
    if (onClick) {
      onClick({
        id: documentId,
        documentId,
        filename: displayName,
        mimeType,
        size: displaySize,
        folderPath
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isInline ? '6px' : '10px',
        padding: isInline ? '2px 8px' : '8px 16px',
        marginTop: isInline ? '0' : '4px',
        marginBottom: isInline ? '0' : '4px',
        marginRight: isInline ? '4px' : '8px',
        marginLeft: isInline ? '2px' : '0',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: isInline ? '12px' : '24px',
        verticalAlign: isInline ? 'middle' : 'baseline',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
        textAlign: 'left',
        boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F3F4F6';
        e.currentTarget.style.borderColor = '#D1D5DB';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#F9FAFB';
        e.currentTarget.style.borderColor = '#E5E7EB';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
      }}
    >
      {/* File Icon */}
      <img
        src={getFileIcon(displayName, mimeType)}
        alt="File icon"
        style={{
          width: isInline ? '14px' : '24px',
          height: isInline ? '14px' : '24px',
          objectFit: 'contain',
          flexShrink: 0
        }}
      />

      {/* File Title - Bold, variant-aware sizing */}
      <span style={{
        fontSize: isInline ? '13px' : '15px',
        fontWeight: '600',
        color: '#1a1a1a',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: isInline ? '150px' : '220px',
        lineHeight: isInline ? '1.5' : 'normal'
      }}>
        {displayName}
      </span>
    </button>
  );
};

export default InlineDocumentButton;
