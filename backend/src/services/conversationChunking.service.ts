/**
 * Conversation Chunking Service
 *
 * PURPOSE: Break conversations into semantic chunks for embedding and retrieval
 * WHY: Can't embed 1000-message conversation at once - need manageable pieces
 * HOW: Group messages by topic shifts, time gaps, or fixed size (10-15 messages)
 *
 * MANUS-STYLE ARCHITECTURE:
 * - Semantic chunking (detect topic shifts)
 * - Extract topics, entities, keywords
 * - Generate summaries for each chunk
 * - Prepare for embedding
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface MessageForChunking {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface ConversationChunkData {
  conversationId: string;
  userId: string;
  startMessageId: string;
  endMessageId: string;
  messageCount: number;
  content: string;
  summary: string;
  topics: string[];
  entities: string[];
  keywords: string[];
  importance: number;
  coherence: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
}

/**
 * Chunk a conversation into semantic segments
 *
 * STRATEGY:
 * 1. Get all messages in conversation
 * 2. Detect topic shifts using AI
 * 3. Group messages into chunks (10-15 messages or topic boundary)
 * 4. Generate summary for each chunk
 * 5. Extract topics, entities, keywords
 * 6. Calculate importance and coherence scores
 */
export async function chunkConversation(
  conversationId: string,
  userId: string,
  options: {
    maxMessagesPerChunk?: number;
    minMessagesPerChunk?: number;
    useSemanticBoundaries?: boolean;
  } = {}
): Promise<ConversationChunkData[]> {

  const {
    maxMessagesPerChunk = 15,
    minMessagesPerChunk = 5,
    useSemanticBoundaries = true
  } = options;

  console.log(`📦 [CHUNKING] Starting conversation chunking for ${conversationId}`);
  console.log(`   Max messages per chunk: ${maxMessagesPerChunk}`);
  console.log(`   Semantic boundaries: ${useSemanticBoundaries}`);

  // Get all messages in conversation
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true
    }
  });

  if (messages.length === 0) {
    console.log(`📦 [CHUNKING] No messages found`);
    return [];
  }

  console.log(`📦 [CHUNKING] Found ${messages.length} messages`);

  // Detect topic boundaries if enabled
  let topicBoundaries: number[] = [];
  if (useSemanticBoundaries && messages.length >= minMessagesPerChunk) {
    topicBoundaries = await detectTopicBoundaries(messages);
    console.log(`📦 [CHUNKING] Detected ${topicBoundaries.length} topic boundaries`);
  }

  // Create chunks
  const chunks: ConversationChunkData[] = [];
  let currentChunkStart = 0;

  while (currentChunkStart < messages.length) {
    // Determine chunk end
    let chunkEnd = currentChunkStart + maxMessagesPerChunk;

    // Adjust to topic boundary if close
    if (useSemanticBoundaries) {
      const nearbyBoundary = topicBoundaries.find(
        b => b > currentChunkStart && b <= chunkEnd && b >= currentChunkStart + minMessagesPerChunk
      );
      if (nearbyBoundary) {
        chunkEnd = nearbyBoundary;
      }
    }

    // Don't exceed message count
    chunkEnd = Math.min(chunkEnd, messages.length);

    // Extract messages for this chunk
    const chunkMessages = messages.slice(currentChunkStart, chunkEnd);

    if (chunkMessages.length >= minMessagesPerChunk || chunkEnd === messages.length) {
      // Create chunk data
      const chunkData = await createChunkData(
        conversationId,
        userId,
        chunkMessages
      );

      chunks.push(chunkData);
      console.log(`📦 [CHUNKING] Created chunk ${chunks.length}: ${chunkMessages.length} messages, topics: ${chunkData.topics.join(', ')}`);
    }

    currentChunkStart = chunkEnd;
  }

  console.log(`📦 [CHUNKING] Created ${chunks.length} chunks total`);
  return chunks;
}

