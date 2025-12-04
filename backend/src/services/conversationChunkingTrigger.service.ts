/**
 * Conversation Chunking Trigger Service
 *
 * PURPOSE: Automatically trigger chunking and embedding after every message save
 * WHY: Chunking must happen in real-time, not later, for context to be available
 * HOW: Called after message save, checks if chunking needed, embeds synchronously
 *
 * CRITICAL: This is what makes Koda remember forever like Manus
 *
 * USAGE:
 * ```typescript
 * import chunkingTrigger from './conversationChunkingTrigger.service';
 *
 * // After saving message:
 * await chunkingTrigger.triggerAfterMessage(conversationId, userId);
 * ```
 */

import { PrismaClient } from '@prisma/client';
import conversationChunking from './conversationChunking.service';
import conversationEmbedding from './conversationEmbedding.service';
import { INFINITE_MEMORY_CONFIG } from '../config/infinite-memory.config';

const prisma = new PrismaClient();

// Debounce map to prevent rapid re-chunking
const debounceMap = new Map<string, NodeJS.Timeout>();

/**
 * Trigger chunking after a message is saved
 *
 * CALLED FROM: saveMessageWithChunking helper or directly after prisma.message.create
 *
 * FLOW:
 * 1. Check if debounced (prevent rapid re-chunking)
 * 2. Check if conversation has enough messages
 * 3. Check if enough new messages since last chunk
 * 4. If yes: create chunks, embed synchronously
 * 5. Update conversation index
 */
export async function triggerAfterMessage(
  conversationId: string,
  userId: string
): Promise<void> {
  const config = INFINITE_MEMORY_CONFIG;

  // Skip if auto-chunking disabled
  if (!config.chunking.autoChunkOnSave) {
    return;
  }

  const logPrefix = config.logging.prefix;

  try {
    // Debounce check
    const existingTimeout = debounceMap.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new debounce timeout
    debounceMap.set(conversationId, setTimeout(async () => {
      debounceMap.delete(conversationId);
      await executeChunking(conversationId, userId);
    }, config.trigger.debounceMs));

    // Force execution after max wait (don't let debouncing block forever)
    setTimeout(async () => {
      const stillWaiting = debounceMap.has(conversationId);
      if (stillWaiting) {
        debounceMap.delete(conversationId);
        console.log(`${logPrefix} Max wait reached, forcing chunking`);
        await executeChunking(conversationId, userId);
      }
    }, config.trigger.maxWaitMs);

  } catch (error) {
    console.error(`${logPrefix} Trigger error:`, error);
    // Don't throw - chunking failures shouldn't break message saving
  }
}

/**
 * Execute the actual chunking logic
 */
