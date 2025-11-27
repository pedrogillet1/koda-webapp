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
  const [hoveredSegment, setHoveredSegment] = useState(null);

  // Get file extension from document
  const getFileExtension = (doc) => {
    const filename = doc.filename || doc.name || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return ext;
  };

  // Normalize extension - group uncommon types under 'other'
  const normalizeExtension = (ext) => {
    // Main file types to show individually
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

    // Return main type or 'other' for everything else
    return mainTypes[ext] || 'other';
  };

  // Get icon for file type
  const getFileIcon = (ext) => {
    const iconMap = {
      'pdf': pdfIcon,
      'docx': docIcon,
      'xlsx': xlsIcon,
      'pptx': pptxIcon,
      'jpg': jpgIcon,
      'png': pngIcon,
      'mov': movIcon,
      'mp4': mp4Icon,
      'other': txtIcon,
    };
    return iconMap[ext] || txtIcon;
  };

  // Get display name for file type
  const getDisplayName = (ext) => {
    const nameMap = {
      'pdf': 'PDF',
      'docx': 'DOCX',
      'xlsx': 'XLSX',
      'pptx': 'PPTX',
      'jpg': 'JPG',
      'png': 'PNG',
      'mov': 'MOV',
      'mp4': 'MP4',
      'other': 'Other',
    };
    return nameMap[ext] || 'Other';
  };

  // Group documents by file extension
  const extensionBreakdown = {};
  let totalSize = 0;
  let totalCount = 0;

  documents.forEach(doc => {
    const ext = getFileExtension(doc);
    const normalizedExt = normalizeExtension(ext);

    if (!extensionBreakdown[normalizedExt]) {
      extensionBreakdown[normalizedExt] = { count: 0, size: 0, originalExt: ext };
    }

    extensionBreakdown[normalizedExt].count++;
    extensionBreakdown[normalizedExt].size += doc.size || doc.fileSize || 0;
    totalSize += doc.size || doc.fileSize || 0;
    totalCount++;
  });

  // Color palette mapped to file types (matches icon colors)
  const fileTypeColors = {
    'png': '#4CAF50',   // Green - PNG icon color
    'jpg': '#2196F3',   // Blue - JPG icon color
    'pdf': '#F44336',   // Red - PDF icon color
    'docx': '#1565C0',  // Dark Blue - DOCX icon color
    'xlsx': '#4CAF50',  // Green - XLSX icon color
    'pptx': '#FF5722',  // Orange-Red - PPTX icon color
    'mov': '#9C27B0',   // Purple - MOV icon color
    'mp4': '#E91E63',   // Pink - MP4 icon color
    'other': '#9E9E9E', // Grey - Other files
  };

  // Sort extensions by count (largest first)
  const sortedExtensions = Object.keys(extensionBreakdown)
    .filter(ext => extensionBreakdown[ext].count > 0)
    .sort((a, b) => extensionBreakdown[b].count - extensionBreakdown[a].count);

  // Calculate donut segments based on COUNT for accurate proportions
  let currentAngle = -90; // Start at 12 o'clock (top)
  const donutSegments = sortedExtensions.map((ext, index) => {
    const count = extensionBreakdown[ext].count;
    const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
    const angleSpan = (percentage / 100) * 360;
    const gapAngle = sortedExtensions.length > 1 ? 2 : 0; // Small gap between segments

    const segment = {
      ext,
      displayName: getDisplayName(ext),
      count: count,
      size: extensionBreakdown[ext].size,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angleSpan - gapAngle,
      color: fileTypeColors[ext] || '#9E9E9E'
    };
    currentAngle += angleSpan;
    return segment;
  });

  // SVG arc path helper - smooth arcs like Storage donut
  const createArcPath = (startAngle, endAngle, innerRadius, outerRadius, cx, cy) => {
    if (endAngle - startAngle <= 0) return '';

    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
      const angleInRadians = angleInDegrees * Math.PI / 180.0;
      return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
      };
    };

    const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
    const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);

    const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;

    const d = [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
      'Z'
    ].join(' ');

    return d;
  };

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const totalFiles = documents.length;

  // Chart dimensions - thinner ring like Storage donut
  const chartSize = 200;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const outerRadius = 90;
  const innerRadius = 60;

  // Always use 3 columns for consistent layout
  const gridColumns = 3;

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
      {/* Header - matches Your Files header */}
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

      {/* Chart and Legend Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        gap: '20px'
      }}>
        {/* Donut Chart */}
        <div style={{
          position: 'relative',
          width: chartSize,
          height: chartSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
            {donutSegments.length > 0 ? (
              donutSegments.map((segment, index) => (
                <path
                  key={index}
                  d={createArcPath(segment.startAngle, segment.endAngle, innerRadius, outerRadius, cx, cy)}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="2"
                  opacity={hoveredSegment === null || hoveredSegment === index ? 1 : 0.4}
                  style={{
                    transition: 'opacity 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredSegment(index)}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              ))
            ) : (
              // Empty state - full gray ring
              <circle
                cx={cx}
                cy={cy}
                r={(outerRadius + innerRadius) / 2}
                fill="none"
                stroke="#E6E6EC"
                strokeWidth={outerRadius - innerRadius}
              />
            )}
          </svg>

          {/* Center Label */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            pointerEvents: 'none'
          }}>
            <div style={{
              color: '#32302C',
              fontSize: '24px',
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
              Files
            </div>
          </div>
        </div>

        {/* Storage Bar */}
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
              Storage
            </div>
            <div style={{
              color: '#6C6B6E',
              fontSize: '14px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '20px'
            }}>
              {formatSize(totalSize)} of 2 TB Used
            </div>
          </div>
          {/* Progress bar */}
          <div style={{
            width: '100%',
            height: '10px',
            background: '#E6E6EC',
            borderRadius: '5px',
            overflow: 'hidden',
            display: 'flex'
          }}>
            {donutSegments.map((segment, index) => {
              const widthPercent = totalSize > 0 ? (segment.size / totalSize) * 100 : 0;
              const isFirst = index === 0;
              const isLast = index === donutSegments.length - 1;
              return (
                <div
                  key={index}
                  style={{
                    width: `${widthPercent}%`,
                    height: '100%',
                    background: segment.color,
                    transition: 'width 0.3s ease',
                    borderTopLeftRadius: isFirst ? '5px' : '0',
                    borderBottomLeftRadius: isFirst ? '5px' : '0',
                    borderTopRightRadius: isLast ? '5px' : '0',
                    borderBottomRightRadius: isLast ? '5px' : '0'
                  }}
                  onMouseEnter={() => setHoveredSegment(donutSegments.findIndex(s => s.ext === segment.ext))}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              );
            })}
          </div>
        </div>

        {/* Legend - Clean 3-column grid on card background */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px 32px',
          width: '100%',
          boxSizing: 'border-box',
          paddingTop: '8px'
        }}>
          {donutSegments.map((segment, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                cursor: 'pointer',
                opacity: hoveredSegment === null || hoveredSegment === index ? 1 : 0.4,
                transition: 'all 0.2s ease',
                borderRadius: '10px',
                background: hoveredSegment === index ? '#F5F5F5' : 'transparent'
              }}
              onMouseEnter={() => setHoveredSegment(index)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* Color indicator dot matching donut/bar color */}
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: segment.color,
                flexShrink: 0
              }} />

              {/* File type icon */}
              <img
                src={getFileIcon(segment.ext)}
                alt={segment.displayName}
                style={{
                  width: 28,
                  height: 28,
                  objectFit: 'contain',
                  flexShrink: 0
                }}
              />

              {/* Text content */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                minWidth: 0
              }}>
                <div style={{
                  color: '#32302C',
                  fontSize: '14px',
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  lineHeight: '1.2'
                }}>
                  {segment.displayName}
                </div>
                <div style={{
                  color: '#6C6B6E',
                  fontSize: '12px',
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '1.2'
                }}>
                  {segment.count} {segment.count === 1 ? 'File' : 'Files'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Encryption Message - at bottom with divider */}
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
