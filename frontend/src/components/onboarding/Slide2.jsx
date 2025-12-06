import React from 'react';

/**
 * Slide 2: See your work organized into Categories - Refined
 *
 * Shows Home screen mockup with:
 * - Top bar (Welcome message + Search + Upload button)
 * - 5 fixed-width category chips (108px × 60px)
 * - Recently added files list (5 rows)
 * Updated specs: 520px max-width, 220px height, proper spacing
 */
const Slide2 = () => {
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
        STEP 2 OF 3
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
        See your work organized into Categories.
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
        I group your files by clients, projects and themes — so everything lives in one place.
      </div>

      {/* Grey Home Mock Card */}
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
        overflow: 'hidden'
      }}>
        {/* Top Bar */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: 14,
          padding: '10px 12px',
          height: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: '600',
            color: '#111827',
            fontFamily: 'Plus Jakarta Sans'
          }}>
            Welcome back, Alvaro!
          </div>
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center'
          }}>
            {/* Search Input */}
            <div style={{
              background: '#F9FAFB',
              borderRadius: 8,
              padding: '4px 8px',
              fontSize: 10,
              color: '#9CA3AF',
              fontFamily: 'Plus Jakarta Sans',
              border: '1px solid #E5E7EB',
              minWidth: 80
            }}>
              Search...
            </div>
            {/* Upload Button */}
            <div style={{
              background: '#111827',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 10,
              color: '#FFFFFF',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}>
              Upload document
            </div>
          </div>
        </div>

        {/* Categories Row (5 fixed-width chips) */}
        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 2
        }}>
          {[
            { title: 'Clients – Contracts', files: '24 files' },
            { title: 'Financial Reports 2025', files: '18 files' },
            { title: 'Engineering Projects – Line 4', files: '32 files' },
            { title: 'Tax & Compliance', files: '11 files' },
            { title: 'Personal Documents', files: '7 files' }
          ].map((category, index) => (
            <div key={index} style={{
              minWidth: 108,
              width: 108,
              height: 60,
              background: '#FFFFFF',
              borderRadius: 16,
              padding: '10px 12px',
              border: '1px solid #E5E7EB',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: '600',
                color: '#111827',
                fontFamily: 'Plus Jakarta Sans',
                lineHeight: '13px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {category.title}
              </div>
              <div style={{
                fontSize: 9,
                color: '#6B7280',
                fontFamily: 'Plus Jakarta Sans'
              }}>
                {category.files}
              </div>
            </div>
          ))}
        </div>

        {/* Recently Added Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: '600',
            color: '#111827',
            fontFamily: 'Plus Jakarta Sans',
            marginBottom: 2
          }}>
            Recently added
          </div>
          {[
            { name: 'Contrato_Almeida_Assessoria_FINAL.pdf', time: 'Today · 2:32 PM', isFirst: true },
            { name: 'Relatório_Fundos_Q3_2025.xlsx', time: 'Today · 10:05 AM', isFirst: false },
            { name: 'Petição_Embargos_Linha_Amarela.pdf', time: 'Yesterday · 6:17 PM', isFirst: false },
            { name: 'Planta_Pavimento_B2_Rev03.pdf', time: 'Yesterday · 9:41 AM', isFirst: false },
            { name: 'Ata_Reunião_Conselho_10_11_25.docx', time: '2 days ago · 4:03 PM', isFirst: false }
          ].map((file, index) => (
            <div key={index} style={{
              background: file.isFirst ? '#F9FAFB' : '#FFFFFF',
              borderRadius: 6,
              padding: '4px 8px',
              border: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8
            }}>
              <div style={{
                fontSize: 9,
                color: '#111827',
                fontFamily: 'Plus Jakarta Sans',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {file.name}
              </div>
              <div style={{
                fontSize: 8,
                color: '#9CA3AF',
                fontFamily: 'Plus Jakarta Sans',
                whiteSpace: 'nowrap'
              }}>
                {file.time}
              </div>
            </div>
          ))}
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
          <span>Create Categories like "Clients – Contracts" or "Engineering Projects – Line 4".</span>
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
          <span>See what came in last under "Recently added".</span>
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
          <span>Click any line to open the file and ask me about it.</span>
        </div>
      </div>
    </div>
  );
};

export default Slide2;