/**
 * Detect topic boundaries in conversation using AI
 * Returns array of message indices where topics shift
 */
async function detectTopicBoundaries(messages: MessageForChunking[]): Promise<number[]> {
  // For very short conversations, no boundaries needed
  if (messages.length < 10) {
    return [];
  }

  // Sample messages for topic detection (every 5th message to reduce cost)
  const sampledMessages = messages.filter((_, i) => i % 5 === 0 || i === messages.length - 1);

  const conversationText = sampledMessages.map((m, i) =>
    `[${i}] ${m.role}: ${m.content.substring(0, 200)}`
  ).join('\n\n');

  const prompt = `Analyze this conversation and identify where the topic shifts significantly.

Conversation:
${conversationText}

Return ONLY a JSON array of message indices where topic boundaries occur.
Example: [15, 32, 48]

If no clear topic shifts, return empty array: []

Topic boundaries should indicate:
- Change from one subject to another
- Shift in conversation focus
- New question or task started

JSON array:`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Remove markdown code blocks if present (e.g., ```json ... ```)
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Parse JSON array
    const boundaries = JSON.parse(text);

    // Convert sampled indices back to original indices
    const actualBoundaries = boundaries.map((sampledIdx: number) => sampledIdx * 5);

    return actualBoundaries.filter((idx: number) => idx > 0 && idx < messages.length);
  } catch (error) {
    console.error(`⚠️ [CHUNKING] Topic boundary detection failed:`, error);
    return [];
  }
}

/**
 * Create chunk data with summary, topics, entities, keywords
 */
async function createChunkData(
  conversationId: string,
  userId: string,
  messages: MessageForChunking[]
): Promise<ConversationChunkData> {

  // Combine messages into content
  const content = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');

  // Generate summary and extract metadata using AI
  const metadata = await extractChunkMetadata(content);

  return {
    conversationId,
    userId,
    startMessageId: messages[0].id,
    endMessageId: messages[messages.length - 1].id,
    messageCount: messages.length,
    content,
    summary: metadata.summary,
    topics: metadata.topics,
    entities: metadata.entities,
    keywords: metadata.keywords,
    importance: metadata.importance,
    coherence: metadata.coherence,
    firstMessageAt: messages[0].createdAt,
    lastMessageAt: messages[messages.length - 1].createdAt
  };
}

/**
 * Extract metadata from chunk using AI
 */
