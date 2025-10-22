import React, { useState, useEffect } from 'react';
import pdfIcon from '../assets/pdf-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import txtIcon from '../assets/txt-icon.svg';
import xlsIcon from '../assets/xls.svg';
import jpgIcon from '../assets/jpg-icon.svg';
import pngIcon from '../assets/png-icon.svg';
import pptxIcon from '../assets/pptx.svg';
import api from '../services/api';

const CreateCategoryModal = ({ isOpen, onClose, onCreateCategory, uploadedDocuments = [] }) => {
  const [categoryName, setCategoryName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📁');
  const [documents, setDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nameError, setNameError] = useState(false);
  const [documentsError, setDocumentsError] = useState(false);
  const [showAllEmojis, setShowAllEmojis] = useState(false);

  const emojis = [
    // Common & Popular
    '📁', '📄', '📋', '📝', '📌', '📎', '🔖', '📚',
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

          // Fetch ALL documents with a high limit to ensure we get everything
          const response = await api.get('/api/documents?limit=1000');
          const allDocuments = response.data.documents || [];

          console.log('📂 API returned documents:', allDocuments.length);
          console.log('📂 Full response:', response.data);

          setDocuments(allDocuments);
          setSelectedDocuments([]); // Start with none selected
          setLoading(false);
        } catch (error) {
          console.error('❌ Error fetching documents:', error);
          setDocuments([]);
          setLoading(false);
        }
      };

      fetchAllDocuments();
    }
  }, [isOpen]);

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

    // Check if no documents are selected
    if (selectedDocuments.length === 0) {
      setDocumentsError(true);
      hasError = true;
    } else {
      setDocumentsError(false);
    }

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
    setSelectedEmoji('📁');
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
    <div style={{
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
    }}>
      <div style={{
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
      }}>
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
            color: '#32302C',
            fontSize: 14,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600',
            lineHeight: '20px'
          }}>
            Category Emoji
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{
              display: 'flex',
              gap: 8,
              padding: 8,
              background: '#F5F5F5',
              borderRadius: 10,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              overflowX: showAllEmojis ? 'auto' : 'visible',
              flexWrap: showAllEmojis ? 'nowrap' : 'nowrap'
            }}>
              {(showAllEmojis ? emojis : emojis.slice(0, 8)).map((emoji) => (
                <div
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  style={{
                    minWidth: 44,
                    width: 44,
                    height: 44,
                    background: selectedEmoji === emoji ? '#171717' : 'white',
                    borderRadius: 8,
                    outline: selectedEmoji === emoji ? '2px #171717 solid' : '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    if (selectedEmoji !== emoji) {
                      e.currentTarget.style.background = '#F9FAFB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedEmoji !== emoji) {
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
            {!showAllEmojis && (
              <button
                onClick={() => setShowAllEmojis(true)}
                style={{
                  width: '100%',
                  paddingTop: 8,
                  paddingBottom: 8,
                  background: 'transparent',
                  border: 'none',
                  color: '#32302C',
                  fontSize: 14,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                See All Emojis
              </button>
            )}
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
            Select Documents ({selectedDocuments.length} selected)
          </div>

          {/* Search Bar */}
          <div style={{
            position: 'relative',
            marginBottom: 8
          }}>
            <div style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 16
            }}>
              🔍
            </div>
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

          {/* Documents List - Max 5 visible with scroll */}
          <div style={{
            maxHeight: filteredDocuments.length > 5 ? 380 : 'auto', // 76px per item * 5 = 380px
            overflowY: filteredDocuments.length > 5 ? 'auto' : 'visible',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingRight: filteredDocuments.length > 5 ? 4 : 0
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
                <div
                  key={doc.id}
                  onClick={() => toggleDocumentSelection(doc.id)}
                  style={{
                    padding: 12,
                    background: selectedDocuments.includes(doc.id) ? '#F9FAFB' : '#F5F5F5',
                    borderRadius: 10,
                    outline: selectedDocuments.includes(doc.id) ? '2px #181818 solid' : '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: selectedDocuments.includes(doc.id) ? '#181818' : 'white',
                    outline: selectedDocuments.includes(doc.id) ? '2px #181818 solid' : '2px #D0D5DD solid',
                    outlineOffset: '-2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {selectedDocuments.includes(doc.id) && (
                      <div style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>✓</div>
                    )}
                  </div>

                  {/* Document Icon */}
                  <img
                    src={getFileIcon(doc.filename)}
                    alt="File icon"
                    style={{
                      width: 32,
                      height: 32,
                      imageRendering: '-webkit-optimize-contrast',
                      objectFit: 'contain',
                      shapeRendering: 'geometricPrecision',
                      flexShrink: 0
                    }}
                  />

                  {/* Document Info */}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      color: '#32302C',
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      lineHeight: '20px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {doc.filename}
                    </div>
                    <div style={{
                      color: '#6C6B6E',
                      fontSize: 12,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '400',
                      lineHeight: '16px'
                    }}>
                      {formatFileSize(doc.fileSize)}
                    </div>
                  </div>
                </div>
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
              background: '#181818',
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
