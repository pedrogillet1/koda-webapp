/**
 * Infinite Conversation Memory Service
 *
 * PURPOSE: Main integration service for Manus-style infinite conversation memory
 * WHY: Coordinate chunking, embedding, retrieval, and compression
 * HOW: Orchestrate all conversation memory services + integrate with RAG
 *
 * THIS IS THE MAIN SERVICE TO USE IN RAG CONTROLLER
 */

import { PrismaClient } from '@prisma/client';
import conversationChunking from './conversationChunking.service';
import conversationEmbedding from './conversationEmbedding.service';
import conversationRetrieval from './conversationRetrieval.service';
import contextCompression from './contextCompression.service';

const prisma = new PrismaClient();

export interface InfiniteMemoryContext {
  formattedContext: string;
  stats: {
    recentMessageCount: number;
    historicalChunkCount: number;
    memoryCount: number;
    totalTokens: number;
    compressionLevel: number;
    compressionRatio?: number;
  };
}

/**
 * Get conversation context with infinite memory support
 *
 * THIS IS THE MAIN FUNCTION TO CALL FROM RAG SERVICE
 *
 * Replaces the old "get last 5 messages" approach with:
 * - Last 20 messages (full text)
 * - Relevant historical chunks (summaries)
 * - User memories (if relevant)
 * - Automatic compression if needed
 */
export async function getInfiniteConversationContext(
  conversationId: string,
  userId: string,
  query: string,
  options: {
    includeHistorical?: boolean;
    includeMemories?: boolean;
    autoChunk?: boolean;
    autoCompress?: boolean;
  } = {}
): Promise<InfiniteMemoryContext> {

  const {
    includeHistorical = true,
    includeMemories = true,
    autoChunk = true,
    autoCompress = true
  } = options;

  console.log(`♾️ [INFINITE MEMORY] Getting context for conversation ${conversationId}`);
  console.log(`   Query: "${query.substring(0, 50)}..."`);

  // STEP 1: Auto-chunk if needed
  if (autoChunk) {
    await autoChunkConversation(conversationId, userId);
  }

  // STEP 2: Retrieve conversation context
  const context = await conversationRetrieval.getConversationContext(
    conversationId,
    userId,
    query,
    {
      includeHistorical,
      includeMemories
    }
  );

  console.log(`♾️ [INFINITE MEMORY] Retrieved context:`);
  console.log(`   Recent messages: ${context.recentMessages.length}`);
  console.log(`   Historical chunks: ${context.historicalChunks.length}`);
  console.log(`   Memories: ${context.memories.length}`);
  console.log(`   Total tokens: ${context.tokenUsage.total}`);

  // STEP 3: Check if compression needed
  let formattedContext = conversationRetrieval.formatConversationContext(context);
  let compressionLevel = 0;
  let compressionRatio: number | undefined;

  if (autoCompress && contextCompression.needsCompression(context.tokenUsage.total)) {
    console.log(`♾️ [INFINITE MEMORY] Compression needed`);

    const level = contextCompression.determineCompressionLevel(context.tokenUsage.total);
    const compressionResult = await contextCompression.compressContext(
      context.recentMessages,
      context.historicalChunks,
      level
    );

    formattedContext = compressionResult.compressedContent;
    compressionLevel = compressionResult.level;
    compressionRatio = compressionResult.compressionRatio;

    console.log(`♾️ [INFINITE MEMORY] Compressed: ${compressionResult.originalTokens} → ${compressionResult.compressedTokens} tokens`);
  }

  // STEP 4: Update context state for monitoring
  await conversationRetrieval.updateContextState(
    conversationId,
    userId,
    context,
    query
  );

  return {
    formattedContext,
    stats: {
      recentMessageCount: context.recentMessages.length,
      historicalChunkCount: context.historicalChunks.length,
      memoryCount: context.memories.length,
      totalTokens: context.tokenUsage.total,
      compressionLevel,
      compressionRatio
    }
  };
}

/**
 * Auto-chunk conversation if needed
 * Checks if there are 10+ unchunked messages and chunks them
 */
async function autoChunkConversation(
  conversationId: string,
  userId: string
): Promise<void> {

  const needsChunking = await conversationChunking.needsChunking(conversationId);

  if (!needsChunking) {
    return;
  }

  console.log(`♾️ [INFINITE MEMORY] Auto-chunking conversation ${conversationId}`);

  try {
    // Chunk new messages
    const chunks = await conversationChunking.chunkNewMessages(conversationId, userId);

    if (chunks.length === 0) {
      return;
    }

    // Save chunks to database
    await conversationChunking.saveChunks(chunks);

    // FIXED: Wait for embeddings (was fire-and-forget, caused race conditions)
    // Embeddings must complete before query can find them
    try {
      await conversationEmbedding.embedChunksBatch(chunks);
      console.log(`♾️ [INFINITE MEMORY] Successfully embedded ${chunks.length} chunks`);
    } catch (error) {
      console.error(`⚠️ [INFINITE MEMORY] Chunk embedding failed:`, error);
    }

    // Update conversation index (also synchronous now)
    try {
      await conversationEmbedding.embedConversationIndex(conversationId, userId);
      console.log(`♾️ [INFINITE MEMORY] Updated conversation index`);
    } catch (error) {
      console.error(`⚠️ [INFINITE MEMORY] Conversation index update failed:`, error);
    }

    console.log(`♾️ [INFINITE MEMORY] Created and embedded ${chunks.length} new chunks`);
  } catch (error) {
    console.error(`⚠️ [INFINITE MEMORY] Auto-chunking failed:`, error);
  }
}

