import React from 'react';
import { getFileIcon } from '../utils/iconMapper';

/**
 * ============================================================================
 * INLINE DOCUMENT BUTTON - FIXED VERSION
 * ============================================================================
 * 
 * FIXES APPLIED:
 * 1. TWO distinct sizes: 'inline' (small) and 'listing' (large)
 * 2. Proper inline display (no line breaks)
 * 3. UTF-8 encoding support
 * 4. Consistent styling with MasterMarkdownStyles.css
 * 
 * USAGE:
 * - variant="inline" → Small button for use within text (13px font, 14px icon)
 * - variant="listing" → Large button for document lists (15px font, 24px icon)
 * 
 * ============================================================================
 */

const InlineDocumentButton = ({ document, onClick, variant = 'listing', style = {} }) => {
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

  // Determine if inline variant
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

  // Size-specific styles
  const buttonStyles = {
    // Common styles
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    textAlign: 'left',
    boxSizing: 'border-box',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    
    // Size-specific styles
    ...(isInline ? {
      // INLINE (Small) - for use within text
      gap: '4px',
      padding: '2px 8px',
      margin: '0 2px',
      borderRadius: '12px',
      verticalAlign: 'middle',
      lineHeight: '1.5',
    } : {
      // LISTING (Large) - for document lists
      gap: '10px',
      padding: '8px 16px',
      marginTop: '4px',
      marginBottom: '4px',
      marginRight: '8px',
      marginLeft: '0',
      borderRadius: '24px',
    }),
    
    ...style
  };

  const iconStyles = {
    width: isInline ? '14px' : '24px',
    height: isInline ? '14px' : '24px',
    objectFit: 'contain',
    flexShrink: 0
  };

  const textStyles = {
    fontSize: isInline ? '13px' : '15px',
    fontWeight: '600',
    color: '#303030',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: isInline ? '150px' : '220px',
    lineHeight: isInline ? '1.5' : 'normal'
  };

  return (
    <button
      onClick={handleClick}
      style={buttonStyles}
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
      className={isInline ? 'citation-button-inline' : 'citation-button-listing'}
    >
      {/* File Icon */}
      <img
        src={getFileIcon(displayName, mimeType)}
        alt="File icon"
        style={iconStyles}
      />

      {/* File Title */}
      <span style={textStyles}>
        {displayName}
      </span>
    </button>
  );
};

export default InlineDocumentButton;
