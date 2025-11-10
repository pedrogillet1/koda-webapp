import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { encryptData, decryptData } from '../utils/encryption';
import { useAuth } from './AuthContext';

const DocumentsContext = createContext();

export const useDocuments = () => {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error('useDocuments must be used within DocumentsProvider');
  }
  return context;
};

export const DocumentsProvider = ({ children }) => {
  const { encryptionPassword } = useAuth(); // ⚡ ZERO-KNOWLEDGE ENCRYPTION
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/documents');
      const fetchedDocs = response.data.documents || [];

      console.log('\n📄 FETCHED DOCUMENTS:', fetchedDocs.length, 'total');
      console.log('Documents by folder:');
      const docsByFolder = {};
      fetchedDocs.forEach(d => {
        const folderId = d.folderId || 'NO_FOLDER';
        if (!docsByFolder[folderId]) {
          docsByFolder[folderId] = [];
        }
        docsByFolder[folderId].push(d.filename);
      });
      Object.keys(docsByFolder).forEach(fId => {
        console.log(`  Folder ${fId}: ${docsByFolder[fId].length} docs -`, docsByFolder[fId].join(', '));
      });

      setDocuments(fetchedDocs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      // If auth error or rate limit, stop making more requests
      if (error.response?.status === 401 ||
          error.response?.status === 429 ||
          error.message?.includes('refresh')) {
        return;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all folders
  const fetchFolders = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      // IMPORTANT: Pass includeAll=true to get ALL folders (including subfolders)
      // This is required for recursive document counting to work properly
      const response = await api.get(`/api/folders?includeAll=true&_t=${timestamp}`);
      let fetchedFolders = response.data.folders || [];

      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Decrypt folder names
      if (encryptionPassword && fetchedFolders.length > 0) {
        fetchedFolders = await Promise.all(
          fetchedFolders.map(async (folder) => {
            if (folder.nameEncrypted && folder.encryptionSalt) {
              try {
                const encryptedData = {
                  salt: folder.encryptionSalt,
                  iv: folder.encryptionIV,
                  ciphertext: folder.nameEncrypted,
                  authTag: folder.encryptionAuthTag,
                };
                const decryptedName = await decryptData(encryptedData, encryptionPassword);
                return { ...folder, name: decryptedName };
              } catch (error) {
                console.error('❌ [Decryption] Failed to decrypt folder name:', error);
                return folder; // Return original if decryption fails
              }
            }
            return folder;
          })
        );
      }

      console.log('\n🗂️ FETCHED FOLDERS:', fetchedFolders.length, 'total');
      fetchedFolders.forEach(f => {
        console.log(`  ${f.emoji || '📁'} ${f.name} (id: ${f.id}, parent: ${f.parentFolderId || 'ROOT'})`);
      });

      setFolders(fetchedFolders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      // If auth error or rate limit, stop making more requests
      if (error.response?.status === 401 ||
          error.response?.status === 429 ||
          error.message?.includes('refresh')) {
        return;
      }
    }
  }, [encryptionPassword]);

  // Fetch recent documents (use existing endpoint with limit)
  const fetchRecentDocuments = useCallback(async () => {
    try {
      const response = await api.get('/api/documents?limit=5');
      setRecentDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching recent documents:', error);
      // If auth error or rate limit, stop making more requests
      if (error.response?.status === 401 ||
          error.response?.status === 429 ||
          error.message?.includes('refresh')) {
        return;
      }
    }
  }, []);

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchDocuments();
      fetchFolders();
      fetchRecentDocuments();
      setInitialized(true);
    }
  }, [initialized, fetchDocuments, fetchFolders, fetchRecentDocuments]);

  // Auto-refresh data when window regains focus or becomes visible (with debounce)
  useEffect(() => {
    let refreshTimeout = null;
    let lastRefresh = 0;
    const REFRESH_COOLDOWN = 1000; // Only refresh once every 1 second (reduced from 5s for better UX)

    const debouncedRefresh = () => {
      const now = Date.now();
      if (now - lastRefresh < REFRESH_COOLDOWN) {
        console.log('⏸️  Skipping refresh (too soon since last refresh)');
        return;
      }

      lastRefresh = now;
      console.log('🔄 Refreshing data...');
      fetchDocuments();
      fetchFolders();
      fetchRecentDocuments();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && initialized) {
        console.log('📱 Page became visible');
        debouncedRefresh();
      }
    };

    const handleFocus = () => {
      if (initialized) {
        console.log('🔄 Window focused');
        debouncedRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [initialized, fetchDocuments, fetchFolders, fetchRecentDocuments]);

  // WebSocket real-time auto-refresh
  const socketRef = useRef(null);

  useEffect(() => {
    if (!initialized) return;

    // Get auth token
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Get user ID from localStorage (set during login)
    const userStr = localStorage.getItem('user');
    const userId = userStr ? JSON.parse(userStr).id : null;
    if (!userId) {
      console.warn('⚠️ No userId found in localStorage, cannot join user room');
      return;
    }

    console.log('🔌 Setting up WebSocket connection for real-time updates...');

    // Initialize socket connection
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ WebSocket connected for real-time document updates');

      // Join user-specific room for targeted events
      socket.emit('join-user-room', userId);
      console.log(`📡 Joined user room: user:${userId.substring(0, 8)}...`);
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    // Debounced refresh to prevent multiple rapid refreshes
    let documentRefreshTimeout = null;
    let folderRefreshTimeout = null;

    const debouncedDocumentRefresh = () => {
      if (documentRefreshTimeout) clearTimeout(documentRefreshTimeout);
      documentRefreshTimeout = setTimeout(() => {
        console.log('🔄 Debounced: Refreshing documents...');
        fetchDocuments();
        fetchRecentDocuments();
      }, 100); // Wait 100ms before refreshing (reduced from 500ms for instant feel)
    };

    const debouncedFolderRefresh = () => {
      if (folderRefreshTimeout) clearTimeout(folderRefreshTimeout);
      folderRefreshTimeout = setTimeout(() => {
        console.log('🔄 Debounced: Refreshing folders...');
        fetchFolders();
      }, 100); // Wait 100ms before refreshing (reduced from 500ms for instant feel)
    };

    // Listen for document processing updates
    socket.on('document-processing-update', (data) => {
      console.log('📄 Document processing update received:', data);

      // Auto-refresh documents when processing completes
      if (data.status === 'completed' || data.status === 'failed') {
        debouncedDocumentRefresh();
      }
    });

    // Listen for general data changes (we'll add these events to backend)
    socket.on('documents-changed', () => {
      console.log('📚 Documents changed');
      debouncedDocumentRefresh();
    });

    socket.on('folders-changed', () => {
      console.log('📁 Folders changed');
      debouncedFolderRefresh();
    });

    socket.on('document-created', () => {
      console.log('➕ Document created');
      debouncedDocumentRefresh();
    });

    socket.on('document-deleted', () => {
      console.log('🗑️ Document deleted');
      debouncedDocumentRefresh();
    });

    socket.on('document-moved', () => {
      console.log('📦 Document moved');
      debouncedDocumentRefresh();
    });

    socket.on('folder-created', () => {
      console.log('➕ Folder created');
      debouncedFolderRefresh();
    });

    socket.on('folder-deleted', () => {
      console.log('🗑️ Folder deleted');
      debouncedFolderRefresh();
      debouncedDocumentRefresh(); // Also refresh documents since folder counts changed
    });

    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      socket.off('document-processing-update');
      socket.off('documents-changed');
      socket.off('folders-changed');
      socket.off('document-created');
      socket.off('document-deleted');
      socket.off('document-moved');
      socket.off('folder-created');
      socket.off('folder-deleted');
      socket.disconnect();
    };
  }, [initialized, fetchDocuments, fetchFolders, fetchRecentDocuments]);

  // Add document (optimistic)
  const addDocument = useCallback(async (file, folderId = null) => {
    console.log('🔵 addDocument called for:', file.name, 'folderId:', folderId);

    // Create temporary document object
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempDocument = {
      id: tempId,
      name: file.name,
      size: file.size,
      folderId: folderId,
      createdAt: new Date().toISOString(),
      status: 'uploading',
      type: file.type || 'application/octet-stream',
      gcsUrl: null
    };

    console.log('🔵 Created temp document:', tempDocument);

    // Add to UI IMMEDIATELY (optimistic update)
    setDocuments(prev => {
      console.log('🔵 Adding temp doc to documents, current count:', prev.length);
      return [tempDocument, ...prev];
    });
    setRecentDocuments(prev => [tempDocument, ...prev.slice(0, 4)]);

    try {
      // Get upload URL from backend
      console.log('🔵 Requesting upload URL for:', {
        fileName: file.name,
        fileType: file.type,
        size: file.size
      });
      const uploadUrlResponse = await api.post('/api/documents/upload-url', {
        fileName: file.name,
        fileType: file.type,
        folderId: folderId
      });
      console.log('🔵 Upload URL response:', uploadUrlResponse.data);

      const { uploadUrl, gcsUrl, documentId, encryptedFilename } = uploadUrlResponse.data;

      // Calculate file hash
      const calculateFileHash = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const fileHash = await calculateFileHash(file);
      console.log('🔵 File hash calculated:', fileHash);

      // Upload directly to GCS
      console.log('🔵 Uploading to GCS with Content-Type:', file.type);
      const gcsResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });
      console.log('🔵 GCS upload response status:', gcsResponse.status, gcsResponse.statusText);

      if (!gcsResponse.ok) {
        throw new Error(`GCS upload failed: ${gcsResponse.status} ${gcsResponse.statusText}`);
      }

      // Confirm upload with backend - send required metadata
      console.log('🔵 Confirming upload with backend:', {
        documentId,
        encryptedFilename,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileHash,
        folderId
      });
      const confirmResponse = await api.post(`/api/documents/${documentId}/confirm-upload`, {
        encryptedFilename,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileHash,
        folderId
      });
      console.log('🔵 Confirm response:', confirmResponse.data);
      const newDocument = confirmResponse.data.document;
      console.log('🔵 Received new document from server:', newDocument);

      // Replace temp document with real one
      setDocuments(prev => {
        const updated = prev.map(doc => doc.id === tempId ? newDocument : doc);
        console.log('🔵 Replaced temp doc with real doc, count:', updated.length);
        return updated;
      });
      setRecentDocuments(prev =>
        prev.map(doc => doc.id === tempId ? newDocument : doc)
      );

      console.log('🔵 Document upload fully complete, returning:', newDocument);

      // Invalidate settings cache (storage stats need to be recalculated)
      sessionStorage.removeItem('koda_settings_documents');
      sessionStorage.removeItem('koda_settings_fileData');
      sessionStorage.removeItem('koda_settings_totalStorage');

      return newDocument;
    } catch (error) {
      console.error('🔴 Error in addDocument:', error);
      console.error('🔴 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Remove temp document on error
      setDocuments(prev => {
        const updated = prev.filter(doc => doc.id !== tempId);
        console.log('🔴 Removed temp doc on error, remaining count:', updated.length);
        return updated;
      });
      setRecentDocuments(prev => prev.filter(doc => doc.id !== tempId));

      throw error;
    }
  }, []);

  // Delete document (optimistic with proper error handling)
  const deleteDocument = useCallback(async (documentId) => {
    console.log('🗑️ [DELETE] Starting delete for document:', documentId);

    // Store document for potential rollback
    const documentToDelete = documents.find(d => d.id === documentId);

    if (!documentToDelete) {
      console.error('❌ [DELETE] Document not found in state:', documentId);
      throw new Error('Document not found');
    }

    console.log('🗑️ [DELETE] Document to delete:', {
      id: documentToDelete.id,
      filename: documentToDelete.filename,
      folderId: documentToDelete.folderId
    });

    // Remove from UI IMMEDIATELY (optimistic update)
    setDocuments(prev => {
      const updated = prev.filter(doc => doc.id !== documentId);
      console.log('🗑️ [DELETE] Optimistic update - removed from documents, count:', updated.length);
      return updated;
    });
    setRecentDocuments(prev => {
      const updated = prev.filter(doc => doc.id !== documentId);
      console.log('🗑️ [DELETE] Optimistic update - removed from recent, count:', updated.length);
      return updated;
    });

    try {
      // Delete on server
      console.log('🗑️ [DELETE] Sending DELETE request to server...');
      const response = await api.delete(`/api/documents/${documentId}`);
      console.log('✅ [DELETE] Server delete successful:', response.data);

      // Invalidate settings cache (storage stats need to be recalculated)
      sessionStorage.removeItem('koda_settings_documents');
      sessionStorage.removeItem('koda_settings_fileData');
      sessionStorage.removeItem('koda_settings_totalStorage');

      console.log('✅ [DELETE] Document deleted successfully:', documentToDelete.filename);

      // Return success
      return { success: true, document: documentToDelete };
    } catch (error) {
      console.error('❌ [DELETE] Server delete failed:', {
        documentId,
        filename: documentToDelete.filename,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Rollback: Restore document to UI
      console.log('🔄 [DELETE] Rolling back optimistic update...');
      setDocuments(prev => {
        // Insert document back in its original position (at the beginning for simplicity)
        const restored = [documentToDelete, ...prev];
        console.log('🔄 [DELETE] Restored document to state, count:', restored.length);
        return restored;
      });
      setRecentDocuments(prev => {
        const restored = [documentToDelete, ...prev].slice(0, 5);
        console.log('🔄 [DELETE] Restored document to recent, count:', restored.length);
        return restored;
      });

      // Throw error with user-friendly message
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete document';
      const userError = new Error(errorMessage);
      userError.originalError = error;
      userError.documentId = documentId;
      userError.filename = documentToDelete.filename;

      throw userError;
    }
  }, [documents]);

  // Move document to folder (optimistic)
  const moveToFolder = useCallback(async (documentId, newFolderId) => {
    // Store old document for rollback
    const oldDocument = documents.find(d => d.id === documentId);

    // Update UI IMMEDIATELY
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === documentId
          ? { ...doc, folderId: newFolderId }
          : doc
      )
    );
    setRecentDocuments(prev =>
      prev.map(doc =>
        doc.id === documentId
          ? { ...doc, folderId: newFolderId }
          : doc
      )
    );

    try {
      // Update on server in background
      await api.patch(`/api/documents/${documentId}`, {
        folderId: newFolderId
      });
    } catch (error) {
      console.error('Error moving document:', error);

      // Revert on error
      if (oldDocument) {
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId ? oldDocument : doc
          )
        );
        setRecentDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId ? oldDocument : doc
          )
        );
      }

      throw error;
    }
  }, [documents]);

  // Rename document (optimistic)
  const renameDocument = useCallback(async (documentId, newName) => {
    // Store old document for rollback
    const oldDocument = documents.find(d => d.id === documentId);

    // Update UI IMMEDIATELY
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === documentId
          ? { ...doc, filename: newName }
          : doc
      )
    );
    setRecentDocuments(prev =>
      prev.map(doc =>
        doc.id === documentId
          ? { ...doc, filename: newName }
          : doc
      )
    );

    try {
      // Update on server in background
      await api.patch(`/api/documents/${documentId}`, {
        filename: newName
      });
    } catch (error) {
      console.error('Error renaming document:', error);

      // Revert on error
      if (oldDocument) {
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId ? oldDocument : doc
          )
        );
        setRecentDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId ? oldDocument : doc
          )
        );
      }

      throw error;
    }
  }, [documents]);

  // Create folder (optimistic)
  const createFolder = useCallback(async (name, emoji, parentFolderId = null) => {
    const tempId = `temp-folder-${Date.now()}`;
    const tempFolder = {
      id: tempId,
      name,
      emoji,
      parentFolderId,
      createdAt: new Date().toISOString(),
      status: 'creating'
    };

    // Add to UI IMMEDIATELY
    setFolders(prev => [tempFolder, ...prev]);

    try {
      // ⚡ ZERO-KNOWLEDGE ENCRYPTION: Encrypt folder name
      let requestData = {
        name,
        emoji,
        parentFolderId
      };

      if (encryptionPassword) {
        console.log('🔐 [Encryption] Encrypting folder name:', name);
        const encryptedName = await encryptData(name, encryptionPassword);

        requestData = {
          name, // Send plaintext for backward compatibility
          nameEncrypted: encryptedName.ciphertext,
          encryptionSalt: encryptedName.salt,
          encryptionIV: encryptedName.iv,
          encryptionAuthTag: encryptedName.authTag,
          isEncrypted: true,
          emoji,
          parentFolderId
        };

        console.log('✅ [Encryption] Folder name encrypted successfully');
      }

      const response = await api.post('/api/folders', requestData);

      const newFolder = response.data.folder;

      // Replace temp folder with real one
      setFolders(prev =>
        prev.map(folder => folder.id === tempId ? newFolder : folder)
      );

      return newFolder;
    } catch (error) {
      console.error('Error creating folder:', error);

      // Remove temp folder on error
      setFolders(prev => prev.filter(folder => folder.id !== tempId));

      throw error;
    }
  }, []);

  // Delete folder (optimistic)
  const deleteFolder = useCallback(async (folderId) => {
    // Helper function to get all subfolder IDs recursively
    const getAllSubfolderIds = (parentId) => {
      const subfolderIds = [parentId];
      const directSubfolders = folders.filter(f => f.parentFolderId === parentId);

      directSubfolders.forEach(subfolder => {
        const nestedIds = getAllSubfolderIds(subfolder.id);
        subfolderIds.push(...nestedIds);
      });

      return subfolderIds;
    };

    // Get all folder IDs that will be deleted (parent + all subfolders)
    const allFolderIdsToDelete = getAllSubfolderIds(folderId);

    // Store deleted items for potential rollback
    const folderToDelete = folders.find(f => f.id === folderId);
    const foldersToDelete = folders.filter(f => allFolderIdsToDelete.includes(f.id));
    const documentsToDelete = documents.filter(d => allFolderIdsToDelete.includes(d.folderId));

    // Remove folder and all subfolders from UI IMMEDIATELY
    setFolders(prev => prev.filter(folder => !allFolderIdsToDelete.includes(folder.id)));

    // Remove all documents in the folder and subfolders from UI IMMEDIATELY
    setDocuments(prev => prev.filter(doc => !allFolderIdsToDelete.includes(doc.folderId)));
    setRecentDocuments(prev => prev.filter(doc => !allFolderIdsToDelete.includes(doc.folderId)));

    try {
      await api.delete(`/api/folders/${folderId}`);
    } catch (error) {
      console.error('Error deleting folder:', error);

      // Restore folders and documents on error
      if (foldersToDelete.length > 0) {
        setFolders(prev => [...foldersToDelete, ...prev]);
      }
      if (documentsToDelete.length > 0) {
        setDocuments(prev => [...documentsToDelete, ...prev]);
        setRecentDocuments(prev => [...documentsToDelete, ...prev].slice(0, 5));
      }

      throw error;
    }
  }, [folders, documents]);

  // Get document count by folder (including subfolders recursively)
  const getDocumentCountByFolder = useCallback((folderId) => {
    // Helper function to get all subfolder IDs recursively
    const getAllSubfolderIds = (parentId) => {
      const subfolderIds = [parentId];
      const directSubfolders = folders.filter(f => f.parentFolderId === parentId);

      console.log(`  🔄 Getting subfolders for ${parentId}: found ${directSubfolders.length} direct subfolders`);

      directSubfolders.forEach(subfolder => {
        const nestedIds = getAllSubfolderIds(subfolder.id);
        console.log(`  ↳ Subfolder ${subfolder.name} (${subfolder.id}) has ${nestedIds.length - 1} nested subfolders`);
        subfolderIds.push(...nestedIds);
      });

      return subfolderIds;
    };

    console.log(`\n📊 Counting documents for folder ${folderId}...`);

    // Get all folder IDs (current folder + all subfolders)
    const allFolderIds = getAllSubfolderIds(folderId);
    console.log(`  ✓ Found ${allFolderIds.length} total folders (including nested)`, allFolderIds);

    // Count documents in all these folders
    const docsInFolders = documents.filter(doc => allFolderIds.includes(doc.folderId));
    console.log(`  ✓ Found ${docsInFolders.length} documents across all folders`);
    console.log(`  Documents:`, docsInFolders.map(d => `${d.filename} (folderId: ${d.folderId})`));

    return docsInFolders.length;
  }, [documents, folders]);

  // Get file breakdown
  const getFileBreakdown = useCallback(() => {
    const breakdown = {
      total: documents.length,
      byType: {},
      byFolder: {}
    };

    documents.forEach(doc => {
      // Count by file type
      const ext = doc.name.split('.').pop().toLowerCase();
      breakdown.byType[ext] = (breakdown.byType[ext] || 0) + 1;

      // Count by folder
      const folderId = doc.folderId || 'uncategorized';
      breakdown.byFolder[folderId] = (breakdown.byFolder[folderId] || 0) + 1;
    });

    return breakdown;
  }, [documents]);

  // Get documents by folder
  const getDocumentsByFolder = useCallback((folderId) => {
    return documents.filter(doc => doc.folderId === folderId);
  }, [documents]);

  // Get root folders (categories)
  const getRootFolders = useCallback(() => {
    return folders.filter(folder => folder.parentFolderId === null);
  }, [folders]);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchDocuments(),
      fetchFolders(),
      fetchRecentDocuments()
    ]);
  }, [fetchDocuments, fetchFolders, fetchRecentDocuments]);

  const value = {
    // State
    documents,
    folders,
    recentDocuments,
    loading,

    // Document operations
    addDocument,
    deleteDocument,
    moveToFolder,
    renameDocument,

    // Folder operations
    createFolder,
    deleteFolder,

    // Queries
    getDocumentCountByFolder,
    getFileBreakdown,
    getDocumentsByFolder,
    getRootFolders,

    // Fetch operations
    fetchDocuments,
    fetchFolders,
    fetchRecentDocuments,
    refreshAll
  };

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
};