async function extractChunkMetadata(content: string): Promise<{
  summary: string;
  topics: string[];
  entities: string[];
  keywords: string[];
  importance: number;
  coherence: number;
}> {

  const prompt = `Analyze this conversation chunk and extract metadata.

Conversation:
${content.substring(0, 3000)}

Provide:
1. summary: Brief 1-2 sentence summary
2. topics: Array of main topics discussed (e.g., ["budget analysis", "Q4 revenue"])
3. entities: Array of named entities (files, people, companies, dates)
4. keywords: Array of searchable keywords (5-10 words)
5. importance: Score 0-1 (how important is this chunk)
6. coherence: Score 0-1 (how focused/coherent is the topic)

Return ONLY valid JSON:
{
  "summary": "...",
  "topics": [...],
  "entities": [...],
  "keywords": [...],
  "importance": 0.7,
  "coherence": 0.8
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const metadata = JSON.parse(text);

    return {
      summary: metadata.summary || 'Conversation chunk',
      topics: Array.isArray(metadata.topics) ? metadata.topics : [],
      entities: Array.isArray(metadata.entities) ? metadata.entities : [],
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
      importance: typeof metadata.importance === 'number' ? metadata.importance : 0.5,
      coherence: typeof metadata.coherence === 'number' ? metadata.coherence : 0.5
    };
  } catch (error) {
    console.error(`⚠️ [CHUNKING] Metadata extraction failed:`, error);

    // Fallback: Extract keywords using simple heuristics
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();

    words.forEach(word => {
      if (word.length > 4) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    const keywords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return {
      summary: content.substring(0, 200) + '...',
      topics: [],
      entities: [],
      keywords,
      importance: 0.5,
      coherence: 0.5
    };
  }
}

/**
 * Save chunks to database
 */
export async function saveChunks(chunks: ConversationChunkData[]): Promise<void> {
  console.log(`💾 [CHUNKING] Saving ${chunks.length} chunks to database`);

  for (const chunk of chunks) {
    await prisma.conversationChunk.create({
      data: {
        conversationId: chunk.conversationId,
        userId: chunk.userId,
        startMessageId: chunk.startMessageId,
        endMessageId: chunk.endMessageId,
        messageCount: chunk.messageCount,
        content: chunk.content,
        summary: chunk.summary,
        topics: chunk.topics,
        entities: chunk.entities,
        keywords: chunk.keywords,
        importance: chunk.importance,
        coherence: chunk.coherence,
        firstMessageAt: chunk.firstMessageAt,
        lastMessageAt: chunk.lastMessageAt
      }
    });
  }

  console.log(`💾 [CHUNKING] Saved ${chunks.length} chunks successfully`);
}

/**
 * Check if conversation needs chunking
 * Returns true if there are unchunked messages
 */
export async function needsChunking(conversationId: string): Promise<boolean> {
  // Get total message count
  const messageCount = await prisma.message.count({
    where: { conversationId }
  });

  // Get existing chunks
  const existingChunks = await prisma.conversationChunk.findMany({
    where: { conversationId },
    select: { endMessageId: true }
  });

  if (existingChunks.length === 0) {
    // No chunks yet - need chunking if 4+ messages (lowered from 10 for faster context)
    return messageCount >= 4;
  }

  // Get last chunked message
  const lastChunkedMessage = await prisma.message.findFirst({
    where: {
      conversationId,
      id: { in: existingChunks.map(c => c.endMessageId) }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!lastChunkedMessage) {
    return messageCount >= 4;
  }

  // Count messages after last chunk
  const unchunkedCount = await prisma.message.count({
    where: {
      conversationId,
      createdAt: { gt: lastChunkedMessage.createdAt }
    }
  });

  // Need chunking if 4+ new messages (lowered from 10 for faster context)
  return unchunkedCount >= 4;
}

/**
 * Chunk new messages in conversation (incremental chunking)
 */
export async function chunkNewMessages(
  conversationId: string,
  userId: string
): Promise<ConversationChunkData[]> {

  console.log(`📦 [CHUNKING] Incremental chunking for ${conversationId}`);

  // Get last chunk
  const lastChunk = await prisma.conversationChunk.findFirst({
    where: { conversationId },
    orderBy: { lastMessageAt: 'desc' }
  });

  // Get new messages
  const newMessages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(lastChunk && { createdAt: { gt: lastChunk.lastMessageAt } })
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true
    }
  });

  if (newMessages.length < 4) {
    console.log(`📦 [CHUNKING] Only ${newMessages.length} new messages, skipping (need 4+)`);
    return [];
  }

  console.log(`📦 [CHUNKING] Found ${newMessages.length} new messages to chunk`);

  // Chunk new messages
  const chunks: ConversationChunkData[] = [];
  let currentStart = 0;

  while (currentStart < newMessages.length) {
    const chunkEnd = Math.min(currentStart + 15, newMessages.length);
    const chunkMessages = newMessages.slice(currentStart, chunkEnd);

    if (chunkMessages.length >= 5 || chunkEnd === newMessages.length) {
      const chunkData = await createChunkData(
        conversationId,
        userId,
        chunkMessages
      );
      chunks.push(chunkData);
    }

    currentStart = chunkEnd;
  }

  return chunks;
}

export default {
  chunkConversation,
  saveChunks,
  needsChunking,
  chunkNewMessages
};
