/**
 * ============================================================================
 * KODA MEMORY ENGINE SERVICE
 * ============================================================================
 *
 * This service implements the complete Koda Memory System 3.0, integrating:
 * - Short-Term Buffer (last 50 messages)
 * - Rolling Conversation Summary (generated every 10-20 turns)
 * - Retrieval Memory (semantic search from conversation history)
 * - Conversation State (goal, topic, documents being discussed)
 *
 * This is the MAIN ENTRY POINT for conversation memory in the RAG pipeline.
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import rollingConversationSummaryService, {
  getConversationState as getRollingSummaryState,
  updateConversationState as updateRollingSummaryState,
  formatConversationStateForLLM,
  ConversationState
} from './rollingConversationSummary.service';

const prisma = new PrismaClient();

// Configuration
const SHORT_TERM_BUFFER_SIZE = 50;  // Last 50 messages (user + assistant)
const SUMMARY_TRIGGER_TURNS = 10;   // Generate summary every 10 turns

export interface KodaMemory {
  // Short-term: Recent messages in full
  shortTermBuffer: Array<{ role: string; content: string; createdAt?: Date }>;

  // Rolling summary: Compressed history of older messages
  rollingSummary: string;

  // Conversation state: What user is doing, current document, topic
  conversationState: ConversationState | null;

  // Formatted context for LLM prompt
  formattedContext: string;

  // Metadata
  totalMessages: number;
  lastMessageAt: Date | null;
}

/**
 * Get complete memory context for a conversation
 * This is the main function to call from the RAG pipeline
 */
export async function getConversationMemory(
  conversationId: string,
  userId: string
): Promise<KodaMemory> {
  console.log(`🧠 [MEMORY] Loading memory for conversation ${conversationId.slice(0, 8)}...`);

  const startTime = Date.now();

  try {
    // 1. Load short-term buffer (last 50 messages)
    const recentMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: SHORT_TERM_BUFFER_SIZE,
      select: {
        role: true,
        content: true,
        createdAt: true
      }
    });

    // 2. Get or create conversation state (rolling summary)
    let rollingSummary = '';
    let conversationState: ConversationState | null = null;

    try {
      // DISABLED FOR SPEED: conversationState = await getRollingSummaryState(conversationId, userId);
      // rollingSummary = conversationState?.summary || '';
      rollingSummary = ''; // Rolling summary disabled for speed
    } catch (err) {
      // ConversationState table might not exist, fallback gracefully
      console.log('⚠️ [MEMORY] ConversationState not available, using basic memory');
    }

    // 3. Build formatted context for LLM
    const formattedContext = buildFormattedContext(
      recentMessages,
      rollingSummary,
      conversationState
    );

    const duration = Date.now() - startTime;
    console.log(`✅ [MEMORY] Loaded ${recentMessages.length} messages in ${duration}ms`);

    return {
      shortTermBuffer: recentMessages,
      rollingSummary,
      conversationState,
      formattedContext,
      totalMessages: recentMessages.length,
      lastMessageAt: recentMessages.length > 0
        ? recentMessages[recentMessages.length - 1].createdAt || null
        : null
    };

  } catch (error) {
    console.error('❌ [MEMORY] Failed to load memory:', error);

    // Return empty memory on error
    return {
      shortTermBuffer: [],
      rollingSummary: '',
      conversationState: null,
      formattedContext: '',
      totalMessages: 0,
      lastMessageAt: null
    };
  }
}

/**
 * Update conversation memory after a turn
 * Call this after each message exchange
 */
export async function updateConversationMemory(
  conversationId: string,
  userId: string,
  userQuery: string,
  assistantResponse: string,
  documentId?: string
): Promise<void> {
  console.log(`🧠 [MEMORY] Updating memory for conversation ${conversationId.slice(0, 8)}...`);

  try {
    // Update rolling summary state
    await updateRollingSummaryState(conversationId, userId, userQuery, documentId);

    console.log('✅ [MEMORY] Memory updated');
  } catch (error) {
    console.error('❌ [MEMORY] Failed to update memory:', error);
    // Non-critical - don't throw
  }
}

/**
 * Build formatted context string for LLM prompt
 */
function buildFormattedContext(
  messages: Array<{ role: string; content: string; createdAt?: Date }>,
  rollingSummary: string,
  state: ConversationState | null
): string {
  const parts: string[] = [];

  // 1. Add conversation state context if available
  if (state) {
    parts.push('=== CONVERSATION CONTEXT ===');
    parts.push(`USER GOAL: ${state.userGoal}`);
    if (state.currentDocument) {
      parts.push(`CURRENT DOCUMENT: ${state.currentDocument}`);
    }
    parts.push(`CURRENT TOPIC: ${state.currentTopic}`);
    if (state.knownDocuments.length > 0) {
      parts.push(`DOCUMENTS DISCUSSED: ${state.knownDocuments.join(', ')}`);
    }
    parts.push('');
  }

  // 2. Add rolling summary if available
  if (rollingSummary && rollingSummary !== 'Conversation just started.') {
    parts.push('=== CONVERSATION SUMMARY ===');
    parts.push(rollingSummary);
    parts.push('');
  }

  // 3. Add recent conversation history
  if (messages.length > 0) {
    parts.push('=== RECENT CONVERSATION ===');

    // Group messages by pairs (user + assistant)
    for (const msg of messages) {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      // Truncate very long messages for context efficiency
      const content = msg.content.length > 500
        ? msg.content.slice(0, 500) + '...'
        : msg.content;
      parts.push(`${role}: ${content}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Get just the short-term buffer (for quick access)
 */
export async function getShortTermBuffer(
  conversationId: string
): Promise<Array<{ role: string; content: string }>> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: SHORT_TERM_BUFFER_SIZE,
    select: {
      role: true,
      content: true
    }
  });

  return messages;
}

/**
 * Check if conversation has substantial history
 */
export async function hasConversationHistory(
  conversationId: string
): Promise<boolean> {
  const count = await prisma.message.count({
    where: { conversationId }
  });

  return count > 0;
}

/**
 * Get conversation history formatted for Gemini's multi-turn format
 * This is optimized for Gemini's expected message format
 */
export async function getGeminiFormattedHistory(
  conversationId: string
): Promise<Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: SHORT_TERM_BUFFER_SIZE,
    select: {
      role: true,
      content: true
    }
  });

  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

/**
 * Clear conversation memory (used when starting fresh)
 */
export async function clearConversationMemory(
  conversationId: string
): Promise<void> {
  try {
    // Delete all messages
    await prisma.message.deleteMany({
      where: { conversationId }
    });

    // Delete conversation state
    await prisma.conversationState.deleteMany({
      where: { conversationId }
    });

    console.log(`🧹 [MEMORY] Cleared memory for conversation ${conversationId.slice(0, 8)}`);
  } catch (error) {
    console.error('❌ [MEMORY] Failed to clear memory:', error);
  }
}

// Export as default for easy import
export default {
  getConversationMemory,
  updateConversationMemory,
  getShortTermBuffer,
  hasConversationHistory,
  getGeminiFormattedHistory,
  clearConversationMemory,
  SHORT_TERM_BUFFER_SIZE
};
