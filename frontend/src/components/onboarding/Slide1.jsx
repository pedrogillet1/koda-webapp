import React from 'react';

/**
 * Slide 1: Organizing documents isn't your job. It's mine. - Refined
 *
 * Shows chat-style illustration with 3 persona bubbles (Lawyer, Finance, Engineering)
 * Updated specs: consistent grey card sizing, pill-shaped user bubbles, proper spacing
 */
const Slide1 = () => {
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
        STEP 1 OF 3
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
        Organizing documents isn't your job. It's mine.
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
        I store your contracts, reports, spreadsheets and drawings. You just ask — I find the right answer.
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
        gap: 16,
        justifyContent: 'center'
      }}>
        {/* Koda Bubble (Left) - White with shadow */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            padding: '12px 16px',
            maxWidth: '70%',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.06)'
          }}>
            <div style={{
              fontSize: 13,
              color: '#111827',
              fontFamily: 'Plus Jakarta Sans',
              lineHeight: '18px'
            }}>
              I can find that across your files.
            </div>
          </div>
        </div>

        {/* User Bubble 1 - Lawyer (Right) - Dark pill */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#111827',
            borderRadius: 999,
            padding: '8px 16px',
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
              Which clauses mention penalties in the Acme contract?
            </div>
          </div>
        </div>

        {/* User Bubble 2 - Finance (Right) - Dark pill */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#111827',
            borderRadius: 999,
            padding: '8px 16px',
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
              What was the consolidated EBITDA in 2023?
            </div>
          </div>
        </div>

        {/* User Bubble 3 - Engineering (Right) - Dark pill */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#111827',
            borderRadius: 999,
            padding: '8px 16px',
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
              Where does 'basement B2' appear in the drawings?
            </div>
          </div>
        </div>
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
          <span>
            Upload your contracts, pitchbooks, spreadsheets and CAD drawings once<br />
            (DOCX, PDF, XLSX, PPTX, DWG…).
          </span>
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
          <span>Ask me like you would ask a colleague — in natural language.</span>
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
          <span>I find clauses, numbers and passages across all your files in seconds.</span>
        </div>
      </div>
    </div>
  );
};

export default Slide1;
