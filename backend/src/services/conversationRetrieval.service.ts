/**
 * Conversation Retrieval Service
 *
 * PURPOSE: Retrieve relevant conversation history and assemble context
 * WHY: Enable infinite conversation memory without token overflow
 * HOW: Recent messages (full) + Semantic retrieval (summaries) + Memories
 *
 * MANUS-STYLE ARCHITECTURE:
 * - Layer 1: Recent messages (last 20, always included)
 * - Layer 2: Relevant historical chunks (semantic search)
 * - Layer 3: User memories (if relevant)
 * - Layer 4: Smart token budget allocation
 */

import prisma from '../config/database';
import conversationEmbedding from './conversationEmbedding.service';
import { getRelevantMemories } from './memory.service';

// Token budget configuration (Gemini 2.5 Flash: 1M input tokens)
const TOKEN_BUDGET = {
  TOTAL: 200000,           // Conservative limit for context
  SYSTEM_PROMPT: 5000,     // 2.5%
  RECENT_MESSAGES: 20000,  // 10% - Last 20 messages
  HISTORICAL_CHUNKS: 30000, // 15% - Relevant past chunks
  DOCUMENTS: 50000,        // 25% - Document chunks from RAG
  MEMORIES: 5000,          // 2.5% - User memories
  OUTPUT_RESERVE: 40000,   // 20% - Reserved for response
  BUFFER: 50000            // 25% - Safety buffer
};

const RECENT_MESSAGE_COUNT = 20; // How many recent messages to include in full

export interface ConversationContext {
  recentMessages: Array<{
    role: string;
    content: string;
    createdAt: Date;
  }>;
  historicalChunks: Array<{
    summary: string;
    topics: string[];
    timestamp: Date;
    score: number;
  }>;
  memories: Array<{
    content: string;
    section: string;
    importance: number;
  }>;
  tokenUsage: {
    recent: number;
    historical: number;
    memories: number;
    total: number;
  };
}

/**
 * Retrieve conversation context for query
 *
 * STRATEGY:
 * 1. Get last 20 messages (always included)
 * 2. Search for relevant chunks from earlier in conversation
 * 3. Get relevant user memories
 * 4. Assemble context within token budget
 */
export async function getConversationContext(
  conversationId: string,
  userId: string,
  query: string,
  options: {
    includeHistorical?: boolean;
    includeMemories?: boolean;
    maxHistoricalChunks?: number;
  } = {}
): Promise<ConversationContext> {

  const {
    includeHistorical = true,
    includeMemories = true,
    maxHistoricalChunks = 5
  } = options;

  console.log(`📚 [RETRIEVAL] Getting context for conversation ${conversationId}`);
  console.log(`   Query: "${query.substring(0, 50)}..."`);
  console.log(`   Include historical: ${includeHistorical}, memories: ${includeMemories}`);

  // LAYER 1: Get recent messages (last 20)
  const recentMessages = await getRecentMessages(conversationId, RECENT_MESSAGE_COUNT);
  const recentTokens = estimateTokens(
    recentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')
  );

  console.log(`📚 [RETRIEVAL] Recent messages: ${recentMessages.length} (${recentTokens} tokens)`);

  // LAYER 2: Get relevant historical chunks (if enabled)
  let historicalChunks: any[] = [];
  let historicalTokens = 0;

  if (includeHistorical && recentMessages.length > 0) {
    // Get oldest recent message timestamp
    const oldestRecentTimestamp = recentMessages[0].createdAt;

    // Search for relevant chunks BEFORE recent messages
    try {
      const searchResults = await conversationEmbedding.searchConversationChunks(query, {
        conversationId,
        userId,
        topK: maxHistoricalChunks,
        minScore: 0.7
      });

      // Filter out chunks that overlap with recent messages
      historicalChunks = await filterHistoricalChunks(
        searchResults,
        oldestRecentTimestamp
      );

      // Calculate tokens for historical chunks
      historicalTokens = estimateTokens(
        historicalChunks.map(c => c.summary).join('\n\n')
      );

      // Trim if exceeds budget
      if (historicalTokens > TOKEN_BUDGET.HISTORICAL_CHUNKS) {
        historicalChunks = trimChunksToTokenBudget(
          historicalChunks,
          TOKEN_BUDGET.HISTORICAL_CHUNKS
        );
        historicalTokens = TOKEN_BUDGET.HISTORICAL_CHUNKS;
      }

      console.log(`📚 [RETRIEVAL] Historical chunks: ${historicalChunks.length} (${historicalTokens} tokens)`);
    } catch (error) {
      console.warn(`⚠️ [RETRIEVAL] Error getting historical chunks:`, error);
    }
  }

  // LAYER 3: Get relevant memories (if enabled)
  let memories: any[] = [];
  let memoriesTokens = 0;

  if (includeMemories) {
    try {
      memories = await getRelevantMemories(userId, query, undefined, 5);
      memoriesTokens = estimateTokens(
        memories.map(m => m.content).join('\n')
      );

      // Trim if exceeds budget
      if (memoriesTokens > TOKEN_BUDGET.MEMORIES) {
        memories = memories.slice(0, Math.floor(memories.length * TOKEN_BUDGET.MEMORIES / memoriesTokens));
        memoriesTokens = TOKEN_BUDGET.MEMORIES;
      }

      console.log(`📚 [RETRIEVAL] Memories: ${memories.length} (${memoriesTokens} tokens)`);
    } catch (error) {
      console.warn(`⚠️ [RETRIEVAL] Error getting memories:`, error);
    }
  }

  const totalTokens = recentTokens + historicalTokens + memoriesTokens;
  console.log(`📚 [RETRIEVAL] Total context: ${totalTokens} tokens`);

  return {
    recentMessages,
    historicalChunks,
    memories,
    tokenUsage: {
      recent: recentTokens,
      historical: historicalTokens,
      memories: memoriesTokens,
      total: totalTokens
    }
  };
}

