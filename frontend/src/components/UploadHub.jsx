import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import LeftNav from './LeftNav';
import NotificationPanel from './NotificationPanel';
import CreateCategoryModal from './CreateCategoryModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import RenameModal from './RenameModal';
import CreateFolderModal from './CreateFolderModal';
import { useToast } from '../context/ToastContext';
import { ReactComponent as SearchIcon} from '../assets/Search.svg';
import { ReactComponent as CheckIcon} from '../assets/check.svg';
import { ReactComponent as LogoutBlackIcon } from '../assets/Logout-black.svg';
import LayeredFolderIcon from './LayeredFolderIcon';
import api from '../services/api';
import folderUploadService from '../services/folderUploadService';
import pdfIcon from '../assets/pdf-icon.svg';
import docIcon from '../assets/doc-icon.svg';
import txtIcon from '../assets/txt-icon.svg';
import xlsIcon from '../assets/xls.svg';
import jpgIcon from '../assets/jpg-icon.svg';
import pngIcon from '../assets/png-icon.svg';
import pptxIcon from '../assets/pptx.svg';
import movIcon from '../assets/mov.svg';
import mp4Icon from '../assets/mp4.svg';
import mp3Icon from '../assets/mp3.svg';
import folderIcon from '../assets/folder_icon.svg';
import { generateThumbnail, supportsThumbnail } from '../utils/thumbnailGenerator';

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

