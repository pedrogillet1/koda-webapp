/**
 * Conversation Manager Service
 *
 * Centralized service for managing conversation lifecycle with:
 * - Redis caching for fast retrieval
 * - Prisma persistence for long-term history
 * - Auto-summarization to keep context window efficient
 *
 * This service gives Koda persistent memory across interactions.
 */

import { Conversation, Message } from '@prisma/client';
import { redisConnection } from '../config/redis';
import { llmProvider } from './llm.provider';
import prisma from '../config/database';

const CONVERSATION_CACHE_TTL = 3600; // Cache for 1 hour (in seconds)
const SUMMARIZE_THRESHOLD = 8; // Summarize after 8 messages (4 user, 4 AI turns)
const MAX_RECENT_MESSAGES = 10; // Keep last 10 messages in prompt

type ConversationState = Conversation & { messages: Message[] };

class ConversationManager {
  /**
   * Get conversation state from cache or database
   */
  async getConversationState(conversationId: string): Promise<ConversationState | null> {
    // Try to get from Redis cache first
    if (redisConnection) {
      try {
        const cachedConversation = await redisConnection.get(`conversation:${conversationId}`);
        if (cachedConversation) {
          console.log(`📦 [ConversationManager] Cache HIT for conversation: ${conversationId}`);
          // Handle both string and object responses from Upstash
          if (typeof cachedConversation === 'string') {
            return JSON.parse(cachedConversation);
          }
          return cachedConversation as ConversationState;
        }
      } catch (error) {
        console.warn(`⚠️ [ConversationManager] Redis cache read failed:`, error);
      }
    }

    // Fallback to database
    console.log(`💾 [ConversationManager] Cache MISS, fetching from database: ${conversationId}`);
    const dbConversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (dbConversation) {
      // Cache the result for future requests
      await this.cacheConversation(conversationId, dbConversation);
    }

    return dbConversation;
  }

  /**
   * Cache conversation state in Redis
   */
  private async cacheConversation(
    conversationId: string,
    conversation: ConversationState
  ): Promise<void> {
    if (!redisConnection) return;

    try {
      await redisConnection.set(
        `conversation:${conversationId}`,
        JSON.stringify(conversation),
        { ex: CONVERSATION_CACHE_TTL }
      );
      console.log(`📦 [ConversationManager] Cached conversation: ${conversationId}`);
    } catch (error) {
      console.warn(`⚠️ [ConversationManager] Redis cache write failed:`, error);
    }
  }

  /**
   * Invalidate conversation cache
   */
  async invalidateCache(conversationId: string): Promise<void> {
    if (!redisConnection) return;

    try {
      await redisConnection.del(`conversation:${conversationId}`);
      console.log(`🗑️ [ConversationManager] Invalidated cache for: ${conversationId}`);
    } catch (error) {
      console.warn(`⚠️ [ConversationManager] Redis cache invalidation failed:`, error);
    }
  }