async function executeChunking(
  conversationId: string,
  userId: string
): Promise<void> {
  const config = INFINITE_MEMORY_CONFIG;
  const logPrefix = config.logging.prefix;

  try {
    if (config.logging.logChunking) {
      console.log(`${logPrefix} Checking chunking for conversation ${conversationId}`);
    }

    // Get message count
    const messageCount = await prisma.message.count({
      where: { conversationId }
    });

    if (config.logging.verbose) {
      console.log(`${logPrefix} Conversation has ${messageCount} messages`);
    }

    // Check minimum messages
    if (messageCount < config.chunking.minMessagesForChunking) {
      if (config.logging.verbose) {
        console.log(`${logPrefix} Not enough messages (need ${config.chunking.minMessagesForChunking}), skipping`);
      }
      return;
    }

    // Check if we need to create a new chunk
    const lastChunk = await prisma.conversationChunk.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    });

    let shouldChunk = false;
    let reason = '';

    if (!lastChunk) {
      // No chunks yet - create first one
      shouldChunk = true;
      reason = 'No chunks exist yet';
    } else {
      // Count messages since last chunk
      const messagesSinceLastChunk = await prisma.message.count({
        where: {
          conversationId,
          createdAt: { gt: lastChunk.lastMessageAt }
        }
      });

      if (config.logging.verbose) {
        console.log(`${logPrefix} Messages since last chunk: ${messagesSinceLastChunk}`);
      }

      if (messagesSinceLastChunk >= config.chunking.messagesPerChunk) {
        shouldChunk = true;
        reason = `${messagesSinceLastChunk} new messages since last chunk`;
      }
    }

    if (!shouldChunk) {
      if (config.logging.verbose) {
        console.log(`${logPrefix} No chunking needed yet`);
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE CHUNKS
    // ═══════════════════════════════════════════════════════════════════════
    if (config.logging.logChunking) {
      console.log(`${logPrefix} Creating chunks (${reason})`);
    }

    const chunks = await conversationChunking.chunkNewMessages(conversationId, userId);

    if (chunks.length === 0) {
      if (config.logging.verbose) {
        console.log(`${logPrefix} No chunks created`);
      }
      return;
    }

    // Save chunks to database
    await conversationChunking.saveChunks(chunks);

    if (config.logging.logChunking) {
      console.log(`${logPrefix} Created ${chunks.length} chunks`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EMBED CHUNKS (SYNCHRONOUS - CRITICAL!)
    // ═══════════════════════════════════════════════════════════════════════
    if (config.embedding.synchronous) {
      if (config.logging.logEmbedding) {
        console.log(`${logPrefix} Embedding chunks synchronously...`);
      }

      const vectorIds = await conversationEmbedding.embedChunksBatch(chunks);

      if (config.logging.logEmbedding) {
        console.log(`${logPrefix} Embedded ${vectorIds.length}/${chunks.length} chunks`);
      }

      // Update conversation index
      try {
        await conversationEmbedding.embedConversationIndex(conversationId, userId);
        if (config.logging.logEmbedding) {
          console.log(`${logPrefix} Updated conversation index`);
        }
      } catch (indexError) {
        console.error(`${logPrefix} Failed to update conversation index:`, indexError);
      }
    } else {
      // Fire-and-forget (NOT RECOMMENDED - causes race conditions)
      console.warn(`${logPrefix} WARNING: Async embedding may cause context to be unavailable`);

      conversationEmbedding.embedChunksBatch(chunks)
        .then(vectorIds => {
          console.log(`${logPrefix} Async embedded ${vectorIds.length} chunks`);
          return conversationEmbedding.embedConversationIndex(conversationId, userId);
        })
        .catch(error => {
          console.error(`${logPrefix} Async embedding failed:`, error);
        });
    }

    if (config.logging.logChunking) {
      console.log(`${logPrefix} Chunking complete for conversation ${conversationId}`);
    }

  } catch (error) {
    console.error(`${logPrefix} Chunking execution error:`, error);
    // Don't throw - chunking failures shouldn't break the application
  }
}

/**
 * Manually trigger chunking for a conversation
 * Useful for:
 * - Backfilling existing conversations
 * - Debugging
 * - Admin operations
 */
export async function manualChunk(
  conversationId: string,
  userId: string
): Promise<{
  chunksCreated: number;
  chunksEmbedded: number;
}> {
  const config = INFINITE_MEMORY_CONFIG;
  const logPrefix = config.logging.prefix;

  console.log(`${logPrefix} Manual chunking for conversation ${conversationId}`);

  try {
    // Full conversation chunking (not incremental)
    const chunks = await conversationChunking.chunkConversation(conversationId, userId);

    if (chunks.length === 0) {
      console.log(`${logPrefix} No chunks to create`);
      return { chunksCreated: 0, chunksEmbedded: 0 };
    }

    // Save chunks
    await conversationChunking.saveChunks(chunks);
    console.log(`${logPrefix} Saved ${chunks.length} chunks`);

    // Embed chunks
    const vectorIds = await conversationEmbedding.embedChunksBatch(chunks);
    console.log(`${logPrefix} Embedded ${vectorIds.length} chunks`);

    // Update conversation index
    await conversationEmbedding.embedConversationIndex(conversationId, userId);
    console.log(`${logPrefix} Updated conversation index`);

    return {
      chunksCreated: chunks.length,
      chunksEmbedded: vectorIds.length
    };

  } catch (error) {
    console.error(`${logPrefix} Manual chunking failed:`, error);
    throw error;
  }
}

/**
 * Backfill all conversations for a user
 */
export async function backfillUser(userId: string): Promise<{
  conversationsProcessed: number;
  totalChunks: number;
  totalEmbeddings: number;
  errors: string[];
}> {
  const config = INFINITE_MEMORY_CONFIG;
  const logPrefix = config.logging.prefix;

  console.log(`${logPrefix} Backfilling all conversations for user ${userId}`);

  const conversations = await prisma.conversation.findMany({
    where: { userId },
    select: { id: true }
  });

  console.log(`${logPrefix} Found ${conversations.length} conversations`);

  let totalChunks = 0;
  let totalEmbeddings = 0;
  const errors: string[] = [];

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];

    try {
      const result = await manualChunk(conv.id, userId);
      totalChunks += result.chunksCreated;
      totalEmbeddings += result.chunksEmbedded;

      if ((i + 1) % 10 === 0) {
        console.log(`${logPrefix} Progress: ${i + 1}/${conversations.length}`);
      }
    } catch (error: any) {
      errors.push(`${conv.id}: ${error.message}`);
    }
  }

  console.log(`${logPrefix} Backfill complete:`);
  console.log(`   Conversations: ${conversations.length}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Total embeddings: ${totalEmbeddings}`);
  console.log(`   Errors: ${errors.length}`);

  return {
    conversationsProcessed: conversations.length,
    totalChunks,
    totalEmbeddings,
    errors
  };
}

