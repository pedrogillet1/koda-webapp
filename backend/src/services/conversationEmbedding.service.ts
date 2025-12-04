/**
 * Conversation Embedding Service
 *
 * PURPOSE: Generate and store embeddings for conversation chunks
 * WHY: Enable semantic search across conversation history
 * HOW: Use OpenAI text-embedding-3-small (1536 dimensions) → Store in Pinecone
 *
 * MANUS-STYLE ARCHITECTURE:
 * - Separate Pinecone namespace for conversations
 * - Chunk-level embeddings (not message-level)
 * - Conversation-level embeddings for cross-chat search
 * - Metadata for filtering and ranking
 *
 * ✅ Uses OpenAI embeddings for consistency with existing Pinecone index (1536 dims)
 */

import { PrismaClient } from '@prisma/client';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConversationChunkData } from './conversationChunking.service';
import embeddingService from './embedding.service';

const prisma = new PrismaClient();
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// Pinecone configuration
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'koda-production';
const CONVERSATION_NAMESPACE = 'conversations';
const CONVERSATION_INDEX_NAMESPACE = 'conversation-index';

// Embedding model identifier (for database records)
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Generate embedding for text using OpenAI (via embedding.service)
 * Returns 1536-dimensional vector compatible with existing Pinecone index
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await embeddingService.generateEmbedding(text);
    return result.embedding;
  } catch (error) {
    console.error(`⚠️ [EMBEDDING] Failed to generate embedding:`, error);
    throw error;
  }
}

/**
 * Embed conversation chunk and store in Pinecone
 */
export async function embedConversationChunk(
  chunk: ConversationChunkData
): Promise<string> {

  console.log(`🔢 [EMBEDDING] Embedding chunk for conversation ${chunk.conversationId}`);

  // Generate embedding for chunk content
  const embedding = await generateEmbedding(chunk.summary + '\n\n' + chunk.content.substring(0, 2000));

  // Create vector ID
  const vectorId = `conv_chunk_${chunk.conversationId}_${chunk.startMessageId}`;

  // Prepare metadata for Pinecone
  const metadata = {
    conversationId: chunk.conversationId,
    userId: chunk.userId,
    startMessageId: chunk.startMessageId,
    endMessageId: chunk.endMessageId,
    messageCount: chunk.messageCount,
    summary: chunk.summary.substring(0, 500), // Pinecone metadata limit
    topics: chunk.topics.join(', '),
    entities: chunk.entities.join(', '),
    keywords: chunk.keywords.join(', '),
    importance: chunk.importance,
    coherence: chunk.coherence,
    firstMessageAt: chunk.firstMessageAt.toISOString(),
    lastMessageAt: chunk.lastMessageAt.toISOString(),
    type: 'conversation_chunk'
  };

  // Store in Pinecone
  const index = pinecone.index(PINECONE_INDEX_NAME);
  await index.namespace(CONVERSATION_NAMESPACE).upsert([
    {
      id: vectorId,
      values: embedding,
      metadata
    }
  ]);

  console.log(`🔢 [EMBEDDING] Stored chunk embedding: ${vectorId}`);

  // Update database with vector ID
  await prisma.conversationChunk.updateMany({
    where: {
      conversationId: chunk.conversationId,
      startMessageId: chunk.startMessageId
    },
    data: {
      vectorId,
      embeddingModel: EMBEDDING_MODEL
    }
  });

  return vectorId;
}

/**
 * Embed multiple chunks in batch
 */
export async function embedChunksBatch(chunks: ConversationChunkData[]): Promise<string[]> {
  console.log(`🔢 [EMBEDDING] Batch embedding ${chunks.length} chunks`);

  const vectorIds: string[] = [];

  for (const chunk of chunks) {
    try {
      const vectorId = await embedConversationChunk(chunk);
      vectorIds.push(vectorId);
    } catch (error) {
      console.error(`⚠️ [EMBEDDING] Failed to embed chunk:`, error);
    }
  }

  console.log(`🔢 [EMBEDDING] Successfully embedded ${vectorIds.length}/${chunks.length} chunks`);
  return vectorIds;
}

