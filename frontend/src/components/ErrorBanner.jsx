import React from 'react';
import './ErrorBanner.css';

export default function ErrorBanner({ error, onDismiss, onRetry }) {
  if (!error) return null;

  return (
    <div className="error-banner">
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <div className="error-text">
          <div className="error-title">{error.title || 'Something went wrong'}</div>
          <div className="error-message">{error.message}</div>
        </div>
      </div>

      <div className="error-actions">
        {onRetry && (
          <button className="error-button retry-button" onClick={onRetry}>
            Retry
          </button>
        )}
        <button className="error-button dismiss-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