/**
 * Backfill all conversations in the system
 */
export async function backfillAll(): Promise<{
  usersProcessed: number;
  conversationsProcessed: number;
  totalChunks: number;
  totalEmbeddings: number;
  errors: string[];
}> {
  const config = INFINITE_MEMORY_CONFIG;
  const logPrefix = config.logging.prefix;

  console.log(`${logPrefix} Backfilling ALL conversations in system`);

  // Get all users with conversations
  const users = await prisma.user.findMany({
    where: {
      conversations: {
        some: {}
      }
    },
    select: { id: true }
  });

  console.log(`${logPrefix} Found ${users.length} users with conversations`);

  let totalConversations = 0;
  let totalChunks = 0;
  let totalEmbeddings = 0;
  const allErrors: string[] = [];

  for (const user of users) {
    const result = await backfillUser(user.id);
    totalConversations += result.conversationsProcessed;
    totalChunks += result.totalChunks;
    totalEmbeddings += result.totalEmbeddings;
    allErrors.push(...result.errors);
  }

  console.log(`${logPrefix} Full backfill complete:`);
  console.log(`   Users: ${users.length}`);
  console.log(`   Conversations: ${totalConversations}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Total embeddings: ${totalEmbeddings}`);
  console.log(`   Errors: ${allErrors.length}`);

  return {
    usersProcessed: users.length,
    conversationsProcessed: totalConversations,
    totalChunks,
    totalEmbeddings,
    errors: allErrors
  };
}

/**
 * Get chunking status for a conversation
 */
export async function getStatus(conversationId: string): Promise<{
  messageCount: number;
  chunkCount: number;
  lastChunkAt: Date | null;
  needsChunking: boolean;
  messagesUntilNextChunk: number;
}> {
  const config = INFINITE_MEMORY_CONFIG;

  const messageCount = await prisma.message.count({
    where: { conversationId }
  });

  const chunkCount = await prisma.conversationChunk.count({
    where: { conversationId }
  });

  const lastChunk = await prisma.conversationChunk.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' }
  });

  let messagesSinceLastChunk = messageCount;
  if (lastChunk) {
    messagesSinceLastChunk = await prisma.message.count({
      where: {
        conversationId,
        createdAt: { gt: lastChunk.lastMessageAt }
      }
    });
  }

  const needsChunking = messagesSinceLastChunk >= config.chunking.messagesPerChunk;
  const messagesUntilNextChunk = Math.max(0, config.chunking.messagesPerChunk - messagesSinceLastChunk);

  return {
    messageCount,
    chunkCount,
    lastChunkAt: lastChunk?.createdAt || null,
    needsChunking,
    messagesUntilNextChunk
  };
}

export default {
  triggerAfterMessage,
  manualChunk,
  backfillUser,
  backfillAll,
  getStatus
};
