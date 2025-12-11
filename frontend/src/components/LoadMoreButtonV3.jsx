/**
 * ============================================================================
 * LOAD MORE BUTTON V3 - LAYER 4 (FRONTEND)
 * ============================================================================
 *
 * PURPOSE: Render "See all X documents" button
 *
 * FEATURES:
 * - Localized text (en, pt, es)
 * - Shows remaining count
 * - Click loads all documents or navigates to documents page
 * - Block layout (full width)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

// Localized strings
const STRINGS = {
  en: {
    seeAll: 'See all',
    documents: 'documents',
    document: 'document',
    showing: 'Showing',
    of: 'of'
  },
  pt: {
    seeAll: 'Ver todos',
    documents: 'documentos',
    document: 'documento',
    showing: 'Mostrando',
    of: 'de'
  },
  es: {
    seeAll: 'Ver todos',
    documents: 'documentos',
    document: 'documento',
    showing: 'Mostrando',
    of: 'de'
  }
};

function getStrings(language) {
  return STRINGS[language] || STRINGS.en;
}

function LoadMoreButtonV3({
  remainingCount,
  totalCount,
  loadedCount,
  onClick,
  language = 'en',
  navigateToDocuments = true,
  className = '',
  style = {}
}) {
  const navigate = useNavigate();
  const strings = getStrings(language);

  // Handle both direct props and loadMoreData object
  const total = totalCount || 0;
  const loaded = loadedCount || 0;
  const remaining = remainingCount || (total - loaded);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (onClick) {
      onClick({
        remainingCount: remaining,
        totalCount: total,
        loadedCount: loaded
      });
    } else if (navigateToDocuments) {
      // Default behavior: navigate to documents page
      navigate('/documents');
    }
  };

  const docWord = remaining === 1 ? strings.document : strings.documents;

  // Inline styles
  const containerStyles = {
    display: 'block',
    margin: '16px 0',
    textAlign: 'center',
    ...style
  };

  const buttonStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#f8f8f8',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '0.95em',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    color: '#333',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  return (
    <div className={`load-more-container ${className}`} style={containerStyles}>
      <button
        type="button"
        className="load-more-button"
        onClick={handleClick}
        aria-label={`${strings.seeAll} ${total} ${docWord}`}
        style={buttonStyles}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e8e8e8';
          e.currentTarget.style.borderColor = '#c0c0c0';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f8f8f8';
          e.currentTarget.style.borderColor = '#e0e0e0';
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span className="load-more-icon" style={{ fontSize: '1.2em', lineHeight: 1 }}>📂</span>
        <span className="load-more-text" style={{ fontWeight: 600 }}>
          {strings.seeAll} {total} {docWord}
        </span>
        <span className="load-more-count" style={{ fontSize: '0.9em', color: '#666', fontWeight: 400 }}>
          ({strings.showing} {loaded} {strings.of} {total})
        </span>
      </button>
    </div>
  );
}

LoadMoreButtonV3.propTypes = {
  remainingCount: PropTypes.number,
  totalCount: PropTypes.number,
  loadedCount: PropTypes.number,
  onClick: PropTypes.func,
  language: PropTypes.oneOf(['en', 'pt', 'es']),
  navigateToDocuments: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

export default LoadMoreButtonV3;
