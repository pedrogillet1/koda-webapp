import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../context/DocumentsContext';
import { useDocumentSelection } from '../hooks/useDocumentSelection.js';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { colors, spacing, radius, typography } from '../constants/designTokens';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import CreateCategoryModal from './CreateCategoryModal';
import EditCategoryModal from './EditCategoryModal';
import MoveToCategoryModal from './MoveToCategoryModal';
import UploadModal from './UploadModal';
import UniversalUploadModal from './UniversalUploadModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as LogoutBlackIcon } from '../assets/Logout-black.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can-red.svg';
import { ReactComponent as TrashCanLightIcon } from '../assets/Trash can-light.svg';
import { ReactComponent as EditIcon } from '../assets/Edit 5.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as DotsIcon } from '../assets/dots.svg';
import { ReactComponent as UploadIconMenu } from '../assets/upload.svg';
import { ReactComponent as XCloseIcon } from '../assets/x-close.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import logoSvg from '../assets/logo.svg';
import api from '../services/api';
import pdfIcon from '../assets/pdf-icon.png';
import docIcon from '../assets/doc-icon.png';
import txtIcon from '../assets/txt-icon.png';
import xlsIcon from '../assets/xls.png';
import jpgIcon from '../assets/jpg-icon.png';
import pngIcon from '../assets/png-icon.png';
import pptxIcon from '../assets/pptx.png';
import folderIcon from '../assets/folder_icon.svg';
import movIcon from '../assets/mov.png';
import mp4Icon from '../assets/mp4.png';
import mp3Icon from '../assets/mp3.svg';
import CategoryIcon from './CategoryIcon';
import DocumentsLoadingSkeleton from './DocumentsLoadingSkeleton';
import filesIcon from '../assets/files-icon.svg';

const DocumentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess } = useToast();
  const isMobile = useIsMobile();

  // Get global state from context
  const {
    documents: contextDocuments,
    folders: contextFolders,
    loading,
    deleteDocument,
    renameDocument,
    moveToFolder,
    createFolder,
    deleteFolder,
    getRootFolders,
    getDocumentCountByFolder,
    refreshAll
  } = useDocuments();

  // Selection hook for Recently Added section
  const {
    selectedDocuments,
    isSelectMode,
    toggleSelectMode,
    toggleDocument,
    clearSelection,
    isSelected
  } = useDocumentSelection();

  // Only UI state remains local
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedDocumentForCategory, setSelectedDocumentForCategory] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(null);
  const [categoryMenuPosition, setCategoryMenuPosition] = useState({ top: 0, left: 0 });
  const [editingCategory, setEditingCategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState(null);
  const [showAskKoda, setShowAskKoda] = useState(true);
  const [showUniversalUploadModal, setShowUniversalUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [droppedFiles, setDroppedFiles] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Sorting state for Your Files table
  const [sortColumn, setSortColumn] = useState('date'); // 'name', 'type', 'size', 'date'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  // Refs to track current state for event listener (avoids stale closures)
  const openDropdownIdRef = useRef(openDropdownId);
  const categoryMenuOpenRef = useRef(categoryMenuOpen);

  // Keep refs in sync with state
  useEffect(() => {
    openDropdownIdRef.current = openDropdownId;
  }, [openDropdownId]);

  useEffect(() => {
    categoryMenuOpenRef.current = categoryMenuOpen;
  }, [categoryMenuOpen]);

  // Close dropdown when clicking outside - attached ONCE on mount
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Use refs to get current state values (avoids stale closures)
      if (openDropdownIdRef.current && !event.target.closest('[data-dropdown]')) {
        setOpenDropdownId(null);
      }
      if (categoryMenuOpenRef.current && !event.target.closest('[data-category-menu]')) {
        setCategoryMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // Empty array - listener attached ONCE, uses refs for current state

  // Refresh data when component mounts or becomes visible
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Computed categories (auto-updates when folders or documents change!)
  const categories = useMemo(() => {
    console.log('🔍 [CATEGORIES] Calculating categories...');
    console.log('🔍 [CATEGORIES] Total folders:', contextFolders.length);
    console.log('🔍 [CATEGORIES] All folders:', contextFolders.map(f => ({ id: f.id, name: f.name, parentId: f.parentFolderId })));
    console.log('🔍 [CATEGORIES] Total documents:', contextDocuments.length);

    const result = getRootFolders()
      .filter(folder => folder.name.toLowerCase() !== 'recently added')
      .map(folder => {
        // ⚡ OPTIMIZED: Use backend-provided counts directly from folder object
        const fileCount = folder._count?.totalDocuments ?? folder._count?.documents ?? 0;
        console.log(`📁 Category "${folder.name}" (${folder.id}):`, {
          fileCount,
          backendCount: folder._count,
          directDocs: contextDocuments.filter(d => d.folderId === folder.id).length,
          subfolders: contextFolders.filter(f => f.parentFolderId === folder.id).length
        });

        return {
          id: folder.id,
          name: folder.name,
          emoji: folder.emoji || '__FOLDER_SVG__',
          fileCount,
          folderCount: folder._count?.subfolders || 0,
          count: fileCount
        };
      });

    console.log('Final categories:', result);
    return result;
  }, [contextFolders, contextDocuments, getRootFolders]); // Removed getDocumentCountByFolder dependency

  // Computed available categories for modal
  const availableCategories = useMemo(() => {
    return getRootFolders();
  }, [contextFolders, getRootFolders]);

  const handleCreateCategory = async (category) => {
    try {
      console.log('Creating category with:', category);

      // Use context to create folder (instant UI update!)
      const newFolder = await createFolder(category.name, category.emoji);
      console.log('New folder created:', newFolder);

      // If documents were selected, move them to the folder (instant UI updates!)
      if (category.selectedDocuments && category.selectedDocuments.length > 0) {
        console.log('Moving documents to folder:', category.selectedDocuments);
        await Promise.all(
          category.selectedDocuments.map(docId =>
            moveToFolder(docId, newFolder.id)
          )
        );
        console.log('Documents moved successfully');
      }

      // No manual refresh needed - context auto-updates!
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      // Use context to delete folder (instant UI update!)
      await deleteFolder(categoryId);
      showSuccess('1 folder has been deleted');
    } catch (error) {
      console.error('Error deleting folder:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete folder';
      alert(errorMessage);
    }
  };

  // Handle document download
  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/api/documents/${doc.id}/stream?download=true`, {
        responseType: 'blob'
      });

      // Use the blob directly from response (already has correct mime type)
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  // Handle document rename
  const handleRename = (doc) => {
    setItemToRename({ type: 'document', id: doc.id, name: doc.filename });
    setShowRenameModal(true);
    setOpenDropdownId(null);
  };

  // Handle rename confirmation from modal
  const handleRenameConfirm = async (newName) => {
    if (!itemToRename) return;

    try {
      if (itemToRename.type === 'document') {
        // Use context to rename (instant UI update!)
        await renameDocument(itemToRename.id, newName);
      }

      setShowRenameModal(false);
      setItemToRename(null);
    } catch (error) {
      console.error('Error renaming:', error);
      alert(`Failed to rename ${itemToRename.type}`);
    }
  };

  // Handle document delete with proper error handling
  const handleDelete = async (docId) => {
    try {
      // Use context to delete (instant UI update with optimistic update!)
      const result = await deleteDocument(docId);

      // Show success message only after successful delete
      if (result && result.success) {
        showSuccess('1 file has been deleted');
      }

      setOpenDropdownId(null);
    } catch (error) {
      console.error('❌ Error deleting document:', error);

      // Show user-friendly error message
      const errorMessage = error.filename
        ? `Failed to delete "${error.filename}": ${error.message}`
        : `Failed to delete document: ${error.message}`;

      alert(errorMessage);
    }
  };

  // Handle add to category
  const handleAddToCategory = async (doc) => {
    setSelectedDocumentForCategory(doc);
    setShowCategoryModal(true);
    setOpenDropdownId(null);
  };

  const handleCategorySelection = async () => {
    if (!selectedCategoryId || !selectedDocumentForCategory) return;

    try {
      // Use context to move document (instant UI update!)
      await moveToFolder(selectedDocumentForCategory.id, selectedCategoryId);

      setShowCategoryModal(false);
      setSelectedDocumentForCategory(null);
      setSelectedCategoryId(null);
    } catch (error) {
      console.error('Error adding document to category:', error);
      alert('Failed to add document to category');
    }
  };

  // Filter documents based on search query (auto-updates!)
  const filteredDocuments = useMemo(() => {
    return contextDocuments.filter(doc =>
      (doc.filename || doc.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contextDocuments, searchQuery]);

  // Get file icon based on document type
  const getFileIcon = (doc) => {
    // Prioritize MIME type over file extension (more reliable for encrypted filenames)
    const mimeType = doc?.mimeType || '';
    const filename = doc?.filename || '';

    // ========== VIDEO FILES ==========
    // QuickTime videos (.mov) - MUST check before generic video check
    if (mimeType === 'video/quicktime') {
      return movIcon; // Blue MOV icon
    }

    // MP4 videos - specific check only
    if (mimeType === 'video/mp4') {
      return mp4Icon; // Pink MP4 icon
    }

    // Other video types - use generic video icon (mp4)
    if (mimeType.startsWith('video/')) {
      return mp4Icon;
    }

    // ========== AUDIO FILES ==========
    if (mimeType.startsWith('audio/') || mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
      return mp3Icon;
    }

    // ========== DOCUMENT FILES ==========
    if (mimeType === 'application/pdf') return pdfIcon;
    if (mimeType.includes('word') || mimeType.includes('msword')) return docIcon;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return xlsIcon;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return pptxIcon;
    if (mimeType === 'text/plain' || mimeType === 'text/csv') return txtIcon;

    // ========== IMAGE FILES ==========
    if (mimeType.startsWith('image/')) {
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return jpgIcon;
      if (mimeType.includes('png')) return pngIcon;
      return pngIcon; // Default for other images
    }

    // ========== FALLBACK: Extension-based check ==========
    // (For files where MIME type is not set or is generic)
    if (filename) {
      const ext = filename.toLowerCase();
      // Documents
      if (ext.match(/\.(pdf)$/)) return pdfIcon;
      if (ext.match(/\.(doc|docx)$/)) return docIcon;
      if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
      if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
      if (ext.match(/\.(txt)$/)) return txtIcon;

      // Images
      if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
      if (ext.match(/\.(png)$/)) return pngIcon;

      // Videos
      if (ext.match(/\.(mov)$/)) return movIcon;
      if (ext.match(/\.(mp4)$/)) return mp4Icon;

      // Audio
      if (ext.match(/\.(mp3|wav|aac|m4a)$/)) return mp3Icon;

      // Adobe Premiere Pro / Video editing files use generic file icon
      // .prproj, .pek, .cfa - let them fall through to default
    }

    // Final fallback - for unknown/binary files (including .prproj, .pek, .cfa)
    return txtIcon;
  };

  // Handle page-level file drop
  const handlePageDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    console.log('📁 DocumentsPage - Files dropped:', files);
    console.log('📁 File count:', files.length);
    if (files.length > 0) {
      // Set both states together using functional updates to ensure they batch correctly
      setDroppedFiles(files);
      // Use setTimeout to ensure the files state is set before opening modal
      setTimeout(() => {
        setShowUniversalUploadModal(true);
        console.log('📁 Modal opened with files');
      }, 0);
    }
  }, []);

  const handlePageDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only show upload overlay for external file drags, not internal document drags
    const hasFiles = e.dataTransfer.types.includes('Files');
    setIsDraggingOver(hasFiles);
  };

  const handlePageDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  // ✅ Show loading skeleton on first load (when loading and no data)
  if (loading && contextDocuments.length === 0 && contextFolders.length === 0) {
    return (
      <div style={{width: '100%', height: '100vh', background: '#F4F4F6', overflow: 'hidden', display: 'flex'}}>
        <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />
        <div style={{flex: 1, overflow: 'hidden'}}>
          <DocumentsLoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div style={{width: '100%', height: '100vh', background: '#F4F4F6', overflow: 'hidden', display: 'flex'}}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          paddingTop: isMobile ? '70px' : 0, // Space for hamburger button on mobile
          width: isMobile ? '100%' : 'auto'
        }}
        onDrop={handlePageDrop}
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
      >
        {/* Header */}
        <div style={{
          height: 84,
          paddingLeft: spacing.xl,
          paddingRight: spacing.xl,
          background: colors.white,
          borderBottom: `1px solid ${colors.gray[300]}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            color: colors.gray[900],
            fontSize: typography.sizes.xl,
            fontFamily: typography.fontFamily,
            fontWeight: typography.weights.bold,
            textTransform: 'capitalize',
            lineHeight: typography.lineHeights.xl
          }}>
            Documents
          </div>
          {/* Hide search and select controls on mobile */}
          {!isMobile && (
          <div style={{display: 'flex', alignItems: 'center', gap: spacing.md}}>
            {isSelectMode ? (
              <>
                {/* Delete Button in Select Mode */}
                <button
                  onClick={() => {
                    if (selectedDocuments.size === 0) return;

                    // Set up bulk delete info and show modal
                    setItemToDelete({
                      type: 'bulk-documents',
                      ids: Array.from(selectedDocuments),
                      count: selectedDocuments.size,
                      name: `${selectedDocuments.size} document${selectedDocuments.size > 1 ? 's' : ''}`
                    });
                    setShowDeleteModal(true);
                  }}
                  disabled={selectedDocuments.size === 0}
                  style={{
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: selectedDocuments.size === 0 ? '#F3F3F5' : '#E4E4E8',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    border: 'none',
                    cursor: selectedDocuments.size === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedDocuments.size === 0 ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDocuments.size > 0) {
                      e.currentTarget.style.background = '#D8D8DE';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selectedDocuments.size === 0 ? '#F3F3F5' : '#E4E4E8';
                  }}
                >
                  <TrashCanLightIcon style={{ width: 18, height: 18 }} />
                  <div style={{
                    color: selectedDocuments.size === 0 ? '#A0A0A5' : '#181818',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    Delete
                  </div>
                </button>

                {/* Move Button in Select Mode */}
                <button
                  onClick={() => {
                    if (selectedDocuments.size === 0) return;
                    // Open category selection modal for moving
                    alert('Move functionality - implement folder selection modal');
                  }}
                  disabled={selectedDocuments.size === 0}
                  style={{
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: '#F5F5F5',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    border: 'none',
                    cursor: selectedDocuments.size === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedDocuments.size === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    color: '#32302C',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '24px'
                  }}>
                    Move
                  </div>
                </button>

                {/* Selected Count */}
                <div style={{
                  color: '#32302C',
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px'
                }}>
                  {selectedDocuments.size} selected
                </div>

                {/* Close Button */}
                <button
                  onClick={() => {
                    clearSelection();
                    toggleSelectMode();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <CloseIcon style={{ width: 16, height: 16 }} />
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    position: 'relative',
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'transform 0.15s ease',
                    cursor: 'text'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <SearchIcon style={{position: 'absolute', left: 16, width: 20, height: 20, zIndex: 1}} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search any documents..."
                    style={{
                      height: '100%',
                      minWidth: 250,
                      paddingLeft: 46,
                      paddingRight: 16,
                      background: '#F5F5F5',
                      borderRadius: 100,
                      border: '1px #E6E6EC solid',
                      outline: 'none',
                      color: '#32302C',
                      fontSize: 16,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '500',
                      lineHeight: '24px',
                      transition: 'box-shadow 0.15s ease, border-color 0.15s ease'
                    }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px rgba(50, 48, 44, 0.1)'; e.target.style.borderColor = '#A2A2A7'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#E6E6EC'; }}
                  />

                {/* Search Results Dropdown */}
                {searchQuery && (
                  <div style={{
                    position: 'absolute',
                    top: 60,
                    left: 0,
                    right: 0,
                    minWidth: 400,
                    maxHeight: 400,
                    background: 'white',
                    borderRadius: 14,
                    border: '1px #E6E6EC solid',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}>
                    {filteredDocuments.length > 0 ? (
                      <div style={{padding: 8}}>
                        {filteredDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => {
                              navigate(`/document/${doc.id}`);
                              setSearchQuery('');
                            }}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              cursor: 'pointer',
                              transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <img
                              src={getFileIcon(doc)}
                              alt=""
                              style={{
                                width: 40,
                                height: 40,
                                objectFit: 'contain',
                                flexShrink: 0
                              }}
                            />
                            <div style={{flex: 1, overflow: 'hidden'}}>
                              <div style={{
                                color: '#32302C',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '600',
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
                                fontWeight: '400'
                              }}>
                                {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: 40,
                        textAlign: 'center',
                        color: '#6C6B6E',
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        No documents found matching "{searchQuery}"
                      </div>
                    )}
                  </div>
                )}
                </div>

                {/* Select Button */}
                <button
                  onClick={toggleSelectMode}
                  style={{
                    height: 52,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: '#F5F5F5',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    color: '#32302C',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    Select
                  </div>
                </button>

                <div onClick={() => setShowUniversalUploadModal(true)} style={{height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', borderRadius: 100, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease'}} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                  <LogoutBlackIcon style={{width: 24, height: 24}} />
                  <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Upload a Document</div>
                </div>
              </>
            )}
          </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div style={{flex: 1, padding: spacing.xl, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: spacing.xl}}>
          {/* Smart Categories */}
          <div style={{display: 'flex', flexDirection: 'column', gap: spacing.md}}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: spacing.md}}>
              <div onClick={() => setIsModalOpen(true)} style={{
                padding: `${spacing.lg}px`,
                background: colors.white,
                borderRadius: radius.xl,
                border: `1px solid ${colors.gray[300]}`,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                cursor: 'pointer',
                height: 72,
                boxSizing: 'border-box',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{width: 40, height: 40, background: colors.gray[100], borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <AddIcon style={{ width: 20, height: 20 }} />
                </div>
                <span style={{color: colors.gray[900], fontSize: typography.sizes.sm, fontFamily: typography.fontFamily, fontWeight: typography.weights.semibold, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0}}>Add New Smart Category</span>
              </div>
              {categories.map((category, index) => (
                <div
                  key={index}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = colors.primary[50];
                    e.currentTarget.style.border = `2px dashed ${colors.primary[800]}`;
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.background = colors.white;
                    e.currentTarget.style.border = `1px solid ${colors.gray[300]}`;
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = colors.white;
                    e.currentTarget.style.border = `1px solid ${colors.gray[300]}`;

                    try {
                      const data = JSON.parse(e.dataTransfer.getData('application/json'));

                      if (data.type === 'document') {
                        // Move single document
                        await moveToFolder(data.id, category.id);
                        console.log(`✅ Moved document ${data.id} to folder ${category.id}`);
                      } else if (data.type === 'documents') {
                        // Move multiple documents
                        await Promise.all(
                          data.documentIds.map(docId => moveToFolder(docId, category.id))
                        );
                        console.log(`✅ Moved ${data.documentIds.length} documents to folder ${category.id}`);

                        // Clear selection and exit select mode
                        if (isSelectMode) {
                          clearSelection();
                          toggleSelectMode();
                        }
                      }

                      // ⚡ REMOVED: No need to refreshAll() - moveToFolder already updates state optimistically with instant folder count updates
                    } catch (error) {
                      console.error('❌ Error moving document:', error);
                      // On error, the moveToFolder function will rollback automatically
                    }
                  }}
                  style={{
                    padding: spacing.md,
                    background: colors.white,
                    borderRadius: radius.xl,
                    border: `1px solid ${colors.gray[300]}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    position: 'relative',
                    height: 72,
                    boxSizing: 'border-box',
                    zIndex: categoryMenuOpen === category.id ? 99999 : 1
                  }}
                >
                  <div onClick={() => {
                    console.log('📁 DocumentsPage - Clicking folder:', category.name, 'ID:', category.id);
                    console.log('🔗 DocumentsPage - Navigating to:', `/folder/${category.id}`);
                    navigate(`/folder/${category.id}`);
                  }} style={{display: 'flex', alignItems: 'center', gap: spacing.sm, flex: 1, cursor: 'pointer', minWidth: 0}} onMouseEnter={(e) => e.currentTarget.parentElement.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.parentElement.style.transform = 'translateY(0)'}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                      <CategoryIcon emoji={category.emoji} size={40} />
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: spacing.xs, flex: 1, minWidth: 0}}>
                      <div style={{color: colors.gray[900], fontSize: typography.sizes.sm, fontFamily: typography.fontFamily, fontWeight: typography.weights.semibold, lineHeight: '19.60px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{category.name}</div>
                      <div style={{color: colors.gray[500], fontSize: typography.sizes.sm, fontFamily: typography.fontFamily, fontWeight: typography.weights.medium, lineHeight: '15.40px'}}>
                        {category.fileCount || 0} {category.fileCount === 1 ? 'File' : 'Files'}
                      </div>
                    </div>
                  </div>
                  <div style={{position: 'relative'}} data-category-menu>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (categoryMenuOpen === category.id) {
                          setCategoryMenuOpen(null);
                        } else {
                          const buttonRect = e.currentTarget.getBoundingClientRect();
                          const dropdownHeight = 160;
                          const spaceBelow = window.innerHeight - buttonRect.bottom;
                          const openUpward = spaceBelow < dropdownHeight && buttonRect.top > dropdownHeight;
                          setCategoryMenuPosition({
                            top: openUpward ? buttonRect.top - dropdownHeight - 4 : buttonRect.bottom + 4,
                            left: buttonRect.right - 160
                          });
                          setCategoryMenuOpen(category.id);
                        }
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        background: 'transparent',
                        borderRadius: '50%',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'transform 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <DotsIcon style={{width: 24, height: 24}} />
                    </button>
                    {categoryMenuOpen === category.id && (
                      <div
                        style={{
                          position: 'fixed',
                          top: categoryMenuPosition.top,
                          left: categoryMenuPosition.left,
                          background: 'white',
                          borderRadius: 12,
                          border: '1px solid #E6E6EC',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          zIndex: 10000,
                          minWidth: 160,
                          overflow: 'hidden'
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(category);
                            setShowEditModal(true);
                            setCategoryMenuOpen(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #F5F5F5',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            color: '#32302C',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <EditIcon style={{width: 16, height: 16}} />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Show upload modal for this category
                            setUploadCategoryId(category.id);
                            setShowUniversalUploadModal(true);
                            setCategoryMenuOpen(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #F5F5F5',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            color: '#32302C',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <UploadIconMenu style={{width: 16, height: 16, color: '#32302C'}} />
                          Upload
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete({ type: 'category', id: category.id, name: category.name });
                            setShowDeleteModal(true);
                            setCategoryMenuOpen(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '500',
                            color: '#D92D20',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#FEF3F2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <TrashCanIcon style={{width: 16, height: 16}} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Added - Full Width */}
          <div style={{
            padding: spacing.xxl,
            background: colors.white,
            borderRadius: radius.xl,
            border: `1px solid ${colors.gray[300]}`,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxl}}>
              <div style={{color: colors.gray[900], fontSize: typography.sizes.lg, fontFamily: typography.fontFamily, fontWeight: typography.weights.bold}}>Your Files</div>
              <div
                onClick={() => navigate('/category/recently-added')}
                style={{color: colors.gray[900], fontSize: typography.sizes.md, fontFamily: typography.fontFamily, fontWeight: typography.weights.bold, lineHeight: '22.40px', cursor: 'pointer'}}
              >
                See All
              </div>
            </div>

            {(() => {
              // Only show documents that are NOT in any folder (root-level documents)
              // Documents inside folders/categories should only appear when viewing that folder
              const rootDocuments = contextDocuments.filter(doc => !doc.folderId && !doc.folder);
              const combinedItems = [
                ...rootDocuments.map(d => ({ ...d, isDocument: true }))
              ];

              // Helper function to get file type for sorting
              const getFileTypeForSort = (doc) => {
                if (doc.isFolder) return 'Folder';
                const filename = doc?.filename || '';
                const ext = filename.match(/\.([^.]+)$/)?.[1]?.toUpperCase() || '';
                return ext || 'File';
              };

              // Sort based on current sort column and direction
              const recentItems = combinedItems
                .slice()
                .sort((a, b) => {
                  let comparison = 0;

                  switch (sortColumn) {
                    case 'name':
                      const nameA = a.isFolder ? (a.name || '') : (a.filename || '');
                      const nameB = b.isFolder ? (b.name || '') : (b.filename || '');
                      comparison = nameA.localeCompare(nameB);
                      break;
                    case 'type':
                      comparison = getFileTypeForSort(a).localeCompare(getFileTypeForSort(b));
                      break;
                    case 'size':
                      const sizeA = a.isFolder ? (a.fileCount || 0) : (a.fileSize || 0);
                      const sizeB = b.isFolder ? (b.fileCount || 0) : (b.fileSize || 0);
                      comparison = sizeA - sizeB;
                      break;
                    case 'date':
                    default:
                      comparison = new Date(a.createdAt) - new Date(b.createdAt);
                      break;
                  }

                  return sortDirection === 'asc' ? comparison : -comparison;
                })
                .slice(0, 10);

              return recentItems.length > 0 ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 50px',
                  gap: 16,
                  padding: '12px 16px',
                  borderBottom: '1px solid #E6E6EC',
                  marginBottom: 8
                }}>
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'type', label: 'Type' },
                    { key: 'size', label: 'Size' },
                    { key: 'date', label: 'Date' }
                  ].map(col => (
                    <div
                      key={col.key}
                      onClick={() => {
                        if (sortColumn === col.key) {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortColumn(col.key);
                          setSortDirection('asc');
                        }
                      }}
                      style={{
                        color: sortColumn === col.key ? '#171717' : '#6C6B6E',
                        fontSize: 12,
                        fontFamily: 'Plus Jakarta Sans',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        userSelect: 'none'
                      }}
                    >
                      {col.label}
                      {sortColumn === col.key && (
                        <span style={{ fontSize: 10 }}>
                          {sortDirection === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  ))}
                  <div></div>
                </div>
                {recentItems.map((item) => {
                  // If it's a folder, render folder
                  if (item.isFolder) {
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/folder/${item.id}`)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 50px',
                          gap: 16,
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderRadius: 10,
                          background: 'white',
                          border: '1px solid #E6E6EC',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#F9F9F9';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden'}}>
                          <img src={folderIcon} alt="Folder" style={{width: 40, height: 40, flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'}} />
                          <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {item.name}
                          </div>
                        </div>
                        <div style={{color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans'}}>Folder</div>
                        <div style={{color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans'}}>{item.fileCount || 0} items</div>
                        <div style={{color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans'}}>{new Date(item.createdAt).toLocaleDateString()}</div>
                        <div></div>
                      </div>
                    );
                  }

                  // Otherwise render document
                  const doc = item;
                  const getFileIcon = (doc) => {
                    // Prioritize MIME type over file extension (more reliable for encrypted filenames)
                    const mimeType = doc?.mimeType || '';
                    const filename = doc?.filename || '';

                    // ========== VIDEO FILES ==========
                    // QuickTime videos (.mov) - MUST check before generic video check
                    if (mimeType === 'video/quicktime') {
                      return movIcon; // Blue MOV icon
                    }

                    // MP4 videos - specific check only
                    if (mimeType === 'video/mp4') {
                      return mp4Icon; // Pink MP4 icon
                    }

                    // Other video types - use generic video icon (mp4)
                    if (mimeType.startsWith('video/')) {
                      return mp4Icon;
                    }

                    // ========== AUDIO FILES ==========
                    if (mimeType.startsWith('audio/') || mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') {
                      return mp3Icon;
                    }

                    // ========== DOCUMENT FILES ==========
                    if (mimeType === 'application/pdf') return pdfIcon;
                    if (mimeType.includes('word') || mimeType.includes('msword')) return docIcon;
                    if (mimeType.includes('sheet') || mimeType.includes('excel')) return xlsIcon;
                    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return pptxIcon;
                    if (mimeType === 'text/plain' || mimeType === 'text/csv') return txtIcon;

                    // ========== IMAGE FILES ==========
                    if (mimeType.startsWith('image/')) {
                      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return jpgIcon;
                      if (mimeType.includes('png')) return pngIcon;
                      return pngIcon; // Default for other images
                    }

                    // ========== FALLBACK: Extension-based check ==========
                    // (For files where MIME type is not set or is generic)
                    if (filename) {
                      const ext = filename.toLowerCase();
                      // Documents
                      if (ext.match(/\.(pdf)$/)) return pdfIcon;
                      if (ext.match(/\.(doc|docx)$/)) return docIcon;
                      if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
                      if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
                      if (ext.match(/\.(txt)$/)) return txtIcon;

                      // Images
                      if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
                      if (ext.match(/\.(png)$/)) return pngIcon;

                      // Videos
                      if (ext.match(/\.(mov)$/)) return movIcon;
                      if (ext.match(/\.(mp4)$/)) return mp4Icon;

                      // Audio
                      if (ext.match(/\.(mp3|wav|aac|m4a)$/)) return mp3Icon;

                      // Adobe Premiere Pro / Video editing files use generic file icon
                      // .prproj, .pek, .cfa - let them fall through to default
                    }

                    // Final fallback - for unknown/binary files (including .prproj, .pek, .cfa)
                    return txtIcon;
                  };

                  const formatBytes = (bytes) => {
                    if (bytes === 0) return '0 B';
                    const sizes = ['B', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
                  };

                  const getFileType = (doc) => {
                    const mimeType = doc?.mimeType || '';
                    const filename = doc?.filename || '';

                    // Get extension from filename
                    const ext = filename.match(/\.([^.]+)$/)?.[1]?.toUpperCase() || '';

                    if (mimeType === 'application/pdf' || ext === 'PDF') return 'PDF';
                    if (ext === 'DOC') return 'DOC';
                    if (ext === 'DOCX') return 'DOCX';
                    if (ext === 'XLS') return 'XLS';
                    if (ext === 'XLSX') return 'XLSX';
                    if (ext === 'PPT') return 'PPT';
                    if (ext === 'PPTX') return 'PPTX';
                    if (ext === 'TXT') return 'TXT';
                    if (ext === 'CSV') return 'CSV';
                    if (ext === 'PNG') return 'PNG';
                    if (ext === 'JPG' || ext === 'JPEG') return 'JPG';
                    if (ext === 'GIF') return 'GIF';
                    if (ext === 'WEBP') return 'WEBP';
                    if (ext === 'MP4') return 'MP4';
                    if (ext === 'MOV') return 'MOV';
                    if (ext === 'AVI') return 'AVI';
                    if (ext === 'MKV') return 'MKV';
                    if (ext === 'MP3') return 'MP3';
                    if (ext === 'WAV') return 'WAV';
                    if (ext === 'AAC') return 'AAC';
                    if (ext === 'M4A') return 'M4A';

                    return ext || 'File';
                  };

                  return (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => {
                        // If in select mode and this doc is selected, drag all selected docs
                        if (isSelectMode && isSelected(doc.id)) {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'documents',
                            documentIds: Array.from(selectedDocuments)
                          }));
                        } else {
                          // Otherwise just drag this one document
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'document',
                            id: doc.id
                          }));
                        }
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onClick={() => {
                        if (isSelectMode) {
                          toggleDocument(doc.id);
                        } else {
                          navigate(`/document/${doc.id}`);
                        }
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 50px',
                        gap: 16,
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: isSelectMode && isSelected(doc.id) ? '#F3F3F5' : 'white',
                        border: '1px solid #E6E6EC',
                        cursor: isSelectMode ? 'pointer' : 'pointer',
                        transition: 'all 0.2s ease',
                        transform: 'translateY(0)'
                      }}
                      onMouseEnter={(e) => {
                        if (isSelectMode && isSelected(doc.id)) {
                          e.currentTarget.style.background = '#E8E8EC';
                        } else {
                          e.currentTarget.style.background = '#F7F7F9';
                        }
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isSelectMode && isSelected(doc.id) ? '#F3F3F5' : 'white';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Name Column */}
                      <div style={{display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden'}}>
                        <img
                          src={getFileIcon(doc)}
                          alt="File icon"
                          style={{
                            width: 40,
                            height: 40,
                            flexShrink: 0,
                            imageRendering: '-webkit-optimize-contrast',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                          }}
                        />
                        <div style={{
                          color: '#32302C',
                          fontSize: 14,
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {doc.filename}
                        </div>
                      </div>
                      {/* Type Column */}
                      <div style={{
                        color: '#6C6B6E',
                        fontSize: 13,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        {getFileType(doc)}
                      </div>
                      {/* Size Column */}
                      <div style={{
                        color: '#6C6B6E',
                        fontSize: 13,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        {formatBytes(doc.fileSize)}
                      </div>
                      {/* Date Column */}
                      <div style={{
                        color: '#6C6B6E',
                        fontSize: 13,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                      {/* Actions Column */}
                      {!isSelectMode && <div style={{position: 'relative'}} data-dropdown>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === doc.id ? null : doc.id);
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                          style={{
                            width: 32,
                            height: 32,
                            background: 'transparent',
                            borderRadius: '50%',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease'
                          }}
                        >
                          <DotsIcon style={{width: 24, height: 24}} />
                        </button>

                        {openDropdownId === doc.id && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 4,
                              background: 'white',
                              boxShadow: '0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                              borderRadius: 12,
                              border: '1px solid #E6E6EC',
                              zIndex: 1000,
                              minWidth: 160
                            }}
                          >
                            <div style={{padding: 4, display: 'flex', flexDirection: 'column', gap: 1}}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <DownloadIcon style={{width: 16, height: 16}} />
                                Download
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRename(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <EditIcon style={{width: 16, height: 16}} />
                                Rename
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCategory(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M10.6263 4.1665C10.6263 3.82133 10.3465 3.5415 10.0013 3.5415C9.65612 3.5415 9.3763 3.82133 9.3763 4.1665V9.37484H4.16797C3.82279 9.37484 3.54297 9.65466 3.54297 9.99984C3.54297 10.345 3.82279 10.6248 4.16797 10.6248H9.3763V15.8332C9.3763 16.1783 9.65612 16.4582 10.0013 16.4582C10.3465 16.4582 10.6263 16.1783 10.6263 15.8332V10.6248H15.8346C16.1798 10.6248 16.4596 10.345 16.4596 9.99984C16.4596 9.65466 16.1798 9.37484 15.8346 9.37484H10.6263V4.1665Z" fill="#32302C"/>
                                </svg>
                                Category
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({ type: 'document', id: doc.id, name: doc.filename });
                                  setShowDeleteModal(true);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#D92D20',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FEF3F2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <TrashCanIcon style={{width: 16, height: 16}} />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>}
                      {isSelectMode && <div></div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 200}}>
                <div style={{color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500'}}>No documents yet</div>
              </div>
            );
            })()}
          </div>
        </div>

        {/* Drag and Drop Overlay */}
        {isDraggingOver && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(250, 250, 250, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              zIndex: 999,
              pointerEvents: 'none',
              animation: 'fadeIn 0.2s ease-in'
            }}
          >
            <style>
              {`
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
              `}
            </style>
            <img
              src={filesIcon}
              alt="Files"
              style={{
                width: 400,
                height: 'auto',
                opacity: 1.0,
                transform: 'scale(1.0)',
                transition: 'opacity 250ms ease-out, transform 250ms ease-out'
              }}
            />
            <div
              style={{
                color: '#181818',
                fontSize: 32,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '700',
                textAlign: 'center'
              }}
            >
              Drop files here to upload
            </div>
            <div
              style={{
                color: 'rgba(24, 24, 24, 0.6)',
                fontSize: 18,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '500',
                textAlign: 'center'
              }}
            >
              Release to open upload modal
            </div>
          </div>
        )}
      </div>

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedDocumentForCategory(null);
        }}
        onCreateCategory={handleCreateCategory}
        preSelectedDocumentId={selectedDocumentForCategory?.id}
      />

      {/* Notification Panel */}
      <NotificationPanel
        showNotificationsPopup={showNotificationsPopup}
        setShowNotificationsPopup={setShowNotificationsPopup}
      />

      {/* Category Selection Modal */}
      <MoveToCategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setSelectedDocumentForCategory(null);
          setSelectedCategoryId(null);
        }}
        selectedDocument={selectedDocumentForCategory}
        categories={availableCategories}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={setSelectedCategoryId}
        onCreateNew={() => {
          setShowCategoryModal(false);
          setIsModalOpen(true);
        }}
        onConfirm={handleCategorySelection}
      />

      {/* Edit Category Modal */}
      <EditCategoryModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onUpdate={async () => {
          // Refresh to show updated emoji immediately
          await refreshAll();
        }}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadCategoryId(null);
        }}
        categoryId={uploadCategoryId}
        onUploadComplete={() => {
          // No manual refresh needed - context auto-updates!
        }}
      />

      {/* Universal Upload Modal */}
      <UniversalUploadModal
        isOpen={showUniversalUploadModal}
        onClose={() => {
          console.log('📁 DocumentsPage - Closing modal, clearing droppedFiles');
          setShowUniversalUploadModal(false);
          setDroppedFiles(null);
        }}
        categoryId={null}
        onUploadComplete={() => {
          // No manual refresh needed - context auto-updates!
        }}
        initialFiles={droppedFiles}
      />
      {/* Debug: Log when props change */}
      {console.log('📁 DocumentsPage - Rendering modal with:', {
        isOpen: showUniversalUploadModal,
        droppedFiles: droppedFiles,
        fileCount: droppedFiles?.length
      })}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={() => {
          if (!itemToDelete) return;

          // Save reference before clearing state
          const itemToDeleteCopy = itemToDelete;

          // Close modal IMMEDIATELY for instant feedback
          setShowDeleteModal(false);
          setItemToDelete(null);

          // For bulk delete, clear selection and exit select mode IMMEDIATELY
          if (itemToDeleteCopy.type === 'bulk-documents') {
            clearSelection();
            toggleSelectMode();
          }

          // Delete in background - context will update UI instantly
          (async () => {
            try {
              if (itemToDeleteCopy.type === 'bulk-documents') {
                // Handle bulk deletion of selected documents
                const deleteCount = itemToDeleteCopy.count;

                // Delete all selected documents with proper error handling
                const results = await Promise.allSettled(
                  itemToDeleteCopy.ids.map(docId => deleteDocument(docId))
                );

                // Count successes and failures
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;

                // Show appropriate message
                if (failed === 0) {
                  showSuccess(`${deleteCount} file${deleteCount > 1 ? 's have' : ' has'} been deleted`);
                } else if (succeeded === 0) {
                  alert(`Failed to delete ${failed} file${failed > 1 ? 's' : ''}`);
                } else {
                  showSuccess(`${succeeded} file${succeeded > 1 ? 's' : ''} deleted`);
                  alert(`Failed to delete ${failed} file${failed > 1 ? 's' : ''}`);
                }
              } else if (itemToDeleteCopy.type === 'category') {
                await handleDeleteCategory(itemToDeleteCopy.id);
              } else if (itemToDeleteCopy.type === 'document') {
                await handleDelete(itemToDeleteCopy.id);
              }
            } catch (error) {
              console.error('❌ Delete error:', error);
              alert('Failed to delete: ' + (error.message || 'Unknown error'));
            }
          })();
        }}
        itemName={itemToDelete?.name || ''}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={showRenameModal}
        onClose={() => {
          setShowRenameModal(false);
          setItemToRename(null);
        }}
        onConfirm={handleRenameConfirm}
        itemName={itemToRename?.name}
        itemType={itemToRename?.type}
      />

    </div>
  );
};

export default DocumentsPage;
