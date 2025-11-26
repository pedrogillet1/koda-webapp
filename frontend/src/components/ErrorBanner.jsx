import React, { useState, useEffect, useCallback } from 'react';
import './ErrorBanner.css';

export default function ErrorBanner({ error, onDismiss, onRetry }) {
  const [retryCountdown, setRetryCountdown] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  // Reset countdown when error changes
  useEffect(() => {
    if (error && error.retryable && onRetry) {
      // Start 5-second countdown for retryable errors
      setRetryCountdown(5);
      setIsPaused(false);
    } else {
      setRetryCountdown(null);
      setIsPaused(false);
    }
  }, [error, onRetry]);

  // Countdown timer
  useEffect(() => {
    if (retryCountdown === null || isPaused || !onRetry) return;

    if (retryCountdown <= 0) {
      // Auto-retry when countdown reaches 0
      setRetryCountdown(null);
      onRetry();
      return;
    }

    const timer = setTimeout(() => {
      setRetryCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [retryCountdown, isPaused, onRetry]);

  const handleCancelCountdown = useCallback(() => {
    setRetryCountdown(null);
    setIsPaused(true);
  }, []);

  const handleRetryNow = useCallback(() => {
    setRetryCountdown(null);
    onRetry();
  }, [onRetry]);

  const handleDismiss = useCallback(() => {
    setRetryCountdown(null);
    onDismiss();
  }, [onDismiss]);

  if (!error) return null;

  const isRetryable = error.retryable && onRetry;
  const showCountdown = retryCountdown !== null && !isPaused;

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
        {isRetryable && (
          <>
            {showCountdown ? (
              <div className="retry-countdown-container">
                <div className="countdown-text">
                  <span className="countdown-label">Retrying in</span>
                  <span className="countdown-number">{retryCountdown}</span>
                  <span className="countdown-unit">s</span>
                </div>
                <div className="countdown-progress">
                  <div
                    className="countdown-progress-bar"
                    style={{ width: `${(retryCountdown / 5) * 100}%` }}
                  />
                </div>
                <div className="countdown-actions">
                  <button
                    className="error-button retry-now-button"
                    onClick={handleRetryNow}
                  >
                    Retry Now
                  </button>
                  <button
                    className="error-button cancel-button"
                    onClick={handleCancelCountdown}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button className="error-button retry-button" onClick={handleRetryNow}>
                Retry
              </button>
            )}
          </>
        )}
        <button className="error-button dismiss-button" onClick={handleDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
