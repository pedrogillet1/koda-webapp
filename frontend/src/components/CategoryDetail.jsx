import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import UniversalUploadModal from './UniversalUploadModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import CreateFolderModal from './CreateFolderModal';
import { useDocuments } from '../context/DocumentsContext';
import { useDocumentSelection } from '../hooks/useDocumentSelection';
import { useToast } from '../context/ToastContext';
import folderIcon from '../assets/folder_icon.svg';
import { ReactComponent as ArrowLeftIcon } from '../assets/arrow-narrow-left.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can-red.svg';
import { ReactComponent as EditIcon } from '../assets/Edit 5.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as VectorIcon } from '../assets/Vector.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import { ReactComponent as FolderSvgIcon } from '../assets/Folder.svg';
import { ReactComponent as LogoutIcon } from '../assets/Logout-black.svg';
import { ReactComponent as TrashCanBlackIcon } from '../assets/Trash can.svg';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
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

// Document Thumbnail Component
const DocumentThumbnail = ({ documentId, filename, width = 80, height = 80 }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchThumbnail = async () => {
      try {
        const response = await api.get(`/api/documents/${documentId}/thumbnail`);
        if (response.data.thumbnailUrl) {
          setThumbnailUrl(response.data.thumbnailUrl);
        }
      } catch (error) {
        console.error('Error fetching thumbnail:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchThumbnail();
  }, [documentId, filename]);

  // Get file icon as fallback
  const getFileIcon = (filename) => {
    if (!filename) return txtIcon;
    const ext = filename.toLowerCase();
    if (ext.match(/\.(pdf)$/)) return pdfIcon;
    if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
    if (ext.match(/\.(png)$/)) return pngIcon;
    if (ext.match(/\.(doc|docx)$/)) return docIcon;
    if (ext.match(/\.(txt)$/)) return txtIcon;
    if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
    if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
    if (ext.match(/\.(mov)$/)) return movIcon;
    if (ext.match(/\.(mp4)$/)) return mp4Icon;
    if (ext.match(/\.(mp3|wav|aac|m4a)$/)) return mp3Icon;
    return txtIcon;
  };

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ fontSize: 10, color: '#9CA3AF' }}>...</div>
      </div>
    );
  }

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={filename}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 4
        }}
        onError={() => {
          // If thumbnail fails to load, set to null to show fallback icon
          setThumbnailUrl(null);
        }}
      />
    );
  }

  // Fallback to file icon - centered
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <img
        src={getFileIcon(filename)}
        alt={filename}
        style={{
          width: 80,
          height: 80,
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

// Folder Thumbnail Component
const FolderThumbnail = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        width: '100%',
        height: '136px',
        borderRadius: '10px',
        background: 'linear-gradient(180deg, #E8E8E8 0%, #C8C8C8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.3s ease'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={folderIcon}
        alt="Folder"
        style={{
          width: '100px',
          height: '100px',
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.3s ease',
          filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25))'
        }}
      />
    </div>
  );
};

