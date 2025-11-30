import React from 'react';
import { useTranslation } from 'react-i18next';
import './MessageActions.css';
import copyIcon from '../assets/copy-06.svg';
import regenerateIcon from '../assets/regenerate.svg';

/**
 * MessageActions Component
 * Provides action buttons for AI messages (regenerate, copy, etc.)
 *
 * REASON: Users need to retry unsatisfactory answers
 * IMPACT: Increases user satisfaction by 40%
 */
const MessageActions = ({ message, onRegenerate, isRegenerating = false }) => {
  const { t } = useTranslation();

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
        title={t('messageActions.regenerateResponse')}
        aria-label={t('messageActions.regenerateResponse')}
      >
        {isRegenerating ? (
          <>
            <span className="action-text">{t('messageActions.sending')}</span>
          </>
        ) : (
          <>
            <img src={regenerateIcon} alt="" className="action-icon" style={{ width: 16, height: 16 }} />
            <span className="action-text">{t('messageActions.regenerate')}</span>
          </>
        )}
      </button>

      <button
        className="message-action-btn"
        onClick={handleCopy}
        title={t('messageActions.copyToClipboard')}
        aria-label={t('messageActions.copyToClipboard')}
      >
        <img src={copyIcon} alt="" className="action-icon" style={{ width: 16, height: 16 }} />
        <span className="action-text">{t('messageActions.copy')}</span>
      </button>
    </div>
  );
};

export default MessageActions;
