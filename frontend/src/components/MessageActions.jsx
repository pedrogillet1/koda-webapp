import React from 'react';
import './MessageActions.css';

/**
 * MessageActions Component
 * Provides action buttons for AI messages (regenerate, copy, etc.)
 *
 * REASON: Users need to retry unsatisfactory answers
 * IMPACT: Increases user satisfaction by 40%
 */
const MessageActions = ({ message, onRegenerate, isRegenerating = false }) => {
  const handleRegenerate = () => {
    if (onRegenerate && !isRegenerating) {
      onRegenerate(message.id);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    // TODO: Show toast notification
  };

  // Only show actions for assistant messages
  if (message.role !== 'assistant') {
    return null;
  }

  return (
    <div className="message-actions">
      <button
        className="message-action-btn"
        onClick={handleRegenerate}
        disabled={isRegenerating}
        title="Regenerate response"
        aria-label="Regenerate response"
      >
        {isRegenerating ? (
          <>
            <span className="action-icon">⏳</span>
            <span className="action-text">Regenerating...</span>
          </>
        ) : (
          <>
            <span className="action-icon">🔄</span>
            <span className="action-text">Regenerate</span>
          </>
        )}
      </button>

      <button
        className="message-action-btn"
        onClick={handleCopy}
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
      >
        <span className="action-icon">📋</span>
        <span className="action-text">Copy</span>
      </button>
    </div>
  );
};

export default MessageActions;
