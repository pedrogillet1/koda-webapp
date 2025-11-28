import React, { useState } from 'react';

/**
 * Feedback Modal
 * Shows a form for users to send feedback
 */
const FeedbackModal = ({ isOpen, onClose }) => {
  const [feedback, setFeedback] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    // TODO: Implement feedback submission
    console.log('Feedback submitted:', feedback);
    setFeedback('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        display: 'flex',
        width: 986,
        flexDirection: 'column',
        alignItems: 'flex-start',
        background: '#FFF',
        borderRadius: 20,
        padding: 32,
        gap: 24,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
      }}>
        {/* Header */}
        <div style={{
          alignSelf: 'stretch',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {/* Beta Access with Crown Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <div style={{
                width: 56,
                height: 56,
                background: '#FFF',
                border: '2px solid #E6E6EC',
                borderRadius: 12,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 32
              }}>
                👑
              </div>
              <div style={{
                color: '#32302C',
                fontSize: 28,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '700',
                lineHeight: '36px'
              }}>
                Beta Access
              </div>
            </div>

            {/* Subtitle */}
            <div style={{
              color: '#6C6B6E',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '24px'
            }}>
              Early access · All features unlocked
            </div>

            {/* Description */}
            <div style={{
              color: '#6C6B6E',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '400',
              lineHeight: '24px',
              maxWidth: 600
            }}>
              You're part of Koda's early access program. Every search, upload, and note helps refine how Koda thinks — and how secure document intelligence should feel.
            </div>
          </div>

          {/* Close button */}
          <div
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: '#F5F5F5',
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
          >
            <div style={{
              fontSize: 18,
              color: '#323232',
              lineHeight: 1
            }}>
              ✕
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          alignSelf: 'stretch',
          height: 1,
          background: '#E6E6EC'
        }} />

        {/* Feedback Input */}
        <div style={{
          alignSelf: 'stretch',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <label style={{
            color: '#32302C',
            fontSize: 16,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600',
            lineHeight: '24px'
          }}>
            Share your feedback
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us what you think, what works well, and what could be improved..."
            style={{
              width: '100%',
              minHeight: 160,
              padding: 16,
              background: '#F5F5F5',
              border: '1px solid #E6E6EC',
              borderRadius: 12,
              color: '#32302C',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '400',
              lineHeight: '24px',
              resize: 'vertical',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#181818';
              e.target.style.background = '#FFF';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#E6E6EC';
              e.target.style.background = '#F5F5F5';
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{
          alignSelf: 'stretch',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12
        }}>
          {/* Cancel Button */}
          <button
            onClick={onClose}
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 12,
              paddingBottom: 12,
              background: '#F5F5F5',
              borderRadius: 12,
              border: '1px solid #E6E6EC',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
          >
            <div style={{
              color: '#323232',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              lineHeight: '24px'
            }}>
              Cancel
            </div>
          </button>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!feedback.trim()}
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 12,
              paddingBottom: 12,
              background: feedback.trim() ? '#181818' : '#E6E6EC',
              borderRadius: 12,
              border: 'none',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: feedback.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (feedback.trim()) {
                e.currentTarget.style.background = '#323232';
              }
            }}
            onMouseLeave={(e) => {
              if (feedback.trim()) {
                e.currentTarget.style.background = 'rgba(24, 24, 24, 0.90)';
              }
            }}
          >
            <div style={{
              color: feedback.trim() ? '#FFF' : '#B9B9B9',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              lineHeight: '24px'
            }}>
              Send Feedback
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
