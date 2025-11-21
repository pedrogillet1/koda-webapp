import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocuments } from '../context/DocumentsContext';
import CategoryIcon from './CategoryIcon';

const CategoryGrid = () => {
  const navigate = useNavigate();
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
      // ✅ Show ALL categories (removed .slice(0, 8) limit)

    console.log('CategoryGrid - Final categories:', cats);
    return cats;
  }, [contextFolders, contextDocuments]);

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  // Calculate how many categories to show (max 11 visible + "Add New" button = 12 slots)
  const maxVisibleCategories = 11;
  const hasMoreCategories = categories.length > maxVisibleCategories;
  const visibleCategories = hasMoreCategories ? categories.slice(0, maxVisibleCategories) : categories;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      {/* Responsive grid matching DocumentsPage exactly */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12}}>
        {/* Add New Smart Category Button */}
        <div
          onClick={() => navigate('/documents')}
          style={{padding: 14, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 72, width: '100%', boxSizing: 'border-box'}}
        >
          <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: 12.92, height: 12.92, background: 'black'}} />
            </div>
          </div>
          <span style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 1}}>Add New Smart Category</span>
        </div>

        {/* Display categories */}
        {visibleCategories.map((category) => (
          <div
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            style={{padding: 10, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 8, transition: 'transform 0.2s ease, box-shadow 0.2s ease', position: 'relative', minHeight: 72, width: '100%', boxSizing: 'border-box', cursor: 'pointer'}}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0}}>
              <CategoryIcon emoji={category.emoji} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1}}>
              <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px'}}>{category.name}</div>
              <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px'}}>
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
            fontSize: 16,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '22.40px',
            cursor: 'pointer',
            textAlign: 'right',
            paddingRight: 8
          }}
        >
          See All ({categories.length})
        </div>
      )}
    </div>
  );
};

export default CategoryGrid;