const UploadHub = () => {
  const navigate = useNavigate();
  const { showSuccess } = useToast();
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]); // Track folders
  const [expandedFolders, setExpandedFolders] = useState(new Set()); // Track which folders are expanded
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [categories, setCategories] = useState([]);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch documents
        const docsResponse = await api.get('/api/documents');
        const allDocuments = docsResponse.data.documents || [];
        console.log('🔍 Backend returned documents:', allDocuments);
        console.log('🔍 Number of documents from backend:', allDocuments.length);
        setDocuments(allDocuments);

        // Fetch folders (smart categories)
        const foldersResponse = await api.get('/api/folders');
        const allFolders = foldersResponse.data.folders || [];

        // Separate top-level folders (for display in Recently Added) and all folders (for categories)
        const topLevelFolders = allFolders.filter(f =>
          !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
        );
        setFolders(topLevelFolders);

        // Convert ALL folders to categories format (for moving documents), excluding "Recently Added"
        const categoriesData = allFolders
          .filter(folder => folder.name.toLowerCase() !== 'recently added')
          .map(folder => ({
            id: folder.id,
            name: folder.name,
            emoji: folder.emoji || getEmojiForCategory(folder.name)
          }));
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

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
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  /**
   * Upload file directly to GCS using signed URL
   */
  const uploadFileDirectToGCS = async (file, fileHash, folderId, thumbnailBase64, onProgress) => {
    // Step 1: Request signed upload URL from backend
    const urlResponse = await api.post('/api/documents/upload-url', {
      fileName: file.name,
      fileType: file.type,
      fileHash
    });

    const { uploadUrl, encryptedFilename, documentId } = urlResponse.data;

    // Step 2: Upload file directly to GCS (this is where the speed improvement happens!)
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file
    });

    // Update progress to show upload complete
    if (onProgress) onProgress(90);

    // Step 3: Confirm upload with backend to create document record
    const confirmResponse = await api.post(`/api/documents/${documentId}/confirm-upload`, {
      encryptedFilename,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileHash,
      folderId: folderId || undefined,
      thumbnailData: thumbnailBase64 || undefined
    });

    return confirmResponse.data.document;
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: (acceptedFiles) => {
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
      setUploadingFiles(prev => [...pendingFiles, ...prev]);
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    console.log(`📎 Drag-and-drop: ${files.length} file(s) dropped`);

    if (files.length === 0) return;

    // Filter Mac hidden files
    const filteredFiles = filterMacHiddenFiles(files);

    if (filteredFiles.length === 0) {
      console.warn('⚠️ No valid files after filtering hidden files');
      return;
    }

    // Add files to the upload queue
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
  };

  const handleConfirmUpload = async () => {
    const pendingItems = uploadingFiles.filter(f => f.status === 'pending');
    if (pendingItems.length === 0) return;

    console.log('📤 Starting upload for', pendingItems.length, 'item(s)');

    // Count total files for notification (including files inside folders)
    const totalFiles = pendingItems.reduce((count, item) => {
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

    // Upload each item that was pending
    for (let i = 0; i < itemsToUpload.length; i++) {
      const item = itemsToUpload[i];
      if (item.status !== 'pending') continue;

      if (item.isFolder) {
        // Handle folder upload using the dedicated folder upload service
        console.log('📁 Uploading folder:', item.folderName);

        try {
          // Extract just the file objects from fileEntry array
          const files = item.files.map(fe => {
            const file = fe.file;
            // Attach webkitRelativePath for folder structure processing
            Object.defineProperty(file, 'webkitRelativePath', {
              value: fe.relativePath,
              writable: false
            });
            return file;
          });

          // Use the folder upload service which handles:
          // 1. Building folder tree (including root folder)
          // 2. Creating all folders in bulk (preserving hierarchy)
          // 3. Uploading files in parallel to correct folders
          // DO NOT create root category manually - let the service handle it
          await folderUploadService.uploadFolder(files, (progressData) => {
            // Update progress in UI using folderName to identify the correct item
            setUploadingFiles(prev => prev.map((f) => {
              if (f.isFolder && f.folderName === item.folderName) {
                if (progressData.stage === 'uploading') {
                  completedFilesCountRef.current = progressData.uploaded || 0;
                  return {
                    ...f,
                    progress: progressData.percentage || 0,
                    status: 'uploading'
                  };
                } else if (progressData.stage === 'complete') {
                  return {
                    ...f,
                    progress: 100,
                    status: 'completed'
                  };
                }
                return f;
              }
              return f;
            }));
          }, null); // Pass null - service will create root folder from the folder tree

          // Mark folder as completed
          setUploadingFiles(prev => prev.map((f) =>
            (f.isFolder && f.folderName === item.folderName) ? { ...f, status: 'completed', progress: 100 } : f
          ));

          await new Promise(resolve => setTimeout(resolve, 500));

          // Remove folder from upload list
          setUploadingFiles(prev => prev.filter((f) => !(f.isFolder && f.folderName === item.folderName)));

          // Refresh folders and documents to show the newly uploaded data
          console.log('🔄 Refreshing folders and documents...');
          try {
            const [docsResponse, foldersResponse] = await Promise.all([
              api.get('/api/documents'),
              api.get('/api/folders')
            ]);

            setDocuments(docsResponse.data.documents || []);
            const allFolders = foldersResponse.data.folders || [];
            setFolders(allFolders.filter(f =>
              !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
            ));

            // Update categories with all folders, excluding "Recently Added"
            const categoriesData = allFolders
              .filter(folder => folder.name.toLowerCase() !== 'recently added')
              .map(folder => ({
                id: folder.id,
                name: folder.name,
                emoji: folder.emoji || getEmojiForCategory(folder.name)
              }));
            setCategories(categoriesData);
          } catch (refreshError) {
            console.error('⚠️ Error refreshing data:', refreshError);
          }

        } catch (error) {
          console.error('❌ Error uploading folder:', error);
          setUploadingFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: 'failed',
              error: error.message || 'Upload failed'
            } : f
          ));
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
          idx === i ? { ...f, progress: 10, processingStage: 'Preparing...' } : f
        ));

        // Generate thumbnail if supported (PDF or image)
        let thumbnailBase64 = null;
        if (supportsThumbnail(file.name)) {
          try {
            console.log('🖼️ Generating thumbnail for:', file.name);
            const thumbnailBlob = await generateThumbnail(file);
            if (thumbnailBlob) {
              // Convert to base64
              thumbnailBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(thumbnailBlob);
              });
              console.log('✅ Thumbnail generated:', thumbnailBlob.size, 'bytes');
            }
          } catch (thumbError) {
            console.warn('⚠️ Thumbnail generation failed:', thumbError);
          }
        }

        // Update progress
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 30, processingStage: 'Uploading to cloud...' } : f
        ));

        // Upload directly to GCS using the new function!
        const document = await uploadFileDirectToGCS(
          file,
          fileHash,
          targetFolderId,
          thumbnailBase64,
          (progress) => {
            setUploadingFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, progress } : f
            ));
          }
        );

        console.log('✅ Direct upload completed for:', file.name);

        // Update to final processing stage
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, processingStage: 'Finalizing...', progress: 95 } : f
        ));

        // Complete the progress to 100%
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 100 } : f
        ));
        await new Promise(resolve => setTimeout(resolve, 200));

        // Mark as completed and store document ID
        setUploadingFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'completed',
            progress: 100,
            documentId: document.id
          } : f
        ));

        // Wait a moment then remove the completed file from upload area
        await new Promise(resolve => setTimeout(resolve, 500));

        setUploadingFiles(prev => prev.filter((f, idx) => idx !== i));

        // Increment completed count and check if all done
        completedFilesCountRef.current += 1;
        const newCompletedCount = completedFilesCountRef.current;
        const totalFiles = totalFilesToUploadRef.current;

        console.log(`✅ Completed ${newCompletedCount} of ${totalFiles} files`);

        // If all files are done, show notification and reload documents
        if (newCompletedCount === totalFiles) {
          console.log('🎉 All files uploaded! Showing notification...');
          console.log('Setting uploadedCount to:', newCompletedCount);
          console.log('Setting showNotification to: true');

          setUploadedCount(newCompletedCount);
          setNotificationType('success');
          setShowNotification(true);

          // Reload documents and folders
          const loadData = async () => {
            const [docsResponse, foldersResponse] = await Promise.all([
              api.get('/api/documents'),
              api.get('/api/folders')
            ]);
            setDocuments(docsResponse.data.documents || []);
            const allFolders = foldersResponse.data.folders || [];
            setFolders(allFolders.filter(f =>
              !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
            ));
          };
          loadData();

          setTimeout(() => {
            console.log('Hiding notification...');
            setShowNotification(false);
            setUploadedCount(0);
          }, 3000);
        }
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
      }
    }

    // After all uploads complete, show notification
    const newCompletedCount = completedFilesCountRef.current;
    const totalFilesCount = totalFilesToUploadRef.current;

    if (newCompletedCount === totalFilesCount && totalFilesCount > 0) {
      console.log('🎉 All files uploaded! Showing notification...');

      setUploadedCount(newCompletedCount);
      setNotificationType('success');
      setShowNotification(true);

      // Reload documents and folders
      const loadData = async () => {
        const [docsResponse, foldersResponse] = await Promise.all([
          api.get('/api/documents'),
          api.get('/api/folders')
        ]);
        setDocuments(docsResponse.data.documents || []);
        const allFolders = foldersResponse.data.folders || [];
        setFolders(allFolders.filter(f =>
          !f.parentFolderId && f.name.toLowerCase() !== 'recently added'
        ));
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
    // Save folder and related documents for potential rollback
    const folderToDelete = folders.find(f => f.id === folderId);
    const docsInFolder = documents.filter(doc => doc.folderId === folderId);

    try {
      console.log('🗑️ Deleting folder:', folderId);

      // Remove from UI IMMEDIATELY (optimistic update)
      setFolders(prev => prev.filter(f => f.id !== folderId));
      setDocuments(prev => prev.filter(doc => doc.folderId !== folderId));
      setOpenDropdownId(null);

      // Show notification immediately for instant feedback
      showSuccess('1 folder has been deleted');

      // Delete on server in background
      await api.delete(`/api/folders/${folderId}`);

      console.log('✅ Folder deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting folder:', error);

      // Restore folder and documents on error (rollback)
      if (folderToDelete) {
        setFolders(prev => [folderToDelete, ...prev]);
      }
      if (docsInFolder.length > 0) {
        setDocuments(prev => [...docsInFolder, ...prev]);
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
      setCategories(allFolders.filter(f => !f.parentFolderId));

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

  return (
    <div style={{width: '100%', height: '100vh', background: '#F5F5F5', overflow: 'hidden', display: 'flex'}}>
      <LeftNav onNotificationClick={() => setShowNotificationsPopup(true)} />

      {/* Left Sidebar - Library */}
      <div style={{
        width: 320,
        background: '#F9FAFB',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto'
      }}>
        <div style={{padding: 20, borderBottom: '1px solid #E5E7EB'}}>
          <h3 style={{fontSize: 18, fontWeight: '600', color: '#111827', margin: 0, fontFamily: 'Plus Jakarta Sans'}}>Library</h3>
        </div>

        <div style={{padding: 16}}>
          <div style={{position: 'relative'}}>
            <SearchIcon style={{position: 'absolute', left: 12, top: 12, width: 20, height: 20, zIndex: 1}} />
            <input
              type="text"
              placeholder="Search for document......"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 40px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'Plus Jakarta Sans',
                outline: 'none'
              }}
            />
          </div>
        </div>

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
      </div>

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
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB'
        }}>
          <h2 style={{fontSize: 20, fontWeight: '600', color: '#111827', margin: 0, fontFamily: 'Plus Jakarta Sans'}}>Upload Documents</h2>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: uploadingFiles.length > 0 ? 'flex-start' : 'center'
        }}>
          {/* Drag-drop zone */}
          <div {...getRootProps()} style={{
            border: '2px dashed #D1D5DB',
            borderRadius: 12,
            padding: 48,
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
            width: 800,
            height: 400,
            alignSelf: 'center'
          }}>
            <input {...getInputProps()} />
            {/* Folder icon */}
            <img src={folderIcon} alt="Folder" style={{width: 120, height: 120, margin: '0 auto 24px'}} />
            <h3 style={{fontSize: 18, fontWeight: '600', color: '#111827', margin: '0 0 8px 0', fontFamily: 'Plus Jakarta Sans'}}>Upload Documents Or Drag-N-Drop</h3>
            <p style={{fontSize: 14, color: '#6B7280', margin: '0 0 24px 0', lineHeight: 1.5, fontFamily: 'Plus Jakarta Sans'}}>Upload files or folders<br/>All file types supported (max 500MB per file)</p>
            <div style={{display: 'flex', gap: 12}}>
              <button
                onClick={(e) => { e.stopPropagation(); open(); }}
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
                Select Files
              </button>
              <button
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
              </button>
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
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
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
                        ) : (
                          f.processingStage || 'Uploading to cloud...'
                        )}
                      </p>

                      {/* Progress Bar - Only show during upload */}
                      {f.status === 'uploading' && (
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
