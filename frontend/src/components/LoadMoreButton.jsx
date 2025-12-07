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
        gap: '6px',
        padding: '10px 16px',
        marginTop: '12px',
        marginBottom: '4px',
        backgroundColor: '#4a90e2',
        border: 'none',
        borderRadius: '8px',
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
          e.currentTarget.style.backgroundColor = '#357abd';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#4a90e2';
      }}
    >
      {/* Expand Icon */}
      {!loading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="white"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0
          }}
        >
          <path d="M8 0L6.59 1.41L12.17 7H0v2h12.17l-5.58 5.59L8 16l8-8z"/>
        </svg>
      )}

      {/* Loading Spinner */}
      {loading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            flexShrink: 0,
            animation: 'spin 1s linear infinite'
          }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="white"
            strokeWidth="2"
            strokeDasharray="10 10"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Button Text - "View all X files" per UI spec */}
      <span style={{
        fontSize: '15px',
        fontWeight: '500',
        color: 'white',
        whiteSpace: 'nowrap'
      }}>
        {loading
          ? 'Loading...'
          : `View all ${totalCount} files`
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