/**
 * Get recent messages from conversation
 */
async function getRecentMessages(
  conversationId: string,
  count: number
): Promise<Array<{ role: string; content: string; createdAt: Date }>> {

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: count,
    select: {
      role: true,
      content: true,
      createdAt: true
    }
  });

  // Reverse to get chronological order
  return messages.reverse();
}

/**
 * Filter historical chunks to exclude those overlapping with recent messages
 */
async function filterHistoricalChunks(
  searchResults: any[],
  oldestRecentTimestamp: Date
): Promise<any[]> {

  const filtered: any[] = [];

  for (const result of searchResults) {
    // Get chunk from database
    const chunk = await (prisma as any).conversationChunk?.findFirst?.({
      where: { vectorId: result.chunkId }
    });

    if (!chunk) continue;

    // Only include if chunk is BEFORE recent messages
    if (chunk.lastMessageAt < oldestRecentTimestamp) {
      filtered.push({
        summary: chunk.summary,
        topics: chunk.topics,
        timestamp: chunk.lastMessageAt,
        score: result.score
      });
    }
  }

  return filtered;
}

/**
 * Trim chunks to fit token budget
 */
function trimChunksToTokenBudget(chunks: any[], budget: number): any[] {
  const trimmed: any[] = [];
  let currentTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.summary);
    if (currentTokens + chunkTokens <= budget) {
      trimmed.push(chunk);
      currentTokens += chunkTokens;
    } else {
      break;
    }
  }

  return trimmed;
}

/**
 * Estimate token count for text (rough approximation)
 * 1 token ≈ 4 characters for English
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format conversation context for RAG
 * Returns formatted string ready to include in prompt
 */
export function formatConversationContext(context: ConversationContext): string {
  let formatted = '';

  // Recent messages
  if (context.recentMessages.length > 0) {
    formatted += '## Recent Conversation\n\n';
    formatted += context.recentMessages
      .map(m => `**${m.role === 'user' ? 'User' : 'KODA'}**: ${m.content}`)
      .join('\n\n');
    formatted += '\n\n';
  }

  // Historical context
  if (context.historicalChunks.length > 0) {
    formatted += '## Earlier in This Conversation\n\n';
    formatted += context.historicalChunks
      .map((chunk, i) => `**[Earlier discussion ${i + 1}]**: ${chunk.summary}`)
      .join('\n\n');
    formatted += '\n\n';
  }

  // Memories
  if (context.memories.length > 0) {
    formatted += '## What I Remember About You\n\n';
    formatted += context.memories
      .map(m => `- ${m.content}`)
      .join('\n');
    formatted += '\n\n';
  }

  return formatted;
}

