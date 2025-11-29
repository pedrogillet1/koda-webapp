import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '../context/DocumentsContext';
import { useIsMobile, useMobileBreakpoints } from '../hooks/useIsMobile';
import CategoryIcon from './CategoryIcon';

const CategoryGrid = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const mobile = useMobileBreakpoints();
  const { folders: contextFolders, documents: contextDocuments } = useDocuments();

  // Calculate document count for each folder
  const getDocumentCountByFolder = (folderId) => {
    return contextDocuments.filter(doc => doc.folderId === folderId).length;
  };

  // Get top-level folders with their file counts
  const categories = useMemo(() => {
    const cats = contextFolders
      .filter(folder => !folder.parentFolderId)
      .map(folder => {
        return {
          id: folder.id,
          name: folder.name,
          emoji: folder.emoji || '__FOLDER_SVG__',
          fileCount: getDocumentCountByFolder(folder.id)
        };
      });
    return cats;
  }, [contextFolders, contextDocuments]);

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  // On mobile, show fewer categories initially (3 visible + "Add New" = 4 total)
  // On desktop, show 7 visible + "Add New" = 8 total (2 rows of 4)
  const maxVisibleCategories = isMobile ? 3 : 7;
  const hasMoreCategories = categories.length > maxVisibleCategories;
  const visibleCategories = hasMoreCategories ? categories.slice(0, maxVisibleCategories) : categories;

  // ADAPTIVE SIZING - MOBILE ONLY
  const gridGap = isMobile ? mobile.gap : 12;
  const cardPadding = isMobile ? mobile.padding.base : 14;
  const cardBorderRadius = isMobile ? mobile.borderRadius.lg : 14;
  const cardMinHeight = isMobile ? (mobile.isSmallPhone ? 90 : 100) : 72;
  const iconSize = isMobile ? (mobile.isSmallPhone ? 32 : 36) : 42;
  const titleFontSize = isMobile ? mobile.fontSize.sm : 14;
  const subtitleFontSize = isMobile ? mobile.fontSize.xs : 14;

  // ADAPTIVE GRID COLUMNS - different for phone sizes
  const getGridColumns = () => {
    if (!isMobile) return 'repeat(4, 1fr)';
    if (mobile.isSmallPhone) return 'repeat(2, 1fr)'; // Small phones: 2 columns
    if (mobile.isSmallTablet) return 'repeat(3, 1fr)'; // Tablets: 3 columns
    return 'repeat(2, 1fr)'; // Regular/Large phones: 2 columns
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: gridGap, width: '100%', alignSelf: 'stretch' }}>
      {/* Responsive grid - adaptive columns based on screen size */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: getGridColumns(),
        gap: gridGap,
        width: '100%'
      }}>
        {/* Add New Smart Category Button */}
        <div
          onClick={() => navigate('/documents')}
          style={{
            padding: cardPadding,
            background: 'white',
            borderRadius: cardBorderRadius,
            border: '1px #E6E6EC solid',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? mobile.gap : 8,
            cursor: 'pointer',
            minHeight: cardMinHeight,
            width: '100%',
            boxSizing: 'border-box',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
          }}
          onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width={mobile.isSmallPhone ? 20 : isMobile ? 24 : 28} height={mobile.isSmallPhone ? 20 : isMobile ? 24 : 28} viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="black" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{
            color: '#32302C',
            fontSize: titleFontSize,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600',
            lineHeight: 1.3,
            textAlign: 'center',
            wordBreak: 'break-word'
          }}>
            {isMobile ? 'Add New' : 'Add New Smart Category'}
          </span>
        </div>

        {/* Display categories */}
        {visibleCategories.map((category) => (
          <div
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            style={{
              padding: cardPadding,
              background: 'white',
              borderRadius: cardBorderRadius,
              border: '1px #E6E6EC solid',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: isMobile ? mobile.gap : 12,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              position: 'relative',
              minHeight: cardMinHeight,
              width: '100%',
              boxSizing: 'border-box',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: iconSize,
              flexShrink: 0
            }}>
              <CategoryIcon emoji={category.emoji} size={iconSize} />
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: mobile.isSmallPhone ? 2 : 4,
              flex: isMobile ? 'none' : 1,
              alignItems: isMobile ? 'center' : 'flex-start',
              textAlign: isMobile ? 'center' : 'left',
              width: isMobile ? '100%' : 'auto',
              overflow: 'hidden'
            }}>
              <div style={{
                color: '#32302C',
                fontSize: titleFontSize,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '1.3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: isMobile ? 'normal' : 'nowrap',
                maxWidth: '100%',
                wordBreak: 'break-word'
              }}>
                {category.name}
              </div>
              <div style={{
                color: '#6C6B6E',
                fontSize: subtitleFontSize,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '500',
                lineHeight: '1.3'
              }}>
                {category.fileCount || 0} {category.fileCount === 1 ? 'File' : 'Files'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show "See All" only if there are more categories than visible */}
      {hasMoreCategories && (
        <div
          onClick={() => navigate('/documents')}
          style={{
            color: '#171717',
            fontSize: isMobile ? mobile.fontSize.base : 16,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '22.40px',
            cursor: 'pointer',
            textAlign: 'right',
            paddingRight: isMobile ? mobile.padding.xs : 8,
            transition: 'transform 0.2s ease, opacity 0.2s ease'
          }}
          onMouseEnter={(e) => !isMobile && (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => !isMobile && (e.currentTarget.style.opacity = '1')}
        >
          See All ({categories.length})
        </div>
      )}
    </div>
  );
};

export default CategoryGrid;
