import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import api from '../services/api';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import SearchInDocumentModal from './SearchInDocumentModal';
import MarkdownEditor from './MarkdownEditor';
import PPTXPreview from './PPTXPreview';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import CategoryIcon from './CategoryIcon';
import { ReactComponent as ArrowLeftIcon } from '../assets/arrow-narrow-left.svg';
import { ReactComponent as LogoutWhiteIcon } from '../assets/Logout-white.svg';
import logoSvg from '../assets/Logo_head_crop.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can.svg';
import { ReactComponent as PrinterIcon } from '../assets/printer.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as DownloadWhiteIcon } from '../assets/Download 3- white.svg';
import { ReactComponent as PlusIcon } from '../assets/Plus.svg';
import { ReactComponent as MinusIcon } from '../assets/Minus.svg';
import { ReactComponent as StarIcon } from '../assets/Star.svg';
import { ReactComponent as XCloseIcon } from '../assets/x-close.svg';
import folderIcon from '../assets/folder_icon.svg';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import xlsIcon from '../assets/xls.png';
import pptxIcon from '../assets/pptx.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import {
  isSafari,
  isMacOS,
  isIOS,
  downloadFile as safariDownloadFile,
  getOptimalPDFScale,
  getImageRenderingCSS,
  logBrowserInfo
} from '../utils/browserUtils';

// Set up the worker for pdf.js - react-pdf comes with its own pdfjs version
// Use jsdelivr CDN as fallback with the bundled version
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Log browser information for debugging (only in development)
if (process.env.NODE_ENV === 'development') {
  logBrowserInfo();
}

// Text/Code Preview Component
const TextCodePreview = ({ url, document, zoom }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading text:', err);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return <div style={{ color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans' }}>Loading content...</div>;
  }

  return (
    <div style={{
      width: `${zoom}%`,
      maxWidth: '900px',
      background: 'white',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'width 0.2s ease'
    }}>
      <div style={{
        padding: 16,
        background: '#F5F5F5',
        borderBottom: '1px solid #E6E6EC',
        fontSize: 14,
        fontWeight: '600',
        color: '#32302C',
        fontFamily: 'Plus Jakarta Sans'
      }}>
        {document.filename}
      </div>
      <pre style={{
        padding: 20,
        margin: 0,
        overflow: 'auto',
        maxHeight: '70vh',
        fontSize: `${zoom / 10}px`,
        fontFamily: 'monospace',
        lineHeight: 1.6,
        color: '#32302C',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        transition: 'font-size 0.2s ease'
      }}>
        {content}
      </pre>
    </div>
  );
};