/**
 * Search for conversation by query (cross-chat search)
 * Answers "which chat was this in?"
 */
export async function findConversationByQuery(
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

  console.log(`🔍 [RETRIEVAL] Cross-conversation search: "${query.substring(0, 50)}..."`);

  try {
    const results = await conversationEmbedding.searchConversations(query, userId, options);

    return results.map(r => ({
      conversationId: r.conversationId,
      title: r.title,
      summary: r.summary,
      relevance: r.score,
      messageCount: r.messageCount,
      lastMessageAt: new Date(r.lastMessageAt)
    }));
  } catch (error) {
    console.warn(`⚠️ [RETRIEVAL] Cross-conversation search failed:`, error);
    return [];
  }
}

/**
 * Update conversation context state in database
 * Tracks what's currently in context for debugging/monitoring
 */
export async function updateContextState(
  conversationId: string,
  userId: string,
  context: ConversationContext,
  query: string
): Promise<void> {

  try {
    await (prisma as any).conversationContextState?.upsert?.({
      where: { conversationId },
      create: {
        conversationId,
        userId,
        recentMessageIds: context.recentMessages.map((_, i) => `recent_${i}`),
        retrievedChunkIds: context.historicalChunks.map((_, i) => `chunk_${i}`),
        memoryIds: context.memories.map((_, i) => `memory_${i}`),
        totalTokens: context.tokenUsage.total,
        recentMessagesTokens: context.tokenUsage.recent,
        chunksTokens: context.tokenUsage.historical,
        memoriesTokens: context.tokenUsage.memories,
        documentsTokens: 0,
        lastQuery: query
      },
      update: {
        recentMessageIds: context.recentMessages.map((_, i) => `recent_${i}`),
        retrievedChunkIds: context.historicalChunks.map((_, i) => `chunk_${i}`),
        memoryIds: context.memories.map((_, i) => `memory_${i}`),
        totalTokens: context.tokenUsage.total,
        recentMessagesTokens: context.tokenUsage.recent,
        chunksTokens: context.tokenUsage.historical,
        memoriesTokens: context.tokenUsage.memories,
        lastQuery: query,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.warn(`⚠️ [RETRIEVAL] Could not update context state:`, error);
  }
}

/**
 * Get context statistics for monitoring
 */
export async function getContextStats(conversationId: string): Promise<{
  messageCount: number;
  chunkCount: number;
  lastChunkedAt: Date | null;
  needsChunking: boolean;
  contextState: any;
}> {

  const messageCount = await prisma.message.count({
    where: { conversationId }
  });

  let chunkCount = 0;
  let lastChunk: any = null;
  let contextState: any = null;

  try {
    chunkCount = await (prisma as any).conversationChunk?.count?.({
      where: { conversationId }
    }) || 0;

    lastChunk = await (prisma as any).conversationChunk?.findFirst?.({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });

    contextState = await (prisma as any).conversationContextState?.findUnique?.({
      where: { conversationId }
    });
  } catch (error) {
    // Tables may not exist
  }

  // Check if needs chunking (10+ messages since last chunk)
  let needsChunking = false;
  if (lastChunk) {
    const unchunkedCount = await prisma.message.count({
      where: {
        conversationId,
        createdAt: { gt: lastChunk.lastMessageAt }
      }
    });
    needsChunking = unchunkedCount >= 10;
  } else {
    needsChunking = messageCount >= 10;
  }

  return {
    messageCount,
    chunkCount,
    lastChunkedAt: lastChunk?.createdAt || null,
    needsChunking,
    contextState
  };
}

export default {
  getConversationContext,
  formatConversationContext,
  findConversationByQuery,
  updateContextState,
  getContextStats
};
