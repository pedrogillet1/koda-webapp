import React, { useState } from 'react';
import { useDocuments } from '../context/DocumentsContext';

const FileBreakdownDonut = ({ showEncryptionMessage = true, style = {} }) => {
  const { documents } = useDocuments();
  const [hoveredIcon, setHoveredIcon] = useState(null);

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
      'txt': 'txt',
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

  // Unified color system - exact hex values from icon backgrounds (single source of truth)
  const colorMap = {
    'png': '#22C55E',   // Bright Green - matches PNG icon
    'jpg': '#16A34A',   // Forest Green - matches JPG icon
    'pdf': '#8B0000',   // Dark Red - matches PDF icon
    'docx': '#2563EB',  // Blue - matches DOC icon
    'xlsx': '#10B981',  // Teal Green - matches XLS icon
    'pptx': '#DC2626',  // Red - matches PPTX icon
    'mov': '#3B82F6',   // Light Blue - matches MOV icon
    'mp4': '#A855F7',   // Purple - matches MP4 icon
    'txt': '#6B7280',   // Gray - matches TXT icon
    'other': '#6B7280'  // Gray - Other files
  };

  // Psychology-based balanced pyramid layout
  // Layer 1: Hero Elements (Top Center) - Most common file types
  // Layer 2: Primary Elements (Middle) - Important file types
  // Layer 3: Secondary Elements (Lower) - Less common
  // Layer 4: Tertiary Elements (Bottom) - Rare file types

  const iconPositions = [
    // Layer 1: Hero Elements (Top Center)
    {
      type: 'png',
      label: 'PNG',
      size: 100,
      top: 0,
      left: 120,
      zIndex: 5,
      rotation: 0,
      fontSize: 24
    },
    {
      type: 'jpg',
      label: 'JPG',
      size: 90,
      top: 20,
      left: 250,
      zIndex: 4,
      rotation: 5,
      fontSize: 20
    },
    // Layer 2: Primary Elements (Middle)
    {
      type: 'pdf',
      label: 'PDF',
      size: 70,
      top: 110,
      left: 30,
      zIndex: 3,
      rotation: -8,
      fontSize: 14
    },
    {
      type: 'docx',
      label: 'DOC',
      size: 70,
      top: 110,
      left: 300,
      zIndex: 3,
      rotation: 8,
      fontSize: 14
    },
    // Layer 3: Secondary Elements (Lower)
    {
      type: 'mov',
      label: 'MOV',
      size: 55,
      top: 190,
      left: 70,
      zIndex: 2,
      rotation: -5,
      fontSize: 11
    },
    {
      type: 'xlsx',
      label: 'XLS',
      size: 55,
      top: 190,
      left: 180,
      zIndex: 2,
      rotation: 0,
      fontSize: 11
    },
    {
      type: 'mp4',
      label: 'MP4',
      size: 55,
      top: 190,
      left: 290,
      zIndex: 2,
      rotation: 5,
      fontSize: 11
    },
    // Layer 4: Tertiary Elements (Bottom Corners)
    {
      type: 'pptx',
      label: 'PPT',
      size: 45,
      top: 255,
      left: 50,
      zIndex: 1,
      rotation: -10,
      fontSize: 9
    },
    {
      type: 'txt',
      label: 'TXT',
      size: 45,
      top: 255,
      left: 310,
      zIndex: 1,
      rotation: 10,
      fontSize: 9
    }
  ];

  // Get border radius based on size
  const getBorderRadius = (size) => {
    if (size >= 90) return 12;
    if (size >= 70) return 10;
    if (size >= 55) return 8;
    return 6;
  };

  return (
    <div style={{
      padding: '24px',
      background: 'white',
      borderRadius: '14px',
      border: '1px solid #E6E6EC',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      boxSizing: 'border-box',
      ...style
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
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

      {/* Psychology-Based Icon Grid Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        gap: '20px'
      }}>
        {/* Balanced Pyramid Icon Grid */}
        <div style={{
          position: 'relative',
          width: 400,
          height: 320,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {iconPositions.map((icon) => {
            const fileCount = extensionBreakdown[icon.type]?.count || 0;
            const hasFiles = fileCount > 0;
            const isHovered = hoveredIcon === icon.type;
            const otherIsHovered = hoveredIcon !== null && hoveredIcon !== icon.type;

            return (
              <div
                key={icon.type}
                onMouseEnter={() => hasFiles && setHoveredIcon(icon.type)}
                onMouseLeave={() => setHoveredIcon(null)}
                style={{
                  position: 'absolute',
                  top: icon.top,
                  left: icon.left,
                  width: icon.size,
                  height: icon.size,
                  background: colorMap[icon.type] || '#8C919E',
                  borderRadius: getBorderRadius(icon.size),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: hasFiles ? 'pointer' : 'default',
                  transition: 'all 0.25s ease-out',
                  zIndex: isHovered ? 10 : icon.zIndex,
                  opacity: !hasFiles ? 0.3 : (otherIsHovered ? 0.4 : 1),
                  transform: isHovered
                    ? 'scale(1.2) rotate(0deg)'
                    : `scale(1) rotate(${icon.rotation}deg)`,
                  boxShadow: isHovered
                    ? '0 12px 24px rgba(0, 0, 0, 0.15)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08)'
                }}
                title={hasFiles ? `${icon.label}: ${fileCount} files` : icon.label}
              >
                <div style={{
                  color: 'white',
                  fontSize: icon.fontSize,
                  fontWeight: '700',
                  fontFamily: 'Plus Jakarta Sans',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}>
                  {icon.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* File Count Bar */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              color: '#32302C',
              fontSize: '14px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              lineHeight: '20px'
            }}>
              Files
            </div>
            <div style={{
              color: '#6C6B6E',
              fontSize: '14px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '20px'
            }}>
              {totalFiles} Files
            </div>
          </div>

          {/* Progress bar based on file count - muted colors at 80% opacity */}
          <div style={{
            width: '100%',
            height: '10px',
            background: '#F3F3F5',
            borderRadius: '5px',
            overflow: 'hidden',
            display: 'flex'
          }}>
            {iconPositions.map((icon) => {
              const count = extensionBreakdown[icon.type]?.count || 0;
              const widthPercent = totalCount > 0 ? (count / totalCount) * 100 : 0;
              if (widthPercent === 0) return null;

              // Convert hex to rgba with 80% opacity
              const hexToRgba = (hex) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, 0.8)`;
              };

              return (
                <div
                  key={icon.type}
                  style={{
                    width: `${widthPercent}%`,
                    height: '100%',
                    background: hexToRgba(colorMap[icon.type] || '#8C919E'),
                    transition: 'width 0.3s ease'
                  }}
                  onMouseEnter={() => setHoveredIcon(icon.type)}
                  onMouseLeave={() => setHoveredIcon(null)}
                />
              );
            })}
          </div>
        </div>

        {/* Horizontal Legend - Psychology: Natural reading direction */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '8px 16px',
          padding: '12px 0',
          fontSize: '12px',
          fontFamily: 'Plus Jakarta Sans',
          color: '#6C6B6E',
          borderTop: '1px solid #E6E6EC',
          width: '100%'
        }}>
          {iconPositions.map((icon) => {
            const count = extensionBreakdown[icon.type]?.count || 0;
            if (count === 0) return null;

            const isHovered = hoveredIcon === icon.type;

            return (
              <div
                key={icon.type}
                style={{
                  cursor: 'pointer',
                  opacity: hoveredIcon === null || isHovered ? 1 : 0.5,
                  transition: 'opacity 0.2s ease',
                  fontWeight: isHovered ? '600' : '500',
                  color: isHovered ? '#32302C' : '#6C6B6E'
                }}
                onMouseEnter={() => setHoveredIcon(icon.type)}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                {icon.label} ({count})
              </div>
            );
          })}
        </div>
      </div>

      {/* Encryption Message */}
      {showEncryptionMessage && (
        <>
          <div style={{
            height: '1px',
            background: '#E6E6EC',
            marginTop: '16px',
            marginBottom: '12px'
          }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#6C6B6E',
            fontSize: '12px',
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '400',
            lineHeight: '18px'
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M7 1.16667L2.33333 3.5V6.41667C2.33333 9.625 4.34 12.5883 7 13.4167C9.66 12.5883 11.6667 9.625 11.6667 6.41667V3.5L7 1.16667Z" stroke="#6C6B6E" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.25 7L6.41667 8.16667L8.75 5.83333" stroke="#6C6B6E" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Your workspace is encrypted. All documents are private and secure.
          </div>
        </>
      )}
    </div>
  );
};

export default FileBreakdownDonut;
