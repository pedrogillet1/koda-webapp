/**
 * Conversation State Service
 *
 * REASON: Manage conversation state for multi-turn conversations
 * WHY: Users ask follow-up questions within a filtered scope
 * HOW: Track document scope, filters, and conversation history
 * IMPACT: "Which ones use ensemble methods?" searches only within previous results
 *
 * EXAMPLE:
 * User: "Show me papers on reinforcement learning" → Lists 23 papers
 * User: "Which ones use ensemble methods?" → Searches only within those 23 papers
 */

interface ScopeInfo {
  type: 'all' | 'filtered' | 'single';
  documentIds: string[];
  description: string;
  query: string;
  timestamp: Date;
}

interface FilterInfo {
  topic?: string;
  fileType?: string;
  dateRange?: { start: Date; end: Date };
  folder?: string;
  category?: string;
  keywords?: string[];
}

interface HistoryEntry {
  query: string;
  rewrittenQuery?: string;
  scope: string[];
  scopeDescription: string;
  timestamp: Date;
  wasRefinement: boolean;
}

interface ConversationState {
  userId: string;
  conversationId: string;
  currentScope: ScopeInfo;
  filters: FilterInfo;
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Patterns that indicate a refinement query (searching within current scope)
const REFINEMENT_PATTERNS = [
  // Direct refinement
  /\b(which ones?|what about|how many|show me|filter|only|just)\b/i,

  // Reference to previous results
  /\b(that|those|these|them|the results?|the (documents?|files?|papers?))\b/i,

  // Subset queries
  /\b(from|in|with|using|about)\s+(?:the|those|these|them)\b/i,
  /\b(among|between|within)\s+(?:the|those|these|them)\b/i,

  // Counting/filtering
  /\b(how many|count|number of)\b/i,
  /\b(any|some|none)\s+(?:of them|that)\b/i,

  // Sorting/ranking within results
  /\b(most|least|best|worst|top|bottom|latest|oldest|newest)\b/i,
];

// Patterns that indicate a new topic (clears scope)
const NEW_TOPIC_PATTERNS = [
  /^(?:show me|list|find|search|display)\s+(?:all\s+)?(?:documents?|files?|papers?)\s+(?:about|on|regarding)/i,
  /^(?:new search|start over|search for|find)\s+/i,
  /^(?:what|tell me)\s+(?:is|are|about)\s+/i,
];

class ConversationStateService {
  private states: Map<string, ConversationState> = new Map();

  // State expiration time (1 hour)
  private readonly STATE_TTL = 60 * 60 * 1000;

