import React, { useState } from 'react';
import { useDocuments } from '../context/DocumentsContext';
import { ReactComponent as Document2Icon } from '../assets/Document 2.svg';
import { ReactComponent as ImageIcon } from '../assets/Image.svg';
import { ReactComponent as InfoCircleIcon } from '../assets/Info circle.svg';
import { ReactComponent as SpreadsheetIcon } from '../assets/spreadsheet.svg';

const FileBreakdownDonut = ({ showEncryptionMessage = true, style = {} }) => {
  const { documents } = useDocuments();
  const [hoveredSegment, setHoveredSegment] = useState(null);

  // Data calculation
  const getCategoryForExt = (ext) => {
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pptx', 'ppt'];
    const spreadsheetExts = ['xls', 'xlsx', 'csv', 'ods'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];

    if (docExts.includes(ext)) return 'Document';
    if (spreadsheetExts.includes(ext)) return 'Spreadsheet';
    if (imageExts.includes(ext)) return 'Image';
    return 'Other';
  };

  // Group documents by category
  const categoryBreakdown = {};
  let totalSize = 0;
  let totalCount = 0;

  documents.forEach(doc => {
    const ext = doc.filename?.split('.').pop()?.toLowerCase() || '';
    const category = getCategoryForExt(ext);

    if (!categoryBreakdown[category]) {
      categoryBreakdown[category] = { count: 0, size: 0 };
    }

    categoryBreakdown[category].count++;
    categoryBreakdown[category].size += doc.size || doc.fileSize || 0;
    totalSize += doc.size || doc.fileSize || 0;
    totalCount++;
  });

  // Fixed category order and colors (consistent mapping)
  const categoryConfig = {
    'Document': { color: '#000000', order: 0 },
    'Image': { color: '#32302C', order: 1 },
    'Other': { color: '#6C6B6E', order: 2 },
    'Spreadsheet': { color: '#B8B8B8', order: 3 }
  };

  // Get icon for category
  const getCategoryIcon = (category) => {
    const iconStyle = { width: 20, height: 20 };
    switch (category) {
      case 'Spreadsheet':
        return <SpreadsheetIcon style={iconStyle} />;
      case 'Document':
        return <Document2Icon style={iconStyle} />;
      case 'Image':
        return <ImageIcon style={iconStyle} />;
      default:
        return <InfoCircleIcon style={iconStyle} />;
    }
  };

  // Sort categories by count (largest first), then by defined order
  const sortedCategories = Object.keys(categoryBreakdown)
    .filter(cat => categoryBreakdown[cat].count > 0)
    .sort((a, b) => {
      const countDiff = categoryBreakdown[b].count - categoryBreakdown[a].count;
      if (countDiff !== 0) return countDiff;
      return (categoryConfig[a]?.order || 99) - (categoryConfig[b]?.order || 99);
    });

  // Calculate donut segments based on COUNT (not size) for accurate proportions
  let currentAngle = -90; // Start at 12 o'clock (top)
  const donutSegments = sortedCategories.map((category, index) => {
    const count = categoryBreakdown[category].count;
    const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
    const angleSpan = (percentage / 100) * 360;
    const gapAngle = 2; // Small gap between segments

    const segment = {
      category,
      count: count,
      size: categoryBreakdown[category].size,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angleSpan - gapAngle,
      color: categoryConfig[category]?.color || '#E6E6EC'
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
  const innerRadius = 60; // Thinner ring (was 73/115 ratio, now 60/90)

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

        {/* Legend - 2x2 Grid with icons like original */}
        <div style={{
          padding: '14px',
          background: '#F5F5F5',
          borderRadius: '18px',
          border: '1px solid #E6E6EC',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {donutSegments.map((segment, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '2px 0',
                cursor: 'pointer',
                opacity: hoveredSegment === null || hoveredSegment === index ? 1 : 0.4,
                transition: 'opacity 0.2s ease'
              }}
              onMouseEnter={() => setHoveredSegment(index)}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {/* Icon in white circle */}
              <div style={{
                width: 40,
                height: 40,
                background: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {getCategoryIcon(segment.category)}
              </div>

              {/* Text content */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: 0
              }}>
                <div style={{
                  color: '#32302C',
                  fontSize: '14px',
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  lineHeight: '1.2'
                }}>
                  {segment.category}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    color: '#6C6B6E',
                    fontSize: '14px',
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
                    lineHeight: '1.2'
                  }}>
                    {segment.count} Files
                  </span>
                  <div style={{
                    width: 4,
                    height: 4,
                    background: '#6C6B6E',
                    borderRadius: '50%',
                    opacity: 0.9
                  }} />
                  <span style={{
                    color: '#6C6B6E',
                    fontSize: '14px',
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
                    lineHeight: '1.2'
                  }}>
                    {formatSize(segment.size)}
                  </span>
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
