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
import { ReactComponent as ArrowLeftIcon } from '../assets/arrow-narrow-left.svg';
import { ReactComponent as LogoutWhiteIcon } from '../assets/Logout-white.svg';
import logoSvg from '../assets/logo.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can.svg';
import { ReactComponent as PrinterIcon } from '../assets/printer.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as PlusIcon } from '../assets/Plus.svg';
import { ReactComponent as MinusIcon } from '../assets/Minus.svg';
import { ReactComponent as StarIcon } from '../assets/Star.svg';
import { ReactComponent as XCloseIcon } from '../assets/x-close.svg';
import folderIcon from '../assets/folder_icon.svg';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import xlsIcon from '../assets/xls.png';
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
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAskKoda, setShowAskKoda] = useState(true);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

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

  // Handler for regenerating preview (markdown/slides)
  const handleRegeneratePreview = async () => {
    if (!document) return;

    try {
      setIsRegenerating(true);
      console.log('Regenerating preview for document:', documentId);

      // Call reprocess endpoint to regenerate markdown/slides
      const response = await api.post(`/api/documents/${documentId}/reprocess`);
      console.log('Reprocess response:', response.data);

      // Reload the document to get fresh metadata
      const updatedDoc = await api.get(`/api/documents/${documentId}/status`);

      // Update document state
      setDocument(updatedDoc.data);

      // Show success message
      alert('Preview regenerated successfully! The page will reload.');

      // Reload the page to show updated preview
      window.location.reload();
    } catch (error) {
      console.error('Error regenerating preview:', error);
      alert('Failed to regenerate preview. Please try again.');
    } finally {
      setIsRegenerating(false);
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

  // State to hold the actual document URL (with backend URL prepended for API endpoints)
  const [actualDocumentUrl, setActualDocumentUrl] = useState(null);
  const [isFetchingImage, setIsFetchingImage] = useState(false);

  // Process document URL to use correct backend URL for API endpoints
  // For encrypted images, fetch with auth and create blob URL
  useEffect(() => {
    if (!documentUrl) {
      setActualDocumentUrl(null);
      return;
    }

    // Check if it's a relative API path (starts with /api/) or already a full backend URL
    const isRelativeApiPath = documentUrl.startsWith('/api/');
    const isBackendUrl = documentUrl.includes('koda-backend.ngrok.app') || documentUrl.includes('localhost:5000');
    const isSupabaseUrl = documentUrl.includes('supabase.co');
    const isStreamEndpoint = documentUrl.includes('/stream');

    // For encrypted images (stream endpoint), fetch with auth and create blob URL
    if (isStreamEndpoint && document?.mimeType?.startsWith('image/')) {
      console.log(`🔐 Encrypted image detected, fetching with auth: ${documentUrl}`);
      setIsFetchingImage(true);

      const token = localStorage.getItem('accessToken');
      fetch(documentUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          console.log(`✅ Created blob URL for encrypted image: ${blobUrl}`);
          setActualDocumentUrl(blobUrl);
          setIsFetchingImage(false);
        })
        .catch(error => {
          console.error('❌ Failed to fetch encrypted image:', error);
          setIsFetchingImage(false);
          setImageError(true);
        });

      // Cleanup blob URL when component unmounts or URL changes
      return () => {
        if (actualDocumentUrl && actualDocumentUrl.startsWith('blob:')) {
          URL.revokeObjectURL(actualDocumentUrl);
        }
      };
    } else if (isRelativeApiPath) {
      // Relative API path - prepend backend URL
      const API_URL = process.env.REACT_APP_API_URL || 'https://koda-backend.ngrok.app';
      const fullUrl = `${API_URL}${documentUrl}`;
      console.log(`🔗 Relative API path detected, using backend URL: ${fullUrl}`);
      setActualDocumentUrl(fullUrl);
    } else if (isBackendUrl || isSupabaseUrl) {
      // Already a full URL (backend or Supabase) - use directly
      console.log(`🔗 Full URL detected, using directly: ${documentUrl}`);
      setActualDocumentUrl(documentUrl);
    } else {
      // Unknown URL format - use as is
      console.log(`⚠️ Unknown URL format, using as is: ${documentUrl}`);
      setActualDocumentUrl(documentUrl);
    }
  }, [documentUrl, document?.mimeType]);

  // Memoize the file config for PDF.js
  const fileConfig = useMemo(() => {
    if (!actualDocumentUrl) return null;

    // For preview-pdf endpoints, fetch with auth headers
    if (actualDocumentUrl.includes('/preview-pdf')) {
      const token = localStorage.getItem('accessToken');
      return {
        url: actualDocumentUrl,
        httpHeaders: {
          'Authorization': `Bearer ${token}`
        }
      };
    }

    return { url: actualDocumentUrl };
  }, [actualDocumentUrl]);

  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjs.version + '/cmaps/',
    cMapPacked: true,
    // Add better error handling for PDF loading
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

          // AUTO-REGENERATE: Check if markdown content is missing for Excel (keep for Excel only)
          const isExcel = foundDocument.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          const hasMarkdown = foundDocument.metadata && foundDocument.metadata.markdownContent;

          if (isExcel && !hasMarkdown) {
            console.log('⚠️ Markdown content missing, auto-regenerating...');
            // Trigger reprocess in background (don't await, let it run async)
            api.post(`/api/documents/${documentId}/reprocess`)
              .then(response => {
                console.log('✅ Auto-regeneration completed:', response.data);
                // Reload document to get updated metadata
                return api.get(`/api/documents/${documentId}/status`);
              })
              .then(response => {
                setDocument(response.data);
                console.log('✅ Document reloaded with markdown content');
              })
              .catch(error => {
                console.error('❌ Auto-regeneration failed:', error);
              });
          }

          // DOCX FILES: Fetch preview information from backend
          // Backend will return previewType='pdf' with a URL to the converted PDF
          const isDocx = foundDocument.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

          if (isDocx) {
            console.log('📄 DOCX detected - fetching preview information from backend...');
            const previewResponse = await api.get(`/api/documents/${documentId}/preview`);
            const { previewType, previewUrl } = previewResponse.data;

            console.log(`📋 Preview type: ${previewType}, URL: ${previewUrl}`);

            // For DOCX converted to PDF, set the preview-pdf URL
            if (previewType === 'pdf' && previewUrl) {
              setDocumentUrl(previewUrl);
            }
          } else {
            // For non-DOCX files, use the existing view-url logic
            // PERFORMANCE OPTIMIZATION: Use signed URLs for direct access to Supabase Storage (non-encrypted files)
            // For encrypted files, use stream endpoint for server-side decryption
            // This eliminates the backend proxy bottleneck for 50-70% faster loading (non-encrypted files)

            // Fetch the view URL from backend
            console.log('📡 Fetching view URL for document...');
            const viewUrlResponse = await api.get(`/api/documents/${documentId}/view-url`);
            const { url: documentUrl, encrypted } = viewUrlResponse.data;

            // Check if this is a stream endpoint (for encrypted files) or signed URL (for non-encrypted files)
            const isStreamEndpoint = documentUrl.includes('/stream');

            if (isStreamEndpoint) {
              // Encrypted file - use stream endpoint directly (no caching needed)
              console.log('🔐 Document is encrypted, using stream endpoint for server-side decryption');
              setDocumentUrl(documentUrl);
            } else {
              // Non-encrypted file - use signed URL with caching
              const cacheKey = `document_signed_url_${documentId}`;
              const cachedData = sessionStorage.getItem(cacheKey);

              if (cachedData) {
                try {
                  const { url, timestamp } = JSON.parse(cachedData);
                  const age = Date.now() - timestamp;
                  // Signed URLs are valid for 1 hour (3600000ms), refresh if older than 50 minutes
                  if (age < 3000000) {
                    console.log('⚡ Using cached signed URL for non-encrypted document');
                    setDocumentUrl(url);
                  } else {
                    throw new Error('Cached URL expired');
                  }
                } catch (err) {
                  // Cache invalid or expired, use new signed URL
                  console.log('🔄 Cached URL expired, using new signed URL');
                  sessionStorage.removeItem(cacheKey);
                  sessionStorage.setItem(cacheKey, JSON.stringify({
                    url: documentUrl,
                    timestamp: Date.now()
                  }));
                  setDocumentUrl(documentUrl);
                }
              } else {
                // No cache, use signed URL and cache it
                console.log('🚀 Direct signed URL obtained for non-encrypted document');
                sessionStorage.setItem(cacheKey, JSON.stringify({
                  url: documentUrl,
                  timestamp: Date.now()
                }));
                setDocumentUrl(documentUrl);
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
                onClick={() => {
                  if (documentUrl && document) {
                    // Create a hidden iframe for printing
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
                          console.error('Print error:', e);
                        }
                        // Remove iframe after printing
                        setTimeout(() => {
                          window.document.body.removeChild(iframe);
                        }, 1000);
                      }, 500);
                    };

                    iframe.src = documentUrl;
                  }
                }}
                style={{ width: 52, height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer' }}
              >
                <PrinterIcon style={{ width: 44, height: 44 }} />
              </button>
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
                style={{ width: 52, height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: 'white', overflow: 'hidden', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer' }}
                title={isSafari() || isIOS() ? 'Open in new tab' : 'Download'}
              >
                <DownloadIcon style={{ width: 44, height: 44 }} />
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
              onClick={() => setShowShareModal(true)}
              style={{ flex: '1 1 0', height: 52, background: '#181818', overflow: 'hidden', borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8, display: 'flex', border: 'none', cursor: 'pointer' }}
            >
              <LogoutWhiteIcon style={{ width: 24, height: 24 }} />
              <div style={{ color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize', lineHeight: '24px', wordWrap: 'break-word' }}>Export</div>
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
                case 'word': // DOCX - show as PDF (converted during upload)
                  // DOCX files are converted to PDF on the backend and displayed as PDF
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
                          src={actualDocumentUrl}
                          alt={document.filename}
                          onLoad={() => {
                            console.log(`✅ Image loaded successfully: ${actualDocumentUrl}`);
                            setImageLoading(false);
                          }}
                          onError={(e) => {
                            console.error(`❌ Image failed to load: ${actualDocumentUrl}`);
                            console.error('Image error event:', e);
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
                onClick={async (e) => {
                  e.stopPropagation();
                  console.log('Download button clicked');
                  if (document) {
                    try {
                      // Call the download endpoint to get the signed URL
                      const response = await api.get(`/api/documents/${document.id}/download`);
                      const signedUrl = response.data.url;

                      // Fetch the file as a blob to avoid CORS issues with download attribute
                      const fileResponse = await fetch(signedUrl);
                      const blob = await fileResponse.blob();

                      // Create object URL and trigger download
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = blobUrl;
                      link.download = document.filename;
                      link.style.display = 'none';
                      document.body.appendChild(link);
                      link.click();

                      // Clean up
                      setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(blobUrl);
                      }, 100);
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
                <DownloadIcon style={{ width: 20, height: 20, pointerEvents: 'none' }} />
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
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Export PDF clicked');
                    handleExport('pdf');
                  }}
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
                    e.currentTarget.style.background = '#F9FAFB';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#E6E6EC';
                  }}
                >
                  <img src={pdfIcon} alt="PDF" style={{ width: 30, height: 30, display: 'block', pointerEvents: 'none' }} />
                  Export as PDF
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Export DOCX clicked');
                    handleExport('docx');
                  }}
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
                    e.currentTarget.style.background = '#F9FAFB';
                    e.currentTarget.style.borderColor = '#D1D5DB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#E6E6EC';
                  }}
                >
                  <img src={docIcon} alt="DOCX" style={{ width: 30, height: 30, display: 'block', pointerEvents: 'none' }} />
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
          try {
            await api.delete(`/api/documents/${documentId}`);
            alert('Document deleted successfully');
            navigate('/documents');
          } catch (error) {
            console.error('Error deleting document:', error);
            alert('Failed to delete document: ' + (error.response?.data?.error || error.message));
          }
        }}
        itemName={document.filename}
      />

      {/* Category Modal */}
      {showCategoryModal && (
        <div
          onClick={() => setShowCategoryModal(false)}
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
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ fontSize: 20, fontWeight: '700', fontFamily: 'Plus Jakarta Sans', color: '#323232', marginBottom: 8 }}>
              Move to Category
            </div>
            <div style={{ fontSize: 14, fontFamily: 'Plus Jakarta Sans', color: '#6C6B6E', marginBottom: 24 }}>
              {document.filename}
            </div>

            {/* Create New Category */}
            <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #E6E6EC' }}>
              <div style={{ fontSize: 16, fontWeight: '600', fontFamily: 'Plus Jakarta Sans', color: '#323232', marginBottom: 12 }}>
                Create New Category
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name..."
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #E6E6EC',
                    fontSize: 14,
                    fontFamily: 'Plus Jakarta Sans',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={async () => {
                    if (!newCategoryName.trim()) {
                      alert('Please enter a category name');
                      return;
                    }
                    try {
                      const createResponse = await api.post('/api/folders', { name: newCategoryName });
                      const newCategory = createResponse.data.folder;

                      // Move document to new category
                      await api.patch(`/api/documents/${documentId}`, {
                        folderId: newCategory.id
                      });

                      alert('Document moved to new category successfully');
                      setShowCategoryModal(false);
                      setNewCategoryName('');

                      // Refresh categories
                      const response = await api.get('/api/folders');
                      setCategories(response.data.folders || []);
                    } catch (error) {
                      console.error('Error creating category:', error);
                      alert('Failed to create category: ' + (error.response?.data?.error || error.message));
                    }
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#181818',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: '600',
                    fontFamily: 'Plus Jakarta Sans',
                    cursor: 'pointer'
                  }}
                >
                  Create
                </button>
              </div>
            </div>

            {/* Select Existing Category */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: '600', fontFamily: 'Plus Jakarta Sans', color: '#323232', marginBottom: 12 }}>
                Or Select Existing Category
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflow: 'auto' }}>
                {categories.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans' }}>
                    No categories available. Create one above.
                  </div>
                ) : (
                  categories.map((category) => (
                    <div
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: selectedCategory === category.id ? '2px solid #181818' : '1px solid #E6E6EC',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: selectedCategory === category.id ? '#F9FAFB' : 'white',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <img src={folderIcon} alt="Folder" style={{ width: 24, height: 24 }} />
                      <div style={{ fontSize: 14, fontWeight: '600', fontFamily: 'Plus Jakarta Sans', color: '#323232' }}>
                        {category.name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedCategory(null);
                  setNewCategoryName('');
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
                  cursor: 'pointer'
                }}
              >
                Cancel
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
                  } catch (error) {
                    console.error('Error moving document:', error);
                    alert('Failed to move document: ' + (error.response?.data?.error || error.message));
                  }
                }}
                disabled={!selectedCategory}
                style={{
                  padding: '12px 24px',
                  borderRadius: 14,
                  border: 'none',
                  background: selectedCategory ? '#181818' : '#999',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: '600',
                  fontFamily: 'Plus Jakarta Sans',
                  cursor: selectedCategory ? 'pointer' : 'not-allowed'
                }}
              >
                Move to Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
