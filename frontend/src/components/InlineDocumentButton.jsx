import React from 'react';
import { getFileIcon } from '../utils/iconMapper';

/**
 * InlineDocumentButton Component
 *
 * Compact citation button - shows file icon and bold title
 * Matches "Show File" button style with larger icon and font
 */

const InlineDocumentButton = ({ document, onClick, style = {} }) => {
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
        gap: '10px',
        padding: '8px 16px',
        marginTop: '4px',
        marginBottom: '4px',
        marginRight: '8px',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '24px',  // More circular/pill-shaped
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
          width: '24px',
          height: '24px',
          objectFit: 'contain',
          flexShrink: 0
        }}
      />

      {/* File Title - Bold, 15px per UI spec */}
      <span style={{
        fontSize: '15px',
        fontWeight: '600',
        color: '#1a1a1a',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '220px'
      }}>
        {displayName}
      </span>
    </button>
  );
};

export default InlineDocumentButton;
