import React, { useState, useEffect } from 'react';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import { ReactComponent as CheckIcon } from '../assets/check.svg';
import api from '../services/api';

const EditCategoryModal = ({ isOpen, onClose, category, onUpdate }) => {
  const [categoryName, setCategoryName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📁');
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [showAllEmojis, setShowAllEmojis] = useState(false);

  const defaultEmojis = ['📁', '🏠', '💼', '📊', '📄', '🎓', '💰'];
  const allEmojis = [
    '📁', '🏠', '💼', '📊', '📄', '🎓', '💰',
    '🏥', '🎯', '🎨', '🎭', '🎪', '🎬', '🎮', '🎲', '🎵',
    '🎸', '🎹', '🎺', '🎻', '🏀', '⚽', '🏈', '⚾',
    '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋',
    '⛳', '⛸', '🎿', '⛷', '🏂', '🏋', '🤸', '🤺',
    '🤼', '🤽', '🤾', '🤹', '🧘', '🏃', '🚴', '🚵',
    '🏎', '🏍', '🛴', '🛹', '🚗', '🚕', '🚙', '🚌',
    '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛',
    '🚜', '🚲', '🛵', '🏍', '🚨', '🚔', '🚍', '🚘',
    '✈', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥',
    '⚓', '🎢', '🎡', '🎠', '🎪', '🗼', '🏰', '🏯',
    '🗽', '⛪', '🕌', '🛕', '🕍', '⛩', '🕋', '⛲',
    '⛺', '🏕', '🗻', '🏔', '⛰', '🏞', '🏜', '🏖',
    '🏝', '🌋', '🗾', '🏟', '🏛', '🏗', '🏘', '🏚'
  ];

  const emojiOptions = showAllEmojis ? allEmojis : defaultEmojis;

  useEffect(() => {
    if (isOpen && category) {
      setCategoryName(category.name);
      setSelectedEmoji(category.emoji || '📁');
      fetchCategoryDocuments();
      fetchAllDocuments();
    }
  }, [isOpen, category]);

  const fetchCategoryDocuments = async () => {
    try {
      const response = await api.get(`/api/documents?folderId=${category.id}`);
      const docs = response.data.documents || [];
      setDocuments(docs);
      setSelectedDocuments(docs.map(d => d.id));
    } catch (error) {
      console.error('Error fetching category documents:', error);
    }
  };

  const fetchAllDocuments = async () => {
    try {
      const response = await api.get('/api/documents');
      setAllDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching all documents:', error);
    }
  };

  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleConfirm = async () => {
    try {
      // Update category name and emoji
      await api.patch(`/api/folders/${category.id}`, {
        name: categoryName,
        emoji: selectedEmoji
      });

      // Update document assignments
      const currentDocIds = documents.map(d => d.id);
      const toAdd = selectedDocuments.filter(id => !currentDocIds.includes(id));
      const toRemove = currentDocIds.filter(id => !selectedDocuments.includes(id));

      // Add documents to category
      for (const docId of toAdd) {
        await api.patch(`/api/documents/${docId}`, {
          folderId: category.id
        });
      }

      // Remove documents from category
      for (const docId of toRemove) {
        await api.patch(`/api/documents/${docId}`, {
          folderId: null
        });
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredDocuments = allDocuments.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        maxWidth: 450,
        height: 'auto',
        maxHeight: '90vh',
        paddingTop: 18,
        paddingBottom: 18,
        background: 'white',
        borderRadius: 14,
        outline: '1px #E6E6EC solid',
        outlineOffset: '-1px',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 18,
        display: 'flex',
        overflow: 'hidden'
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
          <div style={{width: 30, height: 30, opacity: 0}} />
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
              lineHeight: '26px'
            }}>
              Edit Category
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
            <CloseIcon style={{width: 18, height: 18}} />
          </button>
        </div>

        <div style={{alignSelf: 'stretch', height: 1, background: '#E6E6EC'}} />

        {/* Scrollable Content */}
        <div style={{
          alignSelf: 'stretch',
          flex: 1,
          overflowY: 'auto',
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}>
          {/* Category Name */}
          <div style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 6,
            display: 'flex'
          }}>
            <div style={{
              color: '#32302C',
              fontSize: 14,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              lineHeight: '20px'
            }}>
              Category Name
            </div>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              style={{
                alignSelf: 'stretch',
                height: 52,
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 10,
                paddingBottom: 10,
                background: '#F5F5F5',
                overflow: 'hidden',
                borderRadius: 14,
                outline: '1px #E6E6EC solid',
                outlineOffset: '-1px',
                border: 'none',
                color: '#32302C',
                fontSize: 16,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '400',
                lineHeight: '24px'
              }}
            />
          </div>

          {/* Category Emoji */}
          <div style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 12,
            display: 'flex'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              alignSelf: 'stretch'
            }}>
              <div style={{
                color: '#32302C',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '20px'
              }}>
                Category Emoji
              </div>
              <button
                onClick={() => setShowAllEmojis(!showAllEmojis)}
                style={{
                  padding: '6px 12px',
                  background: '#F5F5F5',
                  border: '1px solid #E6E6EC',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  color: '#32302C',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
              >
                {showAllEmojis ? 'Show Less' : 'See All'}
              </button>
            </div>
            <div style={{
              alignSelf: 'stretch',
              display: 'flex',
              flexWrap: showAllEmojis ? 'wrap' : 'nowrap',
              gap: 8,
              maxHeight: showAllEmojis ? 200 : 'auto',
              overflowY: showAllEmojis ? 'auto' : 'visible',
              padding: 4
            }}>
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  style={{
                    width: 44,
                    height: 44,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: selectedEmoji === emoji ? '#171717' : '#F5F5F5',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    borderRadius: 100,
                    outline: `1px ${selectedEmoji === emoji ? '#171717' : '#E6E6EC'} solid`,
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 20,
                    flexShrink: 0
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Add Documents Section */}
          <div style={{
            alignSelf: 'stretch',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 16,
            display: 'flex'
          }}>
            <div style={{
              alignSelf: 'stretch',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 10,
              display: 'flex'
            }}>
              <div style={{
                flex: '1 1 0',
                color: '#32302C',
                fontSize: 16,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '700',
                textTransform: 'capitalize',
                lineHeight: '24px'
              }}>
                Add documents
              </div>
            </div>

            {/* Search */}
            <div style={{
              alignSelf: 'stretch',
              height: 48,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 10,
              paddingBottom: 10,
              background: '#F5F5F5',
              boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
              overflow: 'hidden',
              borderRadius: 100,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 8,
              display: 'flex'
            }}>
              <SearchIcon style={{width: 24, height: 24}} />
              <input
                type="text"
                placeholder="Search any documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: '1 1 0',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#32302C',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}
              />
            </div>

            {/* Document List */}
            <div style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 8,
              display: 'flex',
              maxHeight: 300,
              overflowY: 'auto'
            }}>
              {filteredDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => toggleDocumentSelection(doc.id)}
                  style={{
                    alignSelf: 'stretch',
                    padding: 14,
                    background: selectedDocuments.includes(doc.id) ? '#F0F0F0' : '#F5F5F5',
                    borderRadius: 18,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    gap: 12,
                    display: 'flex',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedDocuments.includes(doc.id)) {
                      e.currentTarget.style.background = '#EBEBEB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedDocuments.includes(doc.id)) {
                      e.currentTarget.style.background = '#F5F5F5';
                    }
                  }}
                >
                  <div style={{width: 40, height: 40, fontSize: 24, flexShrink: 0}}>📄</div>
                  <div style={{
                    flex: '1 1 0',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    gap: 6,
                    display: 'flex',
                    minWidth: 0
                  }}>
                    <div style={{
                      width: '100%',
                      color: '#32302C',
                      fontSize: 16,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      lineHeight: '22.40px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left'
                    }}>
                      {doc.filename}
                    </div>
                    <div style={{
                      width: '100%',
                      color: '#6C6B6E',
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '500',
                      lineHeight: '15.40px',
                      textAlign: 'left'
                    }}>
                      {formatFileSize(doc.fileSize)}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: selectedDocuments.includes(doc.id) ? '#171717' : 'white',
                      borderRadius: 100,
                      outline: '1px rgba(55, 53, 47, 0.09) solid',
                      outlineOffset: '-1px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {selectedDocuments.includes(doc.id) ? (
                      <CheckIcon style={{width: 16, height: 16, color: 'white'}} />
                    ) : (
                      <AddIcon style={{width: 16, height: 16, color: '#171717'}} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{alignSelf: 'stretch', height: 1, background: '#E6E6EC'}} />

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
            onClick={handleConfirm}
            style={{
              flex: '1 1 0',
              height: 52,
              background: '#181818',
              overflow: 'hidden',
              borderRadius: 14,
              justifyContent: 'center',
              alignItems: 'center',
              display: 'flex',
              border: 'none',
              cursor: 'pointer',
              color: 'white',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCategoryModal;
