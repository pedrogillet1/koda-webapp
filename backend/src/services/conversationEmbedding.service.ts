/**
 * Conversation Embedding Service - STUB (service removed)
 * This stub file prevents import errors while the service is removed.
 */

export const embedConversation = async () => {};

export const searchConversations = async (_query: string, _userId: string, _options?: any) => [];

export const searchConversationChunks = async (_query: string, _options?: any) => [];

export const embedChunksBatch = async (_chunks: any[]) => [];

export const embedConversationIndex = async (_conversationId: string, _userId: string) => {};

export const deleteConversationEmbeddings = async (_conversationId: string) => {};

export default {
  embedConversation,
  searchConversations,
  searchConversationChunks,
  embedChunksBatch,
  embedConversationIndex,
  deleteConversationEmbeddings,
};
