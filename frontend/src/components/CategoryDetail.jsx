import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import UniversalUploadModal from './UniversalUploadModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import CreateFolderModal from './CreateFolderModal';
import CategoryIcon from './CategoryIcon';
import { useDocuments } from '../context/DocumentsContext';
import { useDocumentSelection } from '../hooks/useDocumentSelection';
import { useToast } from '../context/ToastContext';
import { useIsMobile } from '../hooks/useIsMobile';
import folderIcon from '../assets/folder_icon.svg';
import { ReactComponent as ArrowLeftIcon } from '../assets/arrow-narrow-left.svg';
import { ReactComponent as TrashCanIcon } from '../assets/Trash can-red.svg';
import { ReactComponent as TrashCanLightIcon } from '../assets/Trash can-light.svg';
import { ReactComponent as EditIcon } from '../assets/Edit 5.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as SearchIcon } from '../assets/Search.svg';
import { ReactComponent as VectorIcon } from '../assets/Vector.svg';
import { ReactComponent as AddIcon } from '../assets/add.svg';
import { ReactComponent as FolderSvgIcon } from '../assets/Folder.svg';
import { ReactComponent as LogoutIcon } from '../assets/Logout-black.svg';
import { ReactComponent as TrashCanBlackIcon } from '../assets/Trash can.svg';
import { ReactComponent as CloseIcon } from '../assets/x-close.svg';
import { ReactComponent as DotsIcon } from '../assets/dots.svg';
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
import filesIcon from '../assets/files-icon.svg';

