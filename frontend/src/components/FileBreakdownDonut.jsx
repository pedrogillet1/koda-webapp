import React, { useState } from 'react';
import { useDocuments } from '../context/DocumentsContext';

// Import file type icons
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import xlsIcon from '../assets/xls.png';
import pptxIcon from '../assets/pptx.png';
import txtIcon from '../assets/txt-icon.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import movIcon from '../assets/mov.png';
import mp4Icon from '../assets/mp4.png';

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

  // Icon positioning data for the overlapping grid
  const iconPositions = [
    {
      type: 'pdf',
      icon: pdfIcon,
      size: 60,
      top: 10,
      left: 20,
      zIndex: 3,
      rotation: -15,
      label: 'PDF'
    },
    {
      type: 'jpg',
      icon: jpgIcon,
      size: 90,
      top: 0,
      left: 140,
      zIndex: 5,
      rotation: 5,
      label: 'JPG'
    },
    {
      type: 'docx',
      icon: docIcon,
      size: 55,
      top: 15,
      left: 270,
      zIndex: 3,
      rotation: 12,
      label: 'DOCX'
    },
    {
      type: 'txt',
      icon: txtIcon,
      size: 45,
      top: 90,
      left: 50,
      zIndex: 2,
      rotation: -8,
      label: 'TXT'
    },
    {
      type: 'png',
      icon: pngIcon,
      size: 80,
      top: 70,
      left: 145,
      zIndex: 4,
      rotation: -3,
      label: 'PNG'
    },
    {
      type: 'mov',
      icon: movIcon,
      size: 50,
      top: 85,
      left: 260,
      zIndex: 2,
      rotation: 10,
      label: 'MOV'
    },
    {
      type: 'xlsx',
      icon: xlsIcon,
      size: 48,
      top: 160,
      left: 80,
      zIndex: 1,
      rotation: -5,
      label: 'XLSX'
    },
    {
      type: 'mp4',
      icon: mp4Icon,
      size: 52,
      top: 155,
      left: 170,
      zIndex: 1,
      rotation: 3,
      label: 'MP4'
    },
    {
      type: 'pptx',
      icon: pptxIcon,
      size: 46,
      top: 165,
      left: 255,
      zIndex: 1,
      rotation: 8,
      label: 'PPTX'
    }
  ];

  // Filter to only show icons for file types that exist in documents
  const activeIconPositions = iconPositions.filter(icon => {
    return extensionBreakdown[icon.type] && extensionBreakdown[icon.type].count > 0;
  });

  // If no files, show all icons dimmed
  const iconsToShow = activeIconPositions.length > 0 ? activeIconPositions : iconPositions;

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

      {/* Icon Grid Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        gap: '24px'
      }}>
        {/* Overlapping Icon Grid */}
        <div style={{
          position: 'relative',
          width: 360,
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Icon Grid */}
          <div style={{
            position: 'relative',
            width: 340,
            height: 220
          }}>
            {iconsToShow.map((icon) => {
              const fileCount = extensionBreakdown[icon.type]?.count || 0;
              const hasFiles = fileCount > 0;

              return (
                <div
                  key={icon.type}
                  style={{
                    position: 'absolute',
                    top: `${icon.top}px`,
                    left: `${icon.left}px`,
                    width: `${icon.size}px`,
                    height: `${icon.size}px`,
                    zIndex: hoveredIcon && hoveredIcon !== icon.type ? 1 : (hoveredIcon === icon.type ? 10 : icon.zIndex),
                    opacity: !hasFiles ? 0.3 : (hoveredIcon && hoveredIcon !== icon.type ? 0.5 : 1),
                    transform: hoveredIcon === icon.type
                      ? `scale(1.2) rotate(0deg)`
                      : `scale(1) rotate(${icon.rotation}deg)`,
                    transition: 'all 0.3s ease-out',
                    cursor: hasFiles ? 'pointer' : 'default',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'white',
                    boxShadow: hoveredIcon === icon.type
                      ? '0 12px 24px rgba(0,0,0,0.2)'
                      : '0 4px 12px rgba(0,0,0,0.08)'
                  }}
                  onMouseEnter={() => hasFiles && setHoveredIcon(icon.type)}
                  onMouseLeave={() => setHoveredIcon(null)}
                  title={hasFiles ? `${icon.label}: ${fileCount} files` : icon.label}
                >
                  <img
                    src={icon.icon}
                    alt={icon.label}
                    style={{
                      width: '70%',
                      height: '70%',
                      objectFit: 'contain',
                      pointerEvents: 'none'
                    }}
                  />

                  {/* File count badge */}
                  {hasFiles && (
                    <div style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      background: '#32302C',
                      color: 'white',
                      fontSize: '10px',
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      minWidth: '18px',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {fileCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Center Total Label */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            pointerEvents: 'none',
            background: 'rgba(255,255,255,0.9)',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              color: '#32302C',
              fontSize: '28px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              lineHeight: '32px'
            }}>
              {totalFiles}
            </div>
            <div style={{
              color: '#6C6B6E',
              fontSize: '12px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '16px'
            }}>
              Total Files
            </div>
          </div>
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

          {/* Progress bar based on file count */}
          <div style={{
            width: '100%',
            height: '10px',
            background: '#E6E6EC',
            borderRadius: '5px',
            overflow: 'hidden',
            display: 'flex'
          }}>
            {/* Color segments for each file type */}
            {iconPositions.map((icon, index) => {
              const count = extensionBreakdown[icon.type]?.count || 0;
              const widthPercent = totalCount > 0 ? (count / totalCount) * 100 : 0;
              if (widthPercent === 0) return null;

              // Color mapping for each file type
              const colorMap = {
                'pdf': '#DC2626',
                'jpg': '#06B6D4',
                'docx': '#2563EB',
                'txt': '#6B7280',
                'png': '#22C55E',
                'mov': '#3B82F6',
                'xlsx': '#16A34A',
                'mp4': '#A855F7',
                'pptx': '#F97316',
                'other': '#9CA3AF'
              };

              return (
                <div
                  key={icon.type}
                  style={{
                    width: `${widthPercent}%`,
                    height: '100%',
                    background: colorMap[icon.type] || '#9CA3AF',
                    transition: 'width 0.3s ease'
                  }}
                  onMouseEnter={() => setHoveredIcon(icon.type)}
                  onMouseLeave={() => setHoveredIcon(null)}
                />
              );
            })}
          </div>
        </div>

        {/* Legend - File types with counts */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px 20px',
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: '8px'
        }}>
          {iconPositions.map((icon) => {
            const count = extensionBreakdown[icon.type]?.count || 0;
            if (count === 0) return null;

            return (
              <div
                key={icon.type}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  opacity: hoveredIcon === null || hoveredIcon === icon.type ? 1 : 0.4,
                  transition: 'all 0.2s ease',
                  borderRadius: '8px',
                  background: hoveredIcon === icon.type ? '#F5F5F5' : 'transparent'
                }}
                onMouseEnter={() => setHoveredIcon(icon.type)}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <img
                  src={icon.icon}
                  alt={icon.label}
                  style={{
                    width: 24,
                    height: 24,
                    objectFit: 'contain'
                  }}
                />
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px'
                }}>
                  <div style={{
                    color: '#32302C',
                    fontSize: '12px',
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '1.2'
                  }}>
                    {icon.label}
                  </div>
                  <div style={{
                    color: '#6C6B6E',
                    fontSize: '10px',
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
                    lineHeight: '1.2'
                  }}>
                    {count} {count === 1 ? 'File' : 'Files'}
                  </div>
                </div>
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
