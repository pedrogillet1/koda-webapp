import React, { useState } from 'react';
import { useDocuments } from '../context/DocumentsContext';
import { useIsMobile } from '../hooks/useIsMobile';

// Import actual Koda file type icons
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import xlsIcon from '../assets/xls.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import pptxIcon from '../assets/pptx.png';
import movIcon from '../assets/mov.png';
import mp4Icon from '../assets/mp4.png';

const FileBreakdownDonut = ({ showEncryptionMessage = true, compact = false, semicircle = false, style = {} }) => {
  const { documents } = useDocuments();
  const [hoveredType, setHoveredType] = useState(null);
  const isMobile = useIsMobile();

  // Get file extension from document
  const getFileExtension = (doc) => {
    const filename = doc.filename || doc.name || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ext;
  };

  // Normalize extension - group uncommon types under 'other'
  const normalizeExtension = (ext) => {
    const mainTypes = {
      'pdf': 'pdf',
      'docx': 'docx',
      'doc': 'docx',
      'xlsx': 'xlsx',
      'xls': 'xlsx',
      'pptx': 'pptx',
      'ppt': 'pptx',
      'png': 'png',
      'jpg': 'jpg',
      'jpeg': 'jpg',
      'mov': 'mov',
      'mp4': 'mp4',
    };
    return mainTypes[ext] || 'other';
  };

  // Group documents by file extension
  const extensionBreakdown = {};
  let totalCount = 0;

  documents.forEach(doc => {
    const ext = getFileExtension(doc);
    const normalizedExt = normalizeExtension(ext);

    if (!extensionBreakdown[normalizedExt]) {
      extensionBreakdown[normalizedExt] = { count: 0 };
    }

    extensionBreakdown[normalizedExt].count++;
    totalCount++;
  });

  const totalFiles = documents.length;

  // Unified color system - exact hex values from icon backgrounds
  const colorMap = {
    'png': '#22C55E',   // Bright Green
    'jpg': '#16A34A',   // Forest Green
    'pdf': '#8B0000',   // Dark Red
    'docx': '#2563EB',  // Blue
    'xlsx': '#10B981',  // Teal Green
    'pptx': '#DC2626',  // Red
    'mov': '#3B82F6',   // Light Blue
    'mp4': '#A855F7',   // Purple
    'other': '#6B7280'  // Gray
  };

  // V2: 2×4 grid (8 items) - TXT/Other omitted for cleaner layout
  // Row 1: PNG, JPG, PDF, DOC
  // Row 2: MOV, XLS, MP4, PPTX
  const gridData = [
    { type: 'png', label: 'PNG', icon: pngIcon, color: colorMap['png'] },
    { type: 'jpg', label: 'JPG', icon: jpgIcon, color: colorMap['jpg'] },
    { type: 'pdf', label: 'PDF', icon: pdfIcon, color: colorMap['pdf'] },
    { type: 'docx', label: 'DOC', icon: docIcon, color: colorMap['docx'] },
    { type: 'mov', label: 'MOV', icon: movIcon, color: colorMap['mov'] },
    { type: 'xlsx', label: 'XLS', icon: xlsIcon, color: colorMap['xlsx'] },
    { type: 'mp4', label: 'MP4', icon: mp4Icon, color: colorMap['mp4'] },
    { type: 'pptx', label: 'PPTX', icon: pptxIcon, color: colorMap['pptx'] }
  ];

  // Filter to only show file types that exist in documents
  const activeGridData = gridData.filter(item => {
    const count = extensionBreakdown[item.type]?.count || 0;
    return count > 0;
  });

  // Use active data if files exist, otherwise show all (dimmed)
  const displayData = activeGridData.length > 0 ? activeGridData : gridData;

  return (
    <div style={{
      padding: compact ? '16px' : '24px',
      background: 'white',
      borderRadius: isMobile ? '14px' : '20px',
      border: '2px solid #E6E6EC',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      boxSizing: 'border-box',
      height: '100%',
      ...style
    }}>
      {/* Header - V3: Reduced bottom margin */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: compact ? '4px' : '8px'
      }}>
        <div style={{
          color: '#32302C',
          fontSize: '18px',
          fontFamily: 'Plus Jakarta Sans',
          fontWeight: '700',
          lineHeight: '26px'
        }}>
          File Breakdown
        </div>
      </div>

      {/* V3: Icon Grid with Soft Halo + Bar Animation */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center'
      }}>
        {/* Icon Layout - Semicircle or Grid */}
        {semicircle ? (
          /* Single Row Layout - All icons in one row */
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            marginTop: 16,
            marginBottom: 16,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingLeft: '2%',
            paddingRight: '2%'
          }}>
            {displayData.map((item) => {
              const fileCount = extensionBreakdown[item.type]?.count || 0;
              const hasFiles = fileCount > 0;
              const isHovered = hoveredType === item.type;
              const otherIsHovered = hoveredType !== null && hoveredType !== item.type;

              return (
                <div
                  key={item.type}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: !hasFiles ? 0.3 : (otherIsHovered ? 0.5 : 1),
                    transition: 'opacity 0.2s ease-out, transform 0.15s ease',
                    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    cursor: hasFiles ? 'pointer' : 'default'
                  }}
                  onMouseEnter={() => hasFiles && setHoveredType(item.type)}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img
                      src={item.icon}
                      alt={item.label}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#32302C',
                    fontFamily: 'Plus Jakarta Sans',
                    textAlign: 'center'
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    color: '#6C6B6E',
                    fontFamily: 'Plus Jakarta Sans'
                  }}>
                    {fileCount}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Grid Layout - 8×1 single row on desktop, 3 columns on mobile */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : (compact ? 'repeat(8, 48px)' : 'repeat(8, 72px)'),
            gap: isMobile ? '16px 12px' : (compact ? '0 24px' : '0 48px'),
            marginTop: compact ? '4px' : '8px',
            marginBottom: compact ? '12px' : '24px',
            justifyContent: 'center',
            width: isMobile ? '100%' : 'auto'
          }}>
            {displayData.map((item) => {
              const fileCount = extensionBreakdown[item.type]?.count || 0;
              const hasFiles = fileCount > 0;
              const isHovered = hoveredType === item.type;
              const otherIsHovered = hoveredType !== null && hoveredType !== item.type;

              return (
                <div
                  key={item.type}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0px',
                    width: isMobile ? 40 : (compact ? 48 : 72),
                    opacity: !hasFiles ? 0.3 : (otherIsHovered ? 0.5 : 1),
                    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
                    cursor: hasFiles ? 'pointer' : 'default'
                  }}
                  onMouseEnter={() => hasFiles && setHoveredType(item.type)}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  {/* Icon Container - tighter fit */}
                  <div
                    style={{
                      width: isMobile ? 40 : (compact ? 48 : 72),
                      height: isMobile ? 40 : (compact ? 48 : 72),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {/* Icon */}
                    <img
                      src={item.icon}
                      alt={item.label}
                      style={{
                        width: isMobile ? 40 : (compact ? 48 : 72),
                        height: isMobile ? 40 : (compact ? 48 : 72),
                        objectFit: 'contain'
                      }}
                    />
                  </div>

                  {/* Labels - tight spacing */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: compact ? '0px' : '2px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: compact ? '11px' : '14px',
                      fontWeight: '500',
                      color: '#32302C',
                      fontFamily: 'Plus Jakarta Sans'
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: compact ? '10px' : '12px',
                      fontWeight: '400',
                      color: '#6C6B6E',
                      fontFamily: 'Plus Jakarta Sans'
                    }}>
                      {fileCount} {fileCount === 1 ? 'File' : 'Files'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Files Bar - V3: Hover animation with segment highlight */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: compact ? '4px' : '8px',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              color: '#32302C',
              fontSize: compact ? '14px' : '16px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              lineHeight: '24px'
            }}>
              Files
            </div>
            <div style={{
              color: '#6C6B6E',
              fontSize: compact ? '14px' : '16px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              lineHeight: '24px'
            }}>
              {totalFiles} Files
            </div>
          </div>

          {/* Progress bar - V3: Animated segments on hover */}
          <div style={{
            width: '100%',
            height: compact ? '12px' : '16px',
            background: '#F3F3F5',
            borderRadius: '100px',
            overflow: 'hidden',
            display: 'flex',
            position: 'relative'
          }}>
            {gridData.map((item) => {
              const count = extensionBreakdown[item.type]?.count || 0;
              const widthPercent = totalCount > 0 ? (count / totalCount) * 100 : 0;
              if (widthPercent === 0) return null;

              const isHovered = hoveredType === item.type;
              const otherIsHovered = hoveredType !== null && hoveredType !== item.type;

              return (
                <div
                  key={item.type}
                  style={{
                    width: `${widthPercent}%`,
                    height: '100%',
                    background: item.color,
                    opacity: isHovered ? 1.0 : (otherIsHovered ? 0.4 : 0.8),
                    transform: isHovered ? 'scaleY(1.3)' : 'scaleY(1)',
                    transformOrigin: 'center',
                    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
                    cursor: 'pointer',
                    borderRadius: '2px'
                  }}
                  onMouseEnter={() => setHoveredType(item.type)}
                  onMouseLeave={() => setHoveredType(null)}
                />
              );
            })}
          </div>
        </div>

        {/* Encryption Message - below Files bar */}
        {showEncryptionMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid #A2A2A7',
            width: '100%'
          }}>
            {/* Shield icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <path
                d="M8 1.33333L2.66667 4V7.33333C2.66667 11 5.2 14.4 8 15.3333C10.8 14.4 13.3333 11 13.3333 7.33333V4L8 1.33333Z"
                stroke="#6C6B6E"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{
              fontSize: 12,
              fontWeight: 400,
              color: '#6C6B6E',
              fontFamily: 'Plus Jakarta Sans',
              lineHeight: 1.5
            }}>
              Your workspace is encrypted. All documents and conversations are private and secure.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileBreakdownDonut;
