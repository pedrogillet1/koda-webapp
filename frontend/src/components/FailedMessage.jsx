import React from 'react';
import './FailedMessage.css';

export default function FailedMessage({ message, onRetry, onDelete }) {
  return (
    <div className="failed-message">
      <div className="failed-icon">⚠️</div>
      <div className="failed-content">
        <div className="failed-text">{message.content}</div>
        <div className="failed-error">
          {message.error?.message || 'Failed to send message'}
        </div>
      </div>
      <div className="failed-actions">
        <button className="failed-retry-button" onClick={() => onRetry(message)}>
          Retry
        </button>
        <button className="failed-delete-button" onClick={() => onDelete(message.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}
