import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import api from '../services/api';
import pdfIcon from '../assets/pdf-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import { downloadFile } from '../utils/browserUtils';

// Set up the worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const DocumentPreviewModal = ({ isOpen, onClose, document }) => {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const previewContainerRef = useRef(null);
  const pageRefs = useRef({});

  // Memoize file config and options for react-pdf
  const fileConfig = useMemo(() => previewUrl ? { url: previewUrl } : null, [previewUrl]);
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjs.version + '/cmaps/',
    cMapPacked: true,
    withCredentials: false,
    isEvalSupported: false,
  }), []);

  // Handle PDF load success
  const onDocumentLoadSuccess = ({ numPages }) => {
    setTotalPages(numPages);
    setCurrentPage(1);
    console.log('📄 PDF loaded successfully with', numPages, 'pages');
  };

  // Load document preview
  useEffect(() => {
    if (!isOpen || !document) return;

    const loadPreview = async () => {
      setIsLoading(true);
      try {
        // Check if document is DOCX - use preview endpoint for PDF conversion
        const extension = document.filename?.split('.').pop()?.toLowerCase();
        const isDocx = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                       extension === 'docx' || extension === 'doc';

        console.log('🔍 Document type detection:', {
          filename: document.filename,
          extension,
          mimeType: document.mimeType,
          isDocx
        });

        if (isDocx) {
          console.log('🔍 Requesting DOCX preview for document:', document.id);

          try {
            // Get PDF preview for DOCX with timeout
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('DOCX preview timeout')), 60000)
            );

            const previewResponse = await Promise.race([
              api.get(`/api/documents/${document.id}/preview`),
              timeoutPromise
            ]);

            const { previewUrl: pdfUrl } = previewResponse.data;
            console.log('✅ DOCX preview received:', pdfUrl?.substring(0, 100));
            setPreviewUrl(pdfUrl);
          } catch (docxError) {
            console.error('❌ DOCX preview failed:', docxError);
            // Set previewUrl to null so it shows error state
            setPreviewUrl(null);
            throw docxError; // Re-throw to be caught by outer catch
          }
        } else {
          // For PDF files, get document stream as blob
          const response = await api.get(`/api/documents/${document.id}/stream`, {
            responseType: 'blob'
          });

          // Create blob URL for the document
          const blob = response.data;
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);

          console.log('📄 Document preview loaded:', url);
        }
      } catch (error) {
        console.error('❌ Error loading document preview:', error);
        setPreviewUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, document]);

  // Handle Esc key to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      window.document.body.style.overflow = 'hidden';
    }

    return () => {
      window.document.removeEventListener('keydown', handleEsc);
      window.document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Track which page is currently visible using Intersection Observer
  useEffect(() => {
    if (!totalPages || totalPages === 0) return;

    const observerOptions = {
      root: previewContainerRef.current,
      rootMargin: '-50% 0px -50% 0px', // Trigger when page crosses the center of viewport
      threshold: 0
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number'), 10);
          if (pageNum) {
            setCurrentPage(pageNum);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all page elements
    Object.values(pageRefs.current).forEach((pageElement) => {
      if (pageElement) {
        observer.observe(pageElement);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [totalPages]);

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  // Download document
  const handleDownload = async () => {
    try {
      // Call the download endpoint to get the original file
      const response = await api.get(`/api/documents/${document.id}/download`);
      const downloadUrl = response.data.url;

      // Use browser-aware download function with the original file URL
      downloadFile(downloadUrl, document.filename);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  // Navigate to full preview
  const handleOpenFullPreview = () => {
    // Navigate to document page with zoom and scroll state (in-app navigation)
    navigate(`/document/${document.id}?zoom=${zoom}&page=${currentPage}`);
  };

  // Get file type icon
  const getFileIcon = () => {
    if (!document) return pdfIcon;

    // Check mimeType first for most reliable detection
    if (document.mimeType) {
      if (document.mimeType === 'application/pdf') return pdfIcon;
      if (document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          document.mimeType === 'application/msword') return docIcon;
    }

    // Fallback to filename extension
    if (document.filename) {
      const extension = document.filename.split('.').pop().toLowerCase();
      if (extension === 'pdf') return pdfIcon;
      if (['doc', 'docx'].includes(extension)) return docIcon;
    }

    return pdfIcon; // default
  };


  if (!isOpen || !document) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 9998,
          animation: 'fadeIn 250ms ease-out'
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80vw',
          height: '80vh',
          background: '#F5F5F5',
          borderRadius: 16,
          border: '1px solid #DADADA',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 9999,
          animation: 'modalSlideIn 250ms ease-out',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div
          style={{
            height: 56,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingLeft: 28,
            paddingRight: 20,
            borderBottom: '1px solid #DADADA',
            background: '#FFFFFF',
            position: 'relative'
          }}
        >
          {/* Left Section - Document Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: '35%',
            overflow: 'hidden'
          }}>
            <img
              src={getFileIcon()}
              alt="File"
              style={{
                width: 20,
                height: 20,
                flexShrink: 0
              }}
            />
            <div
              style={{
                fontSize: 15,
                fontWeight: '500',
                color: '#1A1A1A',
                fontFamily: 'Plus Jakarta Sans',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {document.filename || 'Document'}
            </div>
          </div>

          {/* Center Section - Page Indicator (absolutely centered) */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 13,
            color: '#6C6C6C',
            fontWeight: '500',
            fontFamily: 'Plus Jakarta Sans',
            whiteSpace: 'nowrap',
            letterSpacing: '0.2px'
          }}>
            Page {currentPage} of {totalPages}
          </div>

          {/* Right Section - Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end' }}>
            {/* Zoom Control Cluster */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid #DADADA',
              borderRadius: 6,
              padding: '4px 6px',
              background: '#FFFFFF'
            }}>
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                style={{
                  width: 24,
                  height: 24,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: zoom <= 50 ? 'not-allowed' : 'pointer',
                  opacity: zoom <= 50 ? 0.4 : 1,
                  transition: 'background 150ms ease-out',
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  if (zoom > 50) e.currentTarget.style.background = '#F5F5F5';
                }}
                onMouseLeave={(e) => {
                  if (zoom > 50) e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 8H12" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Zoom Percentage Display */}
              <div style={{
                fontSize: 13,
                fontWeight: '600',
                color: '#1A1A1A',
                fontFamily: 'Plus Jakarta Sans',
                minWidth: 42,
                textAlign: 'center',
                userSelect: 'none'
              }}>
                {zoom}%
              </div>

              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                style={{
                  width: 24,
                  height: 24,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: zoom >= 200 ? 'not-allowed' : 'pointer',
                  opacity: zoom >= 200 ? 0.4 : 1,
                  transition: 'background 150ms ease-out',
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  if (zoom < 200) e.currentTarget.style.background = '#F5F5F5';
                }}
                onMouseLeave={(e) => {
                  if (zoom < 200) e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 4V12M4 8H12" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              style={{
                width: 32,
                height: 32,
                border: '1px solid #DADADA',
                background: 'transparent',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'opacity 200ms ease-out',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 10V12.6667C14 13.0203 13.8595 13.3594 13.6095 13.6095C13.3594 13.8595 13.0203 14 12.6667 14H3.33333C2.97971 14 2.64057 13.8595 2.39052 13.6095C2.14048 13.3594 2 13.0203 2 12.6667V10" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.66602 6.66667L7.99935 10L11.3327 6.66667" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 10V2" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                border: '1px solid #DADADA',
                background: 'transparent',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'opacity 200ms ease-out',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Document Preview Area */}
        <div
          ref={previewContainerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start'
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
                color: '#6C6C6C',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}
            >
              Loading preview...
            </div>
          ) : previewUrl ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <Document
                file={fileConfig}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error('❌ PDF Load Error:', error);
                  console.error('PDF URL:', previewUrl);
                  console.error('Document:', document);
                }}
                options={pdfOptions}
                loading={
                  <div style={{
                    padding: 40,
                    background: 'white',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: '#6C6C6C',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans'
                  }}>
                    Loading PDF...
                  </div>
                }
                error={
                  <div style={{
                    padding: 40,
                    background: 'white',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 64, marginBottom: 20 }}>📄</div>
                    <div style={{ fontSize: 18, fontWeight: '600', color: '#32302C', fontFamily: 'Plus Jakarta Sans', marginBottom: 12 }}>
                      Failed to load document preview
                    </div>
                    <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 24 }}>
                      {document.filename}
                    </div>
                    <div style={{ fontSize: 13, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans' }}>
                      The document may still be processing. Please try opening the full preview.
                    </div>
                  </div>
                }
              >
                {Array.from(new Array(totalPages), (el, index) => (
                  <div
                    key={`page_${index + 1}`}
                    ref={(el) => {
                      if (el) {
                        pageRefs.current[index + 1] = el;
                      }
                    }}
                    data-page-number={index + 1}
                    style={{
                      marginBottom: index < totalPages - 1 ? '20px' : '0'
                    }}
                  >
                    <Page
                      pageNumber={index + 1}
                      width={700 * (zoom / 100)}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div style={{
                          width: 700 * (zoom / 100),
                          height: 900 * (zoom / 100),
                          background: 'white',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6C6C6C',
                          fontFamily: 'Plus Jakarta Sans'
                        }}>
                          Loading page {index + 1}...
                        </div>
                      }
                    />
                  </div>
                ))}
              </Document>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
                color: '#6C6C6C',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans'
              }}
            >
              Preview not available
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 28px',
            borderTop: '1px solid #E0E0E0',
            background: '#F5F5F5'
          }}
        >
          <button
            onClick={handleOpenFullPreview}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6C6C6C',
              fontSize: 14,
              fontWeight: '500',
              fontFamily: 'Plus Jakarta Sans',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: 6,
              transition: 'color 200ms ease-out, opacity 200ms ease-out',
              opacity: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#1A1A1A';
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#6C6C6C';
              e.currentTarget.style.opacity = '1';
            }}
          >
            Open Full Preview
          </button>
        </div>
      </div>

      {/* Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}} />
    </>
  );
};

export default DocumentPreviewModal;