/**
 * Generate conversation-level embedding for cross-chat search
 */
export async function embedConversationIndex(
  conversationId: string,
  userId: string
): Promise<string> {

  console.log(`🔢 [EMBEDDING] Creating conversation index for ${conversationId}`);

  // Get conversation metadata
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50 // Sample first 50 messages for summary
      }
    }
  });

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  // Get all chunks for this conversation
  const chunks = await prisma.conversationChunk.findMany({
    where: { conversationId },
    orderBy: { firstMessageAt: 'asc' }
  });

  // Create conversation summary
  const summaryText = chunks.length > 0
    ? chunks.map(c => c.summary).join('\n')
    : conversation.messages.map(m => `${m.role}: ${m.content.substring(0, 100)}`).join('\n');

  // Extract topics and entities from chunks
  const allTopics = new Set<string>();
  const allEntities = new Set<string>();
  const allKeywords = new Set<string>();

  chunks.forEach(chunk => {
    chunk.topics.forEach(t => allTopics.add(t));
    chunk.entities.forEach(e => allEntities.add(e));
    chunk.keywords.forEach(k => allKeywords.add(k));
  });

  // Generate embedding for conversation
  const embeddingText = `${conversation.title}\n\n${summaryText.substring(0, 3000)}`;
  const embedding = await generateEmbedding(embeddingText);

  // Create vector ID
  const vectorId = `conv_index_${conversationId}`;

  // Prepare metadata
  const metadata = {
    conversationId,
    userId,
    title: conversation.title,
    summary: summaryText.substring(0, 500),
    mainTopics: Array.from(allTopics).slice(0, 10).join(', '),
    keyEntities: Array.from(allEntities).slice(0, 10).join(', '),
    keywords: Array.from(allKeywords).slice(0, 20).join(', '),
    messageCount: conversation.messages.length,
    chunkCount: chunks.length,
    firstMessageAt: conversation.createdAt.toISOString(),
    lastMessageAt: conversation.updatedAt.toISOString(),
    type: 'conversation_index'
  };

  // Store in Pinecone
  const index = pinecone.index(PINECONE_INDEX_NAME);
  await index.namespace(CONVERSATION_INDEX_NAMESPACE).upsert([
    {
      id: vectorId,
      values: embedding,
      metadata
    }
  ]);

  console.log(`🔢 [EMBEDDING] Stored conversation index: ${vectorId}`);

  // Save or update conversation index in database
  await prisma.conversationIndex.upsert({
    where: { conversationId },
    create: {
      conversationId,
      userId,
      title: conversation.title,
      summary: summaryText.substring(0, 1000),
      mainTopics: Array.from(allTopics).slice(0, 10),
      keyEntities: Array.from(allEntities).slice(0, 10),
      keywords: Array.from(allKeywords).slice(0, 20),
      messageCount: conversation.messages.length,
      chunkCount: chunks.length,
      firstMessageAt: conversation.createdAt,
      lastMessageAt: conversation.updatedAt,
      vectorId,
      embeddingModel: EMBEDDING_MODEL
    },
    update: {
      summary: summaryText.substring(0, 1000),
      mainTopics: Array.from(allTopics).slice(0, 10),
      keyEntities: Array.from(allEntities).slice(0, 10),
      keywords: Array.from(allKeywords).slice(0, 20),
      messageCount: conversation.messages.length,
      chunkCount: chunks.length,
      lastMessageAt: conversation.updatedAt,
      vectorId
    }
  });

  return vectorId;
}

/**
 * Search conversation chunks semantically
 */
