import React, { useState, useEffect } from 'react';

const ThinkingIndicator = ({ stage = 'processing', context = null, showTips = false }) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const stages = {
    analyzing: {
      icon: '🔍',
      message: 'Analyzing your documents...',
      submessage: 'Reading through uploaded files'
    },
    processing: {
      icon: '⚙️',
      message: 'Processing your request...',
      submessage: 'Understanding context and requirements'
    },
    generating: {
      icon: '✨',
      message: 'Generating response...',
      submessage: 'Crafting detailed answer'
    },
    finalizing: {
      icon: '📝',
      message: 'Finalizing response...',
      submessage: 'Almost ready'
    }
  };

  const tips = [
    "💡 Tip: You can upload multiple documents at once",
    "⚡ Did you know? You can drag and drop files anywhere",
    "🎯 Pro tip: Use folders to organize your documents",
    "✨ Fun fact: AI can analyze documents in 20+ languages",
    "📁 Tip: Create folders to keep your workspace organized",
    "🔍 Did you know? You can search across all your documents",
    "⚡ Pro tip: Use tags to quickly find related documents",
    "🎨 Fun fact: You can customize folder emojis"
  ];

  const current = stages[stage] || stages.processing;

  useEffect(() => {
    if (showTips) {
      const interval = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % tips.length);
      }, 3000); // Change tip every 3 seconds

      return () => clearInterval(interval);
    }
  }, [showTips, tips.length]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '16px 0'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          fontSize: 24,
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          {current.icon}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            color: '#111827',
            fontSize: 14,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600',
            marginBottom: 4
          }}>
            {current.message}
          </div>
          <div style={{
            color: '#6B7280',
            fontSize: 12,
            fontFamily: 'Plus Jakarta Sans'
          }}>
            {current.submessage}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: 4,
          alignItems: 'center'
        }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                background: '#3B82F6',
                borderRadius: '50%',
                animation: `bounce 1.4s infinite ease-in-out`,
                animationDelay: `${i * -0.16}s`
              }}
            />
          ))}
        </div>
      </div>

      {context && (
        <div style={{
          color: '#9CA3AF',
          fontSize: 12,
          fontFamily: 'Plus Jakarta Sans',
          fontStyle: 'italic',
          marginLeft: 36
        }}>
          {context}
        </div>
      )}

      {showTips && (
        <div style={{
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <div style={{
            color: '#374151',
            fontSize: 13,
            fontFamily: 'Plus Jakarta Sans',
            transition: 'opacity 0.3s ease-in-out'
          }}>
            {tips[currentTipIndex]}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.1);
              opacity: 0.8;
            }
          }

          @keyframes bounce {
            0%, 80%, 100% {
              transform: scale(0);
              opacity: 0.5;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-5px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default ThinkingIndicator;