// Document Thumbnail Component - simplified to just show file icons (thumbnails not in use)
const DocumentThumbnail = ({ documentId, filename, width = 80, height = 80 }) => {

  // Get file icon
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

  // Just show file icon - no thumbnail loading needed
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
        background: 'transparent',
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
  const { t } = useTranslation();
  const { showSuccess, showDeleteSuccess, showError } = useToast();
  const isMobile = useIsMobile();
  const {
    documents: contextDocuments,
    folders: contextFolders,
    createFolder,
    moveToFolder,
    refreshAll,
    deleteDocument,   // ✅ For optimistic document deletion
    deleteFolder,     // ✅ For optimistic folder deletion
    renameDocument    // ✅ For optimistic document rename
  } = useDocuments();

  // State declarations
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [dropdownDirection, setDropdownDirection] = useState('down'); // 'up' or 'down'
  const [dropdownMenuPosition, setDropdownMenuPosition] = useState({ top: 0, left: 0 });
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [sortBy, setSortBy] = useState('timeAdded');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDropdown, setShowNewDropdown] = useState(false);
  const [openFolderMenuId, setOpenFolderMenuId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedDocumentForCategory, setSelectedDocumentForCategory] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [initialUploadFiles, setInitialUploadFiles] = useState(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
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

  // ✅ PHASE 1 OPTIMIZATION: Use context data instead of API calls (eliminates 800-1300ms delay)

  // ✅ Get current folder from context (instant - no API call)
  const currentFolder = useMemo(() => {
    if (categoryName === 'recently-added') return null;
    if (folderId) {
      return contextFolders.find(f => f.id === folderId);
    }
    // Find by category name (case-insensitive)
    const formattedCategoryName = categoryName?.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return contextFolders.find(f => f.name?.toLowerCase() === formattedCategoryName?.toLowerCase());
  }, [folderId, categoryName, contextFolders]);

  // ✅ Filter documents from context (instant - no API call)
  const documents = useMemo(() => {
    if (categoryName === 'recently-added') {
      return [...contextDocuments].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );
    }
    if (currentFolder) {
      return contextDocuments.filter(doc => doc.folderId === currentFolder.id);
    }
    return [];
  }, [contextDocuments, currentFolder, categoryName]);

  // ✅ Filter subfolders from context (instant - no API call)
  const subFolders = useMemo(() => {
    if (!currentFolder) return [];
    return contextFolders.filter(f => f.parentFolderId === currentFolder.id);
  }, [contextFolders, currentFolder]);

  // ✅ Build breadcrumb path (memoized - no state needed)
  const breadcrumbPath = useMemo(() => {
    if (!currentFolder) return [];

    const path = [];
    let folder = currentFolder;

    while (folder) {
      path.unshift({
        id: folder.id,
        name: folder.name
      });

      if (folder.parentFolderId) {
        folder = contextFolders.find(f => f.id === folder.parentFolderId);
      } else {
        folder = null;
      }
    }

    return path;
  }, [currentFolder, contextFolders]);

  // ✅ Get current folder ID and name (memoized)
  const currentFolderId = currentFolder?.id || null;
  const currentFolderName = currentFolder?.name || '';
  const loading = false; // No loading state needed - data is instant

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
    // Special case for "recently-added" category
    if (name.toLowerCase() === 'recently-added') return t('common.yourFiles');
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // ✅ REMOVED: Old API call useEffects - no longer needed! Data is now instant from context.

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
      return t('timeAgo.justNow');
    } else if (diffMins < 60) {
      return t('timeAgo.minutesAgo', { count: diffMins });
    } else if (diffHours < 24) {
      return `${t('common.today')}, ${docDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else if (diffDays === 1) {
      return `${t('common.yesterday')}, ${docDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return docDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  // Helper function to get file type display
  const getFileTypeDisplay = (doc) => {
    const mimeType = doc?.mimeType || '';
    const filename = doc?.filename || '';
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

    return ext || t('common.file');
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
    if (sortBy === 'type') {
      return sortOrder === 'asc'
        ? getFileTypeDisplay(a).localeCompare(getFileTypeDisplay(b))
        : getFileTypeDisplay(b).localeCompare(getFileTypeDisplay(a));
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
      showError(t('alerts.failedToDownload'));
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
      // ✅ FAST: Use context for optimistic rename
      await renameDocument(docId, newFileName);

      setRenamingDocId(null);
      setNewFileName('');

      // ✅ NO refreshAll() - context handles updates automatically
    } catch (error) {
      showError(t('alerts.failedToRename'));
    }
  };

  // Handle rename confirmation from modal
  const handleRenameConfirm = async (newName) => {
    if (!itemToRename) return;

    try {
      if (itemToRename.type === 'document') {
        // ✅ FAST: Use context for optimistic document rename
        await renameDocument(itemToRename.id, newName);
      } else if (itemToRename.type === 'folder') {
        // Folder rename - manual API call (no context method yet)
        await api.patch(`/api/folders/${itemToRename.id}`, { name: newName });
        // ⚠️ Folder rename requires refreshAll (no optimistic method)
        await refreshAll();
      }

      setShowRenameModal(false);
      setItemToRename(null);

      // ✅ NO refreshAll() for documents - context handles updates automatically
    } catch (error) {
      showError(t('alerts.failedToRenameItem', { type: itemToRename.type }));
    }
  };

  // Handle add to category
  const handleAddToCategory = (doc) => {
    // ✅ Use folders from context instead of API call (eliminates 500-1000ms delay)
    const availableFolders = contextFolders.filter(f =>
      f.name?.toLowerCase() !== 'recently added'
    );
    // ✅ Batch state updates together
    setSelectedDocumentForCategory(doc);
    setAvailableCategories(availableFolders);
    setShowCategoryModal(true);
    setOpenDropdownId(null);
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
        }
      }

      setShowCategoryModal(false);
      setSelectedDocumentForCategory(null);
      setSelectedCategoryId(null);
    } catch (error) {
      showError(t('alerts.failedToMoveToCategory', { type: selectedDocumentForCategory?.type || 'item' }));

      // ✅ On error, refresh context to restore correct state
      await refreshAll();
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

    // Close modal IMMEDIATELY for instant feedback
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

        // ✅ FAST: Delete each document using context (optimistic updates)
        const deletePromises = itemToDeleteCopy.ids.map(docId =>
          deleteDocument(docId).catch(error => {
            return { success: false, error };
          })
        );

        const results = await Promise.all(deletePromises);

        // Count successful deletions
        const successCount = results.filter(r => r && r.success).length;

        if (successCount > 0) {
          showDeleteSuccess('file');
        }

        if (successCount < deleteCount) {
          const failedCount = deleteCount - successCount;
          showError(failedCount > 1 ? t('alerts.filesFailedToDeletePlural', { count: failedCount }) : t('alerts.filesFailedToDelete', { count: failedCount }));
        }

        // ✅ NO refreshAll() - context handles updates automatically

      } else if (itemToDeleteCopy.type === 'document') {
        // ✅ FAST: Use context for single document deletion (optimistic update)
        setOpenDropdownId(null);

        const result = await deleteDocument(itemToDeleteCopy.id);

        // Show success message after optimistic update
        if (result && result.success) {
          showDeleteSuccess('file');
        }

        // ✅ NO refreshAll() - context handles updates automatically

      } else if (itemToDeleteCopy.type === 'folder') {
        // ✅ FAST: Use context for folder deletion (optimistic update)
        await deleteFolder(itemToDeleteCopy.id);

        showDeleteSuccess('folder');

        // Navigate to home with replace to avoid stale browser history cache
        navigate('/', { replace: true });

        // ✅ NO refreshAll() - context handles updates automatically
      }
    } catch (error) {
      // ✅ NO refreshAll() - context already rolled back on error

      // Show user-friendly error message
      const errorMessage = error.filename
        ? t('toasts.failedToDeleteFile', { name: error.filename, error: error.message })
        : error.message || t('errors.generic');

      showError(errorMessage);
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

      // ✅ Context will auto-update after upload
      await refreshAll();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setShowNewDropdown(false);
    } catch (error) {
      showError(t('alerts.failedToUploadFiles'));
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

      // ✅ Context will auto-update after upload
      await refreshAll();

      // Reset folder input
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }

      setShowNewDropdown(false);
    } catch (error) {
      showError(t('alerts.failedToUploadFolder'));
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
      // Use context's createFolder method for instant UI updates
      await createFolder(folderName.trim(), null, currentFolderId);
      // Context automatically updates all components with the new folder!
      setShowCreateFolderModal(false);
    } catch (error) {
      showError(t('alerts.failedToCreateFolder'));
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
          showError(t('alerts.cannotMoveFolderIntoItself'));
          return;
        }

        // Move folder into another folder
        await api.patch(`/api/folders/${data.id}`, {
          name: data.name,
          parentFolderId: targetFolder.id
        });

        // ✅ Context will auto-update after folder move
        await refreshAll();

        showSuccess(t('alerts.movedFolderInto', { name: data.name, target: targetFolder.name }));
      }
    } catch (error) {
      showError(t('alerts.failedToMoveItem'));
    }
  };

  // File drag-and-drop handlers for uploading files to current folder
  const handleFileDragOver = (e) => {
    // Only handle file drops, not internal document/folder drags
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsFileDragOver(true);
    }
  };

  const handleFileDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only reset if leaving the main container
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsFileDragOver(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);

    // Only process if files are being dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setInitialUploadFiles(files);
      setShowUploadModal(true);
    }
  };

  return (
    <div
      data-page="category"
      className="category-page"
      style={{ width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex' }}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      {/* File drag-and-drop overlay - dark background like notification popup */}
      {isFileDragOver && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            zIndex: 9999,
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
              transform: 'scale(1.05)',
              transition: 'opacity 250ms ease-out, transform 250ms ease-out'
            }}
          />
          <div
            style={{
              color: '#FFFFFF',
              fontSize: 32,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '700',
              textAlign: 'center',
              opacity: 1.0,
              transition: 'opacity 250ms ease-out'
            }}
          >
            {t('upload.dropFilesHere')}
          </div>
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 18,
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: '500',
              textAlign: 'center',
              opacity: 0.8,
              transition: 'opacity 250ms ease-out'
            }}
          >
            {t('upload.releaseToUpload')}
          </div>
        </div>
      )}

      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header with Breadcrumb, Search, and Controls */}
        <div data-category-header="true" className="category-header mobile-sticky-header" style={{
          background: 'white',
          padding: isMobile ? '16px 16px 16px 70px' : '20px 32px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          {/* Main Header Row */}
          <div style={{
            display: 'flex',
            justifyContent: isMobile ? 'center' : 'space-between',
            alignItems: isMobile ? 'center' : 'flex-start',
            gap: isMobile ? 12 : 24,
            flexWrap: 'wrap',
            flexDirection: isMobile && isSelectMode ? 'column' : 'row'
          }}>
            {/* Left: Breadcrumb and Title */}
            <div style={{ flex: 1, minWidth: 0, width: isMobile && isSelectMode ? '100%' : 'auto' }}>
              {/* Real Breadcrumb Navigation - Hide on mobile in select mode */}
              <div style={{
                fontSize: 13,
                color: '#6B7280',
                marginBottom: 8,
                display: isMobile && isSelectMode ? 'none' : 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: isMobile ? 'calc(100vw - 120px)' : 'none'
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
                  {folderId ? t('common.documents') : t('common.home')}
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
                {!isMobile && (
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
                )}
                <h1 style={{
                  fontSize: isMobile ? 22 : 32,
                  fontWeight: '600',
                  color: '#111827',
                  fontFamily: 'Plus Jakarta Sans',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: isMobile ? 'calc(100vw - 140px)' : 'none'
                }}>
                  {currentFolderName || formatCategoryName(categoryName)}
                </h1>
              </div>
            </div>

            {/* Right: Search, View Toggle, New Button OR Delete/Move buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 8 : 12,
              flexShrink: 0,
              flexWrap: 'wrap',
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'center' : 'flex-end'
            }}>
              {isSelectMode ? (
                <>
                  {/* Delete Button - Red style matching FileTypeDetail */}
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
                      height: isMobile ? 38 : 42,
                      paddingLeft: isMobile ? 12 : 18,
                      paddingRight: isMobile ? 12 : 18,
                      background: selectedDocuments.size > 0 ? '#FEE2E2' : '#F5F5F5',
                      borderRadius: 100,
                      border: '1px solid #E6E6EC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isMobile ? 4 : 8,
                      cursor: selectedDocuments.size > 0 ? 'pointer' : 'not-allowed',
                      opacity: selectedDocuments.size > 0 ? 1 : 0.5,
                      whiteSpace: 'nowrap',
                      flex: isMobile ? 1 : 'none',
                      minWidth: isMobile ? 0 : 'auto'
                    }}
                  >
                    <TrashCanIcon style={{ width: isMobile ? 16 : 18, height: isMobile ? 16 : 18 }} />
                    <span style={{
                      color: '#D92D20',
                      fontSize: isMobile ? 13 : 15,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}>
                      {isMobile ? (selectedDocuments.size > 0 ? `(${selectedDocuments.size})` : '') : (t('common.delete') + (selectedDocuments.size > 0 ? ` (${selectedDocuments.size})` : ''))}
                    </span>
                  </button>

                  {/* Move Button - White with + icon matching FileTypeDetail */}
                  <button
                    onClick={() => {
                      if (selectedDocuments.size === 0) return;
                      // ✅ Use folders from context (instant - 0ms)
                      const availableFolders = contextFolders.filter(f =>
                        f.name?.toLowerCase() !== 'recently added' && f.id !== currentFolderId
                      );
                      setAvailableCategories(availableFolders);
                      setShowCategoryModal(true);
                    }}
                    disabled={selectedDocuments.size === 0}
                    style={{
                      height: isMobile ? 38 : 42,
                      paddingLeft: isMobile ? 12 : 18,
                      paddingRight: isMobile ? 12 : 18,
                      background: 'white',
                      borderRadius: 100,
                      border: '1px solid #E6E6EC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isMobile ? 4 : 8,
                      cursor: selectedDocuments.size > 0 ? 'pointer' : 'not-allowed',
                      opacity: selectedDocuments.size > 0 ? 1 : 0.5,
                      whiteSpace: 'nowrap',
                      flex: isMobile ? 1 : 'none',
                      minWidth: isMobile ? 0 : 'auto'
                    }}
                  >
                    <svg width={isMobile ? 16 : 18} height={isMobile ? 16 : 18} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 3.75V14.25M3.75 9H14.25" stroke="#32302C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{
                      color: '#32302C',
                      fontSize: isMobile ? 13 : 15,
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}>
                      {isMobile ? (selectedDocuments.size > 0 ? `(${selectedDocuments.size})` : '') : (t('common.move') + (selectedDocuments.size > 0 ? ` (${selectedDocuments.size})` : ''))}
                    </span>
                  </button>

                  {/* Cancel Button - Text style matching FileTypeDetail */}
                  <button
                    onClick={() => {
                      clearSelection();
                      toggleSelectMode();
                    }}
                    style={{
                      height: isMobile ? 38 : 42,
                      paddingLeft: isMobile ? 12 : 18,
                      paddingRight: isMobile ? 12 : 18,
                      background: 'white',
                      borderRadius: 100,
                      border: '1px solid #E6E6EC',
                      cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: '600',
                      fontSize: isMobile ? 13 : 15,
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      flex: isMobile ? 1 : 'none',
                      minWidth: isMobile ? 0 : 'auto'
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <>
                  {/* Search Bar */}
                  <div
                    style={{
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
                      display: 'inline-flex',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      cursor: 'text'
                    }}
                    onMouseEnter={(e) => { if (!isMobile) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(50, 48, 44, 0.1)'; } }}
                    onMouseLeave={(e) => { if (!isMobile) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0px 0px 8px 1px rgba(0, 0, 0, 0.02)'; } }}
                  >
                    <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                      <SearchIcon style={{ width: 24, height: 24 }} />
                      <input
                        type="text"
                        placeholder={t('common.searchPlaceholder')}
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
                      whiteSpace: 'nowrap'
                    }}>
                      {t('common.select')}
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
                    setShowNewDropdown(!showNewDropdown);
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
                    <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>{t('common.new')}</div>
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
                                {t('category.uploadDocument')}
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
                                {t('category.createFolder')}
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
                                {t('common.delete')}
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
        <div className="category-content scrollable-content" style={{
          flex: 1,
          padding: isMobile ? 16 : 24,
          paddingBottom: isMobile ? 100 : 24,
          overflowY: 'auto',
          background: '#F5F5F5',
          WebkitOverflowScrolling: 'touch'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6C6B6E' }}>{t('common.loading')}</div>
          ) : (
            <>
              {/* Folders Section (Grid) */}
              {subFolders.length > 0 && (
                <div style={{ marginBottom: 24 }}>
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
                          background: dropTargetId === folder.id ? '#EFF6FF' : 'white',
                          border: dropTargetId === folder.id ? '2px dashed #3B82F6' : '1px solid #E6E6EC',
                          borderRadius: 16,
                          padding: 16,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          opacity: draggedItem?.type === 'folder' && draggedItem?.id === folder.id ? 0.5 : 1,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                        }}
                        onMouseEnter={(e) => {
                          if (dropTargetId !== folder.id) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (dropTargetId !== folder.id) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
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
                              background: 'transparent',
                              border: 'none',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isMobile) e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isMobile) e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <DotsIcon style={{width: 24, height: 24, pointerEvents: 'auto'}} />
                          </button>

                          {/* Dropdown Menu */}
                          {openFolderMenuId === folder.id && (
                            <div
                              data-dropdown
                              onClick={(e) => e.stopPropagation()}
                              style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 4,
                              background: 'white',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                              borderRadius: 12,
                              border: '1px solid #E6E6EC',
                              minWidth: 150,
                              zIndex: 999991,
                              overflow: 'hidden',
                              padding: 8
                            }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/category/${folder.name?.toLowerCase().replace(/\s+/g, '-')}`);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 10, flexShrink: 0 }}>
                                  <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {t('common.open')}
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
                                  padding: '10px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 10, flexShrink: 0 }}>
                                  <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {t('common.rename')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // ✅ Use folders from context (instant - 0ms)
                                  setSelectedDocumentForCategory({ type: 'folder', id: folder.id, name: folder.name });
                                  const availableFolders = contextFolders.filter(f =>
                                    f.name?.toLowerCase() !== 'recently added'
                                  );
                                  setAvailableCategories(availableFolders);
                                  setShowCategoryModal(true);
                                  setOpenFolderMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#32302C',
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 10, flexShrink: 0 }}>
                                  <path d="M5 12H19" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M12 5L19 12L12 19" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {t('common.move')}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setItemToDelete({ id: folder.id, name: folder.name, type: 'folder' });
                                  setShowDeleteModal(true);
                                  setOpenFolderMenuId(null);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  color: '#D92D20',
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 10, flexShrink: 0 }}>
                                  <path d="M3 6H5H21" stroke="#D92D20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="#D92D20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {t('common.delete')}
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
                            {/* ✅ FIX: Use totalDocuments for recursive count, fallback to documents */}
                            {folder._count?.totalDocuments ?? folder._count?.documents ?? 0} document{(folder._count?.totalDocuments ?? folder._count?.documents ?? 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents Section (Table or Grid) */}
              <div style={{ background: "white", borderRadius: 20, border: "2px solid #E6E6EC", padding: 24 }}>
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
                          background: isSelected(doc.id) ? '#E8E8EC' : 'white',
                          border: isSelected(doc.id) ? '2px solid #D1D1D6' : '1px solid #E5E7EB',
                          borderRadius: 12,
                          padding: 16,
                          cursor: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 'move' : 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          opacity: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 0.5 : 1,
                          overflow: 'visible',
                          zIndex: openDropdownId === doc.id ? 9000 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected(doc.id)) {
                            e.currentTarget.style.background = '#F9FAFB';
                            e.currentTarget.style.borderColor = '#D1D5DB';
                          }
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected(doc.id)) {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.borderColor = '#E5E7EB';
                          }
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
                            zIndex: 99999
                          }}
                          data-dropdown
                        >
                          <button
                            data-dropdown-id={doc.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openDropdownId === doc.id) {
                                setOpenDropdownId(null);
                              } else {
                                const buttonRect = e.currentTarget.getBoundingClientRect();
                                const dropdownHeight = 200;
                                const spaceBelow = window.innerHeight - buttonRect.bottom;
                                const spaceAbove = buttonRect.top;
                                // Open upward if not enough space below and more space above
                                setDropdownDirection(spaceBelow < dropdownHeight && spaceAbove > spaceBelow ? 'up' : 'down');
                                setOpenDropdownId(doc.id);
                              }
                            }}
                            style={{
                              width: 28,
                              height: 28,
                              background: 'transparent',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => {
                              if (!isMobile) e.currentTarget.style.transform = 'scale(1.1)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isMobile) e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <DotsIcon style={{width: 24, height: 24, pointerEvents: 'auto'}} />
                          </button>

                          {openDropdownId === doc.id && (
                            <div
                              data-dropdown
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                right: 0,
                                ...(dropdownDirection === 'up'
                                  ? { bottom: '100%', marginBottom: 4 }
                                  : { top: '100%', marginTop: 4 }),
                                background: 'white',
                                border: '1px solid #E6E6EC',
                                borderRadius: 12,
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                                zIndex: 99999,
                                minWidth: 160,
                                overflow: 'hidden',
                                padding: 8
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
                                  padding: '10px 14px',
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
                                <DownloadIcon style={{width: 20, height: 20}} />
                                {t('common.download')}
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
                                  padding: '10px 14px',
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
                                <EditIcon style={{width: 20, height: 20}} />
                                {t('common.rename')}
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
                                  padding: '10px 14px',
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
                                <AddIcon style={{width: 20, height: 20}} />
                                {t('common.move')}
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
                                  padding: '10px 14px',
                                  background: 'none',
                                  border: 'none',
                                  textAlign: 'left',
                                  fontSize: 14,
                                  color: '#D92D20',
                                  fontFamily: 'Plus Jakarta Sans',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s',
                                  borderRadius: 6
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <TrashCanIcon style={{width: 20, height: 20}} />
                                {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // List View - Card-based layout matching Documents page
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Table Header - Hidden on mobile */}
                    {!isMobile && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 50px',
                      gap: 12,
                      padding: '10px 14px',
                      borderBottom: '1px solid #E6E6EC',
                      marginBottom: 8
                    }}>
                      {[
                        { key: 'name', label: t('documents.tableHeaders.name') },
                        { key: 'type', label: t('documents.tableHeaders.type') },
                        { key: 'size', label: t('documents.tableHeaders.size') },
                        { key: 'timeAdded', label: t('documents.tableHeaders.date') }
                      ].map(col => (
                        <div
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          style={{
                            color: sortBy === col.key ? '#171717' : '#6C6B6E',
                            fontSize: 11,
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
                          {sortBy === col.key && (
                            <span style={{ fontSize: 10 }}>
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      ))}
                      <div></div>
                    </div>
                    )}
                    {sortedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="document-row"
                        draggable={!isMobile}
                        onDragStart={(e) => handleDocumentDragStart(e, doc)}
                        onDragEnd={handleDocumentDragEnd}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleDocument(doc.id);
                          } else {
                            navigate(`/document/${doc.id}`);
                          }
                        }}
                        style={isMobile ? {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: 14,
                          borderRadius: 14,
                          background: isSelected(doc.id) ? '#E8E8EC' : '#F5F5F5',
                          cursor: 'pointer',
                          marginBottom: 8,
                          position: 'relative',
                          zIndex: openDropdownId === doc.id ? 99999 : 1
                        } : {
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 50px',
                          gap: 12,
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: isSelected(doc.id) ? '#E8E8EC' : 'white',
                          border: isSelected(doc.id) ? '2px solid #D1D1D6' : '2px solid #E6E6EC',
                          cursor: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 'move' : 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: draggedItem?.type === 'document' && draggedItem?.id === doc.id ? 0.5 : 1,
                          position: 'relative',
                          zIndex: openDropdownId === doc.id ? 99999 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (isMobile) return;
                          if (!isSelected(doc.id)) {
                            e.currentTarget.style.background = '#F9F9F9';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isMobile) return;
                          if (!isSelected(doc.id)) {
                            e.currentTarget.style.background = 'white';
                          }
                        }}
                        data-row-id={doc.id}
                      >
                        {isMobile ? (
                          <>
                            <img
                              src={getFileIcon(doc)}
                              alt="File icon"
                              style={{ width: 48, height: 48, flexShrink: 0, imageRendering: '-webkit-optimize-contrast', objectFit: 'contain' }}
                            />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.filename}
                              </div>
                              <div style={{ color: '#6C6B6E', fontSize: 12, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', marginTop: 5 }}>
                                {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </>
                        ) : (
                        <>
                        {/* Name Column */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                          <img
                            src={getFileIcon(doc)}
                            alt="File icon"
                            style={{ width: 40, height: 40, flexShrink: 0, imageRendering: '-webkit-optimize-contrast', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
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
                                fontWeight: '600',
                                color: '#32302C',
                                border: '1px solid #181818',
                                borderRadius: 6,
                                outline: 'none',
                                background: 'white',
                                flex: 1
                              }}
                            />
                          ) : (
                            <div style={{ color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.filename}
                            </div>
                          )}
                        </div>
                        {/* Type Column */}
                        <div style={{ color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans' }}>{getFileTypeDisplay(doc)}</div>
                        {/* Size Column */}
                        <div style={{ color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans' }}>{formatFileSize(doc.fileSize)}</div>
                        {/* Date Column */}
                        <div style={{ color: '#6C6B6E', fontSize: 13, fontFamily: 'Plus Jakarta Sans' }}>{new Date(doc.createdAt).toLocaleDateString()}</div>
                        {/* Actions - Hidden on mobile */}
                        {!isMobile && <div style={{ position: 'relative' }} data-dropdown>
                          <button
                            data-dropdown-id={`list-${doc.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openDropdownId === doc.id) {
                                setOpenDropdownId(null);
                              } else {
                                const buttonRect = e.currentTarget.getBoundingClientRect();
                                const dropdownHeight = 200;
                                const spaceBelow = window.innerHeight - buttonRect.bottom;
                                const spaceAbove = buttonRect.top;
                                // Open upward if not enough space below and more space above
                                setDropdownDirection(spaceBelow < dropdownHeight && spaceAbove > spaceBelow ? 'up' : 'down');
                                setOpenDropdownId(doc.id);
                              }
                            }}
                            onMouseEnter={(e) => { if (!isMobile) e.currentTarget.style.transform = 'scale(1.1)'; }}
                            onMouseLeave={(e) => { if (!isMobile) e.currentTarget.style.transform = 'scale(1)'; }}
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
                            <DotsIcon style={{width: 24, height: 24, pointerEvents: 'auto'}} />
                          </button>

                              {openDropdownId === doc.id && (
                                <div
                                  data-dropdown
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    ...(dropdownDirection === 'up'
                                      ? { bottom: '100%', marginBottom: 4 }
                                      : { top: '100%', marginTop: 4 }),
                                    background: 'white',
                                    border: '1px solid #E6E6EC',
                                    borderRadius: 12,
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                                    zIndex: 99999,
                                    minWidth: 160,
                                    overflow: 'hidden',
                                    padding: 8
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
                                      padding: '10px 14px',
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
                                    <DownloadIcon style={{width: 20, height: 20}} />
                                    {t('common.download')}
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
                                      padding: '10px 14px',
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
                                    <EditIcon style={{width: 20, height: 20}} />
                                    {t('common.rename')}
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
                                      padding: '10px 14px',
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
                                    <AddIcon style={{width: 20, height: 20}} />
                                    {t('common.move')}
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
                                      padding: '10px 14px',
                                      background: 'none',
                                      border: 'none',
                                      textAlign: 'left',
                                      fontSize: 14,
                                      color: '#D92D20',
                                      fontFamily: 'Plus Jakarta Sans',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                      borderRadius: 6
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <TrashCanIcon style={{width: 20, height: 20}} />
                                    {t('common.delete')}
                                  </button>
                                </div>
                              )}
                        </div>}
                        </>
                        )}
                      </div>
                    ))}
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
              display: 'flex',
              position: isMobile ? 'sticky' : 'relative',
              top: isMobile ? 0 : 'auto',
              zIndex: isMobile ? 10 : 'auto',
              background: 'white'
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
                  borderRadius: 20,
                  border: '2px solid #E6E6EC',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
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
                {availableCategories.filter(f => !f.parentFolderId).map((category) => {
                  const fileCount = category.documentCount || 0;
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
                  setShowCreateFolderModal(true);
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

      {/* Universal Upload Modal */}
      <UniversalUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setInitialUploadFiles(null);
        }}
        categoryId={currentFolderId}
        initialFiles={initialUploadFiles}
        onUploadComplete={() => {
          // ✅ Context will auto-update after upload
          refreshAll();
          setInitialUploadFiles(null);
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
        itemName={itemToDelete?.name || 'this item'}
        itemType={itemToDelete?.type || 'item'}
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
