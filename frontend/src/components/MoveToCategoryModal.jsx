import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import CategoryIcon from './CategoryIcon';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import txtIcon from '../assets/txt-icon.png';
import xlsIcon from '../assets/xls.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import pptxIcon from '../assets/pptx.png';
import movIcon from '../assets/mov.png';
import mp4Icon from '../assets/mp4.png';
import mp3Icon from '../assets/mp3.svg';

/**
 * Universal Move to Category Modal
 * Used across Documents, DocumentsPage, DocumentViewer, and UploadHub
 */
export default function MoveToCategoryModal({
  isOpen,
  onClose,
  selectedDocument,
  categories,
  selectedCategoryId,
  onCategorySelect,
  onCreateNew,
  onConfirm
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const getFileIcon = (filename) => {
    const lower = filename.toLowerCase();
    if (lower.match(/\.(pdf)$/)) return pdfIcon;
    if (lower.match(/\.(jpg|jpeg)$/)) return jpgIcon;
    if (lower.match(/\.(png)$/)) return pngIcon;
    if (lower.match(/\.(doc|docx)$/)) return docIcon;
    if (lower.match(/\.(xls|xlsx)$/)) return xlsIcon;
    if (lower.match(/\.(txt)$/)) return txtIcon;
    if (lower.match(/\.(ppt|pptx)$/)) return pptxIcon;
    if (lower.match(/\.(mov)$/)) return movIcon;
    if (lower.match(/\.(mp4)$/)) return mp4Icon;
    if (lower.match(/\.(mp3)$/)) return mp3Icon;
    return docIcon;
  };

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
        maxWidth: 480,
        paddingTop: 18,
        paddingBottom: 18,
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
          width: '100%',
          paddingLeft: 24,
          paddingRight: 24,
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex'
        }}>
          <div style={{
            color: '#32302C',
            fontSize: 18,
            fontFamily: 'Plus Jakarta Sans',
            fontWeight: '600',
            lineHeight: '25.20px'
          }}>
            {t('modals.moveToCategory.title')}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: '#F5F5F5',
              border: 'none',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
          >
            <CloseIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Selected Document Display */}
        {selectedDocument && (
          <div style={{
            width: '100%',
            paddingLeft: 24,
            paddingRight: 24
          }}>
            <div style={{
              padding: 12,
              background: '#F5F5F5',
              borderRadius: 12,
              border: '1px #E6E6EC solid',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}>
              <img
                src={getFileIcon(selectedDocument.filename)}
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
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  color: '#32302C',
                  fontSize: 14,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {selectedDocument.filename}
                </div>
                <div style={{
                  color: '#6C6B6E',
                  fontSize: 12,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400'
                }}>
                  {((selectedDocument.fileSize || 0) / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories Grid */}
        <div style={{
          width: '100%',
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 8,
          paddingBottom: 8,
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: 12,
          display: 'flex',
          maxHeight: '280px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            width: '100%'
          }}>
            {categories.map((category) => {
              const fileCount = category._count?.documents || category.fileCount || 0;
              return (
                <div
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 12,
                    paddingBottom: 12,
                    background: selectedCategoryId === category.id ? '#F5F5F5' : 'white',
                    borderRadius: 12,
                    border: selectedCategoryId === category.id ? '2px #32302C solid' : '1px #E6E6EC solid',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCategoryId !== category.id) {
                      e.currentTarget.style.background = '#F9FAFB';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCategoryId !== category.id) {
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  {/* Emoji */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#F5F5F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20
                  }}>
                    <CategoryIcon emoji={category.emoji} size={18} />
                  </div>

                  {/* Category Name */}
                  <div style={{
                    width: '100%',
                    color: '#32302C',
                    fontSize: 14,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '19.60px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center'
                  }}>
                    {category.name}
                  </div>

                  {/* File Count */}
                  <div style={{
                    color: '#6C6B6E',
                    fontSize: 12,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
                    lineHeight: '15.40px'
                  }}>
                    {fileCount || 0} {fileCount === 1 ? t('modals.moveToCategory.file') : t('modals.moveToCategory.files')}
                  </div>

                  {/* Checkmark */}
                  {selectedCategoryId === category.id && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8
                    }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="8" r="8" fill="#32302C"/>
                        <path d="M4.5 8L7 10.5L11.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Create New Category Button */}
        <div style={{
          width: '100%',
          paddingLeft: 24,
          paddingRight: 24
        }}>
          <button
            onClick={onCreateNew}
            style={{
              width: '100%',
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              background: '#F5F5F5',
              borderRadius: 100,
              border: '1px #E6E6EC solid',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
          >
            <AddIcon style={{ width: 20, height: 20 }} />
            <div style={{
              color: '#32302C',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '600',
              lineHeight: '24px'
            }}>
              {t('modals.moveToCategory.createNew')}
            </div>
          </button>
        </div>

        {/* Buttons */}
        <div style={{
          width: '100%',
          paddingLeft: 24,
          paddingRight: 24,
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: 10,
          display: 'flex'
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              background: 'white',
              borderRadius: 100,
              border: '1px #E6E6EC solid',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              display: 'flex',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
          >
            <div style={{
              color: '#32302C',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '24px'
            }}>
              {t('common.cancel')}
            </div>
          </button>
          <button
            onClick={onConfirm}
            disabled={!selectedCategoryId}
            style={{
              flex: 1,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 10,
              paddingBottom: 10,
              background: selectedCategoryId ? '#32302C' : '#E6E6EC',
              borderRadius: 100,
              border: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              display: 'flex',
              cursor: selectedCategoryId ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => {
              if (selectedCategoryId) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <div style={{
              color: selectedCategoryId ? 'white' : '#9CA3AF',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              lineHeight: '24px'
            }}>
              {t('modals.moveToCategory.add')}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
