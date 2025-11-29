import React, { useState, useEffect } from 'react';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as CheckIcon } from '../assets/check.svg';
import CategoryIcon from './CategoryIcon';
import api from '../services/api';

const UniversalAddToCategoryModal = ({
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
      setCategories(rootFolders);
      setLoading(false);
    } catch (error) {
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

  // Calculate rows needed (2 categories per row + create new row)
  const categoryRows = [];
  for (let i = 0; i < categories.length; i += 2) {
    categoryRows.push(categories.slice(i, i + 2));
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
        width: '100%',
        maxWidth: 520,
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
          paddingLeft: 18,
          paddingRight: 18,
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            width: 30,
            height: 30,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            opacity: 0,
            background: 'white',
            borderRadius: 100,
            outline: '1px #E6E6EC solid',
            outlineOffset: '-1px',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex'
          }}>
            <div style={{ width: 18, height: 18, position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: 9, height: 9, left: 4.50, top: 4.50, position: 'absolute', outline: '1.50px #323232 solid', outlineOffset: '-0.75px' }} />
            </div>
          </div>
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
              fontSize: 18,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '26px'
            }}>
              Add to Category
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              background: 'white',
              borderRadius: 100,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <CloseIcon style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ alignSelf: 'stretch', height: 1, background: '#E6E6EC' }} />

        {/* Description */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            width: 304,
            textAlign: 'center',
            color: '#32302C',
            fontSize: 16,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '500',
            lineHeight: '24px'
          }}>
            Choose a category for your document
          </div>
        </div>

        {/* Categories Grid */}
        <div style={{
          alignSelf: 'stretch',
          paddingLeft: 18,
          paddingRight: 18,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 12,
            display: 'flex',
            maxHeight: 400,
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{
                alignSelf: 'stretch',
                padding: 40,
                textAlign: 'center',
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Loading categories...
              </div>
            ) : categoryRows.length === 0 ? (
              <div style={{
                alignSelf: 'stretch',
                padding: 40,
                textAlign: 'center',
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                No categories yet. Create one below!
              </div>
            ) : (
              categoryRows.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 12,
                    display: 'flex'
                  }}
                >
                  {row.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category)}
                      style={{
                        flex: '1 1 0',
                        paddingTop: 18,
                        paddingBottom: 18,
                        background: 'white',
                        borderRadius: 14,
                        outline: selectedCategory?.id === category.id ? '2px #181818 solid' : '1px #E6E6EC solid',
                        outlineOffset: '-1px',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 18,
                        display: 'flex',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{
                        alignSelf: 'stretch',
                        position: 'relative',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                        display: 'flex'
                      }}>
                        <CategoryIcon emoji={category.emoji} size={40} />
                        <div style={{
                          alignSelf: 'stretch',
                          textAlign: 'center',
                          color: '#32302C',
                          fontSize: 14,
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: '500',
                          lineHeight: '20px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingLeft: 8,
                          paddingRight: 8
                        }}>
                          {category.name}
                        </div>
                        {selectedCategory?.id === category.id && (
                          <div style={{
                            width: 20,
                            height: 20,
                            right: 8,
                            top: -8,
                            position: 'absolute',
                            background: 'rgba(24, 24, 24, 0.90)',
                            overflow: 'hidden',
                            borderRadius: 6,
                            outline: '1px #181818 solid',
                            outlineOffset: '-1px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <CheckIcon style={{ width: 14, height: 14, color: 'white' }} />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {/* Fill empty space if odd number of categories in last row */}
                  {row.length === 1 && (
                    <div style={{ flex: '1 1 0' }} />
                  )}
                </div>
              ))
            )}

            {/* Create New Row */}
            <div style={{
              alignSelf: 'stretch',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 12,
              display: 'flex'
            }}>
              <button
                onClick={handleCreateNew}
                style={{
                  flex: '1 1 0',
                  paddingTop: 18,
                  paddingBottom: 18,
                  background: 'white',
                  borderRadius: 14,
                  outline: '2px #E6E6EC dashed',
                  outlineOffset: '-2px',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 18,
                  display: 'flex',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  alignSelf: 'stretch',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex'
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: '#F5F5F5',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'flex'
                  }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      position: 'relative',
                      background: 'rgba(255, 255, 255, 0)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: 11.67,
                        height: 11.67,
                        left: 4.17,
                        top: 4.17,
                        position: 'absolute',
                        outline: '1.67px #55534E solid',
                        outlineOffset: '-0.83px'
                      }} />
                    </div>
                  </div>
                  <div style={{
                    alignSelf: 'stretch',
                    textAlign: 'center',
                    color: '#32302C',
                    fontSize: 14,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
                    lineHeight: '20px'
                  }}>
                    Create New
                  </div>
                </div>
              </button>
            </div>
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
              cursor: 'pointer'
            }}
          >
            <div style={{
              color: '#323232',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}>
              Cancel
            </div>
          </button>
          <button
            onClick={handleAddToCategory}
            disabled={!selectedCategory}
            style={{
              flex: '1 1 0',
              height: 52,
              borderRadius: 14,
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex',
              border: 'none',
              cursor: selectedCategory ? 'pointer' : 'not-allowed',
              padding: 0
            }}
          >
            <div style={{
              flex: '1 1 0',
              height: 52,
              background: selectedCategory ? '#181818' : '#E6E6EC',
              overflow: 'hidden',
              borderRadius: 14,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              display: 'flex'
            }}>
              <div style={{
                color: selectedCategory ? 'white' : '#9CA3AF',
                fontSize: 16,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                textTransform: 'capitalize',
                lineHeight: '24px'
              }}>
                Add
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UniversalAddToCategoryModal;