  /**
   * Get or create conversation state
   */
  getState(userId: string, conversationId: string): ConversationState {
    const key = `${userId}:${conversationId}`;

    // Check if state exists and is not expired
    const existing = this.states.get(key);
    if (existing) {
      const age = Date.now() - existing.updatedAt.getTime();
      if (age < this.STATE_TTL) {
        return existing;
      }
      // State expired, remove it
      this.states.delete(key);
    }

    // Create new state
    const newState: ConversationState = {
      userId,
      conversationId,
      currentScope: {
        type: 'all',
        documentIds: [],
        description: 'all documents',
        query: '',
        timestamp: new Date(),
      },
      filters: {},
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.states.set(key, newState);
    console.log(`📊 [CONVERSATION STATE] Created new state for conversation: ${conversationId}`);

    return newState;
  }

  /**
   * Check if query is a refinement of current scope
   */
  isRefinementQuery(query: string, userId: string, conversationId: string): boolean {
    const state = this.getState(userId, conversationId);

    // If no scope is set, can't be a refinement
    if (state.currentScope.type === 'all' || state.currentScope.documentIds.length === 0) {
      return false;
    }

    // Check for new topic patterns (clears scope)
    for (const pattern of NEW_TOPIC_PATTERNS) {
      if (pattern.test(query)) {
        console.log(`📊 [CONVERSATION STATE] New topic detected, not a refinement`);
        return false;
      }
    }

    // Check for refinement patterns
    for (const pattern of REFINEMENT_PATTERNS) {
      if (pattern.test(query)) {
        console.log(`📊 [CONVERSATION STATE] Refinement query detected: ${pattern}`);
        return true;
      }
    }

    // Short queries (< 30 chars) after a scope is set are likely refinements
    if (query.trim().length < 30 && state.history.length > 0) {
      console.log(`📊 [CONVERSATION STATE] Short query in scoped context, treating as refinement`);
      return true;
    }

    return false;
  }

  /**
   * Update scope after a query
   */
  updateScope(
    userId: string,
    conversationId: string,
    documentIds: string[],
    description: string,
    query: string,
    filters: FilterInfo = {}
  ): void {
    const state = this.getState(userId, conversationId);

    // Update current scope
    state.currentScope = {
      type: documentIds.length === 0 ? 'all' : (documentIds.length === 1 ? 'single' : 'filtered'),
      documentIds,
      description,
      query,
      timestamp: new Date(),
    };

    // Merge filters
    state.filters = { ...state.filters, ...filters };

    // Add to history
    state.history.push({
      query,
      scope: documentIds,
      scopeDescription: description,
      timestamp: new Date(),
      wasRefinement: false,
    });

    // Limit history to last 20 entries
    if (state.history.length > 20) {
      state.history = state.history.slice(-20);
    }

    state.updatedAt = new Date();

    console.log(`📊 [CONVERSATION STATE] Updated scope: "${description}" (${documentIds.length} docs)`);
  }

  /**
   * Update scope for a refinement query
   */
  updateScopeRefinement(
    userId: string,
    conversationId: string,
    query: string,
    rewrittenQuery: string,
    newDocumentIds: string[],
    newDescription: string
  ): void {
    const state = this.getState(userId, conversationId);

    // For refinements, the new scope should be a subset of the current scope
    // (or at minimum, related to it)
    state.currentScope = {
      type: newDocumentIds.length === 0 ? 'all' : (newDocumentIds.length === 1 ? 'single' : 'filtered'),
      documentIds: newDocumentIds,
      description: newDescription,
      query: rewrittenQuery || query,
      timestamp: new Date(),
    };

    // Add to history
    state.history.push({
      query,
      rewrittenQuery,
      scope: newDocumentIds,
      scopeDescription: newDescription,
      timestamp: new Date(),
      wasRefinement: true,
    });

    // Limit history
    if (state.history.length > 20) {
      state.history = state.history.slice(-20);
    }

    state.updatedAt = new Date();

    console.log(`📊 [CONVERSATION STATE] Updated scope (refinement): "${newDescription}" (${newDocumentIds.length} docs)`);
  }

  /**
   * Get current scope document IDs
   */
  getCurrentScope(userId: string, conversationId: string): string[] {
    const state = this.getState(userId, conversationId);
    return state.currentScope.documentIds;
  }

  /**
   * Get current scope description
   */
  getCurrentScopeDescription(userId: string, conversationId: string): string {
    const state = this.getState(userId, conversationId);
    return state.currentScope.description;
  }

  /**
   * Get current filters
   */
  getFilters(userId: string, conversationId: string): FilterInfo {
    const state = this.getState(userId, conversationId);
    return state.filters;
  }

  /**
   * Check if a specific filter is set
   */
  hasFilter(userId: string, conversationId: string, filterType: keyof FilterInfo): boolean {
    const state = this.getState(userId, conversationId);
    return state.filters[filterType] !== undefined;
  }

  /**
   * Add a filter
   */
  addFilter(userId: string, conversationId: string, filterType: keyof FilterInfo, value: any): void {
    const state = this.getState(userId, conversationId);
    (state.filters as any)[filterType] = value;
    state.updatedAt = new Date();

    console.log(`📊 [CONVERSATION STATE] Added filter: ${filterType} = ${JSON.stringify(value)}`);
  }

  /**
   * Remove a filter
   */
  removeFilter(userId: string, conversationId: string, filterType: keyof FilterInfo): void {
    const state = this.getState(userId, conversationId);
    delete state.filters[filterType];
    state.updatedAt = new Date();

    console.log(`📊 [CONVERSATION STATE] Removed filter: ${filterType}`);
  }

  /**
   * Clear scope (reset to all documents)
   */
  clearScope(userId: string, conversationId: string): void {
    const state = this.getState(userId, conversationId);

    state.currentScope = {
      type: 'all',
      documentIds: [],
      description: 'all documents',
      query: '',
      timestamp: new Date(),
    };

    state.filters = {};
    state.updatedAt = new Date();

    console.log(`🗑️ [CONVERSATION STATE] Cleared scope for ${conversationId}`);
  }

  /**
   * Get conversation history
   */
  getHistory(userId: string, conversationId: string): HistoryEntry[] {
    const state = this.getState(userId, conversationId);
    return state.history;
  }

  /**
   * Get last N history entries
   */
  getRecentHistory(userId: string, conversationId: string, count: number = 5): HistoryEntry[] {
    const state = this.getState(userId, conversationId);
    return state.history.slice(-count);
  }

  /**
   * Check if there's an active scope
   */
  hasActiveScope(userId: string, conversationId: string): boolean {
    const state = this.getState(userId, conversationId);
    return state.currentScope.type !== 'all' && state.currentScope.documentIds.length > 0;
  }

  /**
   * Extract scope description from query
   */
  extractScopeDescription(query: string): string {
    // Try to extract topic from "about X" or "on X" patterns
    const patterns = [
      /(?:papers?|documents?|files?)\s+(?:about|on|regarding)\s+(.+?)(?:\?|$)/i,
      /(?:about|on|regarding)\s+(.+?)(?:\?|$)/i,
      /(?:related to|concerning)\s+(.+?)(?:\?|$)/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'filtered documents';
  }

  /**
   * Check if query creates a new scope
   */
  createsNewScope(query: string): boolean {
    const scopePatterns = [
      /\b(papers?|documents?|files?)\s+(?:about|on|regarding)\s+/i,
      /\b(show me|list|find|search)\s+(?:all\s+)?(?:papers?|documents?|files?)\s+(?:about|on|regarding)/i,
      /\b(search for|find|look for)\s+/i,
    ];

    return scopePatterns.some(pattern => pattern.test(query));
  }

  /**
   * Build filter criteria for database query
   */
  buildFilterCriteria(userId: string, conversationId: string): any {
    const state = this.getState(userId, conversationId);
    const criteria: any = {};

    // Add scope filter
    if (state.currentScope.documentIds.length > 0) {
      criteria.documentIds = state.currentScope.documentIds;
    }

    // Add other filters
    if (state.filters.topic) {
      criteria.topic = state.filters.topic;
    }

    if (state.filters.fileType) {
      criteria.fileType = state.filters.fileType;
    }

    if (state.filters.folder) {
      criteria.folderId = state.filters.folder;
    }

    if (state.filters.categories) {
      criteria.categoryId = state.filters.categories;
    }

    if (state.filters.dateRange) {
      criteria.dateRange = state.filters.dateRange;
    }

    return criteria;
  }

  /**
   * Clean up expired states
   */
  cleanupExpiredStates(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, state] of this.states.entries()) {
      const age = now - state.updatedAt.getTime();
      if (age >= this.STATE_TTL) {
        this.states.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [CONVERSATION STATE] Cleaned up ${cleaned} expired states`);
    }

    return cleaned;
  }
}

// Run cleanup every 15 minutes
const conversationStateService = new ConversationStateService();
setInterval(() => {
  conversationStateService.cleanupExpiredStates();
}, 15 * 60 * 1000);

export default conversationStateService;
