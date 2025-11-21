import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../context/DocumentsContext';
import { useDocumentSelection } from '../hooks/useDocumentSelection';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSemanticSearch } from '../hooks/useSemanticSearch';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import CreateCategoryModal from './CreateCategoryModal';
import EditCategoryModal from './EditCategoryModal';
import UploadModal from './UploadModal';
import UniversalUploadModal from './UniversalUploadModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import { ReactComponent as SmoothCorner } from '../assets/smoothinnercorner.svg';
import { ReactComponent as SmoothCorner2 } from '../assets/smoothinnercorner2.svg';
import { ReactComponent as ArrowIcon } from '../assets/arrow-narrow-right.svg';
import { ReactComponent as TimeIcon } from '../assets/Time square.svg';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as LogoutBlackIcon } from '../assets/Logout-black.svg';
import { ReactComponent as Document2Icon } from '../assets/Document 2.svg';
import { ReactComponent as ImageIcon } from '../assets/Image.svg';
import { ReactComponent as InfoCircleIcon } from '../assets/Info circle.svg';
import { ReactComponent as SpreadsheetIcon } from '../assets/spreadsheet.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can-red.svg';
import { ReactComponent as EditIcon } from '../assets/Edit 5.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as DotsIcon } from '../assets/dots.svg';
import { ReactComponent as UploadIconMenu } from '../assets/upload.svg';
import { ReactComponent as XCloseIcon } from '../assets/x-close.svg';
import logoSvg from '../assets/logo.svg';
import kodaLogo from '../assets/koda-logo_1.svg';
import logoCopyWhite from '../assets/Logo copy.svg';
import { getCategoriesWithCounts, createCategory, deleteCategory, addDocumentToCategory } from '../utils/categoryManager';
import api from '../services/api';
import chatService from '../services/chatService';
import CategoryIcon from './CategoryIcon';
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

