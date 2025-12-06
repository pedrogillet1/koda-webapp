/**
 * Conversation State Tracker Service
 * Priority: P2 (MEDIUM)
 * 
 * Tracks conversation state across multiple turns.
 * Maintains context, entities, and conversation flow.
 * 
 * Key Functions:
 * - Track conversation state (entities, topics, context)
 * - Update state with each message
 * - Retrieve conversation context
 * - Detect state transitions
 */

import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationState {
  conversationId: string;
  currentTopic: string;
  keyEntities: string[];
  keyTopics: string[];
  summary: string;
  messageCount: number;
  lastUpdated: Date;
  metadata: Record<string, any>;
}

export interface StateUpdate {
  newEntities?: string[];
  newTopics?: string[];
  topicShift?: boolean;
  summaryUpdate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current conversation state
 */
export async function getConversationState(
  conversationId: string
): Promise<ConversationState | null> {
  try {
    const state = await prisma.conversationContextState.findUnique({
      where: { conversationId },
    });

    if (!state) {
      // Initialize new state
      return await initializeConversationState(conversationId);
    }

    const messageCount = await prisma.message.count({
      where: { conversationId },
    });

    return {
      conversationId,
      currentTopic: state.currentTopic || 'general',
      keyEntities: state.keyEntities || [],
      keyTopics: state.keyTopics || [],
      summary: state.summary || '',
      messageCount,
      lastUpdated: state.updatedAt,
      metadata: (state.metadata as Record<string, any>) || {},
    };
  } catch (error) {
    console.error('[ConversationStateTracker] Error getting conversation state:', error);
    return null;
  }
}

/**
 * Update conversation state with new message
 */
export async function updateConversationState(
  conversationId: string,
  update: StateUpdate
): Promise<ConversationState | null> {
  try {
    const currentState = await getConversationState(conversationId);
    
    if (!currentState) {
      return null;
    }

    // Merge new entities and topics
    const updatedEntities = update.newEntities
      ? [...new Set([...currentState.keyEntities, ...update.newEntities])]
      : currentState.keyEntities;

    const updatedTopics = update.newTopics
      ? [...new Set([...currentState.keyTopics, ...update.newTopics])]
      : currentState.keyTopics;

    const updatedTopic = update.topicShift && update.newTopics && update.newTopics.length > 0
      ? update.newTopics[0]
      : currentState.currentTopic;

    const updatedSummary = update.summaryUpdate || currentState.summary;

    // Update database
    await prisma.conversationContextState.update({
      where: { conversationId },
      data: {
        currentTopic: updatedTopic,
        keyEntities: updatedEntities,
        keyTopics: updatedTopics,
        summary: updatedSummary,
        lastMessageCount: currentState.messageCount + 1,
      },
    });

    return {
      conversationId,
      currentTopic: updatedTopic,
      keyEntities: updatedEntities,
      keyTopics: updatedTopics,
      summary: updatedSummary,
      messageCount: currentState.messageCount + 1,
      lastUpdated: new Date(),
      metadata: currentState.metadata,
    };
  } catch (error) {
    console.error('[ConversationStateTracker] Error updating conversation state:', error);
    return null;
  }
}

/**
 * Initialize conversation state
 */
export async function initializeConversationState(
  conversationId: string
): Promise<ConversationState> {
  try {
    // Get userId from conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    const userId = conversation?.userId || 'unknown';

    await prisma.conversationContextState.create({
      data: {
        conversationId,
        userId,
        currentTopic: 'general',
        keyEntities: [],
        keyTopics: [],
        summary: '',
        lastMessageCount: 0,
        metadata: {},
      },
    });

    return {
      conversationId,
      currentTopic: 'general',
      keyEntities: [],
      keyTopics: [],
      summary: '',
      messageCount: 0,
      lastUpdated: new Date(),
      metadata: {},
    };
  } catch (error) {
    console.error('[ConversationStateTracker] Error initializing conversation state:', error);
    
    // Return default state even if database fails
    return {
      conversationId,
      currentTopic: 'general',
      keyEntities: [],
      keyTopics: [],
      summary: '',
      messageCount: 0,
      lastUpdated: new Date(),
      metadata: {},
    };
  }
}

/**
 * Reset conversation state
 */
export async function resetConversationState(
  conversationId: string
): Promise<void> {
  try {
    await prisma.conversationContextState.update({
      where: { conversationId },
      data: {
        currentTopic: 'general',
        keyEntities: [],
        keyTopics: [],
        summary: '',
        lastMessageCount: 0,
        metadata: {},
      },
    });
  } catch (error) {
    console.error('[ConversationStateTracker] Error resetting conversation state:', error);
  }
}

/**
 * Extract entities from text (simple heuristic)
 */
export function extractEntities(text: string): string[] {
  // Simple heuristic: extract capitalized words (potential entities)
  const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  
  // Filter out common words
  const commonWords = new Set(['The', 'A', 'An', 'This', 'That', 'These', 'Those']);
  const entities = capitalizedWords.filter(word => !commonWords.has(word));
  
  return [...new Set(entities)];
}

/**
 * Extract topics from text (simple heuristic)
 */
export function extractTopics(text: string): string[] {
  // Simple heuristic: extract significant words (4+ characters)
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  
  // Count word frequencies
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  });
  
  // Get top 5 most frequent words
  const topics = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  
  return topics;
}

/**
 * Get conversation metadata
 */
export async function getConversationMetadata(
  conversationId: string
): Promise<Record<string, any>> {
  try {
    const state = await prisma.conversationContextState.findUnique({
      where: { conversationId },
      select: { metadata: true },
    });

    return (state?.metadata as Record<string, any>) || {};
  } catch (error) {
    console.error('[ConversationStateTracker] Error getting conversation metadata:', error);
    return {};
  }
}

/**
 * Update conversation metadata
 */
export async function updateConversationMetadata(
  conversationId: string,
  metadata: Record<string, any>
): Promise<void> {
  try {
    const currentMetadata = await getConversationMetadata(conversationId);
    
    await prisma.conversationContextState.update({
      where: { conversationId },
      data: {
        metadata: {
          ...currentMetadata,
          ...metadata,
        },
      },
    });
  } catch (error) {
    console.error('[ConversationStateTracker] Error updating conversation metadata:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  getConversationState,
  updateConversationState,
  initializeConversationState,
  resetConversationState,
  extractEntities,
  extractTopics,
  getConversationMetadata,
  updateConversationMetadata,
};
