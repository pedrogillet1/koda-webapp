/**
 * ============================================================================
 * INLINE DOCUMENT BUTTON V3 - LAYER 4 (FRONTEND)
 * ============================================================================
 *
 * PURPOSE: Render clickable document button inline with text
 *
 * CRITICAL STYLING RULES:
 * - inList={true}: Bold only (NO underline) - for document listings
 * - inList={false}: Bold + underlined (ALWAYS) - for inline text mentions
 *
 * USAGE:
 * - variant="inline" -> Small button (13px font, 14px icon)
 * - variant="listing" -> Large button (15px font, 24px icon)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { getFileIcon as getIconFromMapper } from '../utils/iconMapper';

// File icon emoji fallbacks
const FILE_ICONS_EMOJI = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📊', pptx: '📊', txt: '📃', csv: '📋', json: '📋',
  md: '📝', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
  svg: '🖼️', default: '📎'
};

function getFileIconEmoji(extension) {
  if (!extension) return FILE_ICONS_EMOJI.default;
  return FILE_ICONS_EMOJI[extension.toLowerCase()] || FILE_ICONS_EMOJI.default;
}

function InlineDocumentButtonV3({
  document,
  onClick,
  inList = false,
  variant = 'listing',
  className = '',
  style = {}
}) {
  if (!document) return null;

  // Support both old and new property names
  const {
    documentId, id, filename, documentName, name,
    extension, mimeType, fileSize, size, folderPath
  } = document;

  const docId = documentId || id;
  const displayName = filename || documentName || name || '';
  const displaySize = fileSize || size;

  if (!displayName) return null;

  const fileExtension = extension || displayName.split('.').pop()?.toLowerCase();
  const isInline = variant === 'inline';
  const contextClass = inList ? 'inline-document-button--list' : 'inline-document-button--text';

  const handleClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onClick) {
      onClick({
        id: docId,
        documentId: docId,
        filename: displayName,
        mimeType,
        size: displaySize,
        folderPath
      });
    }
  };

  // Inline styles for the button
  const buttonStyles = {
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
    ...(isInline ? {
      gap: '4px', padding: '2px 8px', margin: '0 2px',
      borderRadius: '12px', verticalAlign: 'middle', lineHeight: '1.5',
    } : {
      gap: '10px', padding: '8px 16px', marginTop: '4px',
      marginBottom: '4px', marginRight: '8px', marginLeft: '0', borderRadius: '24px',
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
    lineHeight: isInline ? '1.5' : 'normal',
    textDecoration: inList ? 'none' : 'underline'
  };

  // Try to get icon from iconMapper, fallback to emoji
  let iconElement;
  try {
    const iconSrc = getIconFromMapper(displayName, mimeType);
    if (iconSrc) {
      iconElement = <img src={iconSrc} alt="" style={iconStyles} />;
    } else {
      throw new Error('No icon');
    }
  } catch (e) {
    iconElement = (
      <span style={{ fontSize: isInline ? '14px' : '18px', lineHeight: 1 }}>
        {getFileIconEmoji(fileExtension)}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`inline-document-button ${contextClass} ${className}`.trim()}
      onClick={handleClick}
      title={`Open ${displayName}`}
      aria-label={`Open document ${displayName}`}
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
    >
      {iconElement}
      <span className="inline-document-name" style={textStyles}>
        {displayName}
      </span>
    </button>
  );
}

InlineDocumentButtonV3.propTypes = {
  document: PropTypes.shape({
    documentId: PropTypes.string,
    id: PropTypes.string,
    filename: PropTypes.string,
    documentName: PropTypes.string,
    name: PropTypes.string,
    extension: PropTypes.string,
    mimeType: PropTypes.string,
    fileSize: PropTypes.number,
    size: PropTypes.number,
    folderPath: PropTypes.string,
    language: PropTypes.string,
    topics: PropTypes.arrayOf(PropTypes.string),
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    pageCount: PropTypes.number,
    slideCount: PropTypes.number
  }).isRequired,
  onClick: PropTypes.func,
  inList: PropTypes.bool,
  variant: PropTypes.oneOf(['inline', 'listing']),
  className: PropTypes.string,
  style: PropTypes.object
};

export default InlineDocumentButtonV3;
