import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '../context/DocumentsContext';
import { useIsMobile } from '../hooks/useIsMobile';
import CategoryIcon from './CategoryIcon';

const CategoryGrid = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
        console.log(`CategoryGrid - Folder: ${folder.name}, emoji:`, folder.emoji);
        return {
          id: folder.id,
          name: folder.name,
          emoji: folder.emoji || '__FOLDER_SVG__',
          fileCount: getDocumentCountByFolder(folder.id)
        };
      });

    console.log('CategoryGrid - Final categories:', cats);
    return cats;
  }, [contextFolders, contextDocuments]);

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  // On mobile, show fewer categories initially (3 visible + "Add New" = 4 total)
  // On desktop, show 11 visible + "Add New" = 12 total
  const maxVisibleCategories = isMobile ? 3 : 11;
  const hasMoreCategories = categories.length > maxVisibleCategories;
  const visibleCategories = hasMoreCategories ? categories.slice(0, maxVisibleCategories) : categories;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 12, width: '100%', alignSelf: 'stretch' }}>
      {/* Responsive grid - 2 columns on mobile, auto-fill on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: isMobile ? 10 : 12,
        width: '100%'
      }}>
        {/* Add New Smart Category Button */}
        <div
          onClick={() => navigate('/documents')}
          style={{
            padding: isMobile ? 12 : 14,
            background: 'white',
            borderRadius: isMobile ? 12 : 14,
            border: '1px #E6E6EC solid',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? 8 : 8,
            cursor: 'pointer',
            minHeight: isMobile ? 100 : 72,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div style={{
            width: isMobile ? 36 : 40,
            height: isMobile ? 36 : 40,
            background: '#F6F6F6',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4V16M4 10H16" stroke="black" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <span style={{
            color: '#32302C',
            fontSize: isMobile ? 12 : 14,
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
              padding: isMobile ? 12 : 10,
              background: 'white',
              borderRadius: isMobile ? 12 : 14,
              border: '1px #E6E6EC solid',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? 8 : 8,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              position: 'relative',
              minHeight: isMobile ? 100 : 72,
              width: '100%',
              boxSizing: 'border-box',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{
              width: isMobile ? 36 : 40,
              height: isMobile ? 36 : 40,
              background: '#F6F6F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? 18 : 20,
              flexShrink: 0
            }}>
              <CategoryIcon emoji={category.emoji} />
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: isMobile ? 'none' : 1,
              alignItems: isMobile ? 'center' : 'flex-start',
              textAlign: isMobile ? 'center' : 'left',
              width: isMobile ? '100%' : 'auto',
              overflow: 'hidden'
            }}>
              <div style={{
                color: '#32302C',
                fontSize: isMobile ? 12 : 14,
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
                fontSize: isMobile ? 11 : 14,
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
            fontSize: isMobile ? 14 : 16,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '22.40px',
            cursor: 'pointer',
            textAlign: 'right',
            paddingRight: isMobile ? 4 : 8
          }}
        >
          See All ({categories.length})
        </div>
      )}
    </div>
  );
};

export default CategoryGrid;