const DocumentViewer = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [extractedText, setExtractedText] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAskKoda, setShowAskKoda] = useState(true);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [isDocxConvertedToPdf, setIsDocxConvertedToPdf] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const zoomPresets = [50, 75, 100, 125, 150, 175, 200];

  // Refs to track PDF pages for scroll position
  const pageRefs = useRef({});
  const documentContainerRef = useRef(null);

  // Handler for saving markdown edits
  const handleSaveMarkdown = async (docId, newMarkdownContent) => {
    try {
      await api.patch(`/api/documents/${docId}/markdown`, {
        markdownContent: newMarkdownContent
      });

      // Update local document state
      setDocument(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          markdownContent: newMarkdownContent
        }
      }));

      console.log('Markdown saved successfully');
    } catch (error) {
      console.error('Error saving markdown:', error);
      throw error; // Re-throw to let the editor handle the error
    }
  };

  // Handler for exporting document
  const handleExport = async (format) => {
    try {
      console.log(`Exporting document as ${format}...`);

      // Call export API endpoint
      const response = await api.post(`/api/documents/${documentId}/export`, {
        format: format
      }, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' :
              format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;

      // Generate filename with appropriate extension
      const baseFilename = document.filename.split('.').slice(0, -1).join('.');
      link.download = `${baseFilename}.${format}`;

      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`Document exported as ${format} successfully`);
    } catch (error) {
      console.error(`Error exporting document as ${format}:`, error);
      alert(`Failed to export document: ${error.response?.data?.error || error.message}`);
    }
  };

  // Handler for adding document to category
  const handleAddToCategory = async (categoryId) => {
    try {
      await api.patch(`/api/documents/${documentId}`, {
        folderId: categoryId
      });
      console.log('✅ Document added to category');
      // Optionally refresh document data
      const response = await api.get('/api/documents');
      const allDocuments = response.data.documents || [];
      const updatedDocument = allDocuments.find(doc => doc.id === documentId);
      if (updatedDocument) {
        setDocument(updatedDocument);
      }
    } catch (error) {
      console.error('❌ Failed to add document to category:', error);
      alert('Failed to add document to category');
    }
  };

  // Determine breadcrumb start based on location state or default to Documents
  const breadcrumbStart = useMemo(() => {
    const from = location.state?.from;
    if (from === '/home' || from === 'home') {
      return { label: 'Home', path: '/home' };
    }
    return { label: 'Documents', path: '/documents' };
  }, [location.state]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  // Memoize the file and options props to prevent unnecessary reloads
  const fileConfig = useMemo(() => documentUrl ? { url: documentUrl } : null, [documentUrl]);
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjs.version + '/cmaps/',
    cMapPacked: true,
    // Add better error handling for PDF loading
    withCredentials: false,
    isEvalSupported: false,
  }), []);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileType = (filename, mimeType) => {
    const extension = filename.split('.').pop().toLowerCase();

    // Image formats
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(extension)) {
      return 'image';
    }

    // Video formats
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) {
      return 'video';
    }

    // Audio formats
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension)) {
      return 'audio';
    }

    // PDF
    if (extension === 'pdf') {
      return 'pdf';
    }

    // Microsoft Office documents
    if (['doc', 'docx'].includes(extension)) {
      return 'word';
    }

    if (['xls', 'xlsx'].includes(extension)) {
      return 'excel';
    }

    if (['ppt', 'pptx'].includes(extension)) {
      return 'powerpoint';
    }

    // Text files
    if (['txt', 'md', 'json', 'xml', 'csv'].includes(extension)) {
      return 'text';
    }

    // Code files
    if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go'].includes(extension)) {
      return 'code';
    }

    // Archives
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
      return 'archive';
    }

    return 'unknown';
  };

  // ============================================
  // COMPREHENSIVE PRINT HANDLERS
  // ============================================

  // Main print handler for all file types
  const handlePrint = async () => {
    try {
      if (!document || !documentUrl) {
        alert('Document not loaded yet. Please wait.');
        return;
      }

      const fileType = getFileType(document.filename, document.mimeType);
      console.log('Printing document:', document.filename, 'Type:', fileType);

      // For PDF files (including PPTX converted to PDF)
      if (fileType === 'pdf' || fileType === 'powerpoint') {
        printPDF(documentUrl);
        return;
      }

      // For images
      if (fileType === 'image') {
        printImage(documentUrl);
        return;
      }

      // For Word documents
      if (fileType === 'word') {
        // Word docs are typically converted to PDF for preview
        // Check if we have a PDF URL
        if (documentUrl.includes('.pdf') || document.pdfUrl) {
          printPDF(document.pdfUrl || documentUrl);
        } else {
          // Fallback: try to print the doc directly
          printGenericDocument(documentUrl);
        }
        return;
      }

      // For Excel files
      if (fileType === 'excel') {
        printGenericDocument(documentUrl);
        return;
      }

      // For text files
      if (fileType === 'text' || fileType === 'code') {
        printTextDocument(documentUrl, document.filename);
        return;
      }

      // Default fallback
      printGenericDocument(documentUrl);

    } catch (error) {
      console.error('Print error:', error);
      alert('Failed to print document. Please try downloading and printing manually.');
    }
  };

  // Print PDF files
  const printPDF = (pdfUrl) => {
    const iframe = window.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    window.document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error('PDF print error:', e);
          // Fallback: open in new window
          window.open(pdfUrl, '_blank');
        }
        // Remove iframe after printing
        setTimeout(() => {
          if (window.document.body.contains(iframe)) {
            window.document.body.removeChild(iframe);
          }
        }, 1000);
      }, 500);
    };

    iframe.onerror = () => {
      console.error('Failed to load PDF for printing');
      window.document.body.removeChild(iframe);
      // Fallback: open in new window
      window.open(pdfUrl, '_blank');
    };

    iframe.src = pdfUrl;
  };

  // Print image files
  const printImage = (imageUrl) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Image</title>
          <style>
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            img {
              max-width: 100%;
              max-height: 100vh;
              object-fit: contain;
            }
            @media print {
              body {
                margin: 0;
              }
              img {
                max-width: 100%;
                height: auto;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" onload="window.print(); setTimeout(() => window.close(), 500);" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print text/code files
  const printTextDocument = async (textUrl, filename) => {
    try {
      const response = await fetch(textUrl);
      const text = await response.text();

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                padding: 20mm;
                font-size: 12pt;
                line-height: 1.6;
                color: #000;
              }
              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                margin: 0;
              }
              @media print {
                body {
                  padding: 15mm;
                }
              }
            </style>
          </head>
          <body>
            <pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 500);
      }, 500);
    } catch (error) {
      console.error('Error printing text document:', error);
      alert('Failed to load text document for printing.');
    }
  };

  // Generic document print (fallback)
  const printGenericDocument = (docUrl) => {
    // Try iframe method first
    const iframe = window.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    window.document.body.appendChild(iframe);

    let printed = false;

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          printed = true;
        } catch (e) {
          console.error('Generic print error:', e);
          if (!printed) {
            // Fallback: open in new window
            window.open(docUrl, '_blank');
          }
        }
        // Remove iframe after printing
        setTimeout(() => {
          if (window.document.body.contains(iframe)) {
            window.document.body.removeChild(iframe);
          }
        }, 1000);
      }, 500);
    };

    iframe.onerror = () => {
      console.error('Failed to load document for printing');
      if (window.document.body.contains(iframe)) {
        window.document.body.removeChild(iframe);
      }
      // Fallback: open in new window
      window.open(docUrl, '_blank');
    };

    // Set timeout to fallback if loading takes too long
    setTimeout(() => {
      if (!printed && window.document.body.contains(iframe)) {
        console.warn('Print timeout, opening in new window');
        window.open(docUrl, '_blank');
        window.document.body.removeChild(iframe);
      }
    }, 5000);

    iframe.src = docUrl;
  };

  // ============================================
  // END PRINT HANDLERS
  // ============================================

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/api/folders');
        setCategories(response.data.folders || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        // Fetch only the specific document instead of all documents
        console.log('📄 Fetching document:', documentId);
        const response = await api.get(`/api/documents/${documentId}/status`);
        const foundDocument = response.data;

        if (foundDocument) {
          setDocument(foundDocument);

          // Store extracted text if available
          if (foundDocument.metadata && foundDocument.metadata.extractedText) {
            setExtractedText(foundDocument.metadata.extractedText);
          }

          // Check if document is DOCX - use preview endpoint for PDF conversion
          const isDocx = foundDocument.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

          if (isDocx) {
            // Get PDF preview for DOCX with timeout
            console.log('🔍 Requesting DOCX preview for document:', documentId);

            try {
              // Timeout increased to 60 seconds to allow for DOCX-to-PDF conversion
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('DOCX preview timeout')), 60000)
              );

              const previewResponse = await Promise.race([
                api.get(`/api/documents/${documentId}/preview`),
                timeoutPromise
              ]);

              const { previewUrl, previewType } = previewResponse.data;
              console.log('✅ Preview response received:', { previewUrl: previewUrl.substring(0, 100), previewType });
              setDocumentUrl(previewUrl);
              setIsDocxConvertedToPdf(true); // Mark that this DOCX should be treated as PDF for rendering
              console.log('✅ DOCX marked as converted to PDF for rendering');
            } catch (error) {
              console.error('❌ DOCX preview failed:', error);
              // Silently continue - document might still be processing
              // The component will handle the loading/error state without blocking the user
              setLoading(false);
              return;
            }
          } else {
            setIsDocxConvertedToPdf(false);

            // Mac (both Safari and Chrome) has issues with blob URLs for PDFs
            const isPdf = foundDocument.mimeType === 'application/pdf';
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const useMacPdfWorkaround = isMac && isPdf;

            if (useMacPdfWorkaround) {
              // For Mac PDFs, use the direct stream URL with authentication
              // This bypasses blob URL issues that affect both Safari and Chrome on Mac
              const accessToken = localStorage.getItem('accessToken');
              const streamUrl = `${api.defaults.baseURL}/api/documents/${documentId}/stream?token=${accessToken}`;
              console.log('🍎 Using Mac PDF workaround with direct stream URL (platform:', navigator.platform, ')');
              setDocumentUrl(streamUrl);
            } else {
              // Check if we have a cached blob URL
              const cacheKey = `document_blob_${documentId}`;
              const cachedUrl = sessionStorage.getItem(cacheKey);

              if (cachedUrl) {
                console.log('⚡ Using cached blob URL for document');
                setDocumentUrl(cachedUrl);
              } else {
                // Use blob URL for Windows/Linux or non-PDF files
                console.log('📥 Downloading document for preview...');
                const fileResponse = await api.get(`/api/documents/${documentId}/stream`, {
                  responseType: 'blob'
                });
                const blob = new Blob([fileResponse.data], { type: foundDocument.mimeType });
                const url = URL.createObjectURL(blob);
                console.log('📄 Created blob URL for document (platform:', navigator.platform, ')');

                // Cache the blob URL (it will be cleaned up when the page is refreshed)
                sessionStorage.setItem(cacheKey, url);
                setDocumentUrl(url);
              }
            }
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching document:', error);
        setLoading(false);
      }
    };

    if (documentId) {
      fetchDocument();
    }

    // Cleanup blob URL
    return () => {
      if (documentUrl && documentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(documentUrl);
      }
    };
  }, [documentId]);

  // Add Ctrl+F / Cmd+F keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearchModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track which page is currently visible using Intersection Observer
  useEffect(() => {
    if (!numPages || numPages === 0) return;

    const observerOptions = {
      root: documentContainerRef.current,
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
  }, [numPages]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans' }}>Loading document...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans' }}>Document not found</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#F5F5F5', overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex' }}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />
      <div style={{ flex: '1 1 0', height: '100vh', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'inline-flex' }}>
        {/* Header */}
        <div style={{ alignSelf: 'stretch', height: 120, padding: 20, background: 'white', borderBottom: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 52,
              height: 52,
              background: 'white',
              borderRadius: 100,
              outline: '1px #E6E6EC solid',
              outlineOffset: '-1px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F5F5F5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
            }}
          >
            <ArrowLeftIcon style={{ width: 20, height: 20, stroke: '#55534E' }} />
          </button>

          <div style={{ flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'inline-flex' }}>
            <div style={{ justifyContent: 'flex-start', alignItems: 'center', display: 'inline-flex' }}>
              <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex' }}>
                {/* Home or Documents */}
                <div
                  onClick={() => navigate(breadcrumbStart.path)}
                  style={{ paddingTop: 4, paddingBottom: 4, borderRadius: 6, justifyContent: 'center', alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                >
                  <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word' }}>{breadcrumbStart.label}</div>
                </div>
                {/* Category (if document has folderId) */}
                {document.folderId && categories.length > 0 && (() => {
                  const category = categories.find(cat => cat.id === document.folderId);
                  return category ? (
                    <React.Fragment>
                      <div style={{ color: '#D0D5DD', fontSize: 16 }}>›</div>
                      <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
                        <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word' }}>{category.name}</div>
                      </div>
                    </React.Fragment>
                  ) : null;
                })()}
                {/* Folder path (if exists) */}
                {document.folderPath && document.folderPath.split('/').filter(Boolean).map((folder, index, arr) => (
                  <React.Fragment key={index}>
                    <div style={{ color: '#D0D5DD', fontSize: 16 }}>›</div>
                    <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
                      <div style={{ color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word' }}>{folder}</div>
                    </div>
                  </React.Fragment>
                ))}
                {/* File name */}
                <div style={{ color: '#D0D5DD', fontSize: 16 }}>›</div>
                <div style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, background: '#F9FAFB', borderRadius: 6, justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
                  <div style={{ color: '#323232', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word' }}>{document.filename}</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ color: '#323232', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: '30px', wordWrap: 'break-word' }}>{document.filename}</span>
            </div>
          </div>

          <div style={{ width: 400, borderRadius: 12, justifyContent: 'center', alignItems: 'flex-start', gap: 24, display: 'flex' }}>
            <div style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex' }}>
              <button
                onClick={() => setShowDeleteModal(true)}
                style={{ width: 52, height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer' }}
              >
                <TrashCanIcon style={{ width: 44, height: 44 }} />
              </button>
              <button
                onClick={handlePrint}
                style={{
                  width: 52,
                  height: 52,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: 'white',
                  overflow: 'hidden',
                  borderRadius: 14,
                  outline: '1px #E6E6EC solid',
                  outlineOffset: '-1px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                title="Print document"
              >
                <PrinterIcon style={{ width: 44, height: 44 }} />
              </button>
              <button
                onClick={() => {
                  // Clear current conversation to force a new chat
                  sessionStorage.removeItem('currentConversationId');
                  navigate(`/chat?documentId=${documentId}`, { state: { newConversation: true } });
                }}
                style={{ width: 52, height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer' }}
              >
                <img
                  src={logoSvg}
                  alt="Profile"
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: 'contain',
                    ...getImageRenderingCSS()
                  }}
                />
              </button>
            </div>
            <button
              onClick={async () => {
                if (document) {
                  try {
                    // Call the download endpoint to get the original file
                    const response = await api.get(`/api/documents/${document.id}/download`);
                    const downloadUrl = response.data.url;

                    // Use Safari-aware download function with the original file URL
                    safariDownloadFile(downloadUrl, document.filename);
                  } catch (error) {
                    console.error('Download error:', error);
                    alert('Failed to download document');
                  }
                }
              }}
              style={{ flex: '1 1 0', height: 52, background: '#181818', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer' }}
              title={isSafari() || isIOS() ? 'Open in new tab' : 'Download'}
            >
              <DownloadWhiteIcon style={{ width: 24, height: 24 }} />
              <div style={{ color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word' }}>Download</div>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ alignSelf: 'stretch', paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 16, background: 'white', borderBottom: '1px #E6E6EC solid', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex' }}>
          <div style={{ color: '#323232', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px', wordWrap: 'break-word' }}>
            {(() => {
              const fileType = document ? getFileType(document.filename, document.mimeType) : 'unknown';
              if (fileType === 'pdf' || fileType === 'word') {
                return numPages ? `${currentPage} of ${numPages} page${numPages > 1 ? 's' : ''}` : 'Loading...';
              }
              return '1 page';
            })()}
          </div>
          <div style={{ width: 1, height: 19, background: '#D9D9D9' }} />
          <div style={{ flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex' }}>
            <button
              onClick={() => setShowCategoryModal(true)}
              style={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                background: '#000000',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '600',
                lineHeight: '20px'
              }}>
                Add to Category
              </span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <button
              onClick={() => setZoom(prev => Math.max(50, prev - 25))}
              style={{ width: 32, height: 32, background: 'white', border: 'none', borderRadius: 8, outline: '1px #E6E6EC solid', outlineOffset: '-1px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <MinusIcon style={{ width: 16, height: 16 }} />
            </button>
            <div style={{ height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', display: 'flex', position: 'relative' }}>
              <div
                onClick={() => setShowZoomDropdown(!showZoomDropdown)}
                style={{ alignSelf: 'stretch', paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', cursor: 'pointer' }}
              >
                <div style={{ color: '#323232', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px', wordWrap: 'break-word' }}>{zoom}%</div>
                <div style={{ fontSize: 12, transition: 'transform 0.2s ease', transform: showZoomDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
              </div>

              {/* Zoom Dropdown */}
              {showZoomDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'white',
                  borderRadius: 12,
                  border: '1px solid #E6E6EC',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 1000,
                  minWidth: 100,
                  overflow: 'hidden'
                }}>
                  {zoomPresets.map((preset) => (
                    <div
                      key={preset}
                      onClick={() => {
                        setZoom(preset);
                        setShowZoomDropdown(false);
                      }}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        background: zoom === preset ? '#F5F5F5' : 'white',
                        color: '#323232',
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans',
                        fontWeight: zoom === preset ? '600' : '500',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (zoom !== preset) e.currentTarget.style.background = '#F9FAFB';
                      }}
                      onMouseLeave={(e) => {
                        if (zoom !== preset) e.currentTarget.style.background = 'white';
                      }}
                    >
                      {preset}%
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setZoom(prev => Math.min(200, prev + 25))}
              style={{ width: 32, height: 32, background: 'white', border: 'none', borderRadius: 8, outline: '1px #E6E6EC solid', outlineOffset: '-1px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <PlusIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Document Preview */}
        <div ref={documentContainerRef} style={{ width: '100%', flex: 1, padding: 20, overflow: 'auto', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', display: 'flex', background: '#E5E5E5' }}>
          {document ? (
            (() => {
              const fileType = getFileType(document.filename, document.mimeType);

              // For other file types, keep existing rendering
              if (!documentUrl) {
                return (
                  <div style={{
                    padding: 40,
                    background: 'white',
                    borderRadius: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: '#6C6B6E',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans'
                  }}>
                    Loading document...
                  </div>
                );
              }

              switch (fileType) {
                case 'word': // DOCX
                  // If DOCX was converted to PDF for preview, render as PDF
                  if (isDocxConvertedToPdf) {
                    return (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                        <Document
                          file={fileConfig}
                          onLoadSuccess={onDocumentLoadSuccess}
                          onLoadError={(error) => {
                            console.error('❌ PDF Load Error (DOCX preview):', error);
                            console.error('PDF URL:', documentUrl);
                            console.error('Document:', document);
                          }}
                          options={pdfOptions}
                          loading={
                            <div style={{
                              padding: 40,
                              background: 'white',
                              borderRadius: 12,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              color: '#6C6B6E',
                              fontSize: 16,
                              fontFamily: 'Plus Jakarta Sans'
                            }}>
                              Loading DOCX preview...
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
                                Failed to load DOCX preview
                              </div>
                              <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 24 }}>
                                {document.filename}
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await api.get(`/api/documents/${document.id}/download`);
                                    const downloadUrl = response.data.url;
                                    safariDownloadFile(downloadUrl, document.filename);
                                  } catch (error) {
                                    console.error('Download error:', error);
                                    alert('Failed to download document');
                                  }
                                }}
                                style={{
                                  display: 'inline-block',
                                  padding: '12px 24px',
                                  background: '#181818',
                                  color: 'white',
                                  borderRadius: 14,
                                  textDecoration: 'none',
                                  fontSize: 14,
                                  fontWeight: '600',
                                  fontFamily: 'Plus Jakarta Sans',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}>
                                {isSafari() || isIOS() ? 'Open Document' : 'Download Document'}
                              </button>
                            </div>
                          }
                        >
                          {Array.from(new Array(numPages), (el, index) => (
                            <div
                              key={`page_${index + 1}`}
                              ref={(el) => {
                                if (el) {
                                  pageRefs.current[index + 1] = el;
                                }
                              }}
                              data-page-number={index + 1}
                              style={{
                                marginBottom: index < numPages - 1 ? '20px' : '0'
                              }}
                            >
                              <Page
                                pageNumber={index + 1}
                                width={900 * (zoom / 100)}
                                scale={getOptimalPDFScale()}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                loading={
                                  <div style={{
                                    width: 900 * (zoom / 100),
                                    height: 1200 * (zoom / 100),
                                    background: 'white',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#6C6B6E',
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
                    );
                  }
                  // Otherwise show markdown editor
                  return <MarkdownEditor document={document} zoom={zoom} onSave={handleSaveMarkdown} />;

                case 'excel': // XLSX - show markdown editor
                  return <MarkdownEditor document={document} zoom={zoom} onSave={handleSaveMarkdown} />;

                case 'powerpoint': // PPTX - show PPTX preview
                  return <PPTXPreview document={document} zoom={zoom} />;

                case 'pdf':
                  return (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                      <Document
                        file={fileConfig}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={(error) => {
                          console.error('❌ PDF Load Error:', error);
                          console.error('PDF URL:', documentUrl);
                          console.error('Document:', document);
                        }}
                        options={pdfOptions}
                        loading={
                          <div style={{
                            padding: 40,
                            background: 'white',
                            borderRadius: 12,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            color: '#6C6B6E',
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
                              Failed to load PDF
                            </div>
                            <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 24 }}>
                              {document.filename}
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await api.get(`/api/documents/${document.id}/download`);
                                  const downloadUrl = response.data.url;
                                  safariDownloadFile(downloadUrl, document.filename);
                                } catch (error) {
                                  console.error('Download error:', error);
                                  alert('Failed to download document');
                                }
                              }}
                              style={{
                                display: 'inline-block',
                                padding: '12px 24px',
                                background: '#181818',
                                color: 'white',
                                borderRadius: 14,
                                textDecoration: 'none',
                                fontSize: 14,
                                fontWeight: '600',
                                fontFamily: 'Plus Jakarta Sans',
                                border: 'none',
                                cursor: 'pointer'
                              }}>
                              {isSafari() || isIOS() ? 'Open PDF' : 'Download PDF'}
                            </button>
                          </div>
                        }
                      >
                        {Array.from(new Array(numPages), (el, index) => (
                          <div
                            key={`page_${index + 1}`}
                            ref={(el) => {
                              if (el) {
                                pageRefs.current[index + 1] = el;
                              }
                            }}
                            data-page-number={index + 1}
                            style={{
                              marginBottom: index < numPages - 1 ? '20px' : '0'
                            }}
                          >
                            <Page
                              pageNumber={index + 1}
                              width={900 * (zoom / 100)}
                              scale={getOptimalPDFScale()}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              loading={
                                <div style={{
                                  width: 900 * (zoom / 100),
                                  height: 1200 * (zoom / 100),
                                  background: 'white',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#6C6B6E',
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
                  );

                case 'image':
                  return (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {imageLoading && !imageError && (
                        <div style={{
                          padding: 40,
                          background: 'white',
                          borderRadius: 12,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          color: '#6C6B6E',
                          fontSize: 16,
                          fontFamily: 'Plus Jakarta Sans'
                        }}>
                          Loading image...
                        </div>
                      )}
                      {imageError ? (
                        <div style={{
                          padding: 40,
                          background: 'white',
                          borderRadius: 12,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: 64, marginBottom: 20 }}>🖼️</div>
                          <div style={{ fontSize: 18, fontWeight: '600', color: '#32302C', fontFamily: 'Plus Jakarta Sans', marginBottom: 12 }}>
                            Failed to load image
                          </div>
                          <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 24 }}>
                            {document.filename}
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const response = await api.get(`/api/documents/${document.id}/download`);
                                const downloadUrl = response.data.url;
                                safariDownloadFile(downloadUrl, document.filename);
                              } catch (error) {
                                console.error('Download error:', error);
                                alert('Failed to download document');
                              }
                            }}
                            style={{
                              display: 'inline-block',
                              padding: '12px 24px',
                              background: '#181818',
                              color: 'white',
                              borderRadius: 14,
                              textDecoration: 'none',
                              fontSize: 14,
                              fontWeight: '600',
                              fontFamily: 'Plus Jakarta Sans',
                              border: 'none',
                              cursor: 'pointer'
                            }}>
                            {isSafari() || isIOS() ? 'Open Image' : 'Download Image'}
                          </button>
                        </div>
                      ) : (
                        <img
                          src={documentUrl}
                          alt={document.filename}
                          onLoad={() => setImageLoading(false)}
                          onError={() => {
                            setImageLoading(false);
                            setImageError(true);
                          }}
                          style={{
                            maxWidth: `${zoom}%`,
                            height: 'auto',
                            objectFit: 'contain',
                            borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            background: 'white',
                            transition: 'max-width 0.2s ease',
                            display: imageLoading ? 'none' : 'block'
                          }}
                        />
                      )}
                    </div>
                  );

                case 'video':
                  return (
                    <div style={{ maxWidth: '900px', width: '100%' }}>
                      <video
                        src={documentUrl}
                        controls
                        preload="metadata"
                        playsInline
                        style={{
                          width: '100%',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          background: 'black'
                        }}
                        onError={(e) => {
                          console.error('Video loading error:', e);
                          console.error('Video source:', documentUrl);
                          console.error('Document MIME type:', document.mimeType);
                        }}
                        onLoadedMetadata={(e) => {
                          console.log('Video metadata loaded:', e.target.duration);
                        }}
                      >
                        <source src={documentUrl} type={document.mimeType || 'video/mp4'} />
                        Your browser does not support video playback.
                      </video>
                    </div>
                  );

                case 'audio':
                  return (
                    <div style={{
                      background: 'white',
                      padding: 40,
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      maxWidth: '500px',
                      width: '100%'
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 20 }}>🎵</div>
                      <div style={{ fontSize: 18, fontWeight: '600', color: '#32302C', fontFamily: 'Plus Jakarta Sans', marginBottom: 20 }}>
                        {document.filename}
                      </div>
                      <audio src={documentUrl} controls style={{ width: '100%' }}>
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  );

                case 'text':
                case 'code':
                  return <TextCodePreview url={documentUrl} document={document} zoom={zoom} />;

                case 'archive':
                  return (
                    <div style={{
                      background: 'white',
                      padding: 40,
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      maxWidth: '500px',
                      width: '100%'
                    }}>
                      <div style={{ fontSize: 64, marginBottom: 20 }}>📦</div>
                      <div style={{ fontSize: 18, fontWeight: '600', color: '#32302C', fontFamily: 'Plus Jakarta Sans', marginBottom: 12 }}>
                        Archive File
                      </div>
                      <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 24 }}>
                        {document.filename}
                      </div>
                      <div style={{
                        padding: 12,
                        background: '#F5F5F5',
                        borderRadius: 6,
                        fontSize: 14,
                        color: '#6C6B6E',
                        marginBottom: 20
                      }}>
                        Archive files cannot be previewed. Download to extract contents.
                      </div>
                      <a href={documentUrl} download={document.filename} style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        background: '#181818',
                        color: 'white',
                        borderRadius: 8,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: '600',
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        Download File
                      </a>
                    </div>
                  );

                default:
                  return (
                    <div style={{
                      background: 'white',
                      padding: 40,
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      textAlign: 'center',
                      maxWidth: '500px',
                      width: '100%'
                    }}>
                      <div style={{ fontSize: 64, marginBottom: 20 }}>📄</div>
                      <div style={{ fontSize: 18, fontWeight: '600', color: '#32302C', fontFamily: 'Plus Jakarta Sans', marginBottom: 12 }}>
                        Preview Not Available
                      </div>
                      <div style={{ fontSize: 14, color: '#6C6B6E', fontFamily: 'Plus Jakarta Sans', marginBottom: 24 }}>
                        {document.filename}
                      </div>
                      <div style={{
                        padding: 12,
                        background: '#F5F5F5',
                        borderRadius: 6,
                        fontSize: 14,
                        color: '#6C6B6E',
                        marginBottom: 20
                      }}>
                        This file type cannot be previewed in the browser.
                      </div>
                      <a href={documentUrl} download={document.filename} style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        background: '#181818',
                        color: 'white',
                        borderRadius: 8,
                        textDecoration: 'none',
                        fontSize: 14,
                        fontWeight: '600',
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        Download File
                      </a>
                    </div>
                  );
              }
            })()
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6C6B6E',
              fontSize: 16,
              fontFamily: 'Plus Jakarta Sans'
            }}>
              Loading document...
            </div>
          )}
        </div>
      </div>

      {/* Ask Koda Floating Button */}
      {showAskKoda && (
        <div style={{ width: 277, height: 82, right: 20, bottom: 20, position: 'absolute' }}>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAskKoda(false);
            }}
            style={{
              width: 24,
              height: 24,
              right: 0,
              top: 0,
              position: 'absolute',
              background: 'white',
              borderRadius: 100,
              outline: '1px rgba(55, 53, 47, 0.09) solid',
              outlineOffset: '-1px',
              justifyContent: 'center',
              alignItems: 'center',
              display: 'inline-flex',
              border: 'none',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            <div style={{ width: 12, height: 12, position: 'relative', overflow: 'hidden' }}>
              <XCloseIcon style={{ width: 12, height: 12, position: 'absolute', left: 0, top: 0 }} />
            </div>
          </button>
          <div style={{ width: 14, height: 14, right: 44, top: 9, position: 'absolute', background: '#171717', borderRadius: 9999 }} />
          <button
            onClick={() => {
              // Clear current conversation to force a new chat
              sessionStorage.removeItem('currentConversationId');
              navigate(`/chat?documentId=${documentId}`, { state: { newConversation: true } });
            }}
            style={{
              height: 56,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              bottom: 0,
              right: 0,
              position: 'absolute',
              background: '#171717',
              borderRadius: 16,
              justifyContent: 'flex-start',
              alignItems: 'center',
              display: 'inline-flex',
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex' }}>
              <div style={{
                width: 36,
                height: 36,
                padding: 6,
                background: 'white',
                borderRadius: 100,
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
                flexShrink: 0
              }}>
                <img
                  src={logoSvg}
                  alt="Koda"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: '-webkit-optimize-contrast',
                    shapeRendering: 'geometricPrecision'
                  }}
                />
              </div>
              <div style={{ color: 'white', fontSize: 15, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '20px', wordWrap: 'break-word' }}>Need help finding something?</div>
            </div>
          </button>
          <div style={{ width: 7, height: 7, right: 33, top: 0, position: 'absolute', background: '#171717', borderRadius: 9999 }} />
        </div>
      )}
      <NotificationPanel
        showNotificationsPopup={showNotificationsPopup}
        setShowNotificationsPopup={setShowNotificationsPopup}
      />

      {/* Search Modal */}
      {showSearchModal && (
        <SearchInDocumentModal
          documentId={documentId}
          document={document}
          onClose={() => setShowSearchModal(false)}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div
          onClick={() => setShowShareModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              width: 500,
              maxWidth: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ fontSize: 20, fontWeight: '700', fontFamily: 'Plus Jakarta Sans', color: '#323232', marginBottom: 8 }}>
              Export Document
            </div>
            <div style={{ fontSize: 14, fontFamily: 'Plus Jakarta Sans', color: '#6C6B6E', marginBottom: 24 }}>
              {document.filename}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <button
                onClick={async () => {
                  if (document) {
                    try {
                      // Call the download endpoint to get the original file
                      const response = await api.get(`/api/documents/${document.id}/download`);
                      const downloadUrl = response.data.url;

                      // Use Safari-aware download function with the original file URL
                      safariDownloadFile(downloadUrl, document.filename);
                    } catch (error) {
                      console.error('Download error:', error);
                      alert('Failed to download document');
                    }
                  }
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: 14,
                  border: '1px solid #E6E6EC',
                  background: 'white',
                  color: '#323232',
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: 'Plus Jakarta Sans',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <DownloadIcon style={{ width: 20, height: 20 }} />
                Download Document
              </button>
            </div>

            <div style={{
              borderTop: '1px solid #E6E6EC',
              marginTop: 20,
              paddingTop: 20
            }}>
              <div style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#32302C',
                marginBottom: 12,
                fontFamily: 'Plus Jakarta Sans'
              }}>
                Export Document
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <button
                  onClick={() => handleExport('pdf')}
                  style={{
                    width: '100%',
                    padding: 12,
                    background: 'white',
                    border: '1px solid #E6E6EC',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#32302C',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'Plus Jakarta Sans',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#F9FAFB';
                    e.target.style.borderColor = '#D1D5DB';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                    e.target.style.borderColor = '#E6E6EC';
                  }}
                >
                  <img src={pdfIcon} alt="PDF" style={{ width: 30, height: 30, display: 'block' }} />
                  Export as PDF
                </button>

                <button
                  onClick={() => handleExport('docx')}
                  style={{
                    width: '100%',
                    padding: 12,
                    background: 'white',
                    border: '1px solid #E6E6EC',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#32302C',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'Plus Jakarta Sans',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#F9FAFB';
                    e.target.style.borderColor = '#D1D5DB';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                    e.target.style.borderColor = '#E6E6EC';
                  }}
                >
                  <img src={docIcon} alt="DOCX" style={{ width: 30, height: 30, display: 'block' }} />
                  Export as DOCX
                </button>

                {(document.mimeType.includes('spreadsheet') || document.mimeType.includes('excel')) && (
                  <button
                    onClick={() => handleExport('xlsx')}
                    style={{
                      width: '100%',
                      padding: 12,
                      background: 'white',
                      border: '1px solid #E6E6EC',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: '500',
                      color: '#32302C',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'Plus Jakarta Sans',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#F9FAFB';
                      e.target.style.borderColor = '#D1D5DB';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'white';
                      e.target.style.borderColor = '#E6E6EC';
                    }}
                  >
                    <img src={xlsIcon} alt="Excel" style={{ width: 30, height: 30, display: 'block' }} />
                    Export as Excel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          setShowDeleteModal(false);
          try {
            await api.delete(`/api/documents/${documentId}`);
            // Navigate back to previous page or documents page
            navigate('/documents', {
              state: {
                notification: {
                  type: 'success',
                  message: '1 file has been deleted'
                }
              }
            });
          } catch (error) {
            console.error('Error deleting document:', error);
            // Navigate back even on error
            navigate('/documents', {
              state: {
                notification: {
                  type: 'error',
                  message: `Failed to delete document: ${error.response?.data?.error || error.message}`
                }
              }
            });
          }
        }}
        itemName={document.filename}
      />

      {/* Category Modal */}
      {showCategoryModal && (
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
            maxWidth: 400,
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
                Move to Category
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedCategory(null);
                  setNewCategoryName('');
                }}
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
                <XCloseIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Selected Document Display */}
            {document && (
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
                    src={(() => {
                      const filename = document.filename.toLowerCase();
                      if (filename.match(/\.(pdf)$/)) return pdfIcon;
                      if (filename.match(/\.(jpg|jpeg)$/)) return jpgIcon;
                      if (filename.match(/\.(png)$/)) return pngIcon;
                      if (filename.match(/\.(doc|docx)$/)) return docIcon;
                      if (filename.match(/\.(xls|xlsx)$/)) return xlsIcon;
                      if (filename.match(/\.(ppt|pptx)$/)) return pptxIcon;
                      return docIcon;
                    })()}
                    alt="File icon"
                    style={{
                      width: 40,
                      height: 40,
                      imageRendering: '-webkit-optimize-contrast',
                      objectFit: 'contain',
                      shapeRendering: 'geometricPrecision',
                      flexShrink: 0
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
                      {document.filename}
                    </div>
                    <div style={{
                      color: '#6C6B6E',
                      fontSize: 12,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '400'
                    }}>
                      {((document.fileSize || 0) / 1024 / 1024).toFixed(2)} MB
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
                {categories.filter(f => f.name.toLowerCase() !== 'recently added').map((category) => {
                  const fileCount = category._count?.documents || 0;
                  return (
                    <div
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      style={{
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 12,
                        paddingBottom: 12,
                        background: selectedCategory === category.id ? '#F5F5F5' : 'white',
                        borderRadius: 12,
                        border: selectedCategory === category.id ? '2px #32302C solid' : '1px #E6E6EC solid',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCategory !== category.id) {
                          e.currentTarget.style.background = '#F9FAFB';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCategory !== category.id) {
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
                        <CategoryIcon emoji={category.emoji} style={{width: 18, height: 18}} />
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
                        {fileCount || 0} {fileCount === 1 ? 'File' : 'Files'}
                      </div>

                      {/* Checkmark */}
                      {selectedCategory === category.id && (
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

              {/* Create New Category Button */}
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setShowCreateCategoryModal(true);
                }}
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

            {/* Footer Buttons */}
            <div style={{
              width: '100%',
              paddingLeft: 24,
              paddingRight: 24,
              display: 'flex',
              gap: 8
            }}>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedCategory(null);
                  setNewCategoryName('');
                }}
                style={{
                  flex: 1,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: '#F5F5F5',
                  borderRadius: 100,
                  border: '1px #E6E6EC solid',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
              >
                <div style={{
                  color: '#323232',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}>
                  Cancel
                </div>
              </button>
              <button
                onClick={async () => {
                  if (!selectedCategory) {
                    alert('Please select a category');
                    return;
                  }
                  try {
                    await api.patch(`/api/documents/${documentId}`, {
                      folderId: selectedCategory
                    });
                    alert('Document moved successfully');
                    setShowCategoryModal(false);
                    setSelectedCategory(null);

                    // Refresh document
                    const response = await api.get(`/api/documents/${documentId}/status`);
                    setDocument(response.data);

                    // Refresh categories
                    const catResponse = await api.get('/api/folders');
                    setCategories(catResponse.data.folders || []);
                  } catch (error) {
                    console.error('Error moving document:', error);
                    alert('Failed to move document: ' + (error.response?.data?.error || error.message));
                  }
                }}
                disabled={!selectedCategory}
                style={{
                  flex: 1,
                  paddingLeft: 18,
                  paddingRight: 18,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: selectedCategory ? '#32302C' : '#E6E6EC',
                  borderRadius: 100,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  cursor: selectedCategory ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedCategory) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <div style={{
                  color: selectedCategory ? 'white' : '#9CA3AF',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}>
                  Add
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