  /**
   * Create a new conversation with first message
   */
  async createConversation(userId: string, firstMessage: string): Promise<ConversationState> {
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        title: this.generateTitleFromMessage(firstMessage),
        messages: {
          create: { role: 'user', content: firstMessage },
        },
      },
      include: { messages: true },
    });

    await this.cacheConversation(conversation.id, conversation);
    console.log(`✨ [ConversationManager] Created conversation: ${conversation.id}`);

    return conversation;
  }

  /**
   * Add a message to an existing conversation
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<ConversationState> {
    // Create the message in database
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

    // Get updated conversation state
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Check if we need to summarize
    if (conversation.messages.length > 0 && conversation.messages.length % SUMMARIZE_THRESHOLD === 0) {
      console.log(`📝 [ConversationManager] Triggering auto-summarization for: ${conversationId}`);
      await this.summarizeConversation(conversationId, conversation);
    }

    // Update cache
    await this.cacheConversation(conversationId, conversation);

    return conversation;
  }

  /**
   * Summarize conversation to keep context window small
   */
  private async summarizeConversation(
    conversationId: string,
    state: ConversationState
  ): Promise<void> {
    try {
      // Build history for summarization
      const history = state.messages
        .map((m) => `${m.role === 'user' ? 'User' : 'Koda'}: ${m.content}`)
        .join('\n\n');

      const summaryPrompt = `Summarize the following conversation in 3-4 sentences.
Retain key information including:
- Main topics discussed
- User's goals or questions
- Key entities mentioned (names, files, dates)
- Any decisions or conclusions reached

Conversation:
${history}

Summary:`;

      const response = await llmProvider.createChatCompletion({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.2,
      });

      const summary = response.choices[0].message.content;

      // Update conversation with summary
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          // Store summary in contextMeta JSON field
          contextMeta: {
            summary,
            summarizedAt: new Date().toISOString(),
            messageCountAtSummary: state.messages.length,
          },
        },
      });

      console.log(`✅ [ConversationManager] Summarized conversation: ${conversationId}`);
    } catch (error) {
      console.error(`❌ [ConversationManager] Summarization failed:`, error);
      // Don't throw - summarization failure shouldn't break the conversation
    }
  }

  /**
   * Build prompt with conversation context
   * Includes summary (if available) and recent messages
   */
  buildPromptWithContext(
    systemPrompt: string,
    state: ConversationState | null
  ): Array<{ role: 'system' | 'user' | 'model'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'model'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (!state) {
      return messages;
    }

    // Add summary context if available
    const contextMeta = state.contextMeta as { summary?: string } | null;
    if (contextMeta?.summary) {
      messages.push({
        role: 'system',
        content: `Previous conversation context: ${contextMeta.summary}`,
      });
    }

    // Add recent messages (limited to keep prompt size manageable)
    const recentMessages = state.messages.slice(-MAX_RECENT_MESSAGES);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content,
      });
    }

    return messages;
  }

  /**
   * Get conversation context for RAG queries
   * Returns a condensed context string suitable for embedding in prompts
   */
  async getConversationContext(conversationId: string): Promise<string> {
    const state = await this.getConversationState(conversationId);

    if (!state || state.messages.length === 0) {
      return '';
    }

    // Build context string
    const parts: string[] = [];

    // Add summary if available
    const contextMeta = state.contextMeta as { summary?: string } | null;
    if (contextMeta?.summary) {
      parts.push(`Previous context: ${contextMeta.summary}`);
    }

    // Add recent messages (last 4 turns = 8 messages)
    const recentMessages = state.messages.slice(-8);
    if (recentMessages.length > 0) {
      const historyStr = recentMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Koda'}: ${m.content.substring(0, 200)}`)
        .join('\n');
      parts.push(`Recent conversation:\n${historyStr}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Get the last N messages from a conversation
   */
  async getRecentMessages(conversationId: string, count: number = 10): Promise<Message[]> {
    const state = await this.getConversationState(conversationId);
    if (!state) {
      return [];
    }
    return state.messages.slice(-count);
  }

  /**
   * Get the last user message from a conversation
   */
  async getLastUserMessage(conversationId: string): Promise<Message | null> {
    const state = await this.getConversationState(conversationId);
    if (!state) {
      return null;
    }

    // Find last user message
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'user') {
        return state.messages[i];
      }
    }

    return null;
  }

  /**
   * Update conversation title
   */
  async updateTitle(conversationId: string, title: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });

    // Invalidate cache so next read gets updated title
    await this.invalidateCache(conversationId);
  }

  /**
   * Generate a short title from the first message
   */
  private generateTitleFromMessage(message: string): string {
    // Take first 50 characters and clean up
    const title = message.substring(0, 50).trim();
    if (message.length > 50) {
      return title + '...';
    }
    return title || 'New Chat';
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    await this.invalidateCache(conversationId);
    console.log(`🗑️ [ConversationManager] Deleted conversation: ${conversationId}`);
  }

  /**
   * Get all conversations for a user (paginated)
   */
  async getUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Conversation[]> {
    return prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Check if a conversation belongs to a user
   */
  async isOwner(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    return conversation?.userId === userId;
  }
}

export const conversationManager = new ConversationManager();
