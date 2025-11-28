import React, { useState, useEffect } from 'react';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import { ReactComponent as CheckIcon } from '../assets/check.svg';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import CategoryIcon from './CategoryIcon';
import folderIcon from '../assets/folder_icon.svg';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import txtIcon from '../assets/txt-icon.png';
import xlsIcon from '../assets/xls.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import pptxIcon from '../assets/pptx.png';
import api from '../services/api';

const CreateCategoryModal = ({ isOpen, onClose, onCreateCategory, uploadedDocuments = [], preSelectedDocumentId = null }) => {
  const [categoryName, setCategoryName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('__FOLDER_SVG__');
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nameError, setNameError] = useState(false);
  const [documentsError, setDocumentsError] = useState(false);
  const [showAllEmojis, setShowAllEmojis] = useState(false);

  // Debug: Log when preSelectedDocumentId changes
  useEffect(() => {
    console.log('📋 CreateCategoryModal received preSelectedDocumentId:', preSelectedDocumentId);
  }, [preSelectedDocumentId]);

  const emojis = [
    // Default folder icon (folder_icon.svg)
    '__FOLDER_SVG__',
    // Common & Popular
    '📄', '📋', '📝', '📌', '📎', '🔖', '📚',
    // Work & Business
    '💼', '📊', '📈', '📉', '💰', '💵', '💳', '🏢', '🏦', '📞',
    // Travel & Places
    '✈️', '🌍', '🗺️', '🏠', '🏥', '🏪',
    // Food & Drink
    '🍕', '🍔', '🍟', '🍎', '🍊', '🍇', '🥗', '☕', '🍷', '🍺',
    // Activities & Hobbies
    '⚽', '🏀', '🎾', '🎮', '🎨', '🎬', '📷', '🎵', '🎸',
    // Symbols & Objects
    '⭐', '❤️', '💙', '💚', '💛', '🔥', '💡', '🔔', '🎯', '🎁',
    // Education & Science
    '🎓', '🔬', '🔭', '⚗️', '🧪', '💻', '⌨️', '🖥️',
    // Nature & Animals
    '🌲', '🌳', '🌴', '🌵', '🌺', '🌻', '🌼', '🐶', '🐱', '🐭',
    // Weather & Time
    '☀️', '⛅', '☁️', '🌧️', '⛈️', '🌈', '⏰', '⏳', '⌛', '📅',
    // Misc
    '🎉', '🎊', '🎈', '🎀', '🎪', '🎭', '🔑', '🔒', '🔓', '🛠️'
  ];

  // Fetch ALL documents directly from API when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchAllDocuments = async () => {
        try {
          setLoading(true);
          console.log('📂 CreateCategoryModal opening - fetching ALL documents from API...');
          console.log('📂 Pre-selected document ID:', preSelectedDocumentId);

          // Fetch ALL documents with a high limit to ensure we get everything
          const response = await api.get('/api/documents?limit=1000');
          const allDocuments = response.data.documents || [];

          console.log('📂 API returned documents:', allDocuments.length);
          console.log('📂 Full response:', response.data);

          setDocuments(allDocuments);
          // Pre-select document if provided
          if (preSelectedDocumentId) {
            console.log('📂 Pre-selecting document:', preSelectedDocumentId);
            setSelectedDocuments([preSelectedDocumentId]);
          } else {
            console.log('📂 No pre-selected document');
            setSelectedDocuments([]);
          }
          setLoading(false);
        } catch (error) {
          console.error('❌ Error fetching documents:', error);
          setDocuments([]);
          setLoading(false);
        }
      };

      fetchAllDocuments();
      // Reset form when modal opens
      setCategoryName('');
      setSelectedEmoji('__FOLDER_SVG__');
      setSearchQuery('');
      setNameError(false);
      setDocumentsError(false);
      setShowAllEmojis(false);
    }
  }, [isOpen, preSelectedDocumentId]);

  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev => {
      const newSelection = prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId];

      // Clear documents error if at least one document is selected
      if (newSelection.length > 0) {
        setDocumentsError(false);
      }

      return newSelection;
    });
  };

  const handleCreate = () => {
    let hasError = false;

    // Check if category name is empty
    if (!categoryName.trim()) {
      setNameError(true);
      hasError = true;
    } else {
      setNameError(false);
    }

    // Documents are optional - no validation needed
    setDocumentsError(false);

    // If there are errors, don't proceed
    if (hasError) {
      return;
    }

    // Notify parent component (which will create the category and add documents)
    onCreateCategory({
      name: categoryName,
      emoji: selectedEmoji,
      files: selectedDocuments.length,
      selectedDocuments: selectedDocuments
    });

    // Reset form
    setCategoryName('');
    setSelectedEmoji('__FOLDER_SVG__');
    setSelectedDocuments([]);
    setSearchQuery('');
    setNameError(false);
    setDocumentsError(false);
    onClose();
  };

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    if (!filename) return docIcon;
    const ext = filename.toLowerCase();
    if (ext.match(/\.(pdf)$/)) return pdfIcon;
    if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
    if (ext.match(/\.(png)$/)) return pngIcon;
    if (ext.match(/\.(doc|docx)$/)) return docIcon;
    if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
    if (ext.match(/\.(txt)$/)) return txtIcon;
    if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
    return docIcon; // Default icon
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 500,
          background: 'white',
          borderRadius: 14,
          outline: '1px #E6E6EC solid',
          outlineOffset: '-1px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          padding: '18px 0'
        }}
      >
        {/* Header */}
        <div style={{
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ width: 30, height: 30, opacity: 0 }} />
          <div style={{
            width: 304,
            textAlign: 'center',
            color: '#32302C',
            fontSize: 18,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '700',
            lineHeight: '26px'
          }}>
            Create a Category
          </div>
          <div
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              background: 'white',
              borderRadius: 100,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 14, color: '#323232' }}>✕</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E6E6EC' }} />

        {/* Category Name Input */}
        <div style={{
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
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
            onChange={(e) => {
              setCategoryName(e.target.value);
              if (e.target.value.trim()) {
                setNameError(false);
              }
            }}
            placeholder="Enter category name"
            style={{
              height: 52,
              paddingLeft: 18,
              paddingRight: 18,
              background: '#F5F5F5',
              borderRadius: 14,
              outline: nameError ? '2px #DC2626 solid' : '1px #E6E6EC solid',
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

        {/* Category Emoji Selector */}
        <div style={{
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
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
            {(showAllEmojis ? emojis : emojis.slice(0, 8)).map((emoji) => (
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
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  display: 'flex',
                  cursor: 'pointer',
                  fontSize: 20,
                  flexShrink: 0,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedEmoji !== emoji) {
                    e.currentTarget.style.background = '#EBEBEB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEmoji !== emoji) {
                    e.currentTarget.style.background = '#F5F5F5';
                  }
                }}
              >
                <CategoryIcon emoji={emoji} size={20} />
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E6E6EC' }} />

        {/* Select Documents */}
        <div style={{
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{
            color: '#32302C',
            fontSize: 14,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600',
            lineHeight: '20px'
          }}>
            Add documents
          </div>

          {/* Search Bar */}
          <div style={{
            position: 'relative',
            marginBottom: 8
          }}>
            <SearchIcon style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              color: '#6C6B6E'
            }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              style={{
                width: '100%',
                height: 42,
                paddingLeft: 40,
                paddingRight: 12,
                background: '#F5F5F5',
                borderRadius: 10,
                outline: documentsError ? '2px #DC2626 solid' : '1px #E6E6EC solid',
                outlineOffset: '-1px',
                border: 'none',
                color: '#32302C',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '400',
                lineHeight: '20px'
              }}
            />
          </div>

          {/* Documents List */}
          <div style={{
            flexDirection: 'column',
            gap: 12,
            display: 'flex',
            maxHeight: 228,
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{
                textAlign: 'center',
                padding: 20,
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Loading documents...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 20,
                color: '#6C6B6E',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                {searchQuery ? 'No documents match your search' : documents.length === 0 ? 'No documents in library. Upload documents first to add them to a category.' : 'No documents available'}
              </div>
            ) : (
              filteredDocuments.map((doc) => (
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
                  <img
                    src={getFileIcon(doc.filename)}
                    alt="File icon"
                    style={{
                      width: 40,
                      height: 40,
                      imageRendering: '-webkit-optimize-contrast',
                      objectFit: 'contain',
                      shapeRendering: 'geometricPrecision',
                      flexShrink: 0,
                      filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                    }}
                  />
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
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E6E6EC' }} />

        {/* Action Buttons */}
        <div style={{
          paddingLeft: 18,
          paddingRight: 18,
          display: 'flex',
          gap: 8
        }}>
          <div
            onClick={onClose}
            style={{
              flex: 1,
              height: 52,
              background: '#F5F5F5',
              borderRadius: 14,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
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
          </div>
          <div
            onClick={handleCreate}
            style={{
              flex: 1,
              height: 52,
              background: 'rgba(24, 24, 24, 0.90)',
              borderRadius: 14,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <div style={{
              color: 'white',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              textTransform: 'capitalize',
              lineHeight: '24px'
            }}>
              Create
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCategoryModal;
