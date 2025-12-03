import React, { useRef, useEffect, useState } from 'react';
import { ReactComponent as AttachmentIcon } from '../assets/Paperclip.svg';
import { ReactComponent as SendIcon } from '../assets/arrow-narrow-up.svg';

/**
 * ChatGPT-style Composer UI for Mobile
 *
 * This component:
 * - Keeps the native iOS keyboard (with autocorrect, dictation, emoji)
 * - Customizes the composer UI above the keyboard
 * - Prevents page scrolling
 * - Positions correctly relative to the keyboard
 */
const MobileComposer = ({
  message,
  onMessageChange,
  onSendMessage,
  onAttachFile,
  isLoading,
  onStopGeneration,
  attachedDocuments = [],
  onRemoveAttachment,
  isMobile,
  fileInputRef,
  placeholder = "Ask Koda anything..."
}) => {
  const inputRef = useRef(null);
  const composerRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(24);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const resizeTextarea = () => {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';

      // Calculate new height
      const minHeight = 24;
      const maxHeight = isMobile ? 100 : 200;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

      setInputHeight(newHeight);
      textarea.style.height = `${newHeight}px`;
    };

    // Resize on input change
    resizeTextarea();

    // Also resize on window resize (orientation change)
    window.addEventListener('resize', resizeTextarea);
    return () => window.removeEventListener('resize', resizeTextarea);
  }, [message, isMobile]);

  // Handle send message
  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage();
      // Reset height after sending
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = '24px';
          setInputHeight(24);
        }
      }, 100);
    }
  };

  // Handle key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      ref={composerRef}
      className="mobile-composer"
      style={{
        // Fixed positioning at bottom of viewport
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,

        // Safe area insets for notch/dynamic island
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingTop: '8px',

        // Background and styling
        background: 'white',
        borderTop: '1px solid #E6E6EC',

        // Layout
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',

        // Constraints
        maxHeight: '50vh',
        overflow: 'hidden',

        // Box model
        boxSizing: 'border-box',
      }}
    >
      {/* Document Attachments Banner */}
      {attachedDocuments.length > 0 && (
        <div
          style={{
            marginBottom: '4px',
            padding: '10px 12px',
            background: '#F5F5F7',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#32302C',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {attachedDocuments.length === 1
                ? (attachedDocuments[0].name || attachedDocuments[0].filename || 'Document')
                : `${attachedDocuments.length} documents attached`}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onRemoveAttachment) onRemoveAttachment();
            }}
            style={{
              padding: '4px 10px',
              background: 'white',
              border: '1px solid #E6E6EC',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              color: '#D92D20',
            }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Composer Input Area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          padding: '8px 12px',
          background: '#F5F5F7',
          borderRadius: '20px',
          minHeight: '40px',
        }}
      >
        {/* Attachment Button */}
        {fileInputRef && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={onAttachFile}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
              multiple
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#6C6B6E',
                transition: 'opacity 0.2s',
              }}
            >
              <AttachmentIcon style={{ width: '22px', height: '22px' }} />
            </button>
          </>
        )}

        {/* Textarea Input */}
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{
            flex: '1 1 auto',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '16px', // Prevents iOS zoom
            color: '#32302C',
            resize: 'none',
            overflow: inputHeight >= 100 ? 'auto' : 'hidden',
            minHeight: '24px',
            maxHeight: isMobile ? '100px' : '200px',
            lineHeight: '24px',
            fontFamily: 'Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif',
            padding: '0',
            margin: '0',
            WebkitAppearance: 'none',
          }}
          rows={1}
        />

        {/* Send/Stop Button */}
        <button
          onClick={isLoading ? onStopGeneration : handleSend}
          disabled={!isLoading && !message.trim()}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: isLoading ? '#FF6B6B' : (!message.trim() ? '#E6E6EC' : '#171717'),
            border: 'none',
            color: 'white',
            cursor: isLoading || message.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s, transform 0.15s',
          }}
        >
          {isLoading ? (
            <span style={{ fontSize: '14px' }}>&#9632;</span>
          ) : (
            <SendIcon style={{ width: '16px', height: '16px' }} />
          )}
        </button>
      </div>
    </div>
  );
};

export default MobileComposer;
