/**
 * ============================================================================
 * CONVERSATION STATE SERVICE
 * ============================================================================
 * 
 * Tracks conversation context across turns:
 * - Active documents (for "nesse documento")
 * - Last citations (for "esse arquivo")
 * - Conversation filters (for "agora só PDFs")
 * - User preferences (for "sempre responda curto")
 * 
 * @version 2.0.0
 * @date 2024-12-10
 */

import { PrismaClient } from '@prisma/client';
import type {
  ConversationState,
  ConversationFilters,
  UserPreferences,
  Citation,
  QuestionType,
} from '../types/rag.types';

const prisma = new PrismaClient();

// ============================================================================
// IN-MEMORY CACHE (for performance)
// ============================================================================

const stateCache = new Map<string, ConversationState>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class ConversationStateService {
  /**
   * Get conversation state (from cache or DB)
   */
  async getState(conversationId: string): Promise<ConversationState | null> {
    // Check cache first
    const cached = stateCache.get(conversationId);
    if (cached) {
      // Check if expired
      const age = Date.now() - cached.updatedAt.getTime();
      if (age < CACHE_TTL_MS) {
        return cached;
      }
      // Expired, remove from cache
      stateCache.delete(conversationId);
    }

    // Load from DB
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          conversationState: true,
        },
      });

      if (!conversation || !conversation.conversationState) {
        return null;
      }

      const state: ConversationState = {
        conversationId: conversation.id,
        userId: conversation.userId,
        activeDocIds: conversation.conversationState.activeDocIds || [],
        lastCitations: conversation.conversationState.lastCitations || [],
        lastAnswerText: conversation.conversationState.lastAnswerText,
        lastQuestionType: conversation.conversationState.lastQuestionType as QuestionType,
        filters: conversation.conversationState.filters as ConversationFilters,
        preferences: conversation.conversationState.preferences as UserPreferences,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };

      // Cache it
      stateCache.set(conversationId, state);

      return state;
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error getting state:', error);
      return null;
    }
  }

  /**
   * Create initial conversation state
   */
  async createState(
    conversationId: string,
    userId: string,
    preferences?: UserPreferences
  ): Promise<ConversationState> {
    const now = new Date();

    const state: ConversationState = {
      conversationId,
      userId,
      activeDocIds: [],
      lastCitations: [],
      preferences: preferences || {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await prisma.conversationState.create({
        data: {
          conversationId,
          activeDocIds: [],
          lastCitations: [],
          preferences: preferences || {},
        },
      });

      // Cache it
      stateCache.set(conversationId, state);

      return state;
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error creating state:', error);
      throw new Error('Failed to create conversation state');
    }
  }

  /**
   * Update active documents
   */
  async updateActiveDocIds(
    conversationId: string,
    docIds: string[]
  ): Promise<void> {
    try {
      await prisma.conversationState.update({
        where: { conversationId },
        data: {
          activeDocIds: docIds,
          updatedAt: new Date(),
        },
      });

      // Update cache
      const cached = stateCache.get(conversationId);
      if (cached) {
        cached.activeDocIds = docIds;
        cached.updatedAt = new Date();
      }
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error updating active docs:', error);
      throw new Error('Failed to update active documents');
    }
  }

  /**
   * Update last citations
   */
  async updateLastCitations(
    conversationId: string,
    citations: Citation[]
  ): Promise<void> {
    try {
      await prisma.conversationState.update({
        where: { conversationId },
        data: {
          lastCitations: citations as any,
          updatedAt: new Date(),
        },
      });

      // Update cache
      const cached = stateCache.get(conversationId);
      if (cached) {
        cached.lastCitations = citations;
        cached.updatedAt = new Date();
      }
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error updating citations:', error);
      throw new Error('Failed to update last citations');
    }
  }

  /**
   * Update last answer text
   */
  async updateLastAnswer(
    conversationId: string,
    answerText: string,
    questionType: QuestionType
  ): Promise<void> {
    try {
      await prisma.conversationState.update({
        where: { conversationId },
        data: {
          lastAnswerText: answerText,
          lastQuestionType: questionType,
          updatedAt: new Date(),
        },
      });

      // Update cache
      const cached = stateCache.get(conversationId);
      if (cached) {
        cached.lastAnswerText = answerText;
        cached.lastQuestionType = questionType;
        cached.updatedAt = new Date();
      }
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error updating last answer:', error);
      throw new Error('Failed to update last answer');
    }
  }

  /**
   * Update conversation filters
   */
  async updateFilters(
    conversationId: string,
    filters: ConversationFilters
  ): Promise<void> {
    try {
      await prisma.conversationState.update({
        where: { conversationId },
        data: {
          filters: filters as any,
          updatedAt: new Date(),
        },
      });

      // Update cache
      const cached = stateCache.get(conversationId);
      if (cached) {
        cached.filters = filters;
        cached.updatedAt = new Date();
      }
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error updating filters:', error);
      throw new Error('Failed to update filters');
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    conversationId: string,
    preferences: UserPreferences
  ): Promise<void> {
    try {
      await prisma.conversationState.update({
        where: { conversationId },
        data: {
          preferences: preferences as any,
          updatedAt: new Date(),
        },
      });

      // Update cache
      const cached = stateCache.get(conversationId);
      if (cached) {
        cached.preferences = preferences;
        cached.updatedAt = new Date();
      }
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error updating preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }

  /**
   * Update complete state (after answer generation)
   */
  async updateCompleteState(
    conversationId: string,
    updates: {
      activeDocIds?: string[];
      lastCitations?: Citation[];
      lastAnswerText?: string;
      lastQuestionType?: QuestionType;
      filters?: ConversationFilters;
    }
  ): Promise<void> {
    try {
      const data: any = {
        updatedAt: new Date(),
      };

      if (updates.activeDocIds !== undefined) {
        data.activeDocIds = updates.activeDocIds;
      }
      if (updates.lastCitations !== undefined) {
        data.lastCitations = updates.lastCitations;
      }
      if (updates.lastAnswerText !== undefined) {
        data.lastAnswerText = updates.lastAnswerText;
      }
      if (updates.lastQuestionType !== undefined) {
        data.lastQuestionType = updates.lastQuestionType;
      }
      if (updates.filters !== undefined) {
        data.filters = updates.filters;
      }

      await prisma.conversationState.update({
        where: { conversationId },
        data,
      });

      // Update cache
      const cached = stateCache.get(conversationId);
      if (cached) {
        if (updates.activeDocIds) cached.activeDocIds = updates.activeDocIds;
        if (updates.lastCitations) cached.lastCitations = updates.lastCitations;
        if (updates.lastAnswerText) cached.lastAnswerText = updates.lastAnswerText;
        if (updates.lastQuestionType) cached.lastQuestionType = updates.lastQuestionType;
        if (updates.filters) cached.filters = updates.filters;
        cached.updatedAt = new Date();
      }
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error updating complete state:', error);
      throw new Error('Failed to update conversation state');
    }
  }

  /**
   * Clear conversation state
   */
  async clearState(conversationId: string): Promise<void> {
    try {
      await prisma.conversationState.update({
        where: { conversationId },
        data: {
          activeDocIds: [],
          lastCitations: [],
          lastAnswerText: null,
          lastQuestionType: null,
          filters: null,
          updatedAt: new Date(),
        },
      });

      // Remove from cache
      stateCache.delete(conversationId);
    } catch (error) {
      console.error('[CONVERSATION_STATE] Error clearing state:', error);
      throw new Error('Failed to clear conversation state');
    }
  }

  /**
   * Get active doc IDs (shorthand)
   */
  async getActiveDocIds(conversationId: string): Promise<string[]> {
    const state = await this.getState(conversationId);
    return state?.activeDocIds || [];
  }

  /**
   * Get last citations (shorthand)
   */
  async getLastCitations(conversationId: string): Promise<Citation[]> {
    const state = await this.getState(conversationId);
    return state?.lastCitations || [];
  }

  /**
   * Get filters (shorthand)
   */
  async getFilters(conversationId: string): Promise<ConversationFilters | undefined> {
    const state = await this.getState(conversationId);
    return state?.filters;
  }

  /**
   * Get preferences (shorthand)
   */
  async getPreferences(conversationId: string): Promise<UserPreferences | undefined> {
    const state = await this.getState(conversationId);
    return state?.preferences;
  }

  /**
   * Check if conversation has active documents
   */
  async hasActiveDocuments(conversationId: string): Promise<boolean> {
    const docIds = await this.getActiveDocIds(conversationId);
    return docIds.length > 0;
  }

  /**
   * Extract doc IDs from citations
   */
  extractDocIdsFromCitations(citations: Citation[]): string[] {
    return [...new Set(citations.map((c) => c.docId))];
  }

  /**
   * Merge filters (for conversation-level filter updates)
   */
  mergeFilters(
    existing: ConversationFilters | undefined,
    updates: Partial<ConversationFilters>
  ): ConversationFilters {
    return {
      mimeTypes: updates.mimeTypes || existing?.mimeTypes,
      tags: updates.tags || existing?.tags,
      folders: updates.folders || existing?.folders,
      dateRange: updates.dateRange || existing?.dateRange,
    };
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    stateCache.clear();
  }

  /**
   * Get cache size (for monitoring)
   */
  getCacheSize(): number {
    return stateCache.size;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default new ConversationStateService();
