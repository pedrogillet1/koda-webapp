import React from 'react';
import laptopMockup from '../../assets/laptop-mockup.svg';
import question1 from '../../assets/question1.svg';
import answer1 from '../../assets/answer1.svg';
import question2 from '../../assets/question2.svg';
import answer2 from '../../assets/answer2.svg';
import question3 from '../../assets/question3.svg';
import answer3 from '../../assets/answer3.svg';

/**
 * Slide 1: Organizing documents isn't your job. It's mine. - Refined
 *
 * Shows chat-style illustration with SVG images
 */
const Slide1 = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      {/* Micro Label */}
      <div style={{
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
        fontFamily: 'Plus Jakarta Sans',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 2
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

      {/* Chat Composition: MacBook + 3 Cylinder Zoom Lenses */}
      <div style={{
        width: '100%',
        maxWidth: 760,
        margin: '0 auto',
        position: 'relative',
        minHeight: 360,
        maxHeight: 360,
        marginTop: -10
      }}>
        {/* MacBook - No longer dimmed */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          transform: 'translate(-50%, -50%)',
          width: '36%',
          maxWidth: 270,
          zIndex: 1
        }}>
          <img
            src={laptopMockup}
            alt="Laptop showing chat interface"
            style={{
              width: '100%',
              height: 'auto',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.04))'
            }}
          />
        </div>

        {/* Lens A (TOP LEFT) - Engineering: Q3 + A3 (Basement B2) */}
        <div style={{
          position: 'absolute',
          top: 35,
          left: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10
        }}>
          {/* Q3 */}
          <div style={{ width: 340 }}>
            <img
              src={question3}
              alt="Where does 'basement B2' appear in the drawings?"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16))'
              }}
            />
          </div>

          {/* A3 */}
          <div style={{ width: 440 }}>
            <img
              src={answer3}
              alt="B2 answer"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.13)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.09))',
                transform: 'perspective(1000px) rotateY(-1deg)',
                transformStyle: 'preserve-3d'
              }}
            />
          </div>
        </div>

        {/* Lens B (MIDDLE RIGHT) - Finance: Q2 + A2 (EBITDA) */}
        <div style={{
          position: 'absolute',
          top: 55,
          right: -60,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10
        }}>
          {/* Q2 */}
          <div style={{ width: 330 }}>
            <img
              src={question2}
              alt="What was the consolidated EBITDA in 2023?"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16))'
              }}
            />
          </div>

          {/* A2 */}
          <div style={{ width: 450 }}>
            <img
              src={answer2}
              alt="EBITDA answer"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.13)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.09))',
                transform: 'perspective(1000px) rotateY(-1deg)',
                transformStyle: 'preserve-3d'
              }}
            />
          </div>
        </div>

        {/* Lens C (BOTTOM LEFT) - Legal: Q1 + A1 (Acme penalties) */}
        <div style={{
          position: 'absolute',
          top: 180,
          left: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10
        }}>
          {/* Q1 */}
          <div style={{ width: 335 }}>
            <img
              src={question1}
              alt="Which clauses mention penalties in the Acme contract?"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16))'
              }}
            />
          </div>

          {/* A1 */}
          <div style={{ width: 455 }}>
            <img
              src={answer1}
              alt="Penalties answer"
              style={{
                width: '100%',
                height: 'auto',
                filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.13)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.09))',
                transform: 'perspective(1000px) rotateY(-1deg)',
                transformStyle: 'preserve-3d'
              }}
            />
          </div>
        </div>
      </div>

      {/* Bullets */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginTop: 16
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: '400',
          color: '#111827',
          fontFamily: 'Plus Jakarta Sans',
          lineHeight: '20px',
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
          lineHeight: '20px',
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
          lineHeight: '20px',
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