/**
 * Search across all conversations (cross-chat search)
 * Answers "which chat was this in?"
 */
export async function searchAcrossConversations(
  query: string,
  userId: string,
  options: {
    topK?: number;
    minScore?: number;
  } = {}
): Promise<Array<{
  conversationId: string;
  title: string;
  summary: string;
  relevance: number;
  messageCount: number;
  lastMessageAt: Date;
}>> {

  console.log(`♾️ [INFINITE MEMORY] Cross-conversation search: "${query.substring(0, 50)}..."`);

  return await conversationRetrieval.findConversationByQuery(query, userId, options);
}

/**
 * Manually trigger conversation chunking and embedding
 * Useful for batch processing or migration
 */
export async function chunkAndEmbedConversation(
  conversationId: string,
  userId: string
): Promise<{
  chunksCreated: number;
  chunksEmbedded: number;
  indexCreated: boolean;
}> {

  console.log(`♾️ [INFINITE MEMORY] Manual chunking for conversation ${conversationId}`);

  // Full conversation chunking
  const chunks = await conversationChunking.chunkConversation(conversationId, userId);

  if (chunks.length === 0) {
    return {
      chunksCreated: 0,
      chunksEmbedded: 0,
      indexCreated: false
    };
  }

  // Save chunks
  await conversationChunking.saveChunks(chunks);

  // Embed chunks
  const vectorIds = await conversationEmbedding.embedChunksBatch(chunks);

  // Create conversation index
  await conversationEmbedding.embedConversationIndex(conversationId, userId);

  console.log(`♾️ [INFINITE MEMORY] Chunked and embedded conversation:`);
  console.log(`   Chunks created: ${chunks.length}`);
  console.log(`   Chunks embedded: ${vectorIds.length}`);

  return {
    chunksCreated: chunks.length,
    chunksEmbedded: vectorIds.length,
    indexCreated: true
  };
}

/**
 * Get conversation statistics
 * Useful for monitoring and debugging
 */
export async function getConversationStats(conversationId: string): Promise<{
  messageCount: number;
  chunkCount: number;
  lastChunkedAt: Date | null;
  needsChunking: boolean;
  contextState: any;
  compressionStats: any;
}> {

  const stats = await conversationRetrieval.getContextStats(conversationId);

  const contextState = await prisma.conversationContextState.findUnique({
    where: { conversationId }
  });

  const compressionStats = contextState
    ? contextCompression.getCompressionStats(contextState.totalTokens)
    : null;

  return {
    ...stats,
    compressionStats
  };
}

/**
 * Delete conversation from infinite memory system
 * Removes chunks, embeddings, and indexes
 */
export async function deleteConversationMemory(conversationId: string): Promise<void> {
  console.log(`♾️ [INFINITE MEMORY] Deleting conversation memory for ${conversationId}`);

  // Delete embeddings from Pinecone
  await conversationEmbedding.deleteConversationEmbeddings(conversationId);

  // Delete chunks from database
  await prisma.conversationChunk.deleteMany({
    where: { conversationId }
  });

  // Delete conversation index
  await prisma.conversationIndex.delete({
    where: { conversationId }
  }).catch(() => {}); // Ignore if doesn't exist

  // Delete context state
  await prisma.conversationContextState.delete({
    where: { conversationId }
  }).catch(() => {}); // Ignore if doesn't exist

  console.log(`♾️ [INFINITE MEMORY] Deleted conversation memory`);
}

/**
 * Batch process all conversations for a user
 * Useful for migration or initial setup
 */
export async function batchProcessUserConversations(
  userId: string,
  options: {
    minMessages?: number;
    maxConversations?: number;
  } = {}
): Promise<{
  conversationsProcessed: number;
  totalChunks: number;
  totalEmbeddings: number;
}> {

  const { minMessages = 10, maxConversations = 100 } = options;

  console.log(`♾️ [INFINITE MEMORY] Batch processing conversations for user ${userId}`);

  // Get conversations with enough messages
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    include: {
      _count: {
        select: { messages: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: maxConversations
  });

  const eligibleConversations = conversations.filter(
    c => c._count.messages >= minMessages
  );

  console.log(`♾️ [INFINITE MEMORY] Found ${eligibleConversations.length} eligible conversations`);

  let totalChunks = 0;
  let totalEmbeddings = 0;

  for (const conversation of eligibleConversations) {
    try {
      const result = await chunkAndEmbedConversation(conversation.id, userId);
      totalChunks += result.chunksCreated;
      totalEmbeddings += result.chunksEmbedded;
    } catch (error) {
      console.error(`⚠️ [INFINITE MEMORY] Failed to process conversation ${conversation.id}:`, error);
    }
  }

  console.log(`♾️ [INFINITE MEMORY] Batch processing complete:`);
  console.log(`   Conversations: ${eligibleConversations.length}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Total embeddings: ${totalEmbeddings}`);

  return {
    conversationsProcessed: eligibleConversations.length,
    totalChunks,
    totalEmbeddings
  };
}

export default {
  getInfiniteConversationContext,
  searchAcrossConversations,
  chunkAndEmbedConversation,
  getConversationStats,
  deleteConversationMemory,
  batchProcessUserConversations
};
