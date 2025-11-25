import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS - Centralized for consistency
// ═══════════════════════════════════════════════════════════════════════════
export const documentsKeys = {
  all: ['documents'],
  lists: () => [...documentsKeys.all, 'list'],
  list: (filters) => [...documentsKeys.lists(), { filters }],
  details: () => [...documentsKeys.all, 'detail'],
  detail: (id) => [...documentsKeys.details(), id],
  byFolder: (folderId) => [...documentsKeys.all, 'folder', folderId],
};

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL DOCUMENTS - List view
// ═══════════════════════════════════════════════════════════════════════════
export function useDocuments(filters = {}) {
  return useQuery({
    queryKey: documentsKeys.list(filters),
    queryFn: async () => {
      console.log('🔍 [React Query] Fetching documents list...');
      const response = await api.get('/api/documents', { params: filters });
      console.log(`✅ [React Query] Fetched ${response.data.documents?.length || 0} documents`);
      return response.data;
    },
    // Cache for 5 minutes (documents don't change often)
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    keepPreviousData: true,
    onError: (error) => {
      console.error('❌ [React Query] Error fetching documents:', error);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE DOCUMENT - Detail view
// ═══════════════════════════════════════════════════════════════════════════
export function useDocument(documentId) {
  return useQuery({
    queryKey: documentsKeys.detail(documentId),
    queryFn: async () => {
      if (!documentId) {
        throw new Error('Document ID is required');
      }
      console.log('🔍 [React Query] Fetching document:', documentId);
      const response = await api.get(`/api/documents/${documentId}`);
      console.log(`✅ [React Query] Fetched document:`, response.data.filename);
      return response.data;
    },
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false, // Don't refetch on focus (document content is stable)
    onError: (error) => {
      console.error('❌ [React Query] Error fetching document:', error);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET DOCUMENTS BY FOLDER - Filtered list
// ═══════════════════════════════════════════════════════════════════════════
export function useDocumentsByFolder(folderId) {
  return useQuery({
    queryKey: documentsKeys.byFolder(folderId),
    queryFn: async () => {
      console.log('🔍 [React Query] Fetching documents for folder:', folderId);
      const response = await api.get('/api/documents', {
        params: { folderId }
      });
      console.log(`✅ [React Query] Fetched ${response.data.documents?.length || 0} documents for folder`);
      return response.data;
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true,
    onError: (error) => {
      console.error('❌ [React Query] Error fetching folder documents:', error);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE DOCUMENT - Mutation with optimistic update
// ═══════════════════════════════════════════════════════════════════════════
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId) => {
      console.log('🗑️  [React Query] Deleting document:', documentId);
      const response = await api.delete(`/api/documents/${documentId}`);
      return response.data;
    },

    // Optimistic update - remove document immediately
    onMutate: async (documentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: documentsKeys.lists() });

      // Snapshot previous values
      const previousDocuments = queryClient.getQueryData(documentsKeys.lists());

      // Optimistically remove from list
      queryClient.setQueryData(documentsKeys.lists(), (old) => ({
        ...old,
        documents: old?.documents?.filter(doc => doc.id !== documentId) || [],
      }));

      return { previousDocuments };
    },

    onError: (err, documentId, context) => {
      console.error('❌ [React Query] Delete document failed:', err);
      if (context?.previousDocuments) {
        queryClient.setQueryData(documentsKeys.lists(), context.previousDocuments);
      }
    },

    onSuccess: (data, documentId) => {
      console.log('✅ [React Query] Document deleted:', documentId);

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: documentsKeys.detail(documentId) });

      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: documentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: documentsKeys.all });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE DOCUMENT - Mutation with optimistic update
// ═══════════════════════════════════════════════════════════════════════════
export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, updates }) => {
      console.log('📝 [React Query] Updating document:', documentId);
      const response = await api.patch(`/api/documents/${documentId}`, updates);
      return response.data;
    },

    // Optimistic update
    onMutate: async ({ documentId, updates }) => {
      await queryClient.cancelQueries({ queryKey: documentsKeys.detail(documentId) });
      await queryClient.cancelQueries({ queryKey: documentsKeys.lists() });

      const previousDocument = queryClient.getQueryData(documentsKeys.detail(documentId));
      const previousList = queryClient.getQueryData(documentsKeys.lists());

      // Update in detail view
      queryClient.setQueryData(documentsKeys.detail(documentId), (old) => ({
        ...old,
        ...updates,
      }));

      // Update in list view
      queryClient.setQueryData(documentsKeys.lists(), (old) => ({
        ...old,
        documents: old?.documents?.map(doc =>
          doc.id === documentId ? { ...doc, ...updates } : doc
        ) || [],
      }));

      return { previousDocument, previousList };
    },

    onError: (err, { documentId }, context) => {
      console.error('❌ [React Query] Update document failed:', err);
      if (context?.previousDocument) {
        queryClient.setQueryData(documentsKeys.detail(documentId), context.previousDocument);
      }
      if (context?.previousList) {
        queryClient.setQueryData(documentsKeys.lists(), context.previousList);
      }
    },

    onSuccess: (data, { documentId }) => {
      console.log('✅ [React Query] Document updated:', documentId);
      queryClient.invalidateQueries({ queryKey: documentsKeys.detail(documentId) });
      queryClient.invalidateQueries({ queryKey: documentsKeys.lists() });
    },
  });
}
