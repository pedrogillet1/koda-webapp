import React, { useState, useEffect } from 'react';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import CategoryIcon from './CategoryIcon';
import api from '../services/api';

/**
 * Unified Add to Category Modal
 * Matches the design from MoveToFolderModal with grid card layout
 */
const AddToCategoryModal = ({
  isOpen,
  onClose,
  uploadedDocuments = [],
  documentId = null, // Single document ID (for document preview)
  onCategorySelected,
  onCreateNew
}) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setCategories([]);
      setSelectedCategory(null);
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const timestamp = new Date().getTime();
      const response = await api.get(`/api/folders?_t=${timestamp}`);

      // Filter to show only root-level folders (categories with no parent)
      const folders = response.data.folders || [];
      const rootFolders = folders.filter(folder => folder.parentFolderId === null);

      console.log('✨ AddToCategoryModal - Root folders:', rootFolders);
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

  const handleAdd = () => {
    if (selectedCategory && onCategorySelected) {
      onCategorySelected(selectedCategory.id);
      onClose();
      setSelectedCategory(null);
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
  };

  if (!isOpen) return null;

  // Determine document info for header
  const documentInfo = documentId
    ? uploadedDocuments.find(doc => doc.id === documentId)
    : uploadedDocuments[0];

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
        maxWidth: 450,
        background: 'white',
        borderRadius: 14,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '85vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E6E6EC',
          position: 'relative'
        }}>
          <div style={{
            color: '#32302C',
            fontSize: 18,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '28px',
            marginBottom: 4
          }}>
            Move to Category
          </div>

          {/* Document info */}
          {documentInfo && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 12,
              padding: 12,
              background: '#F9FAFB',
              borderRadius: 8
            }}>
              <CategoryIcon
                emoji={documentInfo.type === 'pdf' ? '📄' : documentInfo.type === 'docx' ? '📝' : '📊'}
                style={{ fontSize: 20 }}
              />
              <div style={{
                flex: 1,
                minWidth: 0
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#32302C',
                  fontFamily: 'Plus Jakarta Sans',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {documentInfo.filename || documentInfo.name}
                </div>
                <div style={{
                  fontSize: 11,
                  color: '#6C6B6E',
                  fontFamily: 'Plus Jakarta Sans'
                }}>
                  {documentInfo.size ? `${(documentInfo.size / 1024 / 1024).toFixed(2)} MB` : ''}
                </div>
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: -12,
              right: -12,
              width: 32,
              height: 32,
              background: 'white',
              borderRadius: '50%',
              border: '1px solid rgba(55, 53, 47, 0.09)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <CloseIcon style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* Categories Grid */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              color: '#6C6B6E',
              fontSize: 14,
              fontFamily: 'Plus Jakarta Sans'
            }}>
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 40,
              color: '#6C6B6E',
              fontSize: 14,
              fontFamily: 'Plus Jakarta Sans'
            }}>
              No categories yet. Create one below!
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12
            }}>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  style={{
                    padding: 16,
                    background: 'white',
                    borderRadius: 12,
                    border: selectedCategory?.id === category.id
                      ? '2px solid #181818'
                      : '1px solid #E6E6EC',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    minHeight: 110
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategory?.id !== category.id) {
                      e.currentTarget.style.borderColor = '#D1D5DB';
                      e.currentTarget.style.background = '#FAFAFA';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategory?.id !== category.id) {
                      e.currentTarget.style.borderColor = '#E6E6EC';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  {/* Selection indicator */}
                  {selectedCategory?.id === category.id && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 18,
                      height: 18,
                      background: '#181818',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </div>
                  )}

                  {/* Category icon */}
                  <div style={{
                    width: 48,
                    height: 48,
                    background: '#F5F5F5',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28
                  }}>
                    <CategoryIcon emoji={category.emoji || '📁'} />
                  </div>

                  {/* Category name */}
                  <div style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: '#32302C',
                    fontFamily: 'Plus Jakarta Sans',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}>
                    {category.name}
                  </div>

                  {/* File count */}
                  <div style={{
                    fontSize: 11,
                    color: '#6C6B6E',
                    fontFamily: 'Plus Jakarta Sans'
                  }}>
                    {category._count?.documents || 0} Files
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Create New Category Button */}
          <button
            onClick={handleCreateNew}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '14px 20px',
              background: '#F5F5F5',
              borderRadius: 12,
              border: '2px dashed #D1D5DB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EBEBEB';
              e.currentTarget.style.borderColor = '#A0A0A0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F5F5F5';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            <span style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#181818',
              fontFamily: 'Plus Jakarta Sans'
            }}>
              Create New Category
            </span>
          </button>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E6E6EC',
          display: 'flex',
          gap: 12
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              height: 48,
              background: '#F5F5F5',
              borderRadius: 12,
              border: '1px solid #E6E6EC',
              color: '#323232',
              fontSize: 15,
              fontWeight: '600',
              fontFamily: 'Plus Jakarta Sans',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#EBEBEB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F5F5F5';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedCategory}
            style={{
              flex: 1,
              height: 48,
              background: selectedCategory ? '#181818' : '#E6E6EC',
              borderRadius: 12,
              border: 'none',
              color: selectedCategory ? 'white' : '#A9A9A9',
              fontSize: 15,
              fontWeight: '600',
              fontFamily: 'Plus Jakarta Sans',
              cursor: selectedCategory ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (selectedCategory) {
                e.currentTarget.style.background = '#2C2C2C';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedCategory) {
                e.currentTarget.style.background = '#181818';
              }
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToCategoryModal;
