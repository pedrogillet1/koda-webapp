/**
 * Koda Context Engine V1
 *
 * Manages conversation context:
 * - Build conversation context from history
 * - Get last N turns
 * - Update context after each turn
 * - Compress context if needed
 */

import type { ConversationContext, ConversationTurn } from '../../types/ragV1.types';

class KodaContextEngineV1 {
  buildConversationContext(
    sessionId: string,
    userId: string,
    history: ConversationTurn[]
  ): ConversationContext {
    return {
      sessionId,
      userId,
      lastNTurns: this.getLastNTurns(history, 5),
      activeDocIds: this.extractActiveDocIds(history),
      lastCitations: this.extractLastCitations(history),
      lastQuery: history[history.length - 1]?.content || '',
    };
  }

  getLastNTurns(history: ConversationTurn[], n: number): ConversationTurn[] {
    return history.slice(-n);
  }

  updateContext(
    context: ConversationContext,
    query: string,
    answer: string,
    docsUsed: string[]
  ): ConversationContext {
    const newTurn: ConversationTurn = {
      role: 'user',
      content: query,
      timestamp: new Date(),
      metadata: { docsUsed },
    };

    const assistantTurn: ConversationTurn = {
      role: 'assistant',
      content: answer,
      timestamp: new Date(),
      metadata: { docsUsed },
    };

    return {
      ...context,
      lastQuery: query,
      activeDocIds: docsUsed,
      lastNTurns: [
        ...context.lastNTurns,
        newTurn,
        assistantTurn,
      ].slice(-10), // Keep last 10 turns (5 exchanges)
    };
  }

  compressContext(context: ConversationContext): ConversationContext {
    // Keep only last 3 turns if context is too large
    if (context.lastNTurns.length > 6) {
      return {
        ...context,
        lastNTurns: context.lastNTurns.slice(-6),
      };
    }
    return context;
  }

  private extractActiveDocIds(history: ConversationTurn[]): string[] {
    const lastTurn = history[history.length - 1];
    return lastTurn?.metadata?.docsUsed || [];
  }

  private extractLastCitations(history: ConversationTurn[]): any[] {
    const lastAssistantTurn = [...history].reverse().find(t => t.role === 'assistant');
    return lastAssistantTurn?.metadata?.citations || [];
  }

  /**
   * Check if query is a follow-up based on context
   */
  isFollowUpQuery(query: string, context: ConversationContext): boolean {
    const followUpIndicators = [
      /^e /i,
      /^and /i,
      /^também /i,
      /^also /i,
      /nesse|neste|esse|este/i,
      /this|that/i,
      /no mesmo/i,
      /in the same/i,
    ];

    // Check for follow-up patterns
    const hasFollowUpPattern = followUpIndicators.some(p => p.test(query));

    // Also consider it a follow-up if we have active documents
    const hasActiveContext = !!(context.activeDocIds && context.activeDocIds.length > 0);

    return hasFollowUpPattern && hasActiveContext;
  }

  /**
   * Get document context summary for prompts
   */
  getContextSummary(context: ConversationContext): string {
    if (!context.lastNTurns.length) {
      return 'No previous conversation.';
    }

    const summary = context.lastNTurns
      .slice(-4)
      .map(turn => `${turn.role === 'user' ? 'User' : 'Koda'}: ${turn.content.slice(0, 100)}...`)
      .join('\n');

    return `Recent conversation:\n${summary}`;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const kodaContextEngineV1 = new KodaContextEngineV1();
export default kodaContextEngineV1;
