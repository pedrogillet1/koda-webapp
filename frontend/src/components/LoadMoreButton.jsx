import React, { useState } from 'react';

/**
 * LoadMoreButton Component
 *
 * Displays a "load more" button to show additional hidden files
 * Different styling from document/folder buttons (transparent, dashed border)
 */

const LoadMoreButton = ({ loadMoreData, onClick, style = {} }) => {
  const [loading, setLoading] = useState(false);

  const {
    remainingCount,
    totalCount,
    loadedCount
  } = loadMoreData;

  const handleClick = async () => {
    if (onClick && !loading) {
      setLoading(true);
      try {
        await onClick(loadMoreData);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 16px',
        marginTop: '8px',
        marginBottom: '8px',
        backgroundColor: 'transparent',
        border: '2px dashed #D1D5DB',  // Dashed border
        borderRadius: '24px',  // Pill-shaped
        cursor: loading ? 'wait' : 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
        textAlign: 'center',
        boxSizing: 'border-box',
        opacity: loading ? 0.6 : 1,
        ...style
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.backgroundColor = '#F9FAFB';
          e.currentTarget.style.borderColor = '#9CA3AF';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = '#D1D5DB';
      }}
    >
      {/* Expand Icon */}
      {!loading && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0
          }}
        >
          <path
            d="M10 5V15M5 10H15"
            stroke="#6B7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Loading Spinner */}
      {loading && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0,
            animation: 'spin 1s linear infinite'
          }}
        >
          <circle
            cx="10"
            cy="10"
            r="8"
            stroke="#6B7280"
            strokeWidth="2"
            strokeDasharray="12 12"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Button Text */}
      <span style={{
        fontSize: '14px',
        fontWeight: '500',
        color: '#6B7280',
        whiteSpace: 'nowrap'
      }}>
        {loading
          ? 'Loading...'
          : `+ Show ${remainingCount} more file${remainingCount !== 1 ? 's' : ''}`
        }
      </span>

      {/* Add CSS animation for spinner */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
};

export default LoadMoreButton;