const Documents = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess } = useToast();
  const isMobile = useIsMobile();

  // Use DocumentsContext for instant updates
  const {
    documents: contextDocuments,
    folders: contextFolders,
    recentDocuments,
    loading,
    deleteDocument,
    renameDocument,
    moveToFolder,
    createFolder,
    deleteFolder,
    getRootFolders,
    getDocumentCountByFolder,
    getFileBreakdown,
    refreshAll
  } = useDocuments();

  // Local UI state only
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Semantic search hook
  const {
    query: semanticQuery,
    setQuery: setSemanticQuery,
    results: semanticResults,
    isSearching,
    error: searchError
  } = useSemanticSearch(300);

  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({});
  const dropdownRefs = useRef({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedDocumentForCategory, setSelectedDocumentForCategory] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCategoryId, setUploadCategoryId] = useState(null);
  const [showAskKoda, setShowAskKoda] = useState(true);
  const [showUniversalUploadModal, setShowUniversalUploadModal] = useState(false);
  const [showCreateFromMoveModal, setShowCreateFromMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [droppedFiles, setDroppedFiles] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0);
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null);

  // Multi-select functionality
  const {
    isSelectMode,
    selectedDocuments,
    toggleSelectMode,
    toggleDocument,
    selectAll,
    clearSelection,
    isSelected
  } = useDocumentSelection();

  // Force re-render when contextFolders changes
  useEffect(() => {
    setCategoriesRefreshKey(prev => prev + 1);
  }, [contextFolders]);

  // Compute categories from context folders (auto-updates!)
  const categories = getRootFolders()
    .filter(folder => folder.name.toLowerCase() !== 'recently added')
    .map(folder => {
      return {
        id: folder.id,
        name: folder.name,
        emoji: folder.emoji || '__FOLDER_SVG__',
        fileCount: getDocumentCountByFolder(folder.id),
        folderCount: folder._count?.subfolders || 0,
        count: getDocumentCountByFolder(folder.id)
      };
    });

  // All folders for search (auto-updates!)
  const allFolders = useMemo(() => {
    return contextFolders
      .filter(folder => folder.name.toLowerCase() !== 'recently added')
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        emoji: folder.emoji || '📁',
        parentFolderId: folder.parentFolderId
      }));
  }, [contextFolders]);

  // File breakdown data (auto-updates!)
  const { fileData, totalFiles } = useMemo(() => {
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Calculate breakdown by type with sizes
    const breakdown = {
      spreadsheet: { count: 0, size: 0 },
      document: { count: 0, size: 0 },
      image: { count: 0, size: 0 },
      other: { count: 0, size: 0 }
    };

    contextDocuments.forEach(doc => {
      // Safely get filename
      const filename = (doc.filename || doc.name || '').toLowerCase();
      const mimeType = doc.mimeType || '';
      const size = doc.fileSize || 0;

      if (!filename) {
        breakdown.other.count++;
        breakdown.other.size += size;
        return;
      }

      // Check for Excel/Spreadsheet files (by MIME type or extension)
      if (mimeType.includes('sheet') || mimeType.includes('excel') || filename.match(/\.(xls|xlsx|csv)$/)) {
        breakdown.spreadsheet.count++;
        breakdown.spreadsheet.size += size;
      } else if (filename.match(/\.(pdf|doc|docx|txt|rtf|odt)$/)) {
        breakdown.document.count++;
        breakdown.document.size += size;
      } else if (filename.match(/\.(jpg|jpeg|png|gif|bmp|svg|webp)$/)) {
        breakdown.image.count++;
        breakdown.image.size += size;
      } else {
        breakdown.other.count++;
        breakdown.other.size += size;
      }
    });

    return {
      fileData: [
        { name: 'Spreadsheet', value: breakdown.spreadsheet.count, color: '#181818', size: formatBytes(breakdown.spreadsheet.size) },
        { name: 'Document', value: breakdown.document.count, color: '#000000', size: formatBytes(breakdown.document.size) },
        { name: 'Image', value: breakdown.image.count, color: '#A8A8A8', size: formatBytes(breakdown.image.size) },
        { name: 'Other', value: breakdown.other.count, color: '#D9D9D9', size: formatBytes(breakdown.other.size) }
      ],
      totalFiles: contextDocuments.length
    };
  }, [contextDocuments]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('[data-dropdown]')) {
        setOpenDropdownId(null);
      }
      if (categoryMenuOpen && !event.target.closest('[data-category-menu]')) {
        setCategoryMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId, categoryMenuOpen]);

  // Refresh data when component mounts or becomes visible
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // INSTANT UPDATE: Create category
  const handleCreateCategory = async (category) => {
    try {
      console.log('Creating category with:', category);

      // Create folder (UI updates INSTANTLY via context!)
      const newFolder = await createFolder(category.name, category.emoji);
      console.log('New folder created:', newFolder);

      // If documents were selected, move them to the folder (INSTANT updates!)
      if (category.selectedDocuments && category.selectedDocuments.length > 0) {
        console.log('Moving documents to folder:', category.selectedDocuments);
        await Promise.all(
          category.selectedDocuments.map(docId =>
            moveToFolder(docId, newFolder.id)
          )
        );
        console.log('Documents moved successfully');
      }
      // No manual refresh needed - context auto-updates everywhere!
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create category');
    }
  };

  // INSTANT UPDATE: Delete category
  const handleDeleteCategory = async (categoryId) => {
    try {
      // Delete folder (UI updates INSTANTLY via context!)
      await deleteFolder(categoryId);
      // No manual state update needed!
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
        // Rename document (UI updates INSTANTLY via context!)
        await renameDocument(itemToRename.id, newName);
      }

      setShowRenameModal(false);
      setItemToRename(null);
    } catch (error) {
      console.error('Error renaming:', error);
      alert(`Failed to rename ${itemToRename.type}`);
    }
  };

  // INSTANT UPDATE: Delete document with proper error handling
  const handleDelete = async (docId) => {
    try {
      // Delete document (UI updates INSTANTLY via context with optimistic update!)
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
    console.log('handleAddToCategory called for doc:', doc);
    setSelectedDocumentForCategory(doc);
    // Use context folders instead of fetching
    const rootFolders = getRootFolders().filter(f => f.name.toLowerCase() !== 'recently added');
    console.log('Root folders loaded from context:', rootFolders);
    setShowCategoryModal(true);
    console.log('Modal should be showing now');
    setOpenDropdownId(null);
  };

  // INSTANT UPDATE: Move document to category
  const handleCategorySelection = async () => {
    if (!selectedCategoryId || !selectedDocumentForCategory) return;

    try {
      // Move document to folder (UI updates INSTANTLY via context!)
      await moveToFolder(selectedDocumentForCategory.id, selectedCategoryId);
      // Document moves immediately, counts update automatically!

      setShowCategoryModal(false);
      setSelectedDocumentForCategory(null);
      setSelectedCategoryId(null);
    } catch (error) {
      console.error('Error adding document to category:', error);
      alert('Failed to add document to category');
    }
  };

  // Handle create category from move modal
  const handleCreateCategoryFromMove = async (category) => {
    try {
      console.log('Creating category from move modal:', category);

      // Create folder
      const newFolder = await createFolder(category.name, category.emoji);
      console.log('New folder created:', newFolder);

      // If we have a selected document, move it to the new folder
      if (selectedDocumentForCategory) {
        await moveToFolder(selectedDocumentForCategory.id, newFolder.id);
        console.log('Document moved to new category');
      }

      // Close both modals
      setShowCreateFromMoveModal(false);
      setShowCategoryModal(false);
      setSelectedDocumentForCategory(null);
      setSelectedCategoryId(null);
    } catch (error) {
      console.error('Error creating category from move:', error);
      alert('Failed to create category');
    }
  };

  // Sync search query with semantic search
  useEffect(() => {
    setSemanticQuery(searchQuery);
  }, [searchQuery, setSemanticQuery]);

  // Filter documents and folders based on search query (auto-updates!)
  // Hybrid approach: Combine semantic search results with filename matching
  const filteredDocuments = useMemo(() => {
    if (!searchQuery) {
      return contextDocuments;
    }

    // Filename-based filtering
    const filenameMatches = contextDocuments.filter(doc =>
      doc.filename?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // If we have semantic search results, merge them
    if (semanticResults && semanticResults.length > 0) {
      // Create a map of semantic results by ID for quick lookup
      const semanticMap = new Map(semanticResults.map(result => [result.id, result]));

      // Combine both result sets, preferring semantic search order for matches
      const combinedIds = new Set();
      const combined = [];

      // First, add semantic search results (ordered by relevance)
      semanticResults.forEach(result => {
        const doc = contextDocuments.find(d => d.id === result.id);
        if (doc && !combinedIds.has(doc.id)) {
          combined.push({ ...doc, searchScore: result.score, matchedContent: result.matchedContent });
          combinedIds.add(doc.id);
        }
      });

      // Then add filename matches that weren't in semantic results
      filenameMatches.forEach(doc => {
        if (!combinedIds.has(doc.id)) {
          combined.push(doc);
          combinedIds.add(doc.id);
        }
      });

      return combined;
    }

    // Fallback to filename matching only
    return filenameMatches;
  }, [contextDocuments, searchQuery, semanticResults]);

  const filteredFolders = useMemo(() => {
    return allFolders.filter(folder =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allFolders, searchQuery]);

  // Handle page-level file drop
  const handlePageDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    console.log('📁 Documents (Home) - Files dropped:', files);
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

  // ✅ Show loading skeleton during initial data fetch
  if (loading && contextDocuments.length === 0 && contextFolders.length === 0) {
    return <DocumentsSkeleton />;
  }

  return (
    <div style={{width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex'}}>
      {!isMobile && <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />}

      {/* Main Content */}
      <div
        style={{flex: 1, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative'}}
        onDrop={handlePageDrop}
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
      >
        {/* Header */}
        <div style={{height: 84, paddingLeft: 20, paddingRight: 20, background: 'white', borderBottom: '1px #E6E6EC solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          {isSelectMode ? (
            <>
              {/* Left: Back arrow + Documents title */}
              <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                <button
                  onClick={() => navigate(-1)}
                  style={{
                    width: 40,
                    height: 40,
                    background: '#F3F4F6',
                    border: '1px solid #E5E7EB',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    padding: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#E5E7EB';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F3F4F6';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 15L7.5 10L12.5 5" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <h1 style={{
                  fontSize: 32,
                  fontWeight: '600',
                  color: '#111827',
                  fontFamily: 'Plus Jakarta Sans',
                  margin: 0
                }}>
                  Documents
                </h1>
              </div>
            </>
          ) : (
            <div style={{color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: '30px'}}>
              Welcome back, {user && (user.firstName || user.lastName) ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user?.email?.split('@')[0] || 'User'}!
            </div>
          )}
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            {isSelectMode ? (
              <>
                {/* Delete Button */}
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
                    minWidth: 100,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: selectedDocuments.size === 0 ? '#F5F5F5' : '#DC2626',
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
                  <TrashCanIcon style={{ width: 16, height: 16, fill: selectedDocuments.size === 0 ? '#9CA3AF' : 'white' }} />
                  <div style={{
                    color: selectedDocuments.size === 0 ? '#9CA3AF' : 'white',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '600',
                    lineHeight: '24px',
                    wordWrap: 'break-word'
                  }}>
                    Delete
                  </div>
                </button>

                {/* Move Button */}
                <button
                  onClick={async () => {
                    if (selectedDocuments.size === 0) return;
                    // TODO: Implement move functionality
                    alert('Move functionality coming soon');
                  }}
                  disabled={selectedDocuments.size === 0}
                  style={{
                    minWidth: 100,
                    paddingLeft: 18,
                    paddingRight: 18,
                    paddingTop: 10,
                    paddingBottom: 10,
                    background: 'white',
                    boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)',
                    overflow: 'hidden',
                    borderRadius: 100,
                    border: '1px solid #E6E6EC',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex',
                    cursor: selectedDocuments.size === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedDocuments.size === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    color: '#32302C',
                    fontSize: 16,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '500',
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
                  ({selectedDocuments.size}) Selected
                </div>

                {/* X Close Button */}
                <button
                  onClick={() => {
                    clearSelection();
                    toggleSelectMode();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    background: 'white',
                    border: '1px solid #E6E6EC',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#F3F4F6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <CloseIcon style={{ width: 16, height: 16 }} />
                </button>
              </>
            ) : (
              <>
                <div style={{position: 'relative', height: 52, display: 'flex', alignItems: 'center'}}>
                  <SearchIcon style={{position: 'absolute', left: 16, width: 20, height: 20, zIndex: 1}} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
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
                      lineHeight: '24px'
                    }}
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
                  {/* Loading State */}
                  {isSearching && (
                    <div style={{padding: 24, textAlign: 'center'}}>
                      <div style={{
                        display: 'inline-block',
                        width: 24,
                        height: 24,
                        border: '3px solid #E6E6EC',
                        borderTop: '3px solid #32302C',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <div style={{
                        marginTop: 12,
                        color: '#6C6B6E',
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans',
                        fontWeight: '500'
                      }}>
                        Searching...
                      </div>
                    </div>
                  )}

                  {/* Error State */}
                  {searchError && !isSearching && (
                    <div style={{padding: 24, textAlign: 'center'}}>
                      <div style={{
                        color: '#EF4444',
                        fontSize: 14,
                        fontFamily: 'Plus Jakarta Sans',
                        fontWeight: '500'
                      }}>
                        {searchError}
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  {!isSearching && !searchError && (filteredFolders.length > 0 || filteredDocuments.length > 0) ? (
                    <div style={{padding: 8}}>
                      {/* Folders Section */}
                      {filteredFolders.length > 0 && (
                        <>
                          <div style={{
                            padding: '8px 12px',
                            color: '#6C6B6E',
                            fontSize: 12,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Folders
                          </div>
                          {filteredFolders.map((folder) => (
                            <div
                              key={folder.id}
                              onClick={() => {
                                navigate(`/folder/${folder.id}`);
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
                              <div style={{
                                width: 40,
                                height: 40,
                                background: '#F5F5F5',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20
                              }}>
                                <CategoryIcon emoji={folder.emoji || '__FOLDER_SVG__'} style={{width: 20, height: 20}} />
                              </div>
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
                                  {folder.name}
                                </div>
                                <div style={{
                                  color: '#6C6B6E',
                                  fontSize: 12,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '400'
                                }}>
                                  Folder
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Documents Section */}
                      {filteredDocuments.length > 0 && (
                        <>
                          {filteredFolders.length > 0 && (
                            <div style={{
                              height: 1,
                              background: '#E6E6EC',
                              margin: '8px 0'
                            }} />
                          )}
                          <div style={{
                            padding: '8px 12px',
                            color: '#6C6B6E',
                            fontSize: 12,
                            fontFamily: 'Plus Jakarta Sans',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Documents
                          </div>
                          {filteredDocuments.map((doc) => {
                            const getFileIcon = (doc) => {
                              // Prioritize MIME type over file extension (more reliable for encrypted filenames)
                              const mimeType = doc?.mimeType || '';
                              const filename = doc?.filename || '';

                              // DEBUG: Log MIME type and filename for video files
                              if (mimeType.startsWith('video/') || filename.match(/\.(mov|mp4)$/i)) {
                                console.log('🎬 Video file detected:', { filename, mimeType });
                              }

                              // ========== VIDEO FILES ==========
                              // QuickTime videos (.mov) - MUST check before generic video check
                              if (mimeType === 'video/quicktime') {
                                console.log('✅ Returning movIcon for:', filename);
                                return movIcon; // Blue MOV icon
                              }

                              // MP4 videos - specific check only
                              if (mimeType === 'video/mp4') {
                                console.log('✅ Returning mp4Icon for:', filename);
                                return mp4Icon; // Pink MP4 icon
                              }

                              // Other video types - use generic video icon (mp4)
                              if (mimeType.startsWith('video/')) {
                                console.log('⚠️  Generic video type, returning mp4Icon for:', filename, mimeType);
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

                            return (
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
                                <div style={{ position: 'relative' }}>
                                  <img
                                    src={getFileIcon(doc)}
                                    alt="File icon"
                                    style={{
                                      width: 40,
                                      height: 40,
                                      aspectRatio: '1/1',
                                      imageRendering: '-webkit-optimize-contrast',
                                      objectFit: 'contain',
                                      shapeRendering: 'geometricPrecision'
                                    }}
                                  />
                                  {/* Processing badge */}
                                  {doc.status === 'processing' && (
                                    <div style={{
                                      position: 'absolute',
                                      bottom: -4,
                                      right: -4,
                                      background: '#3B82F6',
                                      color: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      fontFamily: 'Plus Jakarta Sans',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }}>
                                      <div style={{
                                        width: 6,
                                        height: 6,
                                        border: '1.5px solid white',
                                        borderTopColor: 'transparent',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                      }} />
                                      {doc.processingProgress ? `${doc.processingProgress}%` : '...'}
                                    </div>
                                  )}
                                  {/* Failed badge */}
                                  {doc.status === 'failed' && (
                                    <div style={{
                                      position: 'absolute',
                                      bottom: -4,
                                      right: -4,
                                      background: '#EF4444',
                                      color: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      fontFamily: 'Plus Jakarta Sans',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }}>
                                      ⚠️ Failed
                                    </div>
                                  )}
                                </div>
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
                            );
                          })}
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      padding: 40,
                      textAlign: 'center',
                      color: '#6C6B6E',
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans'
                    }}>
                      No folders or documents found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>

                <div onClick={() => setShowUniversalUploadModal(true)} style={{height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', borderRadius: 100, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'}}>
                  <LogoutBlackIcon style={{width: 24, height: 24}} />
                  <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Upload a Document</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20}}>
          {/* Smart Categories */}
          <div key={categoriesRefreshKey} style={{display: 'flex', flexDirection: 'column', gap: 12}}>
            {/* First Row: Add New + First 5 Categories */}
            <div style={{display: 'flex', gap: 12}}>
              <div onClick={() => setIsModalOpen(true)} style={{minWidth: 0, flex: '1 1 0', height: 72, padding: 12, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, cursor: 'pointer'}}>
                <div style={{width: 48, height: 48, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <AddIcon style={{ width: 24, height: 24 }} />
                </div>
                <span style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.6px', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>Add New Smart Category</span>
              </div>
              {categories.slice(0, 5).map((category, index) => (
                <div
                  key={`${category.id}-${category.emoji}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverCategoryId(category.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverCategoryId(null);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverCategoryId(null);

                    try {
                      const data = JSON.parse(e.dataTransfer.getData('application/json'));
                      if (data.type === 'document') {
                        // Move document to this category
                        await moveToFolder(data.id, category.id);
                      }
                    } catch (error) {
                      console.error('Error handling drop:', error);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: dragOverCategoryId === category.id ? '#F0F0F0' : 'white',
                    borderRadius: 14,
                    border: dragOverCategoryId === category.id ? '2px dashed #32302C' : '1px #E6E6EC solid',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div onClick={() => navigate(`/category/${category.name.toLowerCase().replace(/\s+/g, '-')}`)} style={{display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0}} onMouseEnter={(e) => e.currentTarget.parentElement.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.parentElement.style.transform = 'translateY(0)'}>
                    <div style={{width: 48, height: 48, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0}}>
                      <CategoryIcon emoji={category.emoji} />
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1}}>
                      <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px'}}>{category.name}</div>
                      <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px'}}>
                        {category.fileCount || 0} {category.fileCount === 1 ? 'File' : 'Files'}
                      </div>
                    </div>
                  </div>
                  <div style={{position: 'relative'}} data-category-menu>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryMenuOpen(categoryMenuOpen === category.id ? null : category.id);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        background: '#F5F5F5',
                        borderRadius: '50%',
                        border: '1px solid #E6E6EC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <DotsIcon style={{width: 16, height: 16}} />
                    </button>
                    {categoryMenuOpen === category.id && (
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: 4,
                        background: 'white',
                        borderRadius: 12,
                        border: '1px solid #E6E6EC',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                        zIndex: 1000,
                        minWidth: 160,
                        overflow: 'hidden'
                      }}>
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
                            setShowUploadModal(true);
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
                          <UploadIconMenu style={{width: 16, height: 16}} />
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

            {/* Second Row: Next 5 Categories + See All */}
            {categories.length > 5 && (
              <div style={{display: 'flex', gap: 12}}>
                {categories.slice(5, 10).map((category, index) => (
                  <div
                    key={`${category.id}-${category.emoji}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverCategoryId(category.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverCategoryId(null);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverCategoryId(null);

                      try {
                        const data = JSON.parse(e.dataTransfer.getData('application/json'));
                        if (data.type === 'document') {
                          await moveToFolder(data.id, category.id);
                        }
                      } catch (error) {
                        console.error('Error handling drop:', error);
                      }
                    }}
                    style={{
                      minWidth: 0,
                      flex: '1 1 0',
                      height: 72,
                      padding: 12,
                      background: dragOverCategoryId === category.id ? '#F0F0F0' : 'white',
                      borderRadius: 14,
                      border: dragOverCategoryId === category.id ? '2px dashed #32302C' : '1px #E6E6EC solid',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div onClick={() => navigate(`/category/${category.name.toLowerCase().replace(/\s+/g, '-')}`)} style={{display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0}} onMouseEnter={(e) => e.currentTarget.parentElement.style.transform = 'translateY(-2px)'} onMouseLeave={(e) => e.currentTarget.parentElement.style.transform = 'translateY(0)'}>
                      <div style={{width: 48, height: 48, background: '#F6F6F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0}}>
                        <CategoryIcon emoji={category.emoji} />
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0}}>
                        <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{category.name}</div>
                        <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '19.6px'}}>
                          {category.fileCount || 0} {category.fileCount === 1 ? 'File' : 'Files'}
                        </div>
                      </div>
                    </div>
                    <div style={{position: 'relative'}} data-category-menu>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryMenuOpen(categoryMenuOpen === category.id ? null : category.id);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          background: '#F5F5F5',
                          borderRadius: '50%',
                          border: '1px solid #E6E6EC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <DotsIcon style={{width: 16, height: 16}} />
                      </button>
                      {categoryMenuOpen === category.id && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: 4,
                          background: 'white',
                          borderRadius: 12,
                          border: '1px solid #E6E6EC',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                          zIndex: 1000,
                          minWidth: 160,
                          overflow: 'hidden'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCategory(category);
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
                              setUploadCategoryId(category.id);
                              setShowUploadModal(true);
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
                            <UploadIconMenu style={{width: 16, height: 16}} />
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
                <div
                  onClick={() => navigate('/documents')}
                  style={{
                    minWidth: 0,
                    flex: '1 1 0',
                    height: 72,
                    padding: 12,
                    background: 'white',
                    borderRadius: 14,
                    border: '1px #E6E6EC solid',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    See All ({categories.length})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* File Breakdown + Upcoming Actions (Side by Side) */}
          <div style={{display: 'flex', gap: 20, flex: 1, minHeight: 0}}>
            {/* File Breakdown - 40% */}
            <div style={{width: '40%', padding: 16, background: 'white', borderRadius: 20, border: '1px #E6E6EC solid', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden'}}>
              <div style={{color: '#101828', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '26px'}}>File Breakdown</div>

              {/* Chart and Legend Container - Centered */}
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center'}}>
              {/* Semicircle Chart */}
              <div style={{position: 'relative', width: '100%', height: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pointerEvents: 'none'}}>
                <div style={{width: '100%', height: '300px', position: 'absolute', bottom: 0}}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={fileData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={90}
                        outerRadius={150}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {fileData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10, textAlign: 'center'}}>
                  <div style={{color: '#32302C', fontSize: 32, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '40px'}}>{totalFiles} Files</div>
                  <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>Total</div>
                </div>
              </div>

              {/* File Legend - 2x2 Grid */}
              <div style={{padding: 14, background: '#F5F5F5', borderRadius: 18, border: '1px #E6E6EC solid', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                {fileData.map((item, index) => (
                  <div key={index} style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <div style={{width: 40, height: 40, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      {item.name === 'Spreadsheet' && <SpreadsheetIcon style={{width: 20, height: 20}} />}
                      {item.name === 'Document' && <Document2Icon style={{width: 20, height: 20}} />}
                      {item.name === 'Image' && <ImageIcon style={{width: 20, height: 20}} />}
                      {item.name === 'Other' && <InfoCircleIcon style={{width: 20, height: 20}} />}
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                      <div style={{color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: '19.60px'}}>{item.name}</div>
                      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px'}}>{item.value} Files</div>
                        <div style={{width: 4, height: 4, background: '#6C6B6E', borderRadius: '50%', opacity: 0.9}} />
                        <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '15.40px'}}>{item.size}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>

            {/* Your Files - 60% */}
            <div style={{width: '60%', padding: 24, background: 'white', borderRadius: 14, border: '1px #E6E6EC solid', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
                <div style={{color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700'}}>Your Files</div>
                {contextDocuments.length > 6 && (
                  <div
                    onClick={() => navigate('/category/recently-added')}
                    style={{color: '#171717', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', lineHeight: '22.40px', cursor: 'pointer'}}
                  >
                    See All
                  </div>
                )}
              </div>

              {contextDocuments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6).length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', minHeight: 0}}>
                  {contextDocuments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6).map((doc) => {
                    // ✅ Check document status for visual indicators
                    const isUploading = doc.status === 'uploading';
                    const isProcessing = doc.status === 'processing';
                    const isCompleted = doc.status === 'completed';
                    const isFailed = doc.status === 'failed';

                    const getFileIcon = (doc) => {
                      // Prioritize MIME type over file extension (more reliable for encrypted filenames)
                      const mimeType = doc?.mimeType || '';
                      const filename = doc?.filename || '';

                      // DEBUG: Log MIME type and filename for video files
                      if (mimeType.startsWith('video/') || filename.match(/\.(mov|mp4)$/i)) {
                        console.log('🎬 Video file detected (Recently Added):', { filename, mimeType });
                      }

                      // ========== VIDEO FILES ==========
                      // QuickTime videos (.mov) - MUST check before generic video check
                      if (mimeType === 'video/quicktime') {
                        console.log('✅ Returning movIcon for (Recently Added):', filename);
                        return movIcon; // Blue MOV icon
                      }

                      // MP4 videos - specific check only
                      if (mimeType === 'video/mp4') {
                        console.log('✅ Returning mp4Icon for (Recently Added):', filename);
                        return mp4Icon; // Pink MP4 icon
                      }

                      // Other video types - use generic video icon (mp4)
                      if (mimeType.startsWith('video/')) {
                        console.log('⚠️  Generic video type, returning mp4Icon for (Recently Added):', filename, mimeType);
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

                    return (
                      <div
                        key={doc.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'document',
                            id: doc.id
                          }));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        onClick={() => navigate(`/document/${doc.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          background: isUploading ? '#FFF9E6' : (isProcessing ? '#F0F9FF' : '#F5F5F5'),
                          opacity: isUploading ? 0.8 : 1,
                          border: isProcessing ? '1px solid #3B82F6' : 'none',
                          cursor: 'grab',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isUploading && !isProcessing) {
                            e.currentTarget.style.background = '#E6E6EC';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isUploading && !isProcessing) {
                            e.currentTarget.style.background = '#F5F5F5';
                          }
                        }}
                      >
                        <img
                          src={getFileIcon(doc)}
                          alt="File icon"
                          style={{
                            width: 48,
                            height: 48,
                            aspectRatio: '1/1',
                            imageRendering: '-webkit-optimize-contrast',
                            objectFit: 'contain',
                            shapeRendering: 'geometricPrecision'
                          }}
                        />
                        <div style={{flex: 1, overflow: 'hidden'}}>
                          <div style={{color: '#32302C', fontSize: 17, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {doc.filename}
                          </div>
                          <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', marginTop: 5}}>
                            {formatBytes(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                          </div>

                          {/* ✅ Status indicator */}
                          {isUploading && (
                            <div style={{
                              fontSize: 12,
                              color: '#F59E0B',
                              fontFamily: 'Plus Jakarta Sans',
                              fontWeight: '600',
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span>⏳</span>
                              <span>Uploading...</span>
                            </div>
                          )}

                          {isProcessing && (
                            <div style={{
                              fontSize: 12,
                              color: '#3B82F6',
                              fontFamily: 'Plus Jakarta Sans',
                              fontWeight: '600',
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span>⚙️</span>
                              <span>Processing...</span>
                            </div>
                          )}

                          {isFailed && (
                            <div style={{
                              fontSize: 12,
                              color: '#EF4444',
                              fontFamily: 'Plus Jakarta Sans',
                              fontWeight: '600',
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span>❌</span>
                              <span>Failed</span>
                            </div>
                          )}
                        </div>
                        <div style={{position: 'relative'}} data-dropdown>
                          <button
                            ref={(el) => {
                              if (el) dropdownRefs.current[doc.id] = el;
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Clicked three dots for doc:', doc.id);

                              if (openDropdownId === doc.id) {
                                setOpenDropdownId(null);
                              } else {
                                // Calculate if dropdown should open upward or downward
                                const buttonRect = e.currentTarget.getBoundingClientRect();
                                const dropdownHeight = 180; // Approximate height of dropdown menu
                                const spaceBelow = window.innerHeight - buttonRect.bottom;
                                const spaceAbove = buttonRect.top;

                                setDropdownPosition({
                                  [doc.id]: {
                                    openUpward: spaceBelow < dropdownHeight && spaceAbove > spaceBelow
                                  }
                                });
                                setOpenDropdownId(doc.id);
                              }
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                            style={{
                              width: 32,
                              height: 32,
                              background: 'white',
                              borderRadius: '50%',
                              border: '1px solid #E6E6EC',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: 18,
                              fontWeight: '700',
                              color: '#32302C',
                              transition: 'background 0.2s ease'
                            }}
                          >
                            ⋯
                          </button>

                          {openDropdownId === doc.id && (
                            <div
                              style={{
                                position: 'absolute',
                                ...(dropdownPosition[doc.id]?.openUpward
                                  ? { bottom: '100%', marginBottom: 4 }
                                  : { top: '100%', marginTop: 4 }
                                ),
                                right: 0,
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
                                    transition: 'background 0.2s ease',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <DownloadIcon style={{ width: 20, height: 20 }} />
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
                                    transition: 'background 0.2s ease',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <EditIcon style={{ width: 20, height: 20 }} />
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
                                    transition: 'background 0.2s ease',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <AddIcon style={{ width: 20, height: 20 }} />
                                  Move
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
                                    color: '#DC2626',
                                    transition: 'background 0.2s ease',
                                    textAlign: 'left'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                  <TrashCanIcon style={{ width: 20, height: 20 }} />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 200}}>
                  <div style={{color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500'}}>No documents yet</div>
                </div>
              )}
            </div>
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
              background: 'rgba(23, 23, 23, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
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
            <div
              style={{
                width: 120,
                height: 120,
                background: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isDraggingOver ? 1.0 : 0.75,
                transform: isDraggingOver ? 'scale(1.08)' : 'scale(1.0)',
                boxShadow: isDraggingOver ? '0 0 24px rgba(255, 255, 255, 0.12)' : 'none',
                transition: 'opacity 250ms ease-out, transform 250ms ease-out, box-shadow 250ms ease-out'
              }}
            >
              <LogoutBlackIcon style={{ width: 60, height: 60 }} />
            </div>
            <div
              style={{
                color: 'white',
                fontSize: 32,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '700',
                textAlign: 'center',
                opacity: isDraggingOver ? 1.0 : 0.6,
                transition: 'opacity 250ms ease-out'
              }}
            >
              Drop files here to upload
            </div>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 18,
                fontFamily: 'Plus Jakarta Sans',
                fontWeight: '500',
                textAlign: 'center',
                opacity: isDraggingOver ? 0.8 : 0.4,
                transition: 'opacity 250ms ease-out'
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
        onClose={() => setIsModalOpen(false)}
        onCreateCategory={handleCreateCategory}
      />

      {/* Create Category From Move Modal */}
      <CreateCategoryModal
        isOpen={showCreateFromMoveModal}
        onClose={() => setShowCreateFromMoveModal(false)}
        onCreateCategory={handleCreateCategoryFromMove}
        uploadedDocuments={selectedDocumentForCategory ? [selectedDocumentForCategory] : []}
      />

      {/* Notification Panel */}
      <NotificationPanel
        showNotificationsPopup={showNotificationsPopup}
        setShowNotificationsPopup={setShowNotificationsPopup}
      />

      {/* Add to Category Modal */}
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
                Move to Category
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedDocumentForCategory(null);
                  setSelectedCategoryId(null);
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
                <CloseIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Selected Document Display */}
            {selectedDocumentForCategory && (
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
                      const filename = selectedDocumentForCategory.filename.toLowerCase();
                      if (filename.match(/\.(pdf)$/)) return pdfIcon;
                      if (filename.match(/\.(jpg|jpeg)$/)) return jpgIcon;
                      if (filename.match(/\.(png)$/)) return pngIcon;
                      if (filename.match(/\.(doc|docx)$/)) return docIcon;
                      if (filename.match(/\.(xls|xlsx)$/)) return xlsIcon;
                      if (filename.match(/\.(txt)$/)) return txtIcon;
                      if (filename.match(/\.(ppt|pptx)$/)) return pptxIcon;
                      if (filename.match(/\.(mov)$/)) return movIcon;
                      if (filename.match(/\.(mp4)$/)) return mp4Icon;
                      if (filename.match(/\.(mp3)$/)) return mp3Icon;
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
                      {selectedDocumentForCategory.filename}
                    </div>
                    <div style={{
                      color: '#6C6B6E',
                      fontSize: 12,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '400'
                    }}>
                      {((selectedDocumentForCategory.fileSize || 0) / 1024 / 1024).toFixed(2)} MB
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
                {getRootFolders().filter(f => f.name.toLowerCase() !== 'recently added').map((category) => {
                  const fileCount = getDocumentCountByFolder(category.id);
                  return (
                    <div
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
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
                onClick={() => {
                  setShowCategoryModal(false);
                  setShowCreateFromMoveModal(true);
                }}
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
                  Create New Category
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
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedDocumentForCategory(null);
                  setSelectedCategoryId(null);
                }}
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
                  Cancel
                </div>
              </button>
              <button
                onClick={handleCategorySelection}
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
                  Add
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      <EditCategoryModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onUpdate={refreshAll}
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
          console.log('📁 Documents - Closing modal, clearing droppedFiles');
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
      {console.log('📁 Documents - Rendering modal with:', {
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

          // Close modal AND clear state IMMEDIATELY for instant feedback
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

      {/* Ask Koda Floating Button */}
      {showAskKoda && (
        <div style={{ width: 280, height: 56, right: 20, bottom: 20, position: 'absolute' }}>
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAskKoda(false);
            }}
            style={{
              width: 20,
              height: 20,
              right: 0,
              top: -2,
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
            <div style={{ width: 10, height: 10, position: 'relative', overflow: 'hidden' }}>
              <XCloseIcon style={{ width: 10, height: 10, position: 'absolute', left: 0, top: 0 }} />
            </div>
          </button>
          <button
            onClick={async () => {
              try {
                const newConversation = await chatService.createConversation();
                navigate('/chat', { state: { newConversation } });
              } catch (error) {
                console.error('Error creating new chat:', error);
                navigate('/chat');
              }
            }}
            style={{
              height: 56,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 10,
              paddingBottom: 10,
              left: 0,
              top: 0,
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
              <div
                style={{
                  width: 36,
                  height: 36,
                  padding: 6,
                  background: 'white',
                  borderRadius: 100,
                  justifyContent: 'center',
                  alignItems: 'center',
                  display: 'flex',
                  flexShrink: 0
                }}
              >
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
              <div
                style={{
                  color: 'white',
                  fontSize: 15,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '600',
                  lineHeight: '20px',
                  wordWrap: 'break-word'
                }}
              >
                Need help finding something?
              </div>
            </div>
          </button>
          <div style={{ width: 7, height: 7, right: 33, top: 0, position: 'absolute', background: '#171717', borderRadius: 9999 }} />
        </div>
      )}
    </div>
  );
};

// ✅ Loading Skeleton Component
const DocumentsSkeleton = () => {
  return (
    <div style={{width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex'}}>
      <LeftNav />

      <div style={{flex: 1, height: '100%', display: 'flex', flexDirection: 'column'}}>
        {/* Header Skeleton */}
        <div style={{height: 84, paddingLeft: 20, paddingRight: 20, background: 'white', borderBottom: '1px #E6E6EC solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{width: 200, height: 36, background: '#E5E7EB', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite'}} />
          <div style={{display: 'flex', gap: 12}}>
            <div style={{width: 120, height: 40, background: '#E5E7EB', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite'}} />
            <div style={{width: 120, height: 40, background: '#E5E7EB', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite'}} />
          </div>
        </div>

        {/* Content Skeleton */}
        <div style={{flex: 1, padding: '32px 20px', overflowY: 'auto'}}>
          {/* Search Bar Skeleton */}
          <div style={{width: '100%', maxWidth: 600, height: 44, background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 24, animation: 'pulse 1.5s ease-in-out infinite'}} />

          {/* Grid Skeleton */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                padding: 16,
                height: 100,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`
              }}>
                <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                  <div style={{width: 48, height: 48, background: '#E5E7EB', borderRadius: 8}} />
                  <div style={{flex: 1}}>
                    <div style={{width: '80%', height: 16, background: '#E5E7EB', borderRadius: 4, marginBottom: 8}} />
                    <div style={{width: '60%', height: 12, background: '#E5E7EB', borderRadius: 4}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default Documents;

