import React, { useState, useEffect, useRef, startTransition, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import { useIsMobile } from '../hooks/useIsMobile';
import CreateCategoryModal from './CreateCategoryModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import CreateFolderModal from './CreateFolderModal';
import { useToast } from '../context/ToastContext';
import { useDocuments } from '../context/DocumentsContext';
import { ReactComponent as SearchIcon} from '../assets/Search.svg';
import { ReactComponent as CheckIcon} from '../assets/check.svg';
import { ReactComponent as LogoutBlackIcon } from '../assets/Logout-black.svg';
import { ReactComponent as ExpandIcon } from '../assets/expand.svg';
import { ReactComponent as DownloadIcon } from '../assets/Download 3- black.svg';
import { ReactComponent as RenameIcon } from '../assets/Edit 5.svg';
import { ReactComponent as MoveIcon } from '../assets/add.svg';
import { ReactComponent as DeleteIcon } from '../assets/Trash can-red.svg';
import LayeredFolderIcon from './LayeredFolderIcon';
import api from '../services/api';
// ✅ REFACTORED: Use unified upload service (replaces folderUploadService + presignedUploadService)
import unifiedUploadService from '../services/unifiedUploadService';
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
import folderIcon from '../assets/folder_icon.svg';
import { generateThumbnail, supportsThumbnail } from '../utils/thumbnailGenerator';
import { encryptFile, encryptData } from '../utils/encryption';
import { extractText } from '../utils/textExtraction';
import { encryptionWorkerManager } from '../utils/encryptionWorkerManager';
import { useAuth } from '../context/AuthContext';
import pLimit from 'p-limit';

/**
 * Filter Mac hidden files before upload
 * Mac creates .DS_Store, __MACOSX, and other system files that cause 400 errors
 */
const filterMacHiddenFiles = (files) => {
  const macHiddenPatterns = [
    /^\./,              // Starts with dot (.DS_Store, .localized)
    /__MACOSX/,         // Mac resource fork
    /\.DS_Store$/,      // Specific .DS_Store
    /Thumbs\.db$/,      // Windows thumbnail cache
    /desktop\.ini$/,    // Windows folder settings
  ];

  const filtered = Array.from(files).filter(file => {
    const fileName = file.name || '';
    const filePath = file.webkitRelativePath || fileName;

    // Check if file matches any hidden pattern
    const isHidden = macHiddenPatterns.some(pattern =>
      pattern.test(fileName) || pattern.test(filePath)
    );

    if (isHidden) {
      console.log('🚫 [Mac Filter] Skipping hidden file:', fileName);
      return false;
    }

    return true;
  });

  const filteredCount = files.length - filtered.length;
  if (filteredCount > 0) {
    console.log(`📁 [Mac Filter] Filtered ${filteredCount} hidden file(s)`);
  }

  return filtered;
};

/**
 * Check if file is Mac hidden file
 */
const isMacHiddenFile = (fileName) => {
  const macHiddenPatterns = [
    /^\./,
    /__MACOSX/,
    /\.DS_Store$/,
    /Thumbs\.db$/,
    /desktop\.ini$/,
  ];

  return macHiddenPatterns.some(pattern => pattern.test(fileName));
};

/**
 * Get File object from FileSystemFileEntry
 */
const getFileFromEntry = (fileEntry) => {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
};

/**
 * Read folder recursively and preserve structure
 */
const readFolderRecursively = async (directoryEntry, path = '') => {
  const files = [];
  const reader = directoryEntry.createReader();

  const readEntries = () => {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  };

  let entries = await readEntries();

  // Keep reading until no more entries (some browsers return in batches)
  while (entries.length > 0) {
    for (const entry of entries) {
      if (entry.isFile) {
        const file = await getFileFromEntry(entry);
        if (file && !isMacHiddenFile(file.name)) {
          const relativePath = path ? `${path}/${entry.name}` : entry.name;
          files.push({
            file: file,
            relativePath: relativePath
          });
        }
      } else if (entry.isDirectory) {
        const subPath = path ? `${path}/${entry.name}` : entry.name;
        const subFiles = await readFolderRecursively(entry, subPath);
        files.push(...subFiles);
      }
    }
    entries = await readEntries();
  }

  return files;
};

/**
 * Process dropped entries (files or folders)
 */
const processDroppedEntries = async (entries) => {
  const items = [];

  for (const entry of entries) {
    if (entry.isFile) {
      // Single file
      const file = await getFileFromEntry(entry);
      if (file && !isMacHiddenFile(file.name)) {
        items.push({
          file,
          status: 'pending',
          progress: 0,
          error: null,
          category: 'Uncategorized'
        });
      }
    } else if (entry.isDirectory) {
      // Folder
      console.log('📁 Processing folder:', entry.name);
      const folderFiles = await readFolderRecursively(entry);

      if (folderFiles.length === 0) {
        console.warn(`⚠️ Folder "${entry.name}" is empty, skipping`);
        continue;
      }

      // ✅ FIX: Normalize to match button upload structure
      // Convert wrapped objects { file: File, relativePath: "..." } to File objects with webkitRelativePath
      const normalizedFiles = folderFiles.map(({ file, relativePath }) => {
        // Create new File object with webkitRelativePath property
        const newFile = new File([file], file.name, {
          type: file.type,
          lastModified: file.lastModified
        });

        // Add webkitRelativePath property (non-standard but needed for compatibility)
        Object.defineProperty(newFile, 'webkitRelativePath', {
          value: `${entry.name}/${relativePath}`,
          writable: false,
          enumerable: true,
          configurable: true
        });

        return newFile;
      });

      // Calculate total size from normalized files
      const totalSize = normalizedFiles.reduce((sum, f) => sum + f.size, 0);

      items.push({
        isFolder: true,
        folderName: entry.name,
        files: normalizedFiles,  // ✅ Now matches button upload structure
        status: 'pending',
        progress: 0,
        error: null,
        totalSize: totalSize,
        fileCount: normalizedFiles.length
      });
    }
  }

  return items;
};

/**
 * Format file size in human-readable format
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const UploadHub = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { showSuccess } = useToast();
  // ⚡ PERFORMANCE FIX: Use documents/folders from context (no duplicate API calls)
  const { documents: contextDocuments, folders: contextFolders, socket, fetchDocuments, fetchFolders } = useDocuments();
  const { encryptionPassword } = useAuth(); // ⚡ ZERO-KNOWLEDGE ENCRYPTION

  // Local state for real-time WebSocket updates (initialized from context)
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);

  // ⚡ PERFORMANCE: Initialize local state from context (no API call)
  useEffect(() => {
    if (contextDocuments.length > 0 && documents.length === 0) {
      console.log(`✅ [UploadHub] Initialized with ${contextDocuments.length} documents from context (no API call)`);
      setDocuments(contextDocuments);
    }
  }, [contextDocuments, documents.length]);

  useEffect(() => {
    if (contextFolders.length > 0 && folders.length === 0) {
      console.log(`✅ [UploadHub] Initialized with ${contextFolders.length} folders from context (no API call)`);
      setFolders(contextFolders);
    }
  }, [contextFolders, folders.length]);

  const [expandedFolders, setExpandedFolders] = useState(new Set()); // Track which folders are expanded
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(null);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState({});
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const embeddingTimeoutsRef = useRef({}); // Track embedding timeouts for slow processing warnings

  // ✅ Listen for document processing updates via WebSocket
  useEffect(() => {
    if (!socket) {
      console.log('⏭️ [UploadHub] Socket not ready yet');
      return;
    }

    console.log('✅ [UploadHub] Attaching WebSocket listener to shared socket');

    const handleProcessingUpdate = (data) => {
      console.log('📊 [UploadHub] Processing update:', data);

      // Update uploadingFiles with processing progress
      setUploadingFiles(prev => prev.map(file => {
        // Handle individual file uploads
        if (file.documentId === data.documentId) {
          // Map backend processing progress (0-100%) to UI progress (50-100%)
          // Upload phase uses 0-50%, processing phase uses 50-100%
          const uiProgress = 50 + (data.progress * 0.5);

          console.log(`📊 Updating upload item ${file.file?.name}: backend ${data.progress}% → UI ${uiProgress}% - ${data.message}`);
          return {
            ...file,
            processingProgress: data.progress,
            progress: uiProgress,
            statusMessage: data.message || file.statusMessage,
            stage: data.message || file.stage || 'Processing...'
          };
        }

        // Handle folder uploads - check if this document belongs to this folder
        if (file.isFolder && file.documentIds && file.documentIds.includes(data.documentId)) {
          const processedCount = file.processedFiles || 0;

          // If this document just completed, increment processed count
          if (data.progress === 100 || data.stage === 'completed' || data.stage === 'complete') {
            const newProcessedCount = processedCount + 1;
            const folderProgress = 50 + ((newProcessedCount / file.totalFiles) * 50);

            console.log(`📊 Folder ${file.folderName}: ${newProcessedCount}/${file.totalFiles} files processed (${folderProgress}%)`);

            return {
              ...file,
              processedFiles: newProcessedCount,
              progress: folderProgress,
              stage: `Processing... (${newProcessedCount}/${file.totalFiles})`
            };
          }
        }

        return file;
      }));

      // When processing completes (100%), remove the item from upload list
      if (data.progress === 100 || data.stage === 'complete' || data.stage === 'completed') {
        console.log('✅ [UploadHub] Document processing complete (100%), removing from upload list...');

        // Increment completed count
        completedFilesCountRef.current += 1;
        const newCompletedCount = completedFilesCountRef.current;
        const totalFiles = totalFilesToUploadRef.current;

        console.log(`✅ Completed ${newCompletedCount} of ${totalFiles} files`);

        // Check if any folder has completed all its files
        setUploadingFiles(prev => {
          const updatedFiles = prev.filter(f => {
            // Keep individual files if they're not this document
            if (f.documentId !== data.documentId) {
              // Check if this is a folder that has completed all files
              if (f.isFolder && f.documentIds && f.processedFiles === f.totalFiles) {
                console.log(`✅ Folder ${f.folderName} processing complete (${f.processedFiles}/${f.totalFiles})`);
                return false; // Remove completed folder
              }
              return true; // Keep this file
            }
            return false; // Remove this individual file (it's the one that completed)
          });

          // If all files are done, show notification
          if (newCompletedCount === totalFiles && totalFiles > 0) {
            console.log('🎉 All files processed! Showing notification...');
            setUploadedCount(newCompletedCount);
            setNotificationType('success');
            setShowNotification(true);

            setTimeout(() => {
              setShowNotification(false);
              setUploadedCount(0);
            }, 3000);
          }

          return updatedFiles;
        });
      }
    };

    socket.on('document-processing-update', handleProcessingUpdate);

    // ⚡ NEW: Listen for embedding completion
    const handleEmbeddingsReady = (data) => {
      console.log('✅ [UploadHub] Embeddings ready for document:', data.documentId);

      // Clear timeout if it exists
      if (embeddingTimeoutsRef.current[data.documentId]) {
        clearTimeout(embeddingTimeoutsRef.current[data.documentId]);
        delete embeddingTimeoutsRef.current[data.documentId];
      }

      // Update document in state
      setDocuments(prev => prev.map(doc =>
        doc.id === data.documentId
          ? {
              ...doc,
              processingStatus: 'completed',
              aiChatReady: true
            }
          : doc
      ));

      console.log(`📢 AI chat ready for ${data.filename || 'document'}!`);
    };

    socket.on('document-embeddings-ready', handleEmbeddingsReady);

    // ⚡ NEW: Listen for embedding failure
    const handleEmbeddingsFailed = (data) => {
      console.error('❌ [UploadHub] Embeddings failed for document:', data.documentId);

      // Update document in state
      setDocuments(prev => prev.map(doc =>
        doc.id === data.documentId
          ? {
              ...doc,
              processingStatus: 'failed',
              aiChatReady: false,
              processingError: data.error
            }
          : doc
      ));

      console.error(`❌ AI chat unavailable for ${data.filename || 'document'}: ${data.error}`);
    };

    socket.on('document-embeddings-failed', handleEmbeddingsFailed);

    return () => {
      socket.off('document-processing-update', handleProcessingUpdate);
      socket.off('document-embeddings-ready', handleEmbeddingsReady);
      socket.off('document-embeddings-failed', handleEmbeddingsFailed);

      // Clear all embedding timeouts on unmount
      Object.values(embeddingTimeoutsRef.current).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      embeddingTimeoutsRef.current = {};

      // Don't disconnect - it's a shared socket
    };
  }, [socket]); // Re-run when socket becomes available

  const getEmojiForCategory = (categoryName) => {
    const emojiMap = {
      'Work': '💼',
      'Work Documents': '💼',
      'Health': '🏥',
      'Travel': '✈️',
      'Finance': '💰',
      'Financial': '💰',
      'Personal': '👤',
      'Education': '📚',
      'Family': '👨‍👩‍👧‍👦',
      'Legal': '⚖️',
      'Insurance': '🛡️',
      'Tax': '🧾',
      'Receipts': '🧾',
      'Palmeiras': '⚽',
      'Football': '⚽',
      'Sports': '⚽'
    };
    return emojiMap[categoryName] || '📁';
  };

  // ⚡ PERFORMANCE: Compute derived data with useMemo (after getEmojiForCategory is defined)
  const topLevelFolders = useMemo(() => {
    return folders.filter(f =>
      !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
    );
  }, [folders]);

  const categories = useMemo(() => {
    return folders
      .filter(folder => folder.name.toLowerCase() !== 'recently added')
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        emoji: folder.emoji || getEmojiForCategory(folder.name)
      }));
  }, [folders]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId !== null) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);

  // Track when all files have completed for notification
  const [uploadedCount, setUploadedCount] = React.useState(0);
  const totalFilesToUploadRef = React.useRef(0);
  const completedFilesCountRef = React.useRef(0);

  // Debug: Log state changes
  React.useEffect(() => {
    console.log('🔔 Notification state:', { showNotification, uploadedCount, notificationType });
  }, [showNotification, uploadedCount, notificationType]);

  // Check upload status for error notifications
  useEffect(() => {
    const failedCount = uploadingFiles.filter(f => f.status === 'failed').length;
    const uploadingCount = uploadingFiles.filter(f => f.status === 'uploading').length;

    if (failedCount > 0 && uploadingCount === 0) {
      setNotificationType('error');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    }
  }, [uploadingFiles]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    if (!filename) return docIcon;
    const ext = filename.toLowerCase();
    if (ext.match(/\.(pdf)$/)) return pdfIcon;
    if (ext.match(/\.(jpg|jpeg)$/)) return jpgIcon;
    if (ext.match(/\.(png)$/)) return pngIcon;
    if (ext.match(/\.(doc|docx)$/)) return docIcon;
    if (ext.match(/\.(xls|xlsx)$/)) return xlsIcon;
    if (ext.match(/\.(txt)$/)) return txtIcon;
    if (ext.match(/\.(ppt|pptx)$/)) return pptxIcon;
    if (ext.match(/\.(mov)$/)) return movIcon;
    if (ext.match(/\.(mp4)$/)) return mp4Icon;
    if (ext.match(/\.(mp3)$/)) return mp3Icon;
    return docIcon; // Default icon
  };

  // Filter both documents and folders
  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Only show documents in Recently Added, not category folders
  // Categories should not appear in the upload/recently added area
  const combinedItems = [
    ...filteredDocuments.map(d => ({ ...d, isDocument: true }))
  ];

  const calculateFileHash = async (file) => {
    console.log(`🔐 [calculateFileHash] Hashing file: ${file.name}`);
    console.log(`   File size: ${file.size} bytes`);
    console.log(`   File type: ${file.type}`);
    console.log(`   Last modified: ${file.lastModified}`);

    const buffer = await file.arrayBuffer();
    console.log(`   Buffer size: ${buffer.byteLength} bytes`);

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(`   ✅ Calculated hash: ${hashHex}`);
    return hashHex;
  };

  const { getRootProps, getInputProps, open} = useDropzone({
    onDrop: (acceptedFiles) => {
      // ⚡ PERFORMANCE: Start timing
      const startTime = performance.now();

      // ✅ CRITICAL: Filter Mac hidden files (.DS_Store, __MACOSX, etc.)
      const filteredFiles = filterMacHiddenFiles(acceptedFiles);

      if (filteredFiles.length === 0) {
        console.warn('⚠️ No valid files after filtering hidden files');
        return;
      }

      console.log(`📤 Drag & Drop: ${acceptedFiles.length} → ${filteredFiles.length} files after filtering`);

      // Just add files to the list without uploading
      const pendingFiles = filteredFiles.map(file => ({
        file,
        status: 'pending',
        progress: 0,
        error: null,
        category: 'Uncategorized', // Default category
        path: file.path || file.name, // Preserve folder structure
        folderPath: file.path ? file.path.substring(0, file.path.lastIndexOf('/')) : null
      }));

      // ⚡ PERFORMANCE: Use startTransition for non-urgent UI update
      console.time('📊 File drop → UI render');
      startTransition(() => {
        setUploadingFiles(prev => [...pendingFiles, ...prev]);

        // ⚡ PERFORMANCE: Log timing
        const endTime = performance.now();
        const totalTime = (endTime - startTime).toFixed(2);
        console.timeEnd('📊 File drop → UI render');
        console.log(`⚡ Performance: ${filteredFiles.length} files processed in ${totalTime}ms`);
      });
    },
    accept: {
      // Documents
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'application/vnd.oasis.opendocument.presentation': ['.odp'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/rtf': ['.rtf'],
      // Images
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/svg+xml': ['.svg'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tiff', '.tif'],
      // Archives
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
      'application/x-tar': ['.tar'],
      'application/gzip': ['.gz'],
      // Videos
      'video/mp4': ['.mp4'],
      'video/mpeg': ['.mpeg', '.mpg'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/x-matroska': ['.mkv'],
      // Audio
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/ogg': ['.ogg'],
      'audio/mp4': ['.m4a'],
    },
    maxSize: 500 * 1024 * 1024, // 500MB max file size
    multiple: true,
    noClick: true,
  });

  // Drag and drop overlay handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Required to allow drop
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we're leaving the drag container entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // If mouse is outside the container bounds, hide overlay
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    console.log('📎 Drag-and-drop detected');

    // ✅ NEW: Check if items are folders using DataTransferItemList
    const items = e.dataTransfer.items;

    if (items && items.length > 0) {
      const entries = [];

      // Convert DataTransferItemList to array
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }
      }

      // Process entries (files or folders)
      const processedItems = await processDroppedEntries(entries);

      if (processedItems.length === 0) {
        console.warn('⚠️ No valid items after processing');
        return;
      }

      console.log(`✅ Processed ${processedItems.length} item(s) from drag-and-drop`);
      setUploadingFiles(prev => [...processedItems, ...prev]);
    } else {
      // Fallback to old behavior for browsers that don't support DataTransferItemList
      const files = Array.from(e.dataTransfer.files);
      console.log(`📎 Drag-and-drop (fallback): ${files.length} file(s) dropped`);

      if (files.length === 0) return;

      const filteredFiles = filterMacHiddenFiles(files);

      if (filteredFiles.length === 0) {
        console.warn('⚠️ No valid files after filtering hidden files');
        return;
      }

      const pendingFiles = filteredFiles.map(file => ({
        file,
        status: 'pending',
        progress: 0,
        error: null,
        category: 'Uncategorized',
        path: file.path || file.name,
        folderPath: file.path ? file.path.substring(0, file.path.lastIndexOf('/')) : null
      }));

      setUploadingFiles(prev => [...pendingFiles, ...prev]);
    }
  };

  const handleConfirmUpload = async () => {
    const pendingItems = uploadingFiles.filter(f => f.status === 'pending');
    if (pendingItems.length === 0) return;

    console.log('📤 Starting upload for', pendingItems.length, 'item(s)');

    // ✅ FIX: Filter hidden files before counting and update items
    const filteredItems = pendingItems.map(item => {
      if (item.isFolder) {
        const validFiles = item.files.filter(f => !isMacHiddenFile(f.name));
        return {
          ...item,
          files: validFiles,
          fileCount: validFiles.length,
          totalSize: validFiles.reduce((sum, f) => sum + f.size, 0)
        };
      }
      return item;
    });

    // Update state with filtered items
    setUploadingFiles(prev => prev.map(item => {
      const filtered = filteredItems.find(fi => fi === item || (fi.isFolder && fi.folderName === item.folderName));
      return filtered || item;
    }));

    // Count valid files only (excluding hidden files)
    const totalFiles = filteredItems.reduce((count, item) => {
      if (item.isFolder) {
        return count + item.files.length;
      }
      return count + 1;
    }, 0);

    totalFilesToUploadRef.current = totalFiles;
    completedFilesCountRef.current = 0;

    // Get current state snapshot
    const itemsToUpload = [...uploadingFiles];

    // Mark all pending items as uploading
    setUploadingFiles(prev => prev.map(f =>
      f.status === 'pending' ? { ...f, status: 'uploading' } : f
    ));

    // ⚡ PARALLEL UPLOAD OPTIMIZATION: Use p-limit for concurrent uploads
    // ✅ OPTIMIZED: Increased to 10 concurrent uploads for better performance
    const limit = pLimit(10);

    // Create upload promises for all items
    const uploadPromises = itemsToUpload.map((item, i) => {
      if (item.status !== 'pending') return Promise.resolve();

      // Wrap each upload in p-limit for concurrency control
      return limit(async () => {

      if (item.isFolder) {
        // Handle folder upload using the dedicated folder upload service
        console.log('📁 Uploading folder:', item.folderName);
        console.log('📁 DEBUG: item.files length:', item.files?.length);
        console.log('📁 DEBUG: item.files sample:', item.files?.[0]);

        // ✅ FIX: Handle both File objects (drag-and-drop) and wrapped objects (legacy)
        const files = item.files.map((fileOrWrapper, idx) => {
          // Check if it's already a File object with webkitRelativePath (drag-and-drop)
          if (fileOrWrapper instanceof File) {
            // File object from drag-and-drop - already has webkitRelativePath
            console.log(`📄 File ${idx + 1}: "${fileOrWrapper.name}" - webkitRelativePath: ${fileOrWrapper.webkitRelativePath || 'MISSING'}`);
            return fileOrWrapper;
          }

          // Legacy wrapped structure: {file: File, relativePath: "..."}
          if (fileOrWrapper.file) {
            const file = fileOrWrapper.file;
            console.log(`📄 File ${idx + 1}: "${file.name}" - wrapped structure`);
            console.log(`   - Has webkitRelativePath: ${!!file.webkitRelativePath}`);
            console.log(`   - Has relativePath: ${!!fileOrWrapper.relativePath}`);
            console.log(`   - relativePath value: ${fileOrWrapper.relativePath}`);

            // Attach webkitRelativePath if not already present
            if (!file.webkitRelativePath && fileOrWrapper.relativePath) {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: fileOrWrapper.relativePath,
                writable: false,
                enumerable: true  // ✅ CRITICAL FIX: Make it enumerable so it's sent in API requests
              });
              console.log(`   ✅ Added webkitRelativePath: ${file.webkitRelativePath}`);
            }
            return file;
          }

          // Fallback: return as-is
          console.warn('⚠️ Unknown file structure:', fileOrWrapper);
          return fileOrWrapper;
        });

        console.log('📁 DEBUG: Processed files length:', files?.length);
        console.log('📁 DEBUG: First processed file:', files?.[0]);
        console.log('📁 DEBUG: First file webkitRelativePath:', files?.[0]?.webkitRelativePath);

        // ✅ VERIFICATION: Check that all files have webkitRelativePath
        const filesWithPath = files.filter(f => f.webkitRelativePath);
        const filesWithoutPath = files.filter(f => !f.webkitRelativePath);
        console.log(`📊 Files with webkitRelativePath: ${filesWithPath.length}/${files.length}`);
        if (filesWithoutPath.length > 0) {
          console.error(`❌ ${filesWithoutPath.length} files MISSING webkitRelativePath:`);
          filesWithoutPath.forEach(f => console.error(`   - ${f.name}`));
        }

        // ✅ REFACTORED: Use unified upload service (same as UniversalUploadModal)
        try {
          const results = await unifiedUploadService.uploadFolder(
            files,
            (progress) => {
              // Update progress in UI using folderName to identify the correct item
              setUploadingFiles(prev => prev.map((f) => {
                if (f.isFolder && f.folderName === item.folderName) {
                  return {
                    ...f,
                    progress: progress.percentage || 0,
                    stage: progress.message || 'Uploading...',
                    status: 'uploading'
                  };
                }
                return f;
              }));
            },
            null // categoryId - will be auto-categorized
          );

          console.log(`✅ Upload complete: ${results.successCount}/${results.totalFiles} files succeeded`);

          if (results.failureCount > 0) {
            console.warn(`⚠️ ${results.failureCount} files failed`);
          }

          // SUCCESS: Mark as completed
          setUploadingFiles(prev => prev.map((f) =>
            (f.isFolder && f.folderName === item.folderName) ? {
              ...f,
              status: 'completed',
              progress: 100,
              stage: null
            } : f
          ));

          // ✅ Documents and folders will appear INSTANTLY via WebSocket events
          console.log('✅ Upload complete - documents will appear instantly via WebSocket');

          // ✅ FIX: Remove completed folder from list after short delay to show success
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter((f) => !(f.isFolder && f.folderName === item.folderName)));
          }, 1500);

        } catch (error) {
          // ERROR: Mark folder as failed
          console.error('❌ Error uploading folder:', error);
          setUploadingFiles(prev => prev.map((f) =>
            (f.isFolder && f.folderName === item.folderName) ? {
              ...f,
              status: 'failed',
              error: error.message || 'Upload failed'
            } : f
          ));

          // Remove failed uploads after delay
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter((f) => !(f.isFolder && f.folderName === item.folderName)));
          }, 3000);
        }
      } else {
        // Handle individual file upload - DIRECT TO GCS!
        const file = item.file;
        console.log('📄 Uploading:', file.name);

      try {
        // Create folder structure if file has a folder path
        let targetFolderId = item.folderId;
        if (item.folderPath) {
          // Helper function to create folder hierarchy
          const getOrCreateFolder = async (folderPath) => {
            if (!folderPath || folderPath === '/' || folderPath === '') {
              return targetFolderId;
            }

            // Split path into parts and filter out invalid folder names
            const parts = folderPath.split('/').filter(p => {
              const trimmed = p?.trim();
              return trimmed && trimmed !== '.' && trimmed !== '..';
            });
            let currentParentId = targetFolderId;

            // Create each folder in the hierarchy
            for (const folderName of parts) {
              try {
                const response = await api.post('/api/folders', {
                  name: folderName,
                  parentFolderId: currentParentId || undefined
                });
                currentParentId = response.data.folder.id;
              } catch (error) {
                console.warn(`Folder ${folderName} may already exist, continuing...`);
              }
            }

            return currentParentId;
          };

          targetFolderId = await getOrCreateFolder(item.folderPath);
        }

        // Calculate file hash first
        const fileHash = await calculateFileHash(file);

        // Update to show starting
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 5, processingStage: 'Preparing...' } : f
        ));

        // ⚡ STEP 1: Extract text from file BEFORE encryption
        let extractedText = '';
        if (encryptionPassword) {
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: 5, processingStage: 'Extracting text...' } : f
          ));

          try {
            console.log('📄 [Text Extraction] Extracting text from:', file.name);
            extractedText = await extractText(file);
            console.log(`✅ [Text Extraction] Extracted ${extractedText.length} characters`);
          } catch (extractionError) {
            console.warn('⚠️ [Text Extraction] Failed:', extractionError);
            // Continue anyway - text extraction failure shouldn't block upload
          }
        }

        // ⚡ STEP 2: ZERO-KNOWLEDGE ENCRYPTION: Encrypt file before upload
        let fileToUpload = file;
        let encryptionMetadata = null;
        let encryptedFilename = null;
        let encryptedText = null;

        if (encryptionPassword) {
          console.log('🔐 [Encryption] Encrypting file with Web Worker:', file.name);

          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress: 10, processingStage: 'Encrypting file...' } : f
          ));

          try {
            // Read file as ArrayBuffer for Web Worker
            const fileBuffer = await file.arrayBuffer();
            const fileUint8Array = new Uint8Array(fileBuffer);

            // ⚡ WEB WORKER: Encrypt file contents off the main thread
            const encrypted = await encryptionWorkerManager.encryptFile(
              fileUint8Array,
              encryptionPassword,
              (operation, progress, message) => {
                setUploadingFiles(prev => prev.map((f, idx) =>
                  idx === i ? {
                    ...f,
                    progress: 10 + (progress * 0.15),
                    processingStage: `${message} ${Math.round(progress)}%`
                  } : f
                ));
              }
            );

            console.log('✅ [Web Worker] File encryption complete');

            // ⚡ WEB WORKER: Encrypt filename
            const filenameEncrypted = await encryptionWorkerManager.encryptData(
              file.name,
              encryptionPassword
            );

            // ⚡ WEB WORKER: Encrypt extracted text
            if (extractedText) {
              console.log('🔐 [Web Worker] Encrypting extracted text...');
              encryptedText = await encryptionWorkerManager.encryptData(
                extractedText,
                encryptionPassword
              );
            }

            // Create encrypted file blob
            fileToUpload = new File([encrypted.ciphertext], `encrypted_${Date.now()}`, {
              type: 'application/octet-stream' // Encrypted files are binary blobs
            });

            encryptionMetadata = {
              salt: encrypted.salt,
              iv: encrypted.iv,
              authTag: encrypted.authTag,
              filenameEncrypted: filenameEncrypted,
              encryptedText: encryptedText, // Encrypted extracted text
              originalMimeType: file.type
            };

            console.log('✅ [Encryption] File encrypted successfully (Web Worker)');
          } catch (encryptionError) {
            console.error('❌ [Encryption] Failed to encrypt file:', encryptionError);
            setUploadingFiles(prev => prev.map((f, idx) =>
              idx === i ? {
                ...f,
                status: 'failed',
                error: 'Encryption failed: ' + encryptionError.message
              } : f
            ));
            return; // Exit this upload function early
          }
        }

        // Thumbnail generation disabled
        const thumbnailBase64 = null;

        // Update progress
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 30, processingStage: 'Uploading to cloud...' } : f
        ));

        // Upload via backend with multipart form data
        const formData = new FormData();
        formData.append('file', fileToUpload); // Upload encrypted file
        formData.append('fileHash', fileHash);
        if (targetFolderId) {
          formData.append('folderId', targetFolderId);
        }

        // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Append encryption metadata
        if (encryptionMetadata) {
          formData.append('isEncrypted', 'true');
          formData.append('encryptionSalt', encryptionMetadata.salt);
          formData.append('encryptionIV', encryptionMetadata.iv);
          formData.append('encryptionAuthTag', encryptionMetadata.authTag);
          formData.append('filenameEncrypted', JSON.stringify(encryptionMetadata.filenameEncrypted));
          formData.append('originalMimeType', encryptionMetadata.originalMimeType);
          formData.append('originalFilename', file.name); // Send original filename for backend logging

          // ⚡ IMPORTANT: Send both encrypted text (for storage) and plaintext (for embeddings)
          if (encryptionMetadata.encryptedText) {
            formData.append('extractedTextEncrypted', JSON.stringify(encryptionMetadata.encryptedText));
          }
          if (extractedText) {
            formData.append('plaintextForEmbeddings', extractedText); // Backend uses this, then deletes
          }
        }

        const uploadResponse = await api.post('/api/documents/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            // Show upload progress (this is just the HTTP upload, very fast)
            const uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadingFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, progress: uploadProgress, processingStage: 'Uploading to cloud...' } : f
            ));
          }
        });

        const document = uploadResponse.data.document;
        let documentAdded = false;

        try {
          console.log('✅ Upload completed, adding to UI immediately:', file.name);

          // ⚡ OPTIMISTIC UPDATE: Add document to UI immediately (instant feedback!)
          setDocuments(prev => [{
            ...document,
            // Add processing indicator
            processingStatus: 'embeddings-pending',
            aiChatReady: false
          }, ...prev]);
          documentAdded = true;

          // ⚡ EDGE CASE: Set timeout warning for slow embeddings (30 seconds)
          const timeoutId = setTimeout(() => {
            console.warn('⚠️ Embeddings taking longer than expected for:', document.id);
            showSuccess('AI chat processing is taking longer than expected. It will be ready soon.', 'warning');
          }, 30000); // 30 seconds

          embeddingTimeoutsRef.current[document.id] = timeoutId;

          // Also update global context for other components to see the document
          await fetchDocuments();

          // ⚡ IMPORTANT: Keep item in upload list with documentId so WebSocket can update progress
          // The WebSocket listener will remove it when backend processing completes (100%)
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              documentId: document.id, // Link to backend document
              progress: 0, // Reset to 0% - backend will send real progress via WebSocket
              processingStage: 'Backend processing started...'
            } : f
          ));

          console.log(`✅ Upload HTTP complete, backend processing started for ${file.name}`);

        } catch (postUploadError) {
          console.error('❌ Error in post-upload processing:', postUploadError);

          // ⚡ EDGE CASE: Rollback optimistic update if post-processing failed
          if (documentAdded) {
            console.log('🔄 Rolling back optimistic update for document:', document.id);
            setDocuments(prev => prev.filter(doc => doc.id !== document.id));

            // Clear timeout if it exists
            if (embeddingTimeoutsRef.current[document.id]) {
              clearTimeout(embeddingTimeoutsRef.current[document.id]);
              delete embeddingTimeoutsRef.current[document.id];
            }
          }

          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: 'failed',
              progress: f.progress,
              error: postUploadError.message
            } : f
          ));
        }

        // Note: The success notification and item removal will happen when:
        // 1. WebSocket emits 'document-processing-update' with progress: 100
        // 2. We verify the document is in the frontend state
        // 3. We remove the item from uploadingFiles
        // 4. We show the success notification
        } catch (error) {
          console.error('❌ Error uploading file:', error);

          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: 'failed',
              progress: f.progress,
              error: error.response?.data?.error || error.message
            } : f
          ));
        }
      } // Close the else block for individual file upload
      }); // Close the limit(async () => {})
    }); // Close the .map((item, i) => {})

    // ⚡ PARALLEL UPLOAD OPTIMIZATION: Wait for all uploads to complete
    console.log(`🚀 Starting ${uploadPromises.length} uploads with max 3 concurrent...`);
    await Promise.all(uploadPromises);
    console.log('✅ All uploads completed!');

    // After all uploads complete, show notification
    const newCompletedCount = completedFilesCountRef.current;
    const totalFilesCount = totalFilesToUploadRef.current;

    if (newCompletedCount === totalFilesCount && totalFilesCount > 0) {
      console.log('🎉 All files uploaded! Showing notification...');

      setUploadedCount(newCompletedCount);
      setNotificationType('success');
      setShowNotification(true);

      // Reload documents and folders using DocumentsContext
      const loadData = async () => {
        await fetchDocuments(); // Update global context
        await fetchFolders();   // Update global context
      };
      loadData();

      setTimeout(() => {
        setShowNotification(false);
        setUploadedCount(0);
      }, 3000);
    }
  };

  const removeUploadingFile = (identifier) => {
    setUploadingFiles(prev => prev.filter(f => {
      if (f.isFolder) {
        return f.folderName !== identifier;
      } else {
        return f.file.name !== identifier;
      }
    }));
  };

  const handleFolderSelect = (event) => {
    const rawFiles = Array.from(event.target.files);

    // ✅ CRITICAL: Filter Mac hidden files (.DS_Store, __MACOSX, etc.)
    const files = filterMacHiddenFiles(rawFiles);

    if (files.length === 0) {
      console.warn('⚠️ No valid files after filtering hidden files');
      return;
    }

    console.log(`📁 Folder upload: ${rawFiles.length} → ${files.length} files after filtering`);

    // Extract folder structure from file paths
    const folderStructure = new Map(); // Map<rootFolderName, {name, files}>

    files.forEach(file => {
      // webkitRelativePath gives us the full path like "MyFolder/Subfolder/file.pdf"
      const relativePath = file.webkitRelativePath || file.name;
      const pathParts = relativePath.split('/');

      // If there are path parts, we have a folder
      if (pathParts.length > 1) {
        const rootFolderName = pathParts[0];

        if (!folderStructure.has(rootFolderName)) {
          folderStructure.set(rootFolderName, {
            name: rootFolderName,
            files: [],
            isFolder: true
          });
        }

        folderStructure.get(rootFolderName).files.push({
          file,
          relativePath
        });
      }
    });

    // Create folder entries (ONE entry per folder, not per file)
    const folderEntries = Array.from(folderStructure.values()).map(folder => {
      // Calculate total size
      const totalSize = folder.files.reduce((sum, f) => sum + f.file.size, 0);

      return {
        isFolder: true,
        folderName: folder.name,
        files: folder.files, // All files in this folder
        status: 'pending',
        progress: 0,
        error: null,
        category: 'Uncategorized',
        fileCount: folder.files.length,
        totalSize: totalSize
      };
    });

    setUploadingFiles(prev => [...folderEntries, ...prev]);
  };

  const toggleCategorySelection = (filename, categoryName) => {
    setSelectedCategories(prev => ({
      ...prev,
      [filename]: prev[filename] === categoryName ? null : categoryName
    }));
  };

  const handleDeleteDocument = async (documentId) => {
    // Save document for potential rollback
    const documentToDelete = documents.find(doc => doc.id === documentId);

    try {
      console.log('🗑️ Deleting document:', documentId);

      // Remove from UI IMMEDIATELY (optimistic update)
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      setOpenDropdownId(null);

      // Show notification immediately for instant feedback
      showSuccess('1 file has been deleted');

      // Delete on server in background
      await api.delete(`/api/documents/${documentId}`);

      console.log('✅ Document deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting document:', error);

      // Restore document on error (rollback)
      if (documentToDelete) {
        setDocuments(prev => [documentToDelete, ...prev]);
      }

      alert('Failed to delete document. Please try again.');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    // ✅ FIX: Recursively find all subfolders and their documents
    const getAllSubfolderIds = (parentId) => {
      const subfolders = folders.filter(f => f.parentFolderId === parentId);
      let allIds = [parentId];

      subfolders.forEach(subfolder => {
        allIds = [...allIds, ...getAllSubfolderIds(subfolder.id)];
      });

      return allIds;
    };

    // Get all folder IDs that will be deleted (parent + all descendants)
    const allFolderIdsToDelete = getAllSubfolderIds(folderId);

    console.log('🗑️ Deleting folder and subfolders:', allFolderIdsToDelete);

    // Save folder, subfolders, and ALL related documents for potential rollback
    const foldersToDelete = folders.filter(f => allFolderIdsToDelete.includes(f.id));
    const docsInFolders = documents.filter(doc => allFolderIdsToDelete.includes(doc.folderId));

    try {
      console.log(`🗑️ Deleting ${foldersToDelete.length} folder(s) and ${docsInFolders.length} document(s)`);

      // Remove from UI IMMEDIATELY (optimistic update)
      setFolders(prev => prev.filter(f => !allFolderIdsToDelete.includes(f.id)));
      setDocuments(prev => prev.filter(doc => !allFolderIdsToDelete.includes(doc.folderId)));
      setOpenDropdownId(null);

      // Show notification immediately for instant feedback
      showSuccess('1 folder has been deleted');

      // Delete on server in background
      await api.delete(`/api/folders/${folderId}`);

      console.log('✅ Folder deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting folder:', error);

      // Restore folders and documents on error (rollback)
      if (foldersToDelete.length > 0) {
        setFolders(prev => [...foldersToDelete, ...prev]);
      }
      if (docsInFolders.length > 0) {
        setDocuments(prev => [...docsInFolders, ...prev]);
      }

      alert('Failed to delete folder. Please try again.');
    }
  };

  const handleCreateCategory = async (categoryData) => {
    const { name, emoji, selectedDocuments } = categoryData;

    try {
      console.log('Creating category:', name, emoji, 'with documents:', selectedDocuments);
      const response = await api.post('/api/folders', { name, emoji });
      const folderId = response.data.folder.id;

      // Add selected documents to the created category
      if (selectedDocuments && selectedDocuments.length > 0) {
        console.log(`📎 Adding ${selectedDocuments.length} documents to category...`);
        for (const docId of selectedDocuments) {
          try {
            await api.patch(`/api/documents/${docId}`, {
              folderId: folderId
            });
          } catch (docError) {
            console.warn(`⚠️ Failed to add document ${docId} to category:`, docError);
          }
        }
      }

      // Refresh folders list
      const foldersResponse = await api.get('/api/folders');
      const allFolders = foldersResponse.data.folders || [];
      setFolders(allFolders.filter(f =>
        !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
      ));
      // ✅ No need to setCategories - computed automatically from folders via useMemo

      // Refresh documents to show they're now in the category
      const docsResponse = await api.get('/api/documents');
      setDocuments(docsResponse.data.documents || []);

      setShowNewCategoryModal(false);
      console.log('✅ Category created successfully with documents');
    } catch (error) {
      console.error('❌ Error creating category:', error);
      alert('Failed to create category. Please try again.');
    }
  };

  const handleAddCategory = async (identifier) => {
    const categoryName = selectedCategories[identifier];
    if (!categoryName) {
      setShowCategoryModal(null);
      setSelectedCategories({});
      return;
    }

    // Find the target category folder ID
    const targetCategory = categories.find(cat => cat.name === categoryName);
    console.log('🏷️ Adding to category:', categoryName, 'Folder:', targetCategory);

    // Check if identifier is a folder ID
    const isFolder = folders.some(f => f.id === identifier);

    if (isFolder) {
      // Moving an entire folder to a category (make it a subfolder)
      try {
        console.log('📁 Moving folder to category:', identifier, '→', categoryName);
        await api.patch(`/api/folders/${identifier}`, {
          name: folders.find(f => f.id === identifier)?.name || 'Folder',
          parentFolderId: targetCategory?.id || null
        });

        // Reload both documents and folders
        const [docsResponse, foldersResponse] = await Promise.all([
          api.get('/api/documents'),
          api.get('/api/folders')
        ]);

        setDocuments(docsResponse.data.documents || []);
        const allFolders = foldersResponse.data.folders || [];
        setFolders(allFolders.filter(f =>
          !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
        ));

        console.log('✅ Folder moved to category:', categoryName);
      } catch (error) {
        console.error('❌ Error moving folder:', error);
        alert('Failed to move folder. Please try again.');
      }
    } else {
      // It's a document or pending folder - existing logic
      // Check if this is a pending file/folder (identifier is filename/foldername) or completed/existing document
      const pendingFile = uploadingFiles.find(f =>
        f.status === 'pending' && (
          (f.isFolder && f.folderName === identifier) ||
          (!f.isFolder && f.file.name === identifier)
        )
      );
      const completedFile = uploadingFiles.find(f => (f.documentId === identifier || f.file?.name === identifier) && f.status === 'completed');

      if (pendingFile) {
        // Update pending file/folder - will be uploaded to this folder
        setUploadingFiles(prev => prev.map(f => {
          const matches = f.isFolder ? f.folderName === identifier : f.file.name === identifier;
          return matches ? {
            ...f,
            category: categoryName,
            folderId: targetCategory?.id || null
          } : f;
        }));
        console.log('✅ Category set for pending item:', categoryName);
      } else if (completedFile) {
        // Update completed uploaded file via API
        try {
          await api.patch(`/api/documents/${completedFile.documentId}`, {
            folderId: targetCategory?.id || null
          });

          // Update the uploadingFiles list to reflect the category
          setUploadingFiles(prev => prev.map(f =>
            f.documentId === completedFile.documentId ? {
              ...f,
              category: categoryName,
              folderId: targetCategory?.id || null
            } : f
          ));

          // Reload documents to reflect the change in library
          const response = await api.get('/api/documents');
          setDocuments(response.data.documents || []);

          console.log('✅ Completed document moved to folder:', categoryName);
        } catch (error) {
          console.error('❌ Error updating document folder:', error);
        }
      } else {
        // This is an existing document from the library (identifier is doc ID)
        try {
          await api.patch(`/api/documents/${identifier}`, {
            folderId: targetCategory?.id || null
          });

          // Reload documents to reflect the change
          const response = await api.get('/api/documents');
          setDocuments(response.data.documents || []);

          console.log('✅ Document moved to folder:', categoryName);
        } catch (error) {
          console.error('❌ Error updating document folder:', error);
        }
      }
    }

    setShowCategoryModal(null);
    setSelectedCategories({});
  };

  // Group documents by time for search modal
  const groupDocumentsByTime = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
      TODAY: [],
      YESTERDAY: [],
      OLDER: []
    };

    // Filter combined items based on modal search query
    const query = modalSearchQuery.toLowerCase();
    const filtered = combinedItems.filter(item => {
      if (item.isFolder) {
        return item.name.toLowerCase().includes(query);
      } else {
        return item.filename.toLowerCase().includes(query);
      }
    });

    filtered.forEach(item => {
      const itemDate = new Date(item.createdAt || item.uploadedAt);

      if (itemDate >= today) {
        groups.TODAY.push(item);
      } else if (itemDate >= yesterday) {
        groups.YESTERDAY.push(item);
      } else {
        groups.OLDER.push(item);
      }
    });

    return groups;
  };

  // Search Modal Component
  const SearchModal = () => {
    const groupedDocuments = groupDocumentsByTime();

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: showSearchModal ? 'flex' : 'none',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: '10vh',
          zIndex: 1000,
        }}
        onClick={() => setShowSearchModal(false)}
      >
        <div
          style={{
            width: 600,
            maxHeight: '80vh',
            background: 'white',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid #E6E6EC',
          }}>
            <div style={{position: 'relative'}}>
              <input
                type="text"
                placeholder="Search any documents..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  height: 44,
                  padding: '10px 40px 10px 40px',
                  background: '#F5F5F5',
                  borderRadius: 100,
                  border: '1px solid #E6E6EC',
                  outline: 'none',
                  fontSize: 14,
                  fontFamily: 'Plus Jakarta Sans',
                }}
              />
              <SearchIcon style={{
                width: 20,
                height: 20,
                color: '#32302C',
                position: 'absolute',
                left: 12,
                top: 12
              }} />
              <div
                onClick={() => setShowSearchModal(false)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 10,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'background 200ms ease-in-out',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 1L1 13M1 1L13 13" stroke="#6C6B6E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Documents List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
          }}>
            {Object.entries(groupedDocuments).map(([day, list]) => {
              if (list.length === 0) return null;

              return (
                <div key={day} style={{marginBottom: 20}}>
                  <div style={{
                    color: '#32302C',
                    fontSize: 12,
                    fontFamily: 'Plus Jakarta Sans',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    marginBottom: 12
                  }}>
                    {day}
                  </div>
                  <div>
                    {list.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.isFolder) {
                            // Toggle folder expansion
                            const newExpanded = new Set(expandedFolders);
                            if (newExpanded.has(item.id)) {
                              newExpanded.delete(item.id);
                            } else {
                              newExpanded.add(item.id);
                            }
                            setExpandedFolders(newExpanded);
                          }
                          setShowSearchModal(false);
                        }}
                        style={{
                          padding: '12px 14px',
                          background: 'transparent',
                          borderRadius: 12,
                          color: '#6C6B6E',
                          fontSize: 14,
                          fontFamily: 'Plus Jakarta Sans',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          transition: 'background 200ms ease-in-out',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <img
                          src={item.isFolder ? folderIcon : getFileIcon(item.filename)}
                          alt={item.isFolder ? 'Folder' : 'File'}
                          style={{
                            width: 40,
                            height: 40,
                            flexShrink: 0,
                            objectFit: 'contain'
                          }}
                        />
                        <div style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.isFolder ? item.name : item.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {combinedItems.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#6C6B6E',
                fontSize: 14,
                marginTop: 20
              }}>
                No documents yet. Upload some documents!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex'}}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      {/* Left Sidebar - Library - Hidden on mobile */}
      {!isMobile && <div style={{
        width: isLibraryExpanded ? 320 : 80,
        background: '#F9FAFB',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto',
        transition: 'width 0.3s ease'
      }}>
        <div style={{padding: 20, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          {isLibraryExpanded && (
            <h3 style={{fontSize: 18, fontWeight: '600', color: '#111827', margin: 0, fontFamily: 'Plus Jakarta Sans'}}>Library</h3>
          )}
          <button
            onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
            style={{
              width: 44,
              height: 44,
              background: 'transparent',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 0.15s',
              marginLeft: isLibraryExpanded ? 0 : 'auto',
              marginRight: isLibraryExpanded ? 0 : 'auto'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F5F5F5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <ExpandIcon
              style={{
                width: 20,
                height: 20,
                transform: isLibraryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease'
              }}
            />
          </button>
        </div>

        <div style={{padding: 16, display: 'flex', justifyContent: 'center'}}>
          {isLibraryExpanded ? (
            <div style={{position: 'relative', height: 52, display: 'flex', alignItems: 'center', width: '100%'}}>
              <SearchIcon style={{position: 'absolute', left: 16, width: 20, height: 20, zIndex: 1}} />
              <input
                type="text"
                placeholder="Search any documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  paddingLeft: 46,
                  paddingRight: 16,
                  background: '#F5F5F5',
                  border: '1px #E6E6EC solid',
                  borderRadius: 100,
                  fontSize: 16,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '500',
                  lineHeight: '24px',
                  color: '#32302C',
                  outline: 'none'
                }}
              />
            </div>
          ) : (
            <div
              onClick={() => setShowSearchModal(true)}
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#F5F5F5',
                borderRadius: 12,
                border: '1px solid #E6E6EC',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#EAEAEA'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
            >
              <SearchIcon style={{width: 20, height: 20}} />
            </div>
          )}
        </div>

        {isLibraryExpanded && (
          <div style={{flex: 1, overflowY: 'auto', padding: 8}}>
            {combinedItems.map((item) => (
            <div key={item.id}>
              {/* Render folder */}
              {item.isFolder && (
                <div>
                  <div
                    onClick={() => {
                      const newExpanded = new Set(expandedFolders);
                      if (newExpanded.has(item.id)) {
                        newExpanded.delete(item.id);
                      } else {
                        newExpanded.add(item.id);
                      }
                      setExpandedFolders(newExpanded);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 4,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: expandedFolders.has(item.id) ? '#F3F4F6' : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                    onMouseLeave={(e) => {
                      if (!expandedFolders.has(item.id)) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <img src={folderIcon} alt="Folder" style={{width: 40, height: 40, flexShrink: 0}} />
                    <div style={{flex: 1, minWidth: 0}}>
                      <p style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#111827',
                        margin: '0 0 4px 0',
                        fontFamily: 'Plus Jakarta Sans',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{item.name}</p>
                      <p style={{
                        fontSize: 12,
                        color: '#6B7280',
                        margin: 0,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>{item._count?.documents || 0} document{item._count?.documents !== 1 ? 's' : ''}</p>
                    </div>
                    <div style={{fontSize: 16, color: '#9CA3AF', transform: expandedFolders.has(item.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}>
                      ›
                    </div>
                    <div style={{position: 'relative'}}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === item.id ? null : item.id);
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

                      {openDropdownId === item.id && (
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
                                setOpenDropdownId(null);
                                setShowCategoryModal(item.id);
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
                              Add to Category
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToRename({ type: 'folder', id: item.id, name: item.name });
                                setShowRenameModal(true);
                                setOpenDropdownId(null);
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
                              <RenameIcon style={{ width: 20, height: 20 }} />
                              Rename Folder
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemToDelete({ type: 'folder', id: item.id, name: item.name });
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
                              <DeleteIcon style={{ width: 20, height: 20 }} />
                              Delete Folder
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Show documents inside folder when expanded */}
                  {expandedFolders.has(item.id) && (
                    <div style={{paddingLeft: 24, borderLeft: '2px solid #E5E7EB', marginLeft: 32, marginBottom: 8}}>
                      {(() => {
                        const folderDocs = documents.filter(doc => doc.folderId === item.id);

                        if (folderDocs.length === 0) {
                          return (
                            <div style={{
                              padding: 16,
                              textAlign: 'center',
                              color: '#9CA3AF',
                              fontSize: 13,
                              fontFamily: 'Plus Jakarta Sans'
                            }}>
                              No documents in this folder
                            </div>
                          );
                        }

                        return folderDocs.map(doc => (
                          <div
                            key={doc.id}
                            onClick={() => navigate(`/document/${doc.id}`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              borderRadius: 8,
                              marginBottom: 4,
                              cursor: 'pointer',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <img
                              src={getFileIcon(doc.filename)}
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
                            <div style={{flex: 1, minWidth: 0}}>
                              <p style={{
                                fontSize: 13,
                                fontWeight: '500',
                                color: '#111827',
                                margin: '0 0 2px 0',
                                fontFamily: 'Plus Jakarta Sans',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>{doc.filename}</p>
                              <p style={{
                                fontSize: 11,
                                color: '#6B7280',
                                margin: 0,
                                fontFamily: 'Plus Jakarta Sans'
                              }}>{formatFileSize(doc.fileSize)}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Render document */}
              {item.isDocument && (
                <div
                  onClick={() => navigate(`/document/${item.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 4,
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#F3F4F6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ position: 'relative' }}>
                    <img
                      src={getFileIcon(item.filename)}
                      alt="File icon"
                      style={{
                        width: 56,
                        height: 56,
                        imageRendering: '-webkit-optimize-contrast',
                        objectFit: 'contain',
                        shapeRendering: 'geometricPrecision',
                        flexShrink: 0
                      }}
                    />
                    {/* ✅ Processing badge */}
                    {item.status === 'processing' && (
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
                        {item.processingProgress ? `${item.processingProgress}%` : '...'}
                      </div>
                    )}
                    {/* ✅ Failed badge */}
                    {item.status === 'failed' && (
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
                  <div style={{flex: 1, minWidth: 0}}>
                    <p style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: '#111827',
                      margin: '0 0 4px 0',
                      fontFamily: 'Plus Jakarta Sans',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{item.filename}</p>
                    <p style={{
                      fontSize: 12,
                      color: '#6B7280',
                      margin: 0,
                      fontFamily: 'Plus Jakarta Sans'
                    }}>{formatFileSize(item.fileSize)}</p>
                  </div>
                  <div style={{position: 'relative'}}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === item.id ? null : item.id);
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

                    {openDropdownId === item.id && (
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
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const response = await api.get(`/api/documents/${item.id}/download`, {
                                  responseType: 'blob'
                                });
                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', item.filename);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                setOpenDropdownId(null);
                              } catch (error) {
                                console.error('Download error:', error);
                                alert('Failed to download file');
                              }
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
                              setItemToRename({ type: 'document', id: item.id, name: item.filename });
                              setShowRenameModal(true);
                              setOpenDropdownId(null);
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
                            <RenameIcon style={{ width: 20, height: 20 }} />
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(null);
                              setShowCategoryModal(item.id);
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
                            <MoveIcon style={{ width: 20, height: 20 }} />
                            Move
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete({ type: 'document', id: item.id, name: item.filename });
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
                            <DeleteIcon style={{ width: 20, height: 20 }} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          </div>
        )}
      </div>}

      {/* Main Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'white',
          height: '100vh',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '16px' : '20px 24px',
          paddingLeft: isMobile ? 70 : 24,
          borderBottom: '1px solid #E5E7EB',
          height: isMobile ? 60 : 'auto'
        }}>
          <h2 style={{fontSize: isMobile ? 18 : 20, fontWeight: '600', color: '#111827', margin: 0, fontFamily: 'Plus Jakarta Sans'}}>Upload Documents</h2>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? 16 : 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: uploadingFiles.length > 0 ? 'flex-start' : 'center'
        }}>
          {/* Drag-drop zone */}
          <div {...getRootProps()} style={{
            border: '2px dashed #D1D5DB',
            borderRadius: isMobile ? 16 : 12,
            padding: isMobile ? 24 : 48,
            textAlign: 'center',
            marginBottom: uploadingFiles.length > 0 ? 24 : 0,
            cursor: 'pointer',
            background: '#F9FAFB',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'all 0.3s ease-out',
            width: isMobile ? '100%' : 800,
            maxWidth: isMobile ? '100%' : 800,
            height: isMobile ? 'auto' : 400,
            minHeight: isMobile ? 300 : 400,
            alignSelf: 'center'
          }}>
            <input {...getInputProps()} />
            {/* Folder icon */}
            <img src={folderIcon} alt="Folder" style={{width: isMobile ? 80 : 120, height: isMobile ? 80 : 120, margin: isMobile ? '0 auto 16px' : '0 auto 24px'}} />
            <h3 style={{fontSize: isMobile ? 16 : 18, fontWeight: '600', color: '#111827', margin: '0 0 8px 0', fontFamily: 'Plus Jakarta Sans'}}>{isMobile ? 'Tap to Upload' : 'Upload Documents Or Drag-N-Drop'}</h3>
            <p style={{fontSize: isMobile ? 13 : 14, color: '#6B7280', margin: isMobile ? '0 0 16px 0' : '0 0 24px 0', lineHeight: 1.5, fontFamily: 'Plus Jakarta Sans'}}>{isMobile ? 'All file types supported (max 500MB)' : 'Upload files or folders'}<br/>{!isMobile && 'All file types supported (max 500MB per file)'}</p>
            <div style={{display: 'flex', gap: isMobile ? 8 : 12, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 200 : 'none'}}>
              <button
                onClick={(e) => { e.stopPropagation(); open(); }}
                style={{
                  padding: isMobile ? '12px 20px' : '10px 24px',
                  background: 'white',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'Plus Jakarta Sans',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                Select Files
              </button>
              {!isMobile && <button
                onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                style={{
                  padding: '10px 24px',
                  background: 'white',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'Plus Jakarta Sans'
                }}
              >
                Select Folder
              </button>}
            </div>
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFolderSelect}
              style={{display: 'none'}}
            />
          </div>

          {/* Upload progress list */}
          {uploadingFiles.length > 0 && (
            <div style={{display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12}}>
              {uploadingFiles.map((f, index) => {
                const isError = f.status === 'failed';
                const progressWidth = f.status === 'completed' ? 100 : (f.progress || 0);

                return (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    background: 'white',
                    outline: isError ? '2px solid #EF4444' : 'none',
                    outlineOffset: '-2px',
                    border: `1px solid ${isError ? '#EF4444' : '#E5E7EB'}`,
                    borderRadius: 8,
                    transition: 'box-shadow 0.15s',
                    position: 'relative'
                  }}>
                    {/* Icon (File or Folder) */}
                    <div style={{
                      width: 64,
                      height: 64,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative'
                    }}>
                      {f.isFolder ? (
                        <img src={folderIcon} alt="Folder" style={{width: 48, height: 48}} />
                      ) : (
                        <img
                          src={getFileIcon(f.file.name)}
                          alt="File icon"
                          style={{
                            width: 64,
                            height: 64,
                            imageRendering: '-webkit-optimize-contrast',
                            objectFit: 'contain',
                            shapeRendering: 'geometricPrecision'
                          }}
                        />
                      )}
                    </div>

                    {/* Details (File or Folder) */}
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4
                      }}>
                        <p style={{
                          fontSize: 14,
                          fontWeight: '500',
                          color: '#111827',
                          margin: 0,
                          fontFamily: 'Plus Jakarta Sans',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1
                        }}>{f.isFolder ? f.folderName : f.file.name}</p>
                        <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                          {f.status === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCategoryModal(f.isFolder ? f.folderName : f.file.name);
                              }}
                              style={{
                                padding: '6px 12px',
                                background: '#F5F5F5',
                                border: '1px solid #E6E6EC',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: '600',
                                color: '#323232',
                                flexShrink: 0,
                                transition: 'all 0.15s',
                                fontFamily: 'Plus Jakarta Sans'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#E6E6EC'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#F5F5F5'}
                            >
                              Add to Category
                            </button>
                          )}
                          {isError && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Reset status to pending and retry immediately
                                setUploadingFiles(prev => prev.map((file, idx) =>
                                  idx === index ? { ...file, status: 'pending', progress: 0, error: null } : file
                                ));
                                // Trigger upload again immediately
                                handleConfirmUpload();
                              }}
                              style={{
                                padding: '6px 12px',
                                background: '#EF4444',
                                border: '1px solid #EF4444',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: '600',
                                color: 'white',
                                flexShrink: 0,
                                transition: 'all 0.15s',
                                fontFamily: 'Plus Jakarta Sans'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#DC2626'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#EF4444'}
                            >
                              Retry Upload
                            </button>
                          )}
                          {f.status === 'completed' && (
                            <div style={{position: 'relative'}}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const identifier = f.isFolder ? f.folderName : f.file.name;
                                  setOpenDropdownId(openDropdownId === identifier ? null : identifier);
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

                              {openDropdownId === (f.isFolder ? f.folderName : f.file.name) && (
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
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const response = await api.get(`/api/documents/${f.documentId}/download`, {
                                            responseType: 'blob'
                                          });
                                          const url = window.URL.createObjectURL(new Blob([response.data]));
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.setAttribute('download', f.file.name);
                                          document.body.appendChild(link);
                                          link.click();
                                          link.remove();
                                          setOpenDropdownId(null);
                                        } catch (error) {
                                          console.error('Download error:', error);
                                          alert('Failed to download file');
                                        }
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
                                      Download
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setItemToRename({ type: 'document', id: f.documentId, name: f.file.name });
                                        setShowRenameModal(true);
                                        setOpenDropdownId(null);
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
                                      Rename
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(null);
                                        setShowCategoryModal(f.documentId || (f.isFolder ? f.folderName : f.file.name));
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
                                      Move
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setItemToDelete({
                                          type: 'uploadedFile',
                                          documentId: f.documentId,
                                          name: f.file.name,
                                          folderName: f.isFolder ? f.folderName : null,
                                          isFolder: f.isFolder
                                        });
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
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {f.status !== 'completed' && (
                            <button
                              onClick={() => removeUploadingFile(f.isFolder ? f.folderName : f.file.name)}
                              style={{
                                width: 24,
                                height: 24,
                                border: 'none',
                                background: 'transparent',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 16,
                                color: '#9CA3AF',
                                flexShrink: 0,
                                transition: 'all 0.15s',
                                fontFamily: 'Plus Jakarta Sans'
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <p style={{
                        fontSize: 13,
                        color: isError ? '#EF4444' : (f.status === 'uploading' ? '#A0A0A0' : '#6B7280'),
                        margin: f.status === 'uploading' ? '0 0 8px 0' : 0,
                        fontFamily: 'Plus Jakarta Sans'
                      }}>
                        {isError ? (
                          'Failed to upload. Try again.'
                        ) : f.isFolder ? (
                          f.status === 'pending' ? (
                            `${f.fileCount} file${f.fileCount !== 1 ? 's' : ''} • ${formatFileSize(f.totalSize)} • ${f.category || 'Uncategorized'}`
                          ) : f.status === 'uploading' ? (
                            'Uploading to cloud...'
                          ) : (
                            `${f.fileCount} file${f.fileCount !== 1 ? 's' : ''} • ${formatFileSize(f.totalSize)} • ${f.category || 'Uncategorized'}`
                          )
                        ) : f.status === 'pending' ? (
                          `${formatFileSize(f.file.size)} • ${f.category || 'Uncategorized'}`
                        ) : f.status === 'completed' ? (
                          `${formatFileSize(f.file.size)} • ${f.category || 'Uncategorized'}`
                        ) : f.status === 'processing' ? (
                          f.statusMessage || 'Processing document...'
                        ) : (
                          f.processingStage || 'Uploading to cloud...'
                        )}
                      </p>

                      {/* Progress Bar - Show during upload AND processing */}
                      {(f.status === 'uploading' || f.status === 'processing') && (
                        <>
                          <div style={{
                            width: '100%',
                            height: '100%',
                            left: 0,
                            top: 0,
                            position: 'absolute',
                            pointerEvents: 'none'
                          }}>
                            <div style={{
                              width: `${progressWidth}%`,
                              height: '100%',
                              left: 0,
                              top: 0,
                              position: 'absolute',
                              background: 'rgba(169, 169, 169, 0.12)',
                              borderTopLeftRadius: 8,
                              borderBottomLeftRadius: 8,
                              transition: 'width 0.3s ease-in-out',
                              opacity: progressWidth >= 100 ? 0 : 1,
                              transitionProperty: progressWidth >= 100 ? 'width 0.3s ease-in-out, opacity 400ms ease-out' : 'width 0.3s ease-in-out'
                            }} />
                          </div>

                          {/* Upload percentage counter */}
                          <div style={{
                            position: 'absolute',
                            bottom: 12,
                            right: 16,
                            fontSize: 13,
                            fontWeight: '500',
                            color: '#6C6C6C',
                            zIndex: 2,
                            opacity: progressWidth < 100 ? 1 : 0,
                            transition: 'opacity 0.3s ease-out'
                          }}>
                            {Math.round(progressWidth)}%
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Upload Buttons - Always show when files are present */}
        {uploadingFiles.length > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
            background: 'white',
            display: 'flex',
            gap: 12
          }}>
            <button
              onClick={() => setUploadingFiles([])}
              disabled={uploadingFiles.filter(f => f.status === 'uploading').length > 0}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: 'white',
                color: '#111827',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: '600',
                cursor: uploadingFiles.filter(f => f.status === 'uploading').length > 0 ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                fontFamily: 'Plus Jakarta Sans',
                opacity: uploadingFiles.filter(f => f.status === 'uploading').length > 0 ? 0.5 : 1
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={uploadingFiles.filter(f => f.status === 'uploading').length > 0 || uploadingFiles.filter(f => f.status === 'pending').length === 0}
              style={{
                flex: 1,
                padding: '14px 24px',
                background: '#111827',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: '600',
                cursor: (uploadingFiles.filter(f => f.status === 'uploading').length > 0 || uploadingFiles.filter(f => f.status === 'pending').length === 0) ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                fontFamily: 'Plus Jakarta Sans',
                opacity: (uploadingFiles.filter(f => f.status === 'uploading').length > 0 || uploadingFiles.filter(f => f.status === 'pending').length === 0) ? 0.5 : 1
              }}
            >
              {uploadingFiles.filter(f => f.status === 'uploading').length > 0
                ? `Uploading ${uploadingFiles.filter(f => f.status === 'uploading').length} Document${uploadingFiles.filter(f => f.status === 'uploading').length > 1 ? 's' : ''}...`
                : `Confirm Upload`
              }
            </button>
          </div>
        )}

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

      {/* Success/Error Notification */}
      {showNotification && (uploadedCount > 0 || notificationType === 'error') && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 700px)',
          maxWidth: '960px',
          minWidth: '400px',
          zIndex: 99999,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{
            width: '100%',
            padding: '6px 16px',
            background: '#181818',
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            display: 'inline-flex'
          }}>
            {notificationType === 'success' ? (
              <>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#34A853',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <CheckIcon style={{width: 12, height: 12}} />
                </div>
                <div style={{
                  flex: '1 1 0',
                  color: 'white',
                  fontSize: 13,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400',
                  lineHeight: '18px',
                  wordWrap: 'break-word'
                }}>
                  {uploadedCount} document{uploadedCount > 1 ? 's have' : ' has'} been successfully uploaded.
                </div>
              </>
            ) : (
              <>
                <div style={{width: 24, height: 24, position: 'relative', flexShrink: 0}}>
                  <div style={{width: 20.57, height: 20.57, left: 1.71, top: 1.71, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                  <div style={{width: 24, height: 24, left: 0, top: 0, position: 'absolute', background: 'rgba(217, 45, 32, 0.60)', borderRadius: 9999}} />
                  <div style={{width: 17.14, height: 17.14, left: 3.43, top: 3.43, position: 'absolute', background: '#D92D20', overflow: 'hidden', borderRadius: 8.57, outline: '1.07px #D92D20 solid', outlineOffset: '-1.07px'}}>
                    <div style={{width: 9.33, height: 9.33, left: 3.91, top: 3.91, position: 'absolute'}}>
                      <div style={{width: 7.78, height: 7.19, left: 0.78, top: 1.17, position: 'absolute', borderRadius: 3.89, outline: '0.80px white solid', outlineOffset: '-0.40px'}} />
                    </div>
                  </div>
                </div>
                <div style={{
                  flex: '1 1 0',
                  color: 'white',
                  fontSize: 13,
                  fontFamily: 'Plus Jakarta Sans',
                  fontWeight: '400',
                  lineHeight: '18px',
                  wordWrap: 'break-word'
                }}>
                  Hmm… the upload didn't work. Please retry.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <NotificationPanel
        showNotificationsPopup={showNotificationsPopup}
        setShowNotificationsPopup={setShowNotificationsPopup}
      />

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000}}>
          <div style={{width: 340, background: 'white', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 18, display: 'flex', padding: '18px 0'}}>
            {/* Header */}
            <div style={{alignSelf: 'stretch', paddingLeft: 18, paddingRight: 18, justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
              <div style={{width: 30, height: 30, opacity: 0}} />
              <div style={{textAlign: 'center', color: '#32302C', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: '26px'}}>Add to Category</div>
              <button
                onClick={() => setShowCategoryModal(null)}
                style={{width: 30, height: 30, padding: '4px 8px', background: 'white', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center'}}
              >
                <div style={{fontSize: 16, color: '#323232'}}>✕</div>
              </button>
            </div>

            <div style={{alignSelf: 'stretch', height: 1, background: '#E6E6EC'}} />

            {/* Description */}
            <div style={{alignSelf: 'stretch', paddingLeft: 18, paddingRight: 18}}>
              <div style={{textAlign: 'center', color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '24px'}}>Choose a category for your document</div>
            </div>

            {/* Category Grid */}
            <div style={{alignSelf: 'stretch', paddingLeft: 18, paddingRight: 18}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                {categories.length === 0 && (
                  <div style={{textAlign: 'center', color: '#6B7280', fontSize: 14, fontFamily: 'Plus Jakarta Sans', padding: '20px 0'}}>
                    No categories yet. Create your first one!
                  </div>
                )}

                {Array.from({length: Math.ceil(categories.filter(c => !c.parentFolderId).length / 2)}).map((_, rowIndex) => (
                  <div key={rowIndex} style={{display: 'flex', gap: 12}}>
                    {categories.filter(c => !c.parentFolderId).slice(rowIndex * 2, rowIndex * 2 + 2).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCategorySelection(showCategoryModal, cat.name)}
                        style={{flex: 1, padding: '18px 0', background: 'white', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', border: 'none', cursor: 'pointer', position: 'relative'}}
                      >
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
                          <div style={{width: 44, height: 44, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6}}>
                            <img src={folderIcon} alt="Folder" style={{width: 20, height: 20}} />
                          </div>
                          <div style={{textAlign: 'center', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>{cat.name}</div>
                          {selectedCategories[showCategoryModal] === cat.name && (
                            <div style={{width: 20, height: 20, position: 'absolute', right: 8, top: 8, background: '#181818', overflow: 'hidden', borderRadius: 6, outline: '1px #181818 solid', outlineOffset: '-1px'}}>
                              <div style={{width: 14, height: 14, left: 3, top: 3, position: 'absolute', overflow: 'hidden'}}>
                                <div style={{width: 9.33, height: 6.42, left: 2.33, top: 3.50, position: 'absolute', outline: '2px white solid', outlineOffset: '-1px'}} />
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}

                {/* Create New Category Button */}
                <div style={{display: 'flex', gap: 12}}>
                  <button
                    onClick={() => {
                      setShowCategoryModal(null);  // Close category selection modal first
                      setShowNewCategoryModal(true);  // Then open create new modal
                    }}
                    style={{flex: 1, padding: '18px 0', background: 'white', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', border: 'none', cursor: 'pointer'}}
                  >
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
                      <div style={{width: 44, height: 44, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6}}>
                        <div style={{width: 20, height: 20, position: 'relative', overflow: 'hidden'}}>
                          <div style={{width: 11.67, height: 11.67, left: 4.17, top: 4.17, position: 'absolute', outline: '1.67px #55534E solid', outlineOffset: '-0.83px'}} />
                        </div>
                      </div>
                      <div style={{textAlign: 'center', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: '20px'}}>Create New</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div style={{alignSelf: 'stretch', height: 1, background: '#E6E6EC'}} />

            {/* Action Buttons */}
            <div style={{alignSelf: 'stretch', paddingLeft: 18, paddingRight: 18, display: 'flex', gap: 8}}>
              <button
                onClick={() => setShowCategoryModal(null)}
                style={{flex: 1, height: 52, padding: '10px 18px', background: '#F5F5F5', borderRadius: 14, outline: '1px #E6E6EC solid', outlineOffset: '-1px', border: 'none', cursor: 'pointer', color: '#323232', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize'}}
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddCategory(showCategoryModal)}
                style={{flex: 1, height: 52, background: '#181818', borderRadius: 14, border: 'none', cursor: 'pointer', color: 'white', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', textTransform: 'capitalize'}}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      <CreateCategoryModal
        isOpen={showNewCategoryModal}
        onClose={async () => {
          console.log('📋 UploadHub documents state:', documents);
          console.log('📋 UploadHub documents count:', documents.length);

          // Fetch ALL documents to check backend response
          try {
            const response = await api.get('/api/documents');
            console.log('📋 Direct API call returned:', response.data.documents?.length, 'documents');
            console.log('📋 Full response:', response.data);
          } catch (error) {
            console.error('📋 Error fetching documents:', error);
          }

          setShowNewCategoryModal(false);
        }}
        onCreateCategory={handleCreateCategory}
        uploadedDocuments={documents}
      />

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

          // Delete in background
          (async () => {
            try {
              if (itemToDeleteCopy.type === 'folder') {
                await handleDeleteFolder(itemToDeleteCopy.id);
              } else if (itemToDeleteCopy.type === 'document') {
                await handleDeleteDocument(itemToDeleteCopy.id);
              } else if (itemToDeleteCopy.type === 'uploadedFile') {
                await api.delete(`/api/documents/${itemToDeleteCopy.documentId}`);
                setOpenDropdownId(null);
                removeUploadingFile(itemToDeleteCopy.isFolder ? itemToDeleteCopy.folderName : itemToDeleteCopy.name);
                setDocuments(prev => prev.filter(doc => doc.id !== itemToDeleteCopy.documentId));
                showSuccess('1 file has been deleted');
              }
            } catch (error) {
              console.error('Delete error:', error);
              alert('Failed to delete: ' + (error.response?.data?.error || error.message));
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
        onConfirm={async (newName) => {
          if (!itemToRename) return;

          try {
            if (itemToRename.type === 'folder') {
              // Update folder name via API
              await api.patch(`/api/folders/${itemToRename.id}`, { name: newName });

              // Update folders list
              setFolders(prev => prev.map(folder =>
                folder.id === itemToRename.id ? { ...folder, name: newName } : folder
              ));
            } else {
              // Update document name via API
              await api.patch(`/api/documents/${itemToRename.id}`, { filename: newName });

              // Update local state for uploading files
              setUploadingFiles(prev => prev.map(file =>
                file.documentId === itemToRename.id ? { ...file, file: { ...file.file, name: newName } } : file
              ));

              // Update documents list
              setDocuments(prev => prev.map(doc =>
                doc.id === itemToRename.id ? { ...doc, filename: newName } : doc
              ));
            }

            setShowRenameModal(false);
            setItemToRename(null);
          } catch (error) {
            console.error('Rename error:', error);
            alert(`Failed to rename ${itemToRename.type === 'folder' ? 'folder' : 'file'}`);
          }
        }}
        itemName={itemToRename?.name}
        itemType={itemToRename?.type}
      />

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={showCreateFolderModal}
        onClose={() => setShowCreateFolderModal(false)}
        onConfirm={async (folderName) => {
          try {
            // Create folder via API
            const response = await api.post('/api/folders', { name: folderName });
            const newFolder = response.data.folder;

            // Add to folders list
            setFolders(prev => [...prev, newFolder]);
            setShowCreateFolderModal(false);
          } catch (error) {
            console.error('Create folder error:', error);
            alert('Failed to create folder: ' + (error.response?.data?.error || error.message));
          }
        }}
      />

      {/* Search Modal */}
      <SearchModal />

      {/* Animation Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes progress-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          .upload-modal {
            width: 100% !important;
            height: 100vh !important;
            border-radius: 0 !important;
            flex-direction: column !important;
          }
        }
      `}} />
    </div>
  );
};

export default UploadHub;