export async function searchConversationChunks(
  query: string,
  options: {
    conversationId?: string;
    userId?: string;
    topK?: number;
    minScore?: number;
  } = {}
): Promise<Array<{
  chunkId: string;
  conversationId: string;
  summary: string;
  score: number;
  metadata: any;
}>> {

  const { conversationId, userId, topK = 5, minScore = 0.7 } = options;

  console.log(`🔍 [EMBEDDING] Searching chunks for query: "${query.substring(0, 50)}..."`);
  console.log(`   Filters: conversationId=${conversationId}, userId=${userId}`);

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Build filter
  const filter: any = {};
  if (conversationId) {
    filter.conversationId = conversationId;
  }
  if (userId) {
    filter.userId = userId;
  }

  // Search Pinecone
  const index = pinecone.index(PINECONE_INDEX_NAME);
  const searchResults = await index.namespace(CONVERSATION_NAMESPACE).query({
    vector: queryEmbedding,
    topK,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
    includeMetadata: true
  });

  // Filter by score and format results
  const results = searchResults.matches
    .filter(match => match.score && match.score >= minScore)
    .map(match => ({
      chunkId: match.id,
      conversationId: match.metadata?.conversationId as string,
      summary: match.metadata?.summary as string,
      score: match.score || 0,
      metadata: match.metadata
    }));

  console.log(`🔍 [EMBEDDING] Found ${results.length} relevant chunks (score >= ${minScore})`);

  return results;
}

/**
 * Search across all conversations (cross-chat search)
 */
export async function searchConversations(
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
  score: number;
  messageCount: number;
  lastMessageAt: string;
}>> {

  const { topK = 5, minScore = 0.7 } = options;

  console.log(`🔍 [EMBEDDING] Cross-conversation search for user ${userId}`);
  console.log(`   Query: "${query.substring(0, 50)}..."`);

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Search conversation indexes
  const index = pinecone.index(PINECONE_INDEX_NAME);
  const searchResults = await index.namespace(CONVERSATION_INDEX_NAMESPACE).query({
    vector: queryEmbedding,
    topK,
    filter: { userId },
    includeMetadata: true
  });

  // Filter and format results
  const results = searchResults.matches
    .filter(match => match.score && match.score >= minScore)
    .map(match => ({
      conversationId: match.metadata?.conversationId as string,
      title: match.metadata?.title as string,
      summary: match.metadata?.summary as string,
      score: match.score || 0,
      messageCount: match.metadata?.messageCount as number,
      lastMessageAt: match.metadata?.lastMessageAt as string
    }));

  console.log(`🔍 [EMBEDDING] Found ${results.length} relevant conversations`);

  return results;
}

/**
 * Delete conversation embeddings from Pinecone
 */
export async function deleteConversationEmbeddings(conversationId: string): Promise<void> {
  console.log(`🗑️ [EMBEDDING] Deleting embeddings for conversation ${conversationId}`);

  const index = pinecone.index(PINECONE_INDEX_NAME);

  // Get all chunk IDs for this conversation
  const chunks = await prisma.conversationChunk.findMany({
    where: { conversationId },
    select: { vectorId: true }
  });

  const vectorIds = chunks
    .filter(c => c.vectorId)
    .map(c => c.vectorId as string);

  // Delete chunks in batches
  if (vectorIds.length > 0) {
    await index.namespace(CONVERSATION_NAMESPACE).deleteMany(vectorIds);
  }

  // Delete conversation index
  const indexVectorId = `conv_index_${conversationId}`;
  try {
    await index.namespace(CONVERSATION_INDEX_NAMESPACE).deleteOne(indexVectorId);
  } catch (error) {
    // Ignore if doesn't exist
  }

  console.log(`🗑️ [EMBEDDING] Deleted ${vectorIds.length} chunk embeddings and conversation index`);
}

export default {
  embedConversationChunk,
  embedChunksBatch,
  embedConversationIndex,
  searchConversationChunks,
  searchConversations,
  deleteConversationEmbeddings
};
