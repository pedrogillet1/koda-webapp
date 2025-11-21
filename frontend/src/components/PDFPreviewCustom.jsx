import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ReactComponent as ArrowLeftIcon } from '../assets/arrow-narrow-left.svg';
import { ReactComponent as ArrowRightIcon } from '../assets/arrow-narrow-right.svg';

// Set up PDF.js worker - use the same configuration as DocumentViewer
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Custom PDF Preview Component with Vertical Sidebar
 * Matches KODA's aesthetic with clean white background
 */
const PDFPreviewCustom = ({ pdfUrl, document, zoom = 100 }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [thumbnailPages, setThumbnailPages] = useState([]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    setThumbnailPages(Array.from({ length: numPages }, (_, i) => i + 1));
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF preview');
    setLoading(false);
  };

  const goToPreviousPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  };

  const goToNextPage = () => {
    if (pageNumber < numPages) {
      setPageNumber(pageNumber + 1);
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20
        }}>📄</div>
        <div style={{
          color: '#6C6B6E',
          fontSize: 16,
          fontFamily: 'Plus Jakarta Sans'
        }}>
          Loading presentation...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        padding: 40,
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 20
        }}>⚠️</div>
        <div style={{
          color: '#DC2626',
          fontSize: 16,
          fontFamily: 'Plus Jakarta Sans'
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      transform: `scale(${zoom / 100})`,
      transformOrigin: 'top center',
      transition: 'transform 0.2s ease'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        minHeight: '700px'
      }}>
        {/* LEFT SIDEBAR - Vertical Thumbnails */}
        <div style={{
          width: '200px',
          background: '#FAFAFA',
          borderRight: '1px solid #E6E6EC',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '16px 12px',
            borderBottom: '1px solid #E6E6EC',
            background: '#F5F5F5'
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: '600',
              color: '#32302C',
              fontFamily: 'Plus Jakarta Sans'
            }}>
              All Slides
            </div>
          </div>

          {/* Thumbnail List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px 8px'
          }}>
            {thumbnailPages.map((page) => (
              <div
                key={page}
                onClick={() => goToPage(page)}
                style={{
                  cursor: 'pointer',
                  background: page === pageNumber ? '#FFFFFF' : 'transparent',
                  border: page === pageNumber ? '2px solid #181818' : '1px solid #E6E6EC',
                  borderRadius: 6,
                  padding: 6,
                  marginBottom: 12,
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
                onMouseEnter={(e) => {
                  if (page !== pageNumber) {
                    e.currentTarget.style.background = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== pageNumber) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#E6E6EC';
                  }
                }}
              >
                <div style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: '#32302C',
                  fontFamily: 'Plus Jakarta Sans',
                  textAlign: 'center'
                }}>
                  {page}
                </div>
                <div style={{
                  width: '100%',
                  background: '#F9FAFB',
                  borderRadius: 4,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '4/3'
                }}>
                  <Document
                    file={pdfUrl}
                    loading={
                      <div style={{
                        fontSize: 10,
                        color: '#6C6B6E',
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        ...
                      </div>
                    }
                  >
                    <Page
                      pageNumber={page}
                      width={160}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE - Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Top Navigation Bar */}
          <div style={{
            padding: '12px 20px',
            background: '#FAFAFA',
            borderBottom: '1px solid #E6E6EC',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16
          }}>
            <button
              onClick={goToPreviousPage}
              disabled={pageNumber === 1}
              style={{
                width: 36,
                height: 36,
                background: pageNumber === 1 ? '#E6E6EC' : 'white',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: pageNumber === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: pageNumber === 1 ? 'none' : '0 2px 4px rgba(0,0,0,0.08)'
              }}
              onMouseEnter={(e) => {
                if (pageNumber > 1) {
                  e.currentTarget.style.background = '#F5F5F5';
                }
              }}
              onMouseLeave={(e) => {
                if (pageNumber > 1) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <ArrowLeftIcon style={{
                width: 18,
                height: 18,
                stroke: pageNumber === 1 ? '#A0A0A0' : '#32302C'
              }} />
            </button>

            <input
              type="number"
              min="1"
              max={numPages}
              value={pageNumber}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= numPages) {
                  goToPage(page);
                }
              }}
              style={{
                width: 50,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #E6E6EC',
                fontSize: 13,
                fontWeight: '600',
                fontFamily: 'Plus Jakarta Sans',
                textAlign: 'center',
                outline: 'none'
              }}
            />

            <div style={{
              fontSize: 13,
              color: '#6C6B6E',
              fontFamily: 'Plus Jakarta Sans'
            }}>
              / {numPages}
            </div>

            <button
              onClick={goToNextPage}
              disabled={pageNumber === numPages}
              style={{
                width: 36,
                height: 36,
                background: pageNumber === numPages ? '#E6E6EC' : 'white',
                border: 'none',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: pageNumber === numPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: pageNumber === numPages ? 'none' : '0 2px 4px rgba(0,0,0,0.08)'
              }}
              onMouseEnter={(e) => {
                if (pageNumber < numPages) {
                  e.currentTarget.style.background = '#F5F5F5';
                }
              }}
              onMouseLeave={(e) => {
                if (pageNumber < numPages) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <ArrowRightIcon style={{
                width: 18,
                height: 18,
                stroke: pageNumber === numPages ? '#A0A0A0' : '#32302C'
              }} />
            </button>
          </div>

          {/* Main PDF Display */}
          <div style={{
            flex: 1,
            padding: '24px',
            background: '#F5F5F5',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto'
          }}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div style={{
                  color: '#6C6B6E',
                  fontSize: 14,
                  fontFamily: 'Plus Jakarta Sans'
                }}>
                  Loading page...
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                width={Math.min(800, window.innerWidth - 300)}
                style={{
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  borderRadius: 8
                }}
              />
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewCustom;
