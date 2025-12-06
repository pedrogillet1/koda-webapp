import React from 'react';

/**
 * Slide 3: Send your files and ask your first question - Refined
 *
 * Shows chat interface mockup with:
 * - Koda welcome bubble
 * - User example question
 * - Two stacked example questions (darker grey)
 * - "START HERE" label above input bar
 * - Highlighted input bar with pulse animation (1-2 second loop)
 */
const Slide3 = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      {/* Micro Label */}
      <div style={{
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
        fontFamily: 'Plus Jakarta Sans',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 4
      }}>
        STEP 3 OF 3
      </div>

      {/* Title */}
      <div style={{
        fontSize: 22,
        fontWeight: '600',
        color: '#111827',
        fontFamily: 'Plus Jakarta Sans',
        lineHeight: '28px',
        maxWidth: 520
      }}>
        Send your files and ask your first question.
      </div>

      {/* Subline */}
      <div style={{
        fontSize: 14,
        fontWeight: '400',
        color: '#111827',
        fontFamily: 'Plus Jakarta Sans',
        lineHeight: '20px',
        marginTop: 0,
        marginBottom: 24
      }}>
        Next time you need a number, clause or plan, just ask me here.
      </div>

      {/* Grey Chat Mock Card */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        height: 220,
        margin: '0 auto',
        background: '#F3F4F6',
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        justifyContent: 'flex-end'
      }}>
        {/* Koda Bubble (Left) with Avatar */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          gap: 8,
          alignItems: 'flex-start'
        }}>
          {/* Koda Avatar */}
          <div style={{
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: '50%',
            background: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: '#FFFFFF',
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600'
          }}>
            K
          </div>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '14px 14px 14px 4px',
            padding: '10px 14px',
            maxWidth: '70%',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{
              fontSize: 13,
              color: '#111827',
              fontFamily: 'Plus Jakarta Sans',
              lineHeight: '18px'
            }}>
              Hi, I'm Koda. Once your files are here, ask me anything about them.
            </div>
          </div>
        </div>

        {/* User Bubble (Right) */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#111827',
            borderRadius: '14px 14px 4px 14px',
            padding: '10px 14px',
            maxWidth: '75%',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.18)'
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: '500',
              color: '#FFFFFF',
              fontFamily: 'Plus Jakarta Sans',
              lineHeight: '18px'
            }}>
              Which contracts expire in the next 30 days?
            </div>
          </div>
        </div>

        {/* Two Stacked Example Questions (Darker Grey) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginTop: 4
        }}>
          <div style={{
            fontSize: 12,
            color: '#9CA3AF',
            fontFamily: 'Plus Jakarta Sans',
            fontStyle: 'italic',
            textAlign: 'left',
            paddingLeft: 36
          }}>
            Ex.: "Where is the drawing for basement B2?"
          </div>
          <div style={{
            fontSize: 12,
            color: '#9CA3AF',
            fontFamily: 'Plus Jakarta Sans',
            fontStyle: 'italic',
            textAlign: 'left',
            paddingLeft: 36
          }}>
            Ex.: "What was the EBITDA in Q3 2025?"
          </div>
        </div>

        {/* START HERE Label */}
        <div style={{
          fontSize: 10,
          color: '#6B7280',
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '500',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: 16,
          marginBottom: 4
        }}>
          START HERE
        </div>

        {/* Chat Input Bar (Highlighted with Pulse Animation) */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '2px solid #111827',
          boxShadow: '0 0 12px rgba(17, 24, 39, 0.35)',
          animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
          <div style={{
            flex: 1,
            fontSize: 13,
            color: '#D1D5DB',
            fontFamily: 'Plus Jakarta Sans'
          }}>
            Ask Koda about your documents…
          </div>
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center'
          }}>
            {/* Paperclip Icon (Pill-shaped) */}
            <div style={{
              width: 26,
              height: 26,
              background: '#F3F4F6',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: 12,
                height: 12,
                background: '#9CA3AF',
                borderRadius: 2
              }} />
            </div>
            {/* Send Icon (Pill-shaped) */}
            <div style={{
              width: 26,
              height: 26,
              background: '#111827',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: 10,
                height: 10,
                background: '#FFFFFF',
                borderRadius: 2
              }} />
            </div>
          </div>
        </div>

        {/* Keyframe for Pulse Animation */}
        <style>{`
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 12px rgba(17, 24, 39, 0.35);
            }
            50% {
              box-shadow: 0 0 20px rgba(17, 24, 39, 0.5);
            }
          }
        `}</style>
      </div>

      {/* Bullets */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginTop: 24
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: '400',
          color: '#111827',
          fontFamily: 'Plus Jakarta Sans',
          lineHeight: '22px',
          display: 'flex',
          gap: 8
        }}>
          <span style={{ color: '#6B7280' }}>•</span>
          <span>Use the text bar to ask anything about your files.</span>
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: '400',
          color: '#111827',
          fontFamily: 'Plus Jakarta Sans',
          lineHeight: '22px',
          display: 'flex',
          gap: 8
        }}>
          <span style={{ color: '#6B7280' }}>•</span>
          <span>Click the paperclip to upload new documents.</span>
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: '400',
          color: '#111827',
          fontFamily: 'Plus Jakarta Sans',
          lineHeight: '22px',
          display: 'flex',
          gap: 8
        }}>
          <span style={{ color: '#6B7280' }}>•</span>
          <span>Speak naturally — you don't need special commands.</span>
        </div>
      </div>
    </div>
  );
};

export default Slide3;
