import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

const DocumentsContext = createContext();

export const useDocuments = () => {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error('useDocuments must be used within DocumentsProvider');
  }
  return context;
};

export const DocumentsProvider = ({ children }) => {
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
      const fetchedFolders = response.data.folders || [];

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
  }, []);

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

  // Auto-refresh data when window regains focus or becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && initialized) {
        console.log('📱 Page became visible, refreshing documents...');
        fetchDocuments();
        fetchFolders();
        fetchRecentDocuments();
      }
    };

    const handleFocus = () => {
      if (initialized) {
        console.log('🔄 Window focused, refreshing documents...');
        fetchDocuments();
        fetchFolders();
        fetchRecentDocuments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [initialized, fetchDocuments, fetchFolders, fetchRecentDocuments]);

  // WebSocket real-time auto-refresh
  const socketRef = useRef(null);

  useEffect(() => {
    if (!initialized) return;

    // Get auth token
    const token = localStorage.getItem('accessToken');
    if (!token) return;

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
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    // Listen for document processing updates
    socket.on('document-processing-update', (data) => {
      console.log('📄 Document processing update received:', data);

      // Auto-refresh documents when processing completes
      if (data.status === 'completed' || data.status === 'failed') {
        fetchDocuments();
        fetchRecentDocuments();
      }
    });

    // Listen for general data changes (we'll add these events to backend)
    socket.on('documents-changed', () => {
      console.log('📚 Documents changed, refreshing...');
      fetchDocuments();
      fetchRecentDocuments();
    });

    socket.on('folders-changed', () => {
      console.log('📁 Folders changed, refreshing...');
      fetchFolders();
    });

    socket.on('document-created', () => {
      console.log('➕ Document created, refreshing...');
      fetchDocuments();
      fetchRecentDocuments();
    });

    socket.on('document-deleted', () => {
      console.log('🗑️ Document deleted, refreshing...');
      fetchDocuments();
      fetchRecentDocuments();
    });

    socket.on('document-moved', () => {
      console.log('📦 Document moved, refreshing...');
      fetchDocuments();
      fetchRecentDocuments();
    });

    socket.on('folder-created', () => {
      console.log('➕ Folder created, refreshing...');
      fetchFolders();
    });

    socket.on('folder-deleted', () => {
      console.log('🗑️ Folder deleted, refreshing...');
      fetchFolders();
      fetchDocuments();
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

    // Add to UI IMMEDIATELY (optimistic update)
    setDocuments(prev => [tempDocument, ...prev]);
    setRecentDocuments(prev => [tempDocument, ...prev.slice(0, 4)]);

    try {
      // Get upload URL from backend
      const uploadUrlResponse = await api.post('/api/documents/upload-url', {
        fileName: file.name,
        fileType: file.type,
        folderId: folderId
      });

      const { uploadUrl, gcsUrl, documentId, encryptedFilename } = uploadUrlResponse.data;

      // Calculate file hash
      const calculateFileHash = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const fileHash = await calculateFileHash(file);

      // Upload directly to GCS
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      // Confirm upload with backend - send required metadata
      const confirmResponse = await api.post(`/api/documents/${documentId}/confirm-upload`, {
        encryptedFilename,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        fileHash,
        folderId
      });
      const newDocument = confirmResponse.data.document;

      // Replace temp document with real one
      setDocuments(prev =>
        prev.map(doc => doc.id === tempId ? newDocument : doc)
      );
      setRecentDocuments(prev =>
        prev.map(doc => doc.id === tempId ? newDocument : doc)
      );

      return newDocument;
    } catch (error) {
      console.error('Error uploading document:', error);

      // Remove temp document on error
      setDocuments(prev => prev.filter(doc => doc.id !== tempId));
      setRecentDocuments(prev => prev.filter(doc => doc.id !== tempId));

      throw error;
    }
  }, []);

  // Delete document (optimistic)
  const deleteDocument = useCallback(async (documentId) => {
    // Store document for potential rollback
    const documentToDelete = documents.find(d => d.id === documentId);

    // Remove from UI IMMEDIATELY
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    setRecentDocuments(prev => prev.filter(doc => doc.id !== documentId));

    try {
      // Delete on server in background
      await api.delete(`/api/documents/${documentId}`);
    } catch (error) {
      console.error('Error deleting document:', error);

      // Restore document on error
      if (documentToDelete) {
        setDocuments(prev => [documentToDelete, ...prev]);
        setRecentDocuments(prev => [documentToDelete, ...prev].slice(0, 5));
      }

      throw error;
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
      const response = await api.post('/api/folders', {
        name,
        emoji,
        parentFolderId
      });

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
    const folderToDelete = folders.find(f => f.id === folderId);

    // Remove from UI IMMEDIATELY
    setFolders(prev => prev.filter(folder => folder.id !== folderId));

    try {
      await api.delete(`/api/folders/${folderId}`);
    } catch (error) {
      console.error('Error deleting folder:', error);

      // Restore folder on error
      if (folderToDelete) {
        setFolders(prev => [folderToDelete, ...prev]);
      }

      throw error;
    }
  }, [folders]);

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
