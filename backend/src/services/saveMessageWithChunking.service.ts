/**
 * Save Message With Chunking Service
 *
 * PURPOSE: Centralized helper for saving messages AND triggering infinite memory chunking
 * WHY: There are 20+ places in rag.controller.ts that save messages - need one function
 * HOW: Wraps prisma.message.create + calls chunkingTrigger.triggerAfterMessage
 *
 * USAGE:
 * ```typescript
 * import { saveUserMessage, saveAssistantMessage, saveMessagePair } from './saveMessageWithChunking.service';
 *
 * // Save user message
 * const userMsg = await saveUserMessage(conversationId, userId, query, metadata);
 *
 * // Save assistant message
 * const assistantMsg = await saveAssistantMessage(conversationId, userId, answer, metadata);
 *
 * // Save both at once (most common)
 * const { userMessage, assistantMessage } = await saveMessagePair(
 *   conversationId, userId, query, answer, userMetadata, assistantMetadata
 * );
 * ```
 */

import { PrismaClient } from '@prisma/client';
import chunkingTrigger from './conversationChunkingTrigger.service';

const prisma = new PrismaClient();

export interface SavedMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  metadata: string | null;
  createdAt: Date;
}

/**
 * Save a user message and trigger chunking
 */
export async function saveUserMessage(
  conversationId: string,
  userId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<SavedMessage> {

  const message = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });

  // Trigger chunking (non-blocking, debounced)
  chunkingTrigger.triggerAfterMessage(conversationId, userId).catch(err => {
    console.error('♾️ [SAVE MESSAGE] Chunking trigger error:', err);
  });

  return message as SavedMessage;
}

/**
 * Save an assistant message and trigger chunking
 */
export async function saveAssistantMessage(
  conversationId: string,
  userId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<SavedMessage> {

  const message = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });

  // Trigger chunking (non-blocking, debounced)
  chunkingTrigger.triggerAfterMessage(conversationId, userId).catch(err => {
    console.error('♾️ [SAVE MESSAGE] Chunking trigger error:', err);
  });

  return message as SavedMessage;
}

/**
 * Save both user and assistant messages (most common pattern)
 * Updates conversation timestamp after both saves
 */
export async function saveMessagePair(
  conversationId: string,
  userId: string,
  userContent: string,
  assistantContent: string,
  userMetadata?: Record<string, any>,
  assistantMetadata?: Record<string, any>
): Promise<{ userMessage: SavedMessage; assistantMessage: SavedMessage }> {

  // Save user message
  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: userContent,
      metadata: userMetadata ? JSON.stringify(userMetadata) : null
    }
  });

  // Save assistant message
  const assistantMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantContent,
      metadata: assistantMetadata ? JSON.stringify(assistantMetadata) : null
    }
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });

  // Trigger chunking ONCE after both messages (debounced)
  chunkingTrigger.triggerAfterMessage(conversationId, userId).catch(err => {
    console.error('♾️ [SAVE MESSAGE] Chunking trigger error:', err);
  });

  return {
    userMessage: userMessage as SavedMessage,
    assistantMessage: assistantMessage as SavedMessage
  };
}

/**
 * Ensure conversation exists before saving messages
 * Creates a new conversation if it doesn't exist
 */
export async function ensureConversationAndSaveMessages(
  conversationId: string,
  userId: string,
  userContent: string,
  assistantContent: string,
  userMetadata?: Record<string, any>,
  assistantMetadata?: Record<string, any>
): Promise<{ userMessage: SavedMessage; assistantMessage: SavedMessage }> {

  // Check if conversation exists
  const existing = await prisma.conversation.findUnique({
    where: { id: conversationId }
  });

  if (!existing) {
    // Create conversation
    await prisma.conversation.create({
      data: {
        id: conversationId,
        userId,
        title: userContent.substring(0, 100) + (userContent.length > 100 ? '...' : '')
      }
    });
  }

  // Save messages
  return saveMessagePair(
    conversationId,
    userId,
    userContent,
    assistantContent,
    userMetadata,
    assistantMetadata
  );
}

/**
 * Save a single message (either role)
 * Lower-level function for flexibility
 */
export async function saveMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, any>
): Promise<SavedMessage> {

  const message = await prisma.message.create({
    data: {
      conversationId,
      role,
      content,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  });

  // Trigger chunking
  chunkingTrigger.triggerAfterMessage(conversationId, userId).catch(err => {
    console.error('♾️ [SAVE MESSAGE] Chunking trigger error:', err);
  });

  return message as SavedMessage;
}

/**
 * Update conversation timestamp
 * Call this after saving messages if not using saveMessagePair
 */
export async function updateConversationTimestamp(conversationId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });
}

export default {
  saveUserMessage,
  saveAssistantMessage,
  saveMessagePair,
  ensureConversationAndSaveMessages,
  saveMessage,
  updateConversationTimestamp
};
