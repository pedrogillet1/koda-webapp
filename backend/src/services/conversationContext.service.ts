/**
 * Conversation Context Manager
 * Manages conversation context across multiple turns for semantic understanding
 */

interface ConversationTurn {
  timestamp: number;
  userQuery: string;
  aiResponse: string;
  documentsUsed: Array<{
    id: string;
    name: string;
    type?: string;
    pageCount?: number;
  }>;
  intent: string;
  metadata: Record<string, any>;
}

interface CurrentDocument {
  id: string;
  name: string;
  type?: string;
  pageCount?: number;
}

class ConversationContextManager {
  private history: ConversationTurn[] = [];
  private maxHistory: number = 10;
  private contextTimeout: number = 600000; // 10 minutes in milliseconds
  private currentDocument: CurrentDocument | null = null;
  private currentTopic: string | null = null;
  private lastInteraction: number = Date.now();

  constructor(maxHistory: number = 10, contextTimeoutSeconds: number = 600) {
    this.maxHistory = maxHistory;
    this.contextTimeout = contextTimeoutSeconds * 1000;
  }

  /**
   * Add a conversation turn to history
   */
  addTurn(
    userQuery: string,
    aiResponse: string,
    documentsUsed: CurrentDocument[],
    intent: string,
    metadata: Record<string, any> = {}
  ): void {
    const turn: ConversationTurn = {
      timestamp: Date.now(),
      userQuery,
      aiResponse,
      documentsUsed,
      intent,
      metadata,
    };

    this.history.push(turn);
    this.lastInteraction = Date.now();

    // Update current document if documents were used
    if (documentsUsed && documentsUsed.length > 0) {
      this.currentDocument = documentsUsed[0];
      this.currentTopic = this.extractTopic(aiResponse);
    }

    // Trim history if too long
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  /**
   * Get a summary of recent conversation context
   */
  getContextSummary(): string {
    if (this.history.length === 0) {
      return 'No previous conversation.';
    }

    // Check if context has expired
    if (Date.now() - this.lastInteraction > this.contextTimeout) {
      return 'Previous conversation context has expired.';
    }

    const recentTurns = this.history.slice(-3); // Last 3 turns
    let summary = 'RECENT CONVERSATION:\n\n';

    recentTurns.forEach((turn, index) => {
      summary += `Turn ${index + 1}:\n`;
      summary += `User: ${turn.userQuery}\n`;
      summary += `Assistant: ${turn.aiResponse.substring(0, 150)}...\n`;

      if (turn.documentsUsed && turn.documentsUsed.length > 0) {
        const docNames = turn.documentsUsed.map(d => d.name).join(', ');
        summary += `Documents: ${docNames}\n`;
      }
      summary += '\n';
    });

    return summary;
  }

  /**
   * Detect if the current query is a follow-up to the previous conversation
   */
  isFollowUpQuestion(userQuery: string): boolean {
    if (this.history.length === 0) {
      return false;
    }

    // Check if context has expired
    if (Date.now() - this.lastInteraction > this.contextTimeout) {
      return false;
    }

    const queryLower = userQuery.toLowerCase();

    // Follow-up patterns
    const followUpPatterns = [
      'tell me more',
      'more detail',
      'in depth',
      'expand',
      'elaborate',
      'explain that',
      'what about',
      'how about',
      'and what',
      'also',
      'continue',
      'go on',
      'keep going',
      'go deeper',
      'dive deeper',
      'more information',
      'additional',
      'further',
      'more about',
    ];

    // Implicit reference patterns
    const implicitPatterns = [
      'it',
      'that',
      'this',
      'these',
      'those',
      'the document',
      'the plan',
      'the file',
      'the report',
    ];

    // Check for follow-up patterns
    const hasFollowUp = followUpPatterns.some(pattern => queryLower.includes(pattern));

    // Check for implicit references
    const hasImplicit = implicitPatterns.some(pattern => queryLower.includes(pattern));

    // Short queries are often follow-ups
    const isShort = userQuery.split(' ').length <= 5;

    return hasFollowUp || (hasImplicit && isShort);
  }

  /**
   * Get the current document being discussed
   */
  getCurrentDocumentContext(): CurrentDocument | null {
    if (!this.currentDocument) {
      return null;
    }

    // Check if context has expired
    if (Date.now() - this.lastInteraction > this.contextTimeout) {
      return null;
    }

    return this.currentDocument;
  }

  /**
   * Build a context-aware prompt that includes conversation history
   */
  buildContextAwarePrompt(userQuery: string, retrievalContent: string): string {
    const promptParts: string[] = [];

    // Add conversation context if this is a follow-up
    if (this.isFollowUpQuestion(userQuery)) {
      promptParts.push('=== CONVERSATION CONTEXT ===');
      promptParts.push(this.getContextSummary());

      if (this.currentDocument) {
        promptParts.push('\nCURRENT DOCUMENT BEING DISCUSSED:');
        promptParts.push(`Name: ${this.currentDocument.name}`);
        if (this.currentDocument.type) {
          promptParts.push(`Type: ${this.currentDocument.type}`);
        }
        if (this.currentDocument.pageCount) {
          promptParts.push(`Pages: ${this.currentDocument.pageCount}`);
        }
        promptParts.push('');
      }

      promptParts.push('=== IMPORTANT ===');
      promptParts.push(
        'This is a FOLLOW-UP question. The user is asking for more information about the SAME topic/document discussed above.'
      );
      promptParts.push('DO NOT give generic advice or templates. Provide actual content from the document.');
      promptParts.push('');
    }

    // Add current query
    promptParts.push('=== CURRENT USER QUERY ===');
    promptParts.push(userQuery);
    promptParts.push('');

    // Add retrieval results
    if (retrievalContent) {
      promptParts.push('=== RELEVANT DOCUMENT CONTENT ===');
      promptParts.push(retrievalContent);
    }

    return promptParts.join('\n');
  }

  /**
   * Extract main topic from AI response (simple heuristic)
   */
  private extractTopic(response: string): string {
    // Take first sentence as topic
    const sentences = response.split('.');
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    return '';
  }

  /**
   * Reset conversation context
   */
  reset(): void {
    this.history = [];
    this.currentDocument = null;
    this.currentTopic = null;
    this.lastInteraction = Date.now();
  }

  /**
   * Get full history (for debugging or analysis)
   */
  getFullHistory(): ConversationTurn[] {
    return [...this.history];
  }

  /**
   * Check if context is still valid
   */
  isContextValid(): boolean {
    return Date.now() - this.lastInteraction <= this.contextTimeout;
  }
}

// Export singleton instance with user-based context management
class ConversationContextService {
  private contexts: Map<string, ConversationContextManager> = new Map();

  /**
   * Get or create context manager for a user
   */
  getContext(userId: string, conversationId?: string): ConversationContextManager {
    const key = conversationId || userId;

    if (!this.contexts.has(key)) {
      this.contexts.set(key, new ConversationContextManager());
    }

    return this.contexts.get(key)!;
  }

  /**
   * Reset context for a user or conversation
   */
  resetContext(userId: string, conversationId?: string): void {
    const key = conversationId || userId;
    this.contexts.delete(key);
  }

  /**
   * Clean up expired contexts (run periodically)
   */
  cleanupExpiredContexts(): void {
    const now = Date.now();
    for (const [key, context] of this.contexts.entries()) {
      if (!context.isContextValid()) {
        this.contexts.delete(key);
      }
    }
  }
}

export default new ConversationContextService();
export { ConversationContextManager, ConversationContextService };
