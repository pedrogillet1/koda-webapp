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
      })
      .slice(0, 8); // Show max 8 categories on dashboard

    console.log('CategoryGrid - Final categories:', cats);
    return cats;
  }, [contextFolders, contextDocuments]);

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`);
  };

  return (
    <div style={{alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'flex'}}>
      <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
        {/* Add New Smart Category Button */}
        <div
          onClick={() => navigate('/documents')}
          style={{flex: '1 1 0', padding: 14, background: 'white', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 6, display: 'flex', cursor: 'pointer'}}
        >
          <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
            <div style={{width: 40, height: 40, position: 'relative', background: '#F6F6F6', borderRadius: 125}}>
              <div style={{width: 20, height: 20, left: 10, top: 10, position: 'absolute', overflow: 'hidden'}}>
                <div style={{width: 12.92, height: 12.92, left: 3.54, top: 3.54, position: 'absolute', background: 'black'}} />
              </div>
            </div>
            <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 20, wordWrap: 'break-word'}}>Add New Smart Category</div>
          </div>
        </div>

        {/* Display first 3 categories */}
        {categories.slice(0, 3).map((category) => (
          <div
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            style={{flex: '1 1 0', padding: 14, background: 'white', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 6, display: 'flex', cursor: 'pointer', transition: 'transform 0.2s ease'}}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
              <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: 90.91, justifyContent: 'center', alignItems: 'center', gap: 9.09, display: 'flex', fontSize: 20}}>
                <CategoryIcon emoji={category.emoji} />
              </div>
              <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex'}}>
                <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'inline-flex'}}>
                  <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 19.60, wordWrap: 'break-word'}}>{category.name}</div>
                  <div style={{justifyContent: 'center', alignItems: 'center', gap: 10, display: 'inline-flex'}}>
                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>{category.fileCount} Files</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Second row - next 4 categories */}
      {categories.length > 3 && (
        <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'inline-flex'}}>
          {categories.slice(3, 7).map((category) => (
            <div
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              style={{flex: '1 1 0', padding: 14, background: 'white', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 6, display: 'flex', cursor: 'pointer', transition: 'transform 0.2s ease'}}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                <div style={{width: 40, height: 40, background: '#F6F6F6', borderRadius: 100, justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', fontSize: 20}}>
                  <CategoryIcon emoji={category.emoji} />
                </div>
                <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex'}}>
                  <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 19.60, wordWrap: 'break-word'}}>{category.name}</div>
                    <div style={{justifyContent: 'center', alignItems: 'center', gap: 10, display: 'inline-flex'}}>
                      <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>{category.fileCount} Files</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryGrid;
