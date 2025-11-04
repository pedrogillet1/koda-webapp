import React, { useState, useEffect } from 'react';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as CheckIcon } from '../assets/check.svg';
import CategoryIcon from './CategoryIcon';
import api from '../services/api';

const AddToCategoryModal = ({
  isOpen,
  onClose,
  uploadedDocuments = [],
  onCategorySelected,
  onCreateNew
}) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // VERSION 2.0 - FULL WIDTH LAYOUT WITH EMOJIS
      console.log('🚀 AddToCategoryModal VERSION 2.0 LOADED');
      // Clear state first to force fresh data
      setCategories([]);
      setSelectedCategory(null);
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      // Add cache busting parameter to force fresh data
      const timestamp = new Date().getTime();
      const response = await api.get(`/api/folders?_t=${timestamp}`);

      // Filter to show only root-level folders (categories with no parent)
      const folders = response.data.folders || [];
      const rootFolders = folders.filter(folder => folder.parentFolderId === null);
      console.log('✨ CACHE-BUSTED AddToCategoryModal - Root folders:', rootFolders);
      console.log('✨ Found categories:', rootFolders.map(f => `${f.emoji || '📁'} ${f.name}`));
      console.log('✨ Emoji values:', rootFolders.map(f => ({ name: f.name, emoji: f.emoji, emojiType: typeof f.emoji })));
      setCategories(rootFolders);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setLoading(false);
    }
  };

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
  };

  const handleAddToCategory = () => {
    if (selectedCategory && onCategorySelected) {
      onCategorySelected(selectedCategory.id);
      onClose();
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        width: '100%',
        maxWidth: 700,
        paddingTop: 18,
        paddingBottom: 18,
        position: 'relative',
        background: 'white',
        borderRadius: 14,
        outline: '1px #E6E6EC solid',
        outlineOffset: '-1px',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 18,
        display: 'flex'
      }}>
        {/* Header */}
        <div style={{
          alignSelf: 'stretch',
          height: 30,
          paddingLeft: 18,
          paddingRight: 18,
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 12,
            display: 'flex'
          }}>
            <div style={{
              width: 304,
              textAlign: 'center',
              color: '#32302C',
              fontSize: 20,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '30px'
            }}>
              Add to Category
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            right: -16,
            top: -16,
            position: 'absolute',
            background: 'white',
            borderRadius: 100,
            outline: '1px rgba(55, 53, 47, 0.09) solid',
            outlineOffset: '-1px',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <CloseIcon style={{ width: 12, height: 12 }} />
        </button>

        <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

        {/* Content Area */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          display: 'flex'
        }}>
          {/* Subtitle */}
          <div style={{
            alignSelf: 'stretch',
            textAlign: 'center',
            color: '#6C6B6E',
            fontSize: 14,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '500',
            lineHeight: '20px'
          }}>
            Choose a category for your document
          </div>

          {/* Categories grid */}
          <div style={{
            alignSelf: 'stretch',
            maxHeight: 400,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            {loading ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                No categories yet. Create one below!
              </div>
            ) : (
              categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  style={{
                    height: 70,
                    padding: '12px 16px',
                    background: 'white',
                    borderRadius: 14,
                    outline: selectedCategory?.id === category.id ? '2px #181818 solid' : '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 12,
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Selection checkmark */}
                  {selectedCategory?.id === category.id && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 20,
                      height: 20,
                      background: '#181818',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </div>
                  )}

                  {/* Emoji icon */}
                  <div style={{
                    width: 40,
                    height: 40,
                    background: '#F5F5F5',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    flexShrink: 0,
                    backgroundImage: 'none',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center'
                  }}>
                    <CategoryIcon emoji={category.emoji || '__FOLDER_SVG__'} style={{fontSize: 24}} />
                  </div>

                  {/* Category name */}
                  <div style={{
                    flex: 1,
                    textAlign: 'left',
                    color: '#32302C',
                    fontSize: 14,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '20px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {category.name}
                  </div>
                </button>
              ))
            )}

            {/* Create New button in grid */}
            <button
              onClick={handleCreateNew}
              style={{
                height: 70,
                padding: '12px 16px',
                background: 'white',
                borderRadius: 14,
                outline: '2px #E6E6EC dashed',
                outlineOffset: '-2px',
                flexDirection: 'row',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: 12,
                display: 'flex',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                background: '#F5F5F5',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckIcon style={{ width: 20, height: 20, color: '#181818' }} />
              </div>
              <div style={{
                color: '#181818',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '20px'
              }}>
                Create New
              </div>
            </button>
          </div>
        </div>

        <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

        {/* Footer Buttons */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: 8,
          display: 'flex'
        }}>
          <button
            onClick={onClose}
            style={{
              flex: '1 1 0',
              height: 52,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              background: '#F5F5F5',
              borderRadius: 14,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              display: 'flex',
              border: 'none',
              cursor: 'pointer',
              color: '#323232',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAddToCategory}
            disabled={!selectedCategory}
            style={{
              flex: '1 1 0',
              height: 52,
              background: selectedCategory ? '#181818' : '#E6E6EC',
              overflow: 'hidden',
              borderRadius: 14,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              display: 'flex',
              border: 'none',
              cursor: selectedCategory ? 'pointer' : 'not-allowed',
              color: selectedCategory ? 'white' : '#A9A9A9',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}
          >
            Add to Category
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToCategoryModal;