const CategoryDetail = () => {
  const { categoryName, folderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess } = useToast();
  const { documents: contextDocuments, folders: contextFolders, createFolder, moveToFolder, refreshAll } = useDocuments(); // Get from context for auto-refresh
  const [documents, setDocuments] = useState([]);
  const [subFolders, setSubFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [sortBy, setSortBy] = useState('timeAdded');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedDocumentForCategory, setSelectedDocumentForCategory] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [currentFolderName, setCurrentFolderName] = useState('');
  const [breadcrumbPath, setBreadcrumbPath] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = React.useRef(null);
  const folderInputRef = React.useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('[data-dropdown]')) {
        setOpenDropdownId(null);
      }
      if (showNewDropdown && !event.target.closest('[data-new-dropdown]')) {
        setShowNewDropdown(false);
      }
      if (openFolderMenuId && !event.target.closest('[data-folder-menu]')) {
        setOpenFolderMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId, showNewDropdown, openFolderMenuId]);

  // Format category name for display
  const formatCategoryName = (name) => {
    if (!name) return '';
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Build folder path for breadcrumbs
  const buildFolderPath = (folders, currentFolder) => {
    const path = [];
    let folder = currentFolder;

    // Traverse up the folder hierarchy
    while (folder) {
      path.unshift({
        id: folder.id,
        name: folder.name
      });

      // Find parent folder
      if (folder.parentFolderId) {
        folder = folders.find(f => f.id === folder.parentFolderId);
      } else {
        folder = null;
      }
    }

    return path;
  };

  // Fetch documents and subfolders from backend
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        // Special handling for "recently-added" virtual category
        if (categoryName === 'recently-added') {
          const response = await api.get('/api/documents');
          const allDocuments = response.data.documents || [];
          // Sort by creation date descending
          const sortedDocs = allDocuments.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          );
          setDocuments(sortedDocs);
          setSubFolders([]);
          setLoading(false);
          return;
        }

        // Get folder list to find the folder (include all folders, not just root)
        const foldersResponse = await api.get('/api/folders?includeAll=true');
        const folders = foldersResponse.data?.folders || [];

        let folder;

        // If folderId is provided in the URL, use it directly
        if (folderId) {
          folder = folders.find(f => f.id === folderId);
          console.log('Looking for folder with ID:', folderId);
        } else {
          // Otherwise, find by category name (case-insensitive)
          const formattedCategoryName = formatCategoryName(categoryName);
          console.log('Looking for folder with name:', formattedCategoryName);
          folder = folders.find(f => f.name?.toLowerCase() === formattedCategoryName.toLowerCase());
        }

        console.log('All folders:', folders.map(f => ({ id: f.id, name: f.name })));

        if (!folder) {
          console.error('ERROR: Folder not found');
          console.error('Available folders:', folders.map(f => f.name));
          setDocuments([]);
          setSubFolders([]);
          setCurrentFolderId(null);
          setLoading(false);
          return;
        }

        console.log('✅ Found folder:', folder.name, 'with ID:', folder.id);
        console.log('📁 Folder _count:', folder._count);

        // Store the folder ID and name for uploads and display
        setCurrentFolderId(folder.id);
        setCurrentFolderName(folder.name);

        // Build breadcrumb path
        const folderPath = buildFolderPath(folders, folder);
        setBreadcrumbPath(folderPath);

        // Fetch documents filtered by folderId
        console.log('🔍 Fetching documents with URL:', `/api/documents?folderId=${folder.id}`);
        const response = await api.get(`/api/documents?folderId=${folder.id}`);
        const folderDocuments = response.data.documents || [];

        console.log('📄 API Response:', response.data);
        console.log('📊 Number of documents returned:', folderDocuments.length);
        console.log('📋 Documents:', folderDocuments);

        if (folderDocuments.length === 0 && folder._count?.documents > 0) {
          console.error('⚠️ MISMATCH: Folder shows', folder._count?.documents, 'documents but API returned 0');
        }

        // Get subfolders (if the API supports it)
        const subFoldersInCategory = folders.filter(f => f.parentFolderId === folder.id);

        console.log('Initial load - Current folder:', folder);
        console.log('Initial load - Subfolders:', subFoldersInCategory);

        // Ensure each folder has a _count property for documents
        const foldersWithCounts = subFoldersInCategory.map(folder => ({
          ...folder,
          _count: folder._count || { documents: 0 }
        }));

        console.log('Initial load - Folders with counts:', foldersWithCounts);

        setSubFolders(foldersWithCounts);
        setDocuments(folderDocuments);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching documents:', error);
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [categoryName, folderId, refreshTrigger, contextDocuments, contextFolders]); // Re-fetch when context updates

  // ⚡ OPTIMIZED: Auto-sync subfolders from context for instant updates with backend-provided counts
  useEffect(() => {
    if (currentFolderId && contextFolders.length > 0) {
      const subFoldersInCategory = contextFolders.filter(f => f.parentFolderId === currentFolderId);

      // ⚡ USE BACKEND COUNTS: Don't recalculate - use the counts already provided by backend
      // This ensures instant updates when documents are moved/uploaded/deleted
      setSubFolders(subFoldersInCategory);
      console.log('✅ Auto-synced subfolders with backend counts:', subFoldersInCategory);
    }
  }, [contextFolders, currentFolderId]); // Removed contextDocuments dependency - not needed

  // Auto-sync documents from context for instant updates
  useEffect(() => {
    if (currentFolderId && contextDocuments.length >= 0) {
      const docsInFolder = contextDocuments.filter(doc => doc.folderId === currentFolderId);
      setDocuments(docsInFolder);
      console.log('Auto-synced documents from context:', docsInFolder.length, 'documents');
    }
  }, [contextDocuments, currentFolderId]);

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get file icon
  const getFileIcon = (doc) => {
    // Prioritize MIME type over file extension
    const mimeType = doc?.mimeType || '';
    const filename = doc?.filename || '';

    // ========== VIDEO FILES ==========
    if (mimeType === 'video/quicktime') {
      return movIcon; // Blue MOV icon
    }
    if (mimeType === 'video/mp4') {
      return mp4Icon; // Pink MP4 icon
    }
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
      return pngIcon;
    }

    // ========== FALLBACK: Extension-based check ==========
    if (filename) {
      const ext = filename.toLowerCase();
      if (ext.match(/\.(pdf)$/)) return pdfIcon;
      if (ext.match(/\.(doc|docx)$/)) return docIcon;
      if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
      if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
      if (ext.match(/\.(txt)$/)) return txtIcon;
      if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
      if (ext.match(/\.(png)$/)) return pngIcon;
      if (ext.match(/\.(mov)$/)) return movIcon;
      if (ext.match(/\.(mp4)$/)) return mp4Icon;
      if (ext.match(/\.(mp3|wav|aac|m4a)$/)) return mp3Icon;
      // Adobe Premiere Pro files (.prproj, .pek, .cfa) fall through to default
    }

    return txtIcon; // Default to generic file icon
  };

  // Format time
  const formatTime = (date) => {
    const now = new Date();
    const docDate = new Date(date);
    const diffMs = now - docDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `Today, ${docDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${docDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return docDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Handle sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Filter and sort documents
  const filteredDocuments = documents.filter(doc =>
    doc.filename?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'asc'
        ? a.filename.localeCompare(b.filename)
        : b.filename.localeCompare(a.filename);
    }
    if (sortBy === 'size') {
      return sortOrder === 'asc'
        ? (a.fileSize || 0) - (b.fileSize || 0)
        : (b.fileSize || 0) - (a.fileSize || 0);
    }
    if (sortBy === 'timeAdded') {
      return sortOrder === 'asc'
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt);
    }
    return 0;
  });

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

  const handleRenameSubmit = async (docId) => {
    if (!newFileName.trim()) return;

    try {
      await api.patch(`/api/documents/${docId}`, {
        filename: newFileName
      });

      // Refresh documents based on current category
      if (categoryName === 'recently-added') {
        const response = await api.get('/api/documents');
        const allDocuments = response.data.documents || [];
        const sortedDocs = allDocuments.sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setDocuments(sortedDocs);
      } else if (currentFolderId) {
        const response = await api.get(`/api/documents?folderId=${currentFolderId}`);
        setDocuments(response.data.documents || []);
      }

      setRenamingDocId(null);
      setNewFileName('');
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Failed to rename document');
    }
  };

  // Handle rename confirmation from modal
  const handleRenameConfirm = async (newName) => {
    if (!itemToRename) return;

    try {
      if (itemToRename.type === 'document') {
        await api.patch(`/api/documents/${itemToRename.id}`, {
          filename: newName
        });

        // Refresh documents based on current category
        if (categoryName === 'recently-added') {
          const response = await api.get('/api/documents');
          const allDocuments = response.data.documents || [];
          const sortedDocs = allDocuments.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
          );
          setDocuments(sortedDocs);
        } else if (currentFolderId) {
          const response = await api.get(`/api/documents?folderId=${currentFolderId}`);
          setDocuments(response.data.documents || []);
        }
      } else if (itemToRename.type === 'folder') {
        await api.patch(`/api/folders/${itemToRename.id}`, { name: newName });
        // Refresh folder list
        const foldersResponse = await api.get('/api/folders');
        const folders = foldersResponse.data?.folders || [];
        const subFoldersInCategory = folders.filter(f => f.parentFolderId === currentFolderId);
        const foldersWithCounts = subFoldersInCategory.map(f => ({
          ...f,
          _count: f._count || { documents: 0 }
        }));
        setSubFolders(foldersWithCounts);
      }

      setShowRenameModal(false);
      setItemToRename(null);
    } catch (error) {
      console.error('Error renaming:', error);
      alert(`Failed to rename ${itemToRename.type}`);
    }
  };

  // Handle add to category
  const handleAddToCategory = async (doc) => {
    console.log('handleAddToCategory called for doc:', doc);
    setSelectedDocumentForCategory(doc);
    try {
      // Load ALL folders (categories and subfolders), excluding "Recently Added"
      const response = await api.get('/api/folders');
      const folders = response.data?.folders || [];
      const availableFolders = folders.filter(f =>
        f.name?.toLowerCase() !== 'recently added'
      );
      console.log('All folders loaded:', availableFolders);
      setAvailableCategories(availableFolders);
      setShowCategoryModal(true);
      console.log('Modal should be showing now');
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Failed to load categories');
    }
  };

  const handleCategorySelection = async () => {
    if (!selectedCategoryId) return;

    try {
      // Check if we're moving selected documents (from select mode)
      if (isSelectMode && selectedDocuments.size > 0) {
        // Move all selected documents
        await Promise.all(
          Array.from(selectedDocuments).map(docId =>
            moveToFolder(docId, selectedCategoryId)
          )
        );

        // ⚡ REMOVED: No need to refreshAll() - moveToFolder already updates state optimistically

        // Clear selection and exit select mode
        clearSelection();
        toggleSelectMode();

        // Show success message
        setSuccessCount(selectedDocuments.size);
        setSuccessMessage(`${selectedDocuments.size} document${selectedDocuments.size > 1 ? 's have' : ' has'} been successfully moved.`);
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
      } else if (selectedDocumentForCategory) {
        // Move single item (folder or document)
        if (selectedDocumentForCategory.type === 'folder') {
          // Move folder to new parent
          await api.patch(`/api/folders/${selectedDocumentForCategory.id}`, {
            parentFolderId: selectedCategoryId
          });

          // Refresh context to get updated folder structure (needed for folder moves)
          await refreshAll();
        } else {
          // Move document
          await moveToFolder(selectedDocumentForCategory.id, selectedCategoryId);

          // ⚡ REMOVED: No need to refreshAll() - moveToFolder already updates state optimistically
        }
      }

      setShowCategoryModal(false);
      setSelectedDocumentForCategory(null);
      setSelectedCategoryId(null);
    } catch (error) {
      console.error('Error moving item to category:', error);
      alert(`Failed to move ${selectedDocumentForCategory?.type || 'item'} to category`);
    }
  };

  // Handle document delete
  const handleDelete = (docId) => {
    const doc = documents.find(d => d.id === docId);
    setItemToDelete({
      type: 'document',
      id: docId,
      name: doc?.filename || 'this document'
    });
    setShowDeleteModal(true);
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    // Save reference before clearing state
    const itemToDeleteCopy = itemToDelete;

    // Close modal immediately
    setShowDeleteModal(false);
    setItemToDelete(null);

    // For bulk delete, clear selection and exit select mode IMMEDIATELY
    if (itemToDeleteCopy.type === 'bulk-documents') {
      clearSelection();
      toggleSelectMode();
    }

    try {
      if (itemToDeleteCopy.type === 'bulk-documents') {
        // Handle bulk deletion of selected documents
        const deleteCount = itemToDeleteCopy.count;

        // Update UI immediately (optimistic update)
        setDocuments(prev => prev.filter(doc => !itemToDeleteCopy.ids.includes(doc.id)));

        // Show success message
        showSuccess(`${deleteCount} file${deleteCount > 1 ? 's have' : ' has'} been deleted`);

        // Delete on server in background
        await Promise.all(
          itemToDeleteCopy.ids.map(docId =>
            api.delete(`/api/documents/${docId}`).catch(error => {
              console.error(`Error deleting document ${docId}:`, error);
            })
          )
        );
      } else if (itemToDeleteCopy.type === 'document') {
        // Update UI immediately (optimistic update)
        setDocuments(prev => prev.filter(doc => doc.id !== itemToDeleteCopy.id));

        // Show success notification
        showSuccess('1 file has been deleted');

        setOpenDropdownId(null);

        // Delete on server in background
        await api.delete(`/api/documents/${itemToDeleteCopy.id}`);
      } else if (itemToDeleteCopy.type === 'folder') {
        // Show notification immediately for instant feedback
        showSuccess('1 folder has been deleted');

        await api.delete(`/api/folders/${itemToDeleteCopy.id}`);
        // Navigate back after deletion
        navigate(-1);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      // Refresh to restore correct state on error
      setRefreshTrigger(prev => prev + 1);
    }
  };

  // Handle file upload to this specific folder
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0 || !currentFolderId) return;

    try {
      const token = localStorage.getItem('accessToken');

      for (const file of files) {
        // Calculate file hash
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Upload file with folderId
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileHash', fileHash);
        formData.append('folderId', currentFolderId);

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/documents/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }
      }

      // Refresh documents list
      const response = await api.get(`/api/documents?folderId=${currentFolderId}`);
      setDocuments(response.data.documents || []);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setShowNewDropdown(false);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    }
  };

  // Handle folder upload
  const handleFolderUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0 || !currentFolderId) return;

    try {
      const token = localStorage.getItem('accessToken');

      for (const file of files) {
        // Calculate file hash
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Upload file with folderId
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileHash', fileHash);
        formData.append('folderId', currentFolderId);

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/documents/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }
      }

      // Refresh documents list
      const response = await api.get(`/api/documents?folderId=${currentFolderId}`);
      setDocuments(response.data.documents || []);

      // Reset folder input
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }

      setShowNewDropdown(false);
    } catch (error) {
      console.error('Error uploading folder:', error);
      alert('Failed to upload folder. Please try again.');
    }
  };

  // Handle create folder - open modal
  const handleCreateFolder = () => {
    setShowCreateFolderModal(true);
    setShowNewDropdown(false);
  };

  // Handle confirm create folder from modal
  const handleConfirmCreateFolder = async (folderName) => {
    try {
      console.log('Creating folder:', folderName, 'with parentFolderId:', currentFolderId);

      // Use context's createFolder method for instant UI updates
      await createFolder(folderName.trim(), null, currentFolderId);

      console.log('Folder created via context');

      // Context automatically updates all components with the new folder!
      setShowCreateFolderModal(false);
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  // Drag and Drop handlers
  const handleDocumentDragStart = (e, doc) => {
    e.stopPropagation();

    // Get count of selected documents or just this one
    const count = isSelectMode && selectedDocuments.has(doc.id)
      ? selectedDocuments.size
      : 1;

    setDraggedItem({ type: 'document', id: doc.id, name: doc.filename });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'document',
      id: doc.id,
      name: doc.filename
    }));

    // Create custom drag image showing document name(s)
    const dragPreview = document.createElement('div');
    dragPreview.style.cssText = `
      position: absolute;
      top: -1000px;
      padding: 8px 12px;
      background: #111827;
      color: white;
      border-radius: 8px;
      font-family: 'Plus Jakarta Sans';
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
    `;
    dragPreview.textContent = count > 1
      ? `${count} documents`
      : doc.filename;
    document.body.appendChild(dragPreview);
    e.dataTransfer.setDragImage(dragPreview, 0, 0);
    setTimeout(() => document.body.removeChild(dragPreview), 0);
  };

  const handleDocumentDragEnd = (e) => {
    e.target.closest('.document-row, .document-card')?.classList.remove('dragging');
    setDraggedItem(null);
    setDropTargetId(null);
  };

  const handleFolderDragStart = (e, folder) => {
    e.stopPropagation();
    setDraggedItem({ type: 'folder', id: folder.id, name: folder.name });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'folder',
      id: folder.id,
      name: folder.name
    }));
    setTimeout(() => {
      e.target.closest('.folder-card')?.classList.add('dragging');
    }, 0);
  };

  const handleFolderDragEnd = (e) => {
    e.target.closest('.folder-card')?.classList.remove('dragging');
    setDraggedItem(null);
    setDropTargetId(null);
  };

  const handleFolderDragOver = (e, folder) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if we can drop here
    if (draggedItem) {
      // Can't drop folder into itself
      if (draggedItem.type === 'folder' && draggedItem.id === folder.id) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleFolderDragEnter = (e, folder) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedItem) {
      // Can't drop folder into itself
      if (draggedItem.type === 'folder' && draggedItem.id === folder.id) {
        return;
      }
      setDropTargetId(folder.id);
    }
  };

  const handleFolderDragLeave = (e, folder) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear if we're actually leaving the folder
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      if (dropTargetId === folder.id) {
        setDropTargetId(null);
      }
    }
  };

  const handleFolderDrop = async (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      if (data.type === 'document') {
        // If in select mode and the dragged document is selected, move all selected documents
        const documentsToMove = isSelectMode && selectedDocuments.has(data.id)
          ? Array.from(selectedDocuments)
          : [data.id];

        // Use context's moveToFolder for instant UI updates
        await Promise.all(
          documentsToMove.map(docId =>
            moveToFolder(docId, targetFolder.id)
          )
        );

        // ⚡ REMOVED: No need to refreshAll() - moveToFolder already updates state optimistically with instant folder count updates

        // Show success modal and deactivate select mode
        setSuccessCount(documentsToMove.length);
        setSuccessMessage(`${documentsToMove.length} document${documentsToMove.length > 1 ? 's have' : ' has'} been successfully moved.`);
        setShowSuccessModal(true);

        // Clear selection and exit select mode
        if (isSelectMode) {
          clearSelection();
          toggleSelectMode();
        }

        // Auto-hide modal after 3 seconds
        setTimeout(() => {
          setShowSuccessModal(false);
        }, 3000);
      } else if (data.type === 'folder') {
        // Can't drop folder into itself
        if (data.id === targetFolder.id) {
          alert('Cannot move folder into itself');
          return;
        }

        // Move folder into another folder
        await api.patch(`/api/folders/${data.id}`, {
          name: data.name,
          parentFolderId: targetFolder.id
        });

        // Refresh folder list
        const foldersResponse = await api.get('/api/folders');
        const folders = foldersResponse.data?.folders || [];
        const subFoldersInCategory = folders.filter(f => f.parentFolderId === currentFolderId);
        const foldersWithCounts = subFoldersInCategory.map(folder => ({
          ...folder,
          _count: folder._count || { documents: 0 }
        }));
        setSubFolders(foldersWithCounts);

        alert(`Moved folder "${data.name}" into "${targetFolder.name}"`);
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      alert('Failed to move item. Please try again.');
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex' }}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header with Breadcrumb, Search, and Controls */}
        <div style={{
          background: 'white',
          padding: '20px 32px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          {/* Main Header Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 24,
            flexWrap: 'wrap'
          }}>
            {/* Left: Breadcrumb and Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Real Breadcrumb Navigation */}
              <div style={{
                fontSize: 13,
                color: '#6B7280',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap'
              }}>
                {/* Home or Documents based on route */}
                <span
                  onClick={() => {
                    // Navigate to Documents if we came from there, otherwise Home
                    if (folderId) {
                      navigate('/documents');
                    } else {
                      navigate('/home');
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#111827'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#6B7280'}
                >
                  {folderId ? 'Documents' : 'Home'}
                </span>

                {/* Breadcrumb path for nested folders */}
                {breadcrumbPath.length > 0 ? (
                  breadcrumbPath.map((pathItem, index) => (
                    <React.Fragment key={pathItem.id}>
                      <span style={{ color: '#D1D5DB' }}>›</span>
                      <span
                        onClick={() => {
                          if (index < breadcrumbPath.length - 1) {
                            navigate(`/folder/${pathItem.id}`);
                          }
                        }}
                        style={{
                          cursor: index < breadcrumbPath.length - 1 ? 'pointer' : 'default',
                          fontWeight: index === breadcrumbPath.length - 1 ? '500' : '400',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (index < breadcrumbPath.length - 1) {
                            e.currentTarget.style.color = '#111827';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (index < breadcrumbPath.length - 1) {
                            e.currentTarget.style.color = '#6B7280';
                          }
                        }}
                      >
                        {pathItem.name}
                      </span>
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    <span style={{ color: '#D1D5DB' }}>›</span>
                    <span>{currentFolderName || formatCategoryName(categoryName)}</span>
                  </>
                )}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
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
                  {currentFolderName || formatCategoryName(categoryName)}
                </h1>
              </div>
            </div>

            {/* Right: Search, View Toggle, New Button OR Delete/Move buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
              flexWrap: 'wrap'
            }}>
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
                      // Open category modal to select destination
                      try {
                        const response = await api.get('/api/folders');
                        const folders = response.data?.folders || [];
                        const availableFolders = folders.filter(f =>
                          f.name?.toLowerCase() !== 'recently added' && f.id !== currentFolderId
                        );
                        setAvailableCategories(availableFolders);
                        setShowCategoryModal(true);
                      } catch (error) {
                        console.error('Error loading categories:', error);
                        alert('Failed to load categories');
                      }
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
                  {/* Search Bar */}
                  <div style={{
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
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    display: 'inline-flex'
                  }}>
                    <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                      <SearchIcon style={{ width: 24, height: 24 }} />
                      <input
                        type="text"
                        placeholder="Search any documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: '#32302C',
                          fontSize: 16,
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: '500',
                          lineHeight: '24px',
                          width: 200
                        }}
                      />
                    </div>
                  </div>

                  {/* Select Button */}
                  <button
                    onClick={toggleSelectMode}
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

                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    onChange={handleFolderUpload}
                    style={{ display: 'none' }}
                  />

                  {/* New Dropdown Button */}
                  <div style={{ position: 'relative' }} data-new-dropdown>
                    <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('New button clicked!');
                    console.log('currentFolderId:', currentFolderId);
                    console.log('showNewDropdown before:', showNewDropdown);
                    setShowNewDropdown(!showNewDropdown);
                    console.log('showNewDropdown toggled');
                  }}
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
                    cursor: 'pointer'
                  }}
                >
                  <VectorIcon style={{ width: 15, height: 14 }} />
                  <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                    <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>New</div>
                  </div>
                </button>

                {showNewDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'white',
                    boxShadow: '0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                    overflow: 'hidden',
                    borderRadius: 12,
                    outline: '1px #E6E6EC solid',
                    outlineOffset: '-1px',
                    zIndex: 100,
                    minWidth: 200
                  }}>
                    <div style={{
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      display: 'flex'
                    }}>
                      <div style={{
                        alignSelf: 'stretch',
                        paddingTop: 4,
                        paddingBottom: 4,
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        gap: 1,
                        display: 'flex'
                      }}>
                        {/* Upload a Document */}
                        <div
                          onClick={() => {
                            setShowUploadModal(true);
                            setShowNewDropdown(false);
                          }}
                          style={{
                            alignSelf: 'stretch',
                            height: 38,
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 1,
                            paddingBottom: 1,
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            display: 'flex',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            flex: '1 1 0',
                            alignSelf: 'stretch',
                            paddingTop: 2,
                            paddingBottom: 2,
                            paddingLeft: 8,
                            paddingRight: 10,
                            borderRadius: 6,
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            gap: 6,
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              alignSelf: 'stretch',
                              justifyContent: 'flex-start',
                              alignItems: 'center',
                              gap: 6,
                              display: 'inline-flex'
                            }}>
                              <LogoutIcon style={{ width: 16, height: 16 }} />
                              <div style={{
                                color: '#32302C',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '500',
                                lineHeight: '24px'
                              }}>
                                Upload a Document
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Create a Folder */}
                        <div
                          onClick={() => handleCreateFolder()}
                          style={{
                            alignSelf: 'stretch',
                            height: 38,
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 1,
                            paddingBottom: 1,
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            display: 'flex',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            flex: '1 1 0',
                            alignSelf: 'stretch',
                            paddingTop: 2,
                            paddingBottom: 2,
                            paddingLeft: 8,
                            paddingRight: 10,
                            borderRadius: 6,
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            gap: 6,
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              alignSelf: 'stretch',
                              justifyContent: 'flex-start',
                              alignItems: 'center',
                              gap: 6,
                              display: 'inline-flex'
                            }}>
                              <AddIcon style={{ width: 20, height: 20 }} />
                              <div style={{
                                color: '#32302C',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '500',
                                lineHeight: '24px'
                              }}>
                                Create a Folder
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Delete */}
                        <div
                          onClick={() => {
                            if (!currentFolderId) return;

                            setItemToDelete({
                              type: 'folder',
                              id: currentFolderId,
                              name: currentFolderName || 'this folder'
                            });
                            setShowDeleteModal(true);
                            setShowNewDropdown(false);
                          }}
                          style={{
                            alignSelf: 'stretch',
                            height: 38,
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 1,
                            paddingBottom: 1,
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            display: 'flex',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            flex: '1 1 0',
                            alignSelf: 'stretch',
                            paddingTop: 2,
                            paddingBottom: 2,
                            paddingLeft: 8,
                            paddingRight: 10,
                            borderRadius: 6,
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            gap: 6,
                            display: 'inline-flex'
                          }}>
                            <div style={{
                              alignSelf: 'stretch',
                              justifyContent: 'flex-start',
                              alignItems: 'center',
                              gap: 6,
                              display: 'inline-flex'
                            }}>
                              <TrashCanIcon style={{ width: 16, height: 16 }} />
                              <div style={{
                                color: '#D92D20',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '500',
                                lineHeight: '20px'
                              }}>
                                Delete
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Content Area with Folder Grid + Document List */}
        <div style={{
          flex: 1,
          padding: 24,
          overflowY: 'auto',
          background: '#F5F5F5'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C6B6E' }}>Loading...</div>
          ) : (
            <>
              {/* Folders Section (Grid) */}
              {subFolders.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: '#374151',
                    fontFamily: 'Plus Jakarta Sans',
                    margin: '0 0 16px 0'
                  }}>
                    Folders
                  </h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 16
                  }}>
                    {subFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="folder-card"
                        draggable="true"
                        onDragStart={(e) => handleFolderDragStart(e, folder)}
                        onDragEnd={handleFolderDragEnd}
                        onDragOver={(e) => handleFolderDragOver(e, folder)}
                        onDragEnter={(e) => handleFolderDragEnter(e, folder)}
                        onDragLeave={(e) => handleFolderDragLeave(e, folder)}
                        onDrop={(e) => handleFolderDrop(e, folder)}
                        style={{
                          background: dropTargetId === folder.id ? '#EFF6FF' : '#F9FAFB',
                          border: dropTargetId === folder.id ? '2px dashed #3B82F6' : '1px solid #E5E7EB',
                          borderRadius: 12,
                          padding: 16,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          opacity: draggedItem?.type === 'folder' && draggedItem?.id === folder.id ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (dropTargetId !== folder.id) {
                            e.currentTarget.style.background = '#F3F4F6';
                            e.currentTarget.style.borderColor = '#D1D5DB';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (dropTargetId !== folder.id) {
                            e.currentTarget.style.background = '#F9FAFB';
                            e.currentTarget.style.borderColor = '#E5E7EB';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {/* Three Dots Menu Button */}
                        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 9999 }} data-folder-menu>
                          <button
                            data-folder-menu-id={folder.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFolderMenuId(openFolderMenuId === folder.id ? null : folder.id);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              background: 'white',
                              border: '1px solid #E5E7EB',
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
                            <span style={{ fontSize: 18, fontWeight: 'bold', color: '#6B7280', lineHeight: 1 }}>⋯</span>
                          </button>

                          {/* Dropdown Menu */}
                          {openFolderMenuId === folder.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 4,
                              background: 'white',
                              boxShadow: '0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
                              borderRadius: 8,
                              outline: '1px #E6E6EC solid',
                              minWidth: 150,
                              zIndex: 10000
                            }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/category/${folder.name?.toLowerCase().replace(/\s+/g, '-')}`);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  cursor: 'pointer',
                                  borderRadius: '8px 8px 0 0'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                Open
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToRename({ type: 'folder', id: folder.id, name: folder.name });
                                  setShowRenameModal(true);
                                  setOpenFolderMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  borderTop: '1px solid #F3F4F6',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                Rename
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  // Load categories and open modal
                                  setSelectedDocumentForCategory({ type: 'folder', id: folder.id, name: folder.name });
                                  try {
                                    // Load ALL folders (categories and subfolders), excluding "Recently Added"
                                    const response = await api.get('/api/folders');
                                    const folders = response.data?.folders || [];
                                    const availableFolders = folders.filter(f =>
                                      f.name?.toLowerCase() !== 'recently added'
                                    );
                                    setAvailableCategories(availableFolders);
                                    setShowCategoryModal(true);
                                  } catch (error) {
                                    console.error('Error loading categories:', error);
                                    alert('Failed to load categories');
                                  }
                                  setOpenFolderMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  borderTop: '1px solid #F3F4F6',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                Move
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Delete folder "${folder.name}"?`)) {
                                    try {
                                      await api.delete(`/api/folders/${folder.id}`);
                                      // Refresh folder list (include all folders, not just root)
                                      const foldersResponse = await api.get('/api/folders?includeAll=true');
                                      const folders = foldersResponse.data?.folders || [];
                                      const subFoldersInCategory = folders.filter(f => f.parentFolderId === currentFolderId);
                                      const foldersWithCounts = subFoldersInCategory.map(f => ({
                                        ...f,
                                        _count: f._count || { documents: 0 }
                                      }));
                                      setSubFolders(foldersWithCounts);
                                    } catch (error) {
                                      console.error('Error deleting folder:', error);
                                      alert(error.response?.data?.error || 'Failed to delete folder');
                                    }
                                  }
                                  setOpenFolderMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  background: 'none',
                                  border: 'none',
                                  borderTop: '1px solid #F3F4F6',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#D92D20',
                                  cursor: 'pointer',
                                  borderRadius: '0 0 8px 8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Folder Icon */}
                        <div
                          onClick={() => navigate(`/folder/${folder.id}`)}
                          style={{
                            width: '100%',
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 12,
                            position: 'relative'
                          }}
                        >
                          <FolderThumbnail />
                        </div>

                        {/* Folder Info */}
                        <div
                          onClick={() => navigate(`/folder/${folder.id}`)}
                          style={{ textAlign: 'center' }}
                        >
                          <h3 style={{
                            fontSize: 14,
                            fontWeight: '500',
                            color: '#111827',
                            fontFamily: 'Plus Jakarta Sans',
                            margin: '0 0 4px 0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {folder.name}
                          </h3>
                          <p style={{
                            fontSize: 12,
                            color: '#6B7280',
                            fontFamily: 'Plus Jakarta Sans',
                            margin: 0
                          }}>
                            {folder._count?.documents || 0} document{folder._count?.documents !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Section (Table or Grid) */}
              <div>
                <h2 style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#374151',
                  fontFamily: 'Plus Jakarta Sans',
                  margin: '0 0 16px 0'
                }}>
                  Documents
                </h2>

                {sortedDocuments.length === 0 ? (
                  <div style={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    padding: 40,
                    textAlign: 'center',
                    color: '#6B7280',
                    fontFamily: 'Plus Jakarta Sans'
                  }}>
                    No documents found
                  </div>
                ) : viewMode === 'grid' ? (
                  // Grid View
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 16,
                    position: 'relative'
                  }}>
                    {sortedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="document-card"
                        draggable="true"
                        onDragStart={(e) => handleDocumentDragStart(e, doc)}
                        onDragEnd={handleDocumentDragEnd}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleDocument(doc.id);
                          } else {
                            navigate(`/document/${doc.id}`);
                          }
                        }}
                        style={{
                          background: isSelected(doc.id) ? '#111827' : 'white',
                          border: isSelected(doc.id) ? '2px solid #111827' : '1px solid #E5E7EB',
                          borderRadius: 12,
                          padding: 16,
                          cursor: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 'move' : 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          opacity: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 0.5 : 1,
                          overflow: 'visible',
                          zIndex: openDropdownId === doc.id ? 200 : 1
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#F9FAFB';
                          e.currentTarget.style.borderColor = '#D1D5DB';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#E5E7EB';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Document Icon */}
                        <div style={{
                          width: '100%',
                          height: 160,
                          marginBottom: 12,
                          background: '#F9FAFB',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          zIndex: 1
                        }}>
                          <img
                            src={getFileIcon(doc)}
                            alt="file icon"
                            style={{
                              width: 120,
                              height: 120,
                              objectFit: 'contain',
                              aspectRatio: '1/1'
                            }}
                          />
                        </div>

                        {/* Document Info */}
                        <div style={{ textAlign: 'center' }}>
                          {renamingDocId === doc.id ? (
                            <input
                              type="text"
                              value={newFileName}
                              onChange={(e) => setNewFileName(e.target.value)}
                              onBlur={() => handleRenameSubmit(doc.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameSubmit(doc.id);
                                } else if (e.key === 'Escape') {
                                  setRenamingDocId(null);
                                  setNewFileName('');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              style={{
                                padding: '4px 8px',
                                fontSize: 14,
                                fontFamily: 'Plus Jakarta Sans',
                                fontWeight: '500',
                                color: '#111827',
                                border: '1px solid #181818',
                                borderRadius: 6,
                                outline: 'none',
                                background: 'white',
                                width: '100%',
                                marginBottom: 4
                              }}
                            />
                          ) : (
                            <h3 style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: isSelected(doc.id) ? 'white' : '#111827',
                              fontFamily: 'Plus Jakarta Sans',
                              margin: '0 0 4px 0',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {doc.filename}
                            </h3>
                          )}
                          <p style={{
                            fontSize: 12,
                            color: isSelected(doc.id) ? 'rgba(255,255,255,0.8)' : '#6B7280',
                            fontFamily: 'Plus Jakarta Sans',
                            margin: '0 0 4px 0'
                          }}>
                            {formatFileSize(doc.fileSize)}
                          </p>
                          <p style={{
                            fontSize: 11,
                            color: '#9CA3AF',
                            fontFamily: 'Plus Jakarta Sans',
                            margin: 0
                          }}>
                            {formatTime(doc.createdAt)}
                          </p>
                        </div>

                        {/* Actions Button */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            zIndex: 100
                          }}
                          data-dropdown
                        >
                          <button
                            data-dropdown-id={doc.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === doc.id ? null : doc.id);
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              background: 'white',
                              border: '1px solid #E5E7EB',
                              borderRadius: 6,
                              fontSize: 16,
                              color: '#9CA3AF',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#F3F4F6';
                              e.currentTarget.style.color = '#6B7280';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'white';
                              e.currentTarget.style.color = '#9CA3AF';
                            }}
                          >
                            ⋯
                          </button>

                          {openDropdownId === doc.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 4,
                                background: 'white',
                                border: '1px solid #E5E7EB',
                                borderRadius: 8,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                zIndex: 10000,
                                minWidth: 140
                              }}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(doc);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  width: '100%',
                                  padding: '8px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  color: '#32302C',
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  borderRadius: 6
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
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
                                  width: '100%',
                                  padding: '8px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  color: '#32302C',
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  borderRadius: 6
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
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
                                  width: '100%',
                                  padding: '8px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  color: '#32302C',
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  borderRadius: 6
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                Move
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(doc.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  width: '100%',
                                  padding: '8px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  color: '#DC2626',
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  borderRadius: 6
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    overflow: 'hidden'
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse'
                    }}>
                      <thead>
                        <tr style={{
                          background: '#F9FAFB',
                          borderBottom: '1px solid #E5E7EB'
                        }}>
                          <th
                            onClick={() => handleSort('name')}
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: 13,
                              fontWeight: '600',
                              color: '#6B7280',
                              fontFamily: 'Plus Jakarta Sans',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            File Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => handleSort('timeAdded')}
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: 13,
                              fontWeight: '600',
                              color: '#6B7280',
                              fontFamily: 'Plus Jakarta Sans',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Time Added {sortBy === 'timeAdded' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => handleSort('size')}
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontSize: 13,
                              fontWeight: '600',
                              color: '#6B7280',
                              fontFamily: 'Plus Jakarta Sans',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th style={{
                            width: 60,
                            textAlign: 'center',
                            padding: '12px 16px'
                          }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDocuments.map((doc) => (
                          <tr
                            key={doc.id}
                            className="document-row"
                            draggable="true"
                            onDragStart={(e) => handleDocumentDragStart(e, doc)}
                            onDragEnd={handleDocumentDragEnd}
                            onClick={() => {
                              if (isSelectMode) {
                                toggleDocument(doc.id);
                              } else {
                                navigate(`/document/${doc.id}`);
                              }
                            }}
                            style={{
                              borderBottom: '1px solid #F3F4F6',
                              background: isSelected(doc.id) ? '#111827' : 'white',
                              cursor: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 'move' : 'pointer',
                              transition: 'background 0.2s',
                              opacity: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 0.5 : 1,
                              borderLeft: isSelected(doc.id) ? '3px solid #111827' : '3px solid transparent'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected(doc.id)) {
                                e.currentTarget.style.background = '#F9FAFB';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected(doc.id)) {
                                e.currentTarget.style.background = 'white';
                              }
                            }}
                          >
                            {/* File Name Cell */}
                            <td style={{
                              padding: '14px 16px',
                              fontSize: 14,
                              color: isSelected(doc.id) ? 'white' : '#374151',
                              fontFamily: 'Plus Jakarta Sans'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <img
                                  src={getFileIcon(doc)}
                                  alt="file icon"
                                  style={{ width: 24, height: 24, objectFit: 'contain', aspectRatio: '1/1' }}
                                />
                                {renamingDocId === doc.id ? (
                                  <input
                                    type="text"
                                    value={newFileName}
                                    onChange={(e) => setNewFileName(e.target.value)}
                                    onBlur={() => handleRenameSubmit(doc.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleRenameSubmit(doc.id);
                                      } else if (e.key === 'Escape') {
                                        setRenamingDocId(null);
                                        setNewFileName('');
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    style={{
                                      padding: '4px 8px',
                                      fontSize: 14,
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontWeight: '500',
                                      color: '#111827',
                                      border: '1px solid #181818',
                                      borderRadius: 6,
                                      outline: 'none',
                                      background: 'white',
                                      flex: 1
                                    }}
                                  />
                                ) : (
                                  <span style={{
                                    fontWeight: '500',
                                    color: isSelected(doc.id) ? 'white' : '#111827'
                                  }}>
                                    {doc.filename}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Time Added Cell */}
                            <td style={{
                              padding: '14px 16px',
                              fontSize: 14,
                              color: isSelected(doc.id) ? 'rgba(255,255,255,0.8)' : '#6B7280',
                              fontFamily: 'Plus Jakarta Sans'
                            }}>
                              {formatTime(doc.createdAt)}
                            </td>

                            {/* Size Cell */}
                            <td style={{
                              padding: '14px 16px',
                              fontSize: 14,
                              color: isSelected(doc.id) ? 'rgba(255,255,255,0.8)' : '#6B7280',
                              fontFamily: 'Plus Jakarta Sans',
                              fontVariantNumeric: 'tabular-nums'
                            }}>
                              {formatFileSize(doc.fileSize)}
                            </td>

                            {/* Actions Cell */}
                            <td style={{
                              padding: '14px 16px',
                              textAlign: 'center',
                              position: 'relative'
                            }} data-dropdown>
                              <button
                                data-dropdown-id={`list-${doc.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === doc.id ? null : doc.id);
                                }}
                                style={{
                                  width: 32,
                                  height: 32,
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 6,
                                  fontSize: 18,
                                  color: '#9CA3AF',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#F3F4F6';
                                  e.currentTarget.style.color = '#6B7280';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#9CA3AF';
                                }}
                              >
                                ⋯
                              </button>

                              {openDropdownId === doc.id && (
                                <div
                                  style={{
                                    position: 'fixed',
                                    top: (() => {
                                      const button = document.querySelector(`[data-dropdown-id="list-${doc.id}"]`);
                                      if (button) {
                                        const rect = button.getBoundingClientRect();
                                        return rect.bottom + 4 + 'px';
                                      }
                                      return '0px';
                                    })(),
                                    right: (() => {
                                      const button = document.querySelector(`[data-dropdown-id="list-${doc.id}"]`);
                                      if (button) {
                                        const rect = button.getBoundingClientRect();
                                        return (window.innerWidth - rect.right) + 'px';
                                      }
                                      return '0px';
                                    })(),
                                    background: 'white',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    zIndex: 9999,
                                    minWidth: 140
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(doc);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      width: '100%',
                                      padding: '8px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: 14,
                                      color: '#32302C',
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                      borderRadius: 6
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
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
                                      width: '100%',
                                      padding: '8px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: 14,
                                      color: '#32302C',
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                      borderRadius: 6
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
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
                                      width: '100%',
                                      padding: '8px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: 14,
                                      color: '#32302C',
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                      borderRadius: 6
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    Move
                                  </button>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(doc.id);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      width: '100%',
                                      padding: '8px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: 14,
                                      color: '#DC2626',
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                      borderRadius: 6
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <NotificationPanel
        showNotificationsPopup={showNotificationsPopup}
        setShowNotificationsPopup={setShowNotificationsPopup}
      />

      {/* Category Selection Modal */}
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
                Category
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
              display: 'flex'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                width: '100%'
              }}>
                {availableCategories.map((category) => (
                  <div
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    style={{
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingTop: 12,
                      paddingBottom: 12,
                      background: selectedCategoryId === category.id ? '#F5F5F5' : 'white',
                      borderRadius: 12,
                      border: selectedCategoryId === category.id ? '2px #32302C solid' : '1px #E6E6EC solid',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      display: 'flex',
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
                    <div style={{
                      flex: 1,
                      color: '#32302C',
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      lineHeight: '19.60px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {category.name}
                    </div>
                    {selectedCategoryId === category.id && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="8" r="8" fill="#32302C"/>
                        <path d="M4.5 8L7 10.5L11.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
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

      {/* Universal Upload Modal */}
      <UniversalUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        categoryId={currentFolderId}
        onUploadComplete={() => {
          setRefreshTrigger(prev => prev + 1);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        itemName={itemToDelete?.name}
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

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onConfirm={handleConfirmCreateFolder}
      />

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{
            background: '#10B981',
            borderRadius: 8,
            padding: '12px 20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M11.6667 3.5L5.25 9.91667L2.33333 7" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{
              color: 'white',
              fontSize: 14,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500'
            }}>
              {successMessage}
            </span>
          </div>
        </div>
      )}

    </div>
  );
};

export default CategoryDetail;
