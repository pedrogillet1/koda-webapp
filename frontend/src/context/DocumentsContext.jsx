import React, { createContext, useContext, useState, useCallback, useEffect, useRef, startTransition } from 'react';
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

  // ✅ OPTIMIZATION: Frontend caching with 30s TTL (5s → <500ms for screen switches)
  const cacheRef = useRef({
    data: null,
    timestamp: 0
  });
  const CACHE_TTL = 30000; // 30 seconds

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

      // ⚡ FIX: Protect recently uploaded documents from being removed by stale refetches
      setDocuments(prev => {
        // Keep temp docs (status='uploading' or id starts with 'temp-')
        const tempDocs = prev.filter(doc => doc.status === 'uploading' || doc.id?.startsWith('temp-'));

        // ⚡ NEW: Also keep recently uploaded docs that might not be in fetchedDocs yet
        // (created in last 5 seconds and status='processing' or 'completed')
        const recentDocs = prev.filter(doc => {
          if (doc.id?.startsWith('temp-')) return false; // Already in tempDocs
          if (!doc.createdAt) {
            console.log(`⚠️ Document ${doc.id} has no createdAt`);
            return false;
          }

          const docAge = Date.now() - new Date(doc.createdAt).getTime();
          const isRecent = docAge < 5000; // Created in last 5 seconds (increased from 3s)
          const isProcessing = doc.status === 'processing' || doc.status === 'completed';
          const notInFetched = !fetchedDocs.find(fd => fd.id === doc.id);

          if (isRecent && isProcessing && notInFetched) {
            console.log(`✅ Protecting recent doc: ${doc.filename} (age: ${docAge}ms, status: ${doc.status})`);
          }

          return isRecent && isProcessing && notInFetched;
        });

        // Merge: temp docs + recent docs + fetched docs (deduplicated)
        const fetchedIds = new Set(fetchedDocs.map(d => d.id));
        const protectedDocs = [...tempDocs, ...recentDocs].filter(d => !fetchedIds.has(d.id));
        const mergedDocs = [...protectedDocs, ...fetchedDocs];

        console.log(`📄 Merged: ${tempDocs.length} temp + ${recentDocs.length} recent + ${fetchedDocs.length} fetched = ${mergedDocs.length} total`);
        if (recentDocs.length > 0) {
          console.log(`🔍 Recent docs being protected:`, recentDocs.map(d => d.filename));
        }
        return mergedDocs;
      });
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

  // ✅ OPTIMIZATION: Fetch all initial data in a single batched request with caching
  const fetchAllData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();

    // ✅ Check cache first (unless force refresh)
    if (!forceRefresh && cacheRef.current.data && (now - cacheRef.current.timestamp) < CACHE_TTL) {
      const cacheAge = Math.round((now - cacheRef.current.timestamp) / 1000);
      console.log(`✅ [CACHE] Using cached data (age: ${cacheAge}s, TTL: ${CACHE_TTL / 1000}s)`);

      const { documents: cachedDocs, folders: cachedFolders, recentDocuments: cachedRecent } = cacheRef.current.data;

      // ✅ OPTIMIZATION: Use startTransition for cached data too
      startTransition(() => {
        setDocuments(cachedDocs);
        setFolders(cachedFolders);
        setRecentDocuments(cachedRecent);
      });
      return;
    }

    setLoading(true);
    try {
      console.log('📦 [BATCH] Loading all data in single request...');
      const startTime = Date.now();

      const response = await api.get('/api/batch/initial-data');
      const { documents: fetchedDocs, folders: fetchedFolders, recentDocuments: fetchedRecent, meta } = response.data;

      const duration = Date.now() - startTime;
      console.log(`✅ [BATCH] Loaded in ${duration}ms (server: ${meta.loadTime}ms)`);
      console.log(`   ${fetchedDocs.length} documents, ${fetchedFolders.length} folders, ${fetchedRecent.length} recent`);

      // Decrypt folder names if encryption is enabled
      let decryptedFolders = fetchedFolders;
      if (encryptionPassword && fetchedFolders.length > 0) {
        const decryptStart = Date.now();
        decryptedFolders = await Promise.all(
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
                return folder;
              }
            }
            return folder;
          })
        );
        const decryptTime = Date.now() - decryptStart;
        console.log(`🔓 [Decryption] Decrypted ${fetchedFolders.length} folder names in ${decryptTime}ms`);
      }

      // ✅ Cache the result
      cacheRef.current = {
        data: {
          documents: fetchedDocs,
          folders: decryptedFolders,
          recentDocuments: fetchedRecent
        },
        timestamp: now
      };
      console.log(`💾 [CACHE] Cached data (TTL: ${CACHE_TTL / 1000}s)`);

      // ✅ OPTIMIZATION: Use startTransition for non-urgent state updates (save 500ms-1s)
      // This allows React to prioritize urgent updates like user input
      startTransition(() => {
        setDocuments(fetchedDocs);
        setFolders(decryptedFolders);
        setRecentDocuments(fetchedRecent);
      });

    } catch (error) {
      console.error('❌ [BATCH] Error loading data:', error);
      // Fallback to individual requests if batch fails
      console.log('🔄 Falling back to individual requests...');
      await Promise.all([
        fetchDocuments(),
        fetchFolders(),
        fetchRecentDocuments()
      ]);
    } finally {
      setLoading(false);
    }
  }, [encryptionPassword, fetchDocuments, fetchFolders, fetchRecentDocuments]);

  // ✅ Cache invalidation function
  const invalidateCache = useCallback(() => {
    cacheRef.current = { data: null, timestamp: 0 };
    console.log('🗑️ [CACHE] Cache invalidated');
  }, []);

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      // ✅ OPTIMIZATION: Use batched endpoint (1 request instead of 3)
      fetchAllData();
      setInitialized(true);
    }
  }, [initialized, fetchAllData]);

  // Auto-refresh data when window regains focus or becomes visible (with debounce)
  useEffect(() => {
    let refreshTimeout = null;
    let lastRefresh = 0;
    const REFRESH_COOLDOWN = 5000; // ⚡ FIX: 5 seconds to prevent overwriting optimistic updates
    const REFRESH_DELAY = 1000; // ⚡ FIX: Wait 1 second before refreshing to allow Supabase replication

    const debouncedRefresh = () => {
      const now = Date.now();
      if (now - lastRefresh < REFRESH_COOLDOWN) {
        console.log('⏸️  Skipping refresh (too soon since last refresh)');
        return;
      }

      // ⚡ FIX: Delay refresh to give Supabase time to replicate data
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        lastRefresh = Date.now();
        console.log('🔄 Refreshing data (after 1s delay)...');
        // ✅ OPTIMIZATION: Use batched endpoint for refresh
        fetchAllData();
      }, REFRESH_DELAY);
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

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const isNgrok = apiUrl.includes('ngrok');

    console.log('🔗 Connecting to:', apiUrl, '(ngrok:', isNgrok, ')');

    // Initialize socket connection
    // For ngrok, start with polling first due to WebSocket limitations
    const socket = io(apiUrl, {
      auth: { token },
      transports: isNgrok ? ['polling', 'websocket'] : ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false
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

      // ✅ Update document with progress information
      setDocuments((prevDocs) => {
        return prevDocs.map((doc) => {
          if (doc.id === data.documentId) {
            console.log(`📊 Updating document ${doc.name || doc.filename}: ${data.stage} (${data.progress}%)`);
            return {
              ...doc,
              status: data.status || doc.status,
              processingProgress: data.progress,
              processingStage: data.stage,
              processingMessage: data.message,
              // Remove temporary flag if completed or failed
              isTemporary: (data.status === 'completed' || data.status === 'failed') ? false : doc.isTemporary,
            };
          }
          return doc;
        });
      });

      // Also update recent documents if they're loaded
      setRecentDocuments((prevRecent) => {
        return prevRecent.map((doc) => {
          if (doc.id === data.documentId) {
            return {
              ...doc,
              status: data.status || doc.status,
              processingProgress: data.progress,
              processingStage: data.stage,
              processingMessage: data.message,
            };
          }
          return doc;
        });
      });

      // ✅ FIX: If document reaches 100% or 'complete'/'completed' stage, refresh documents
      if (data.progress === 100 || data.stage === 'complete' || data.stage === 'completed') {
        console.log('🔄 Document processing reached 100%, refreshing documents list...');
        setTimeout(() => {
          fetchDocuments();
          fetchRecentDocuments();
        }, 500); // Small delay to ensure backend has finished updating
      }
    });

    // ✅ NEW: Handle document processing complete
    socket.on('document-processing-complete', (data) => {
      console.log('✅ Document processing complete:', data);

      // Refresh document to get updated data
      fetchDocuments();
      fetchRecentDocuments();
    });

    // ✅ NEW: Handle document processing failed
    socket.on('document-processing-failed', (data) => {
      console.error('❌ Document processing failed:', data);

      // Update document status to failed
      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc.id === data.documentId
            ? { ...doc, status: 'failed', errorMessage: data.error }
            : doc
        )
      );

      setRecentDocuments((prevRecent) =>
        prevRecent.map((doc) =>
          doc.id === data.documentId
            ? { ...doc, status: 'failed', errorMessage: data.error }
            : doc
        )
      );
    });

    // ⚡ OPTIMIZED: Removed debounced refreshes - we use optimistic updates instead
    // These WebSocket events are kept for logging but don't trigger refetches
    socket.on('documents-changed', () => {
      console.log('📚 Documents changed (optimistic update already applied)');
      // No refresh - optimistic update already happened
    });

    socket.on('folders-changed', () => {
      console.log('📁 Folders changed (optimistic update already applied)');
      // No refresh - optimistic update already happened
    });

    socket.on('document-created', (data) => {
      console.log('➕ Document created event received:', data);

      // ✅ INSTANT UPLOAD FIX: Don't fetch - optimistic update already added the document!
      // Fetching here would overwrite the optimistic update and make the document disappear
      // The document will update its status via 'processing-complete' event when ready
      console.log('✅ Document already in UI via optimistic update - no fetch needed');

      // ✅ Invalidate cache so next fetchAllData() gets fresh data
      invalidateCache();
    });

    socket.on('document-deleted', () => {
      console.log('🗑️ Document deleted (optimistic update already applied)');
      // No refresh - optimistic update already happened
      invalidateCache();
    });

    socket.on('document-moved', () => {
      console.log('📦 Document moved (optimistic update already applied)');
      // No refresh - optimistic update already happened in moveToFolder()
      invalidateCache();
    });

    socket.on('folder-created', () => {
      console.log('➕ Folder created (optimistic update already applied)');
      // No refresh - optimistic update already happened in createFolder()
      invalidateCache();
    });

    socket.on('folder-deleted', () => {
      console.log('🗑️ Folder deleted (optimistic update already applied)');
      // No refresh - optimistic update already happened in deleteFolder()
      invalidateCache();
    });

    // ⚡ NEW: Listen for folder tree updates (emitted after cache invalidation completes)
    socket.on('folder-tree-updated', () => {
      console.log('🌳 Folder tree updated (optimistic update already applied)');
      // Don't refresh - we already have optimistic updates
      // Only refresh on window focus or explicit user action
    });

    // ⚡ NEW: Listen for processing complete events (emitted after Supabase commit completes)
    socket.on('processing-complete', (data) => {
      console.log('✅ Processing complete event received:', data);
      // Don't refresh - folder counts already updated via optimistic updates
      // Processing status is updated via document-processing-update event
    });

    // Listen for document uploads from FileContext
    const handleDocumentUploaded = () => {
      console.log('📤 Document uploaded event received');
      // ✅ INSTANT UPLOAD FIX: Don't fetch - optimistic update already added the document!
      // The addDocument() function already handles optimistic updates
      // Fetching here would overwrite the optimistic update and make the document disappear
      console.log('✅ Document already in UI via optimistic update - no fetch needed');
    };

    window.addEventListener('document-uploaded', handleDocumentUploaded);

    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      socket.off('document-processing-update');
      socket.off('document-processing-complete');
      socket.off('document-processing-failed');
      socket.off('documents-changed');
      socket.off('folders-changed');
      socket.off('document-created');
      socket.off('document-deleted');
      socket.off('document-moved');
      socket.off('folder-created');
      socket.off('folder-deleted');
      socket.off('folder-tree-updated');
      socket.off('processing-complete');
      socket.disconnect();
      window.removeEventListener('document-uploaded', handleDocumentUploaded);
    };
  }, [initialized, fetchDocuments, fetchFolders, fetchRecentDocuments]);

  // Add document (optimistic)
  const addDocument = useCallback(async (file, folderId = null) => {
    console.log('🔵 addDocument called for:', file.name, 'folderId:', folderId);

    // Create temporary document object (matches backend Document schema)
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempDocument = {
      id: tempId,
      filename: file.name, // ⚡ FIX: Use 'filename' to match backend schema
      fileSize: file.size, // ⚡ FIX: Use 'fileSize' to match backend schema
      mimeType: file.type || 'application/octet-stream', // ⚡ FIX: Use 'mimeType'
      folderId: folderId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'uploading',
      // Legacy fields for backward compatibility (in case UI uses them)
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream'
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

      const { uploadUrl, documentId, encryptedFilename } = uploadUrlResponse.data;

      // Calculate file hash
      const calculateFileHash = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };

      const fileHash = await calculateFileHash(file);
      console.log('🔵 File hash calculated:', fileHash);

      // Upload directly to S3
      console.log('🔵 Uploading to S3 with Content-Type:', file.type);
      const s3Response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-amz-server-side-encryption': 'AES256' // Required by S3 presigned URL signature
        },
        body: file
      });
      console.log('🔵 S3 upload response status:', s3Response.status, s3Response.statusText);

      if (!s3Response.ok) {
        throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
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

      // ⚡ INSTANT UPDATE: Increment folder count immediately
      if (newDocument.folderId) {
        setFolders(prev => prev.map(folder => {
          if (folder.id === newDocument.folderId) {
            return {
              ...folder,
              _count: {
                ...folder._count,
                documents: (folder._count?.documents || 0) + 1,
                totalDocuments: (folder._count?.totalDocuments || 0) + 1
              }
            };
          }
          return folder;
        }));
        console.log(`✅ Incremented count for folder ${newDocument.folderId}`);
      }

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

    // ⚡ PREVENT DUPLICATE DELETES: Check if document is already being deleted
    if (documentToDelete.isDeleting) {
      console.warn('⚠️ [DELETE] Document is already being deleted, skipping:', documentId);
      return { success: false, message: 'Delete already in progress' };
    }

    console.log('🗑️ [DELETE] Document to delete:', {
      id: documentToDelete.id,
      filename: documentToDelete.filename,
      folderId: documentToDelete.folderId
    });

    // Mark as deleting to prevent duplicate attempts
    setDocuments(prev => prev.map(doc =>
      doc.id === documentId ? { ...doc, isDeleting: true } : doc
    ));

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

    // ⚡ INSTANT UPDATE: Decrement folder count immediately
    if (documentToDelete.folderId) {
      setFolders(prev => prev.map(folder => {
        if (folder.id === documentToDelete.folderId) {
          return {
            ...folder,
            _count: {
              ...folder._count,
              documents: Math.max(0, (folder._count?.documents || 0) - 1),
              totalDocuments: Math.max(0, (folder._count?.totalDocuments || 0) - 1)
            }
          };
        }
        return folder;
      }));
      console.log(`✅ Decremented count for folder ${documentToDelete.folderId}`);
    }

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

      // Rollback: Restore document to UI (clear isDeleting flag)
      console.log('🔄 [DELETE] Rolling back optimistic update...');
      setDocuments(prev => {
        // Insert document back in its original position (at the beginning for simplicity)
        // Clear isDeleting flag so user can retry
        const restoredDoc = { ...documentToDelete, isDeleting: false };
        const restored = [restoredDoc, ...prev];
        console.log('🔄 [DELETE] Restored document to state, count:', restored.length);
        return restored;
      });
      setRecentDocuments(prev => {
        const restored = [documentToDelete, ...prev].slice(0, 5);
        console.log('🔄 [DELETE] Restored document to recent, count:', restored.length);
        return restored;
      });

      // ⚡ ROLLBACK: Restore folder count
      if (documentToDelete.folderId) {
        setFolders(prev => prev.map(folder => {
          if (folder.id === documentToDelete.folderId) {
            return {
              ...folder,
              _count: {
                ...folder._count,
                documents: (folder._count?.documents || 0) + 1,
                totalDocuments: (folder._count?.totalDocuments || 0) + 1
              }
            };
          }
          return folder;
        }));
        console.log(`🔄 Restored count for folder ${documentToDelete.folderId}`);
      }

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
    const oldFolderId = oldDocument?.folderId;

    console.log(`📦 [MOVE] Moving document ${documentId} from folder ${oldFolderId || 'NONE'} to ${newFolderId || 'NONE'}`);

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

    // ⚡ INSTANT UPDATE: Update folder counts for both source and destination
    if (oldFolderId !== newFolderId) {
      setFolders(prev => prev.map(folder => {
        // Decrement count from old folder
        if (folder.id === oldFolderId) {
          const newCount = Math.max(0, (folder._count?.documents || 0) - 1);
          const newTotalCount = Math.max(0, (folder._count?.totalDocuments || 0) - 1);
          console.log(`  📉 Decrementing source folder ${oldFolderId}: ${folder._count?.documents} → ${newCount}`);
          return {
            ...folder,
            _count: {
              ...folder._count,
              documents: newCount,
              totalDocuments: newTotalCount
            }
          };
        }

        // Increment count in new folder
        if (folder.id === newFolderId) {
          const newCount = (folder._count?.documents || 0) + 1;
          const newTotalCount = (folder._count?.totalDocuments || 0) + 1;
          console.log(`  📈 Incrementing destination folder ${newFolderId}: ${folder._count?.documents} → ${newCount}`);
          return {
            ...folder,
            _count: {
              ...folder._count,
              documents: newCount,
              totalDocuments: newTotalCount
            }
          };
        }

        return folder;
      }));
    }

    try {
      // Update on server in background
      await api.patch(`/api/documents/${documentId}`, {
        folderId: newFolderId
      });
      console.log(`✅ [MOVE] Successfully moved document ${documentId} to folder ${newFolderId}`);
    } catch (error) {
      console.error('❌ [MOVE] Error moving document:', error);

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

        // ⚡ ROLLBACK: Restore folder counts
        if (oldFolderId !== newFolderId) {
          setFolders(prev => prev.map(folder => {
            // Restore old folder count (increment back)
            if (folder.id === oldFolderId) {
              return {
                ...folder,
                _count: {
                  ...folder._count,
                  documents: (folder._count?.documents || 0) + 1,
                  totalDocuments: (folder._count?.totalDocuments || 0) + 1
                }
              };
            }

            // Restore new folder count (decrement back)
            if (folder.id === newFolderId) {
              return {
                ...folder,
                _count: {
                  ...folder._count,
                  documents: Math.max(0, (folder._count?.documents || 0) - 1),
                  totalDocuments: Math.max(0, (folder._count?.totalDocuments || 0) - 1)
                }
              };
            }

            return folder;
          }));
          console.log(`🔄 Rolled back folder counts for move operation`);
        }
      }

      throw error;
    }
  }, [documents, folders]); // Add folders to dependencies since we're updating it

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
      status: 'creating',
      // ⚡ Add empty counts for instant display
      _count: {
        documents: 0,
        totalDocuments: 0,
        subfolders: 0
      }
    };

    // Add to UI IMMEDIATELY
    console.log(`📁 [CREATE] Adding temp folder "${name}" to UI`);
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
      console.log(`✅ [CREATE] Folder "${name}" created successfully, replacing temp ID with real ID: ${newFolder.id}`);
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
  }, [encryptionPassword]); // Add dependency for encryptionPassword

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

  // ⚡ OPTIMIZED: Get document count by folder using backend-provided count
  // Backend already calculated this recursively - no need to recount on frontend!
  const getDocumentCountByFolder = useCallback((folderId) => {
    // Find the folder
    const folder = folders.find(f => f.id === folderId);

    if (!folder) {
      console.warn(`⚠️ Folder ${folderId} not found`);
      return 0;
    }

    // Use backend-provided totalDocuments count if available
    if (folder._count?.totalDocuments !== undefined) {
      console.log(`✅ Using backend count for ${folder.name}: ${folder._count.totalDocuments} documents`);
      return folder._count.totalDocuments;
    }

    // Fallback: Use direct document count
    if (folder._count?.documents !== undefined) {
      console.log(`⚡ Using direct count for ${folder.name}: ${folder._count.documents} documents`);
      return folder._count.documents;
    }

    // Last resort fallback: Count manually (should rarely happen)
    const count = documents.filter(doc => doc.folderId === folderId).length;
    console.log(`⚠️ Manual count fallback for ${folder.name}: ${count} documents`);
    return count;
  }, [folders, documents]);

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
    console.log('🔄 [DocumentsContext] Refreshing all data...');

    // ✅ PROGRESSIVE RENDERING: Don't wait for all - let each update independently
    // This allows UI to render data as it arrives (folders → documents → recent)
    // Fastest data (folders, 300-500ms) appears first, improving perceived speed

    // Start all fetches in parallel
    const promises = [
      fetchFolders(),           // Fastest (300-500ms)
      fetchDocuments(),         // Medium (500-800ms)
      fetchRecentDocuments()    // Variable (400-600ms)
    ];

    // Don't await - let each complete independently and update state
    // Each fetch calls its own setState, triggering progressive re-renders
    promises.forEach(p => p.catch(err => console.error('❌ [DocumentsContext] Fetch error:', err)));

    console.log('✅ [DocumentsContext] All fetches started (progressive rendering enabled)');
  }, [fetchDocuments, fetchFolders, fetchRecentDocuments]);

  const value = {
    // State
    documents,
    folders,
    recentDocuments,
    loading,
    socket: socketRef.current, // ⚡ Expose socket for other components

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
    fetchAllData, // ✅ Expose fetchAllData for manual cache refresh
    refreshAll,
    invalidateCache // ✅ Expose cache invalidation
  };

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
};
