import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as chatService from '../services/chatService';

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS - Centralized for consistency
// ═══════════════════════════════════════════════════════════════════════════
export const conversationsKeys = {
  all: ['conversations'],
  lists: () => [...conversationsKeys.all, 'list'],
  list: (filters) => [...conversationsKeys.lists(), { filters }],
  details: () => [...conversationsKeys.all, 'detail'],
  detail: (id) => [...conversationsKeys.details(), id],
};

// ═══════════════════════════════════════════════════════════════════════════
// GET ALL CONVERSATIONS - List view
// ═══════════════════════════════════════════════════════════════════════════
export function useConversations() {
  return useQuery({
    queryKey: conversationsKeys.lists(),
    queryFn: async () => {
      console.log('🔍 [React Query] Fetching conversations list...');
      const data = await chatService.getConversations();
      console.log(`✅ [React Query] Fetched ${data.conversations?.length || 0} conversations`);
      return data;
    },
    // Cache for 5 minutes (no need to refetch constantly)
    staleTime: 5 * 60 * 1000,

    // Keep in cache for 10 minutes
    cacheTime: 10 * 60 * 1000,

    // Refetch on window focus to sync changes
    refetchOnWindowFocus: true,

    // Show cached data while refetching in background
    keepPreviousData: true,

    // Handle errors gracefully
    onError: (error) => {
      console.error('❌ [React Query] Error fetching conversations:', error);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE CONVERSATION - Detail view with messages
// ═══════════════════════════════════════════════════════════════════════════
export function useConversation(conversationId) {
  return useQuery({
    queryKey: conversationsKeys.detail(conversationId),
    queryFn: async () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      console.log('🔍 [React Query] Fetching conversation:', conversationId);
      const data = await chatService.getConversation(conversationId);
      console.log(`✅ [React Query] Fetched conversation with ${data.messages?.length || 0} messages`);
      return data;
    },
    // Only fetch if we have a conversation ID
    enabled: !!conversationId,

    // Cache for 3 minutes (messages change more frequently)
    staleTime: 3 * 60 * 1000,

    // Refetch on window focus
    refetchOnWindowFocus: true,

    // Show cached data while refetching
    keepPreviousData: true,

    onError: (error) => {
      console.error('❌ [React Query] Error fetching conversation:', error);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE CONVERSATION - Mutation with optimistic update
// ═══════════════════════════════════════════════════════════════════════════
export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title) => {
      console.log('🆕 [React Query] Creating conversation:', title);
      return await chatService.createConversation(title);
    },

    // Optimistic update - add conversation immediately
    onMutate: async (title) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: conversationsKeys.lists() });

      // Snapshot previous value
      const previousConversations = queryClient.getQueryData(conversationsKeys.lists());

      // Optimistically update
      queryClient.setQueryData(conversationsKeys.lists(), (old) => {
        const optimisticConversation = {
          id: `temp-${Date.now()}`,
          title: title || 'New Chat',
          createdAt: new Date().toISOString(),
          isOptimistic: true,
        };

        return {
          ...old,
          conversations: [optimisticConversation, ...(old?.conversations || [])],
        };
      });

      // Return snapshot for rollback
      return { previousConversations };
    },

    // On error, rollback
    onError: (err, title, context) => {
      console.error('❌ [React Query] Create conversation failed:', err);
      if (context?.previousConversations) {
        queryClient.setQueryData(conversationsKeys.lists(), context.previousConversations);
      }
    },

    // On success, replace optimistic with real data
    onSuccess: (data) => {
      console.log('✅ [React Query] Conversation created:', data.id);

      // Invalidate conversations list to refetch
      queryClient.invalidateQueries({ queryKey: conversationsKeys.lists() });

      // Set the new conversation data
      queryClient.setQueryData(conversationsKeys.detail(data.id), data);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE CONVERSATION - Mutation with optimistic update
// ═══════════════════════════════════════════════════════════════════════════
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId) => {
      console.log('🗑️  [React Query] Deleting conversation:', conversationId);
      return await chatService.deleteConversation(conversationId);
    },

    // Optimistic update - remove conversation immediately
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: conversationsKeys.lists() });

      const previousConversations = queryClient.getQueryData(conversationsKeys.lists());

      // Remove from list
      queryClient.setQueryData(conversationsKeys.lists(), (old) => ({
        ...old,
        conversations: old?.conversations?.filter(conv => conv.id !== conversationId) || [],
      }));

      return { previousConversations };
    },

    onError: (err, conversationId, context) => {
      console.error('❌ [React Query] Delete conversation failed:', err);
      if (context?.previousConversations) {
        queryClient.setQueryData(conversationsKeys.lists(), context.previousConversations);
      }
    },

    onSuccess: (data, conversationId) => {
      console.log('✅ [React Query] Conversation deleted:', conversationId);

      // Remove from cache
      queryClient.removeQueries({ queryKey: conversationsKeys.detail(conversationId) });

      // Refetch list
      queryClient.invalidateQueries({ queryKey: conversationsKeys.lists() });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE CONVERSATION TITLE - Mutation with optimistic update
// ═══════════════════════════════════════════════════════════════════════════
export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, title }) => {
      console.log('📝 [React Query] Updating conversation title:', conversationId, title);
      return await chatService.updateConversationTitle(conversationId, title);
    },

    // Optimistic update
    onMutate: async ({ conversationId, title }) => {
      await queryClient.cancelQueries({ queryKey: conversationsKeys.detail(conversationId) });
      await queryClient.cancelQueries({ queryKey: conversationsKeys.lists() });

      const previousConversation = queryClient.getQueryData(conversationsKeys.detail(conversationId));
      const previousList = queryClient.getQueryData(conversationsKeys.lists());

      // Update in detail view
      queryClient.setQueryData(conversationsKeys.detail(conversationId), (old) => ({
        ...old,
        title,
      }));

      // Update in list view
      queryClient.setQueryData(conversationsKeys.lists(), (old) => ({
        ...old,
        conversations: old?.conversations?.map(conv =>
          conv.id === conversationId ? { ...conv, title } : conv
        ) || [],
      }));

      return { previousConversation, previousList };
    },

    onError: (err, { conversationId }, context) => {
      console.error('❌ [React Query] Update title failed:', err);
      if (context?.previousConversation) {
        queryClient.setQueryData(conversationsKeys.detail(conversationId), context.previousConversation);
      }
      if (context?.previousList) {
        queryClient.setQueryData(conversationsKeys.lists(), context.previousList);
      }
    },

    onSuccess: (data, { conversationId }) => {
      console.log('✅ [React Query] Conversation title updated:', conversationId);
      queryClient.invalidateQueries({ queryKey: conversationsKeys.detail(conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationsKeys.lists() });
    },
  });
}
