/**
 * Context Tracker Service
 *
 * REASON: Track conversation context for follow-up question understanding
 * WHY: Users ask follow-up questions like "What about 2019?" that reference previous context
 * HOW: Extract and store entities (countries, years, metrics, files) from each query/answer
 * IMPACT: Enables natural multi-turn conversations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConversationContext {
  userId: string;
  conversationId: string;
  entities: Map<string, any>;
  lastQuery: string;
  lastQueryType: string;
  lastEntities: string[];
  lastAnswer: string;
  scope: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface ExtractedEntities {
  country?: string;
  countries?: string[];
  year?: number;
  years?: number[];
  metric?: string;
  metrics?: string[];
  file?: string;
  files?: string[];
  topic?: string;
  topics?: string[];
  dateRange?: { start: string; end: string };
  [key: string]: any;
}

class ContextTrackerService {
  private contexts: Map<string, ConversationContext> = new Map();

  // Context expiration time (30 minutes)
  private readonly CONTEXT_TTL = 30 * 60 * 1000;

  /**
   * Initialize or get context for a conversation
   */
  getContext(userId: string, conversationId: string): ConversationContext {
    const key = `${userId}:${conversationId}`;

    // Check if context exists and is not expired
    const existing = this.contexts.get(key);
    if (existing) {
      const age = Date.now() - existing.updatedAt.getTime();
      if (age < this.CONTEXT_TTL) {
        return existing;
      }
      // Context expired, remove it
      this.contexts.delete(key);
    }

    // Create new context
    const newContext: ConversationContext = {
      userId,
      conversationId,
      entities: new Map(),
      lastQuery: '',
      lastQueryType: '',
      lastEntities: [],
      lastAnswer: '',
      scope: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.contexts.set(key, newContext);
    console.log(`📝 [CONTEXT TRACKER] Created new context for conversation: ${conversationId}`);

    return newContext;
  }

  /**
   * Update context after each query
   */
  updateContext(
    userId: string,
    conversationId: string,
    query: string,
    answer: string,
    queryType: string = 'general',
    scope: string[] = []
  ): void {
    const context = this.getContext(userId, conversationId);

    // Extract entities from query and answer
    const entities = this.extractEntities(query, answer);

    // Update entities (merge with existing)
    Object.entries(entities).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        context.entities.set(key, value);
      }
    });

    // Update last query info
    context.lastQuery = query;
    context.lastQueryType = queryType;
    context.lastEntities = Object.keys(entities).filter(k => entities[k] !== undefined);
    context.lastAnswer = answer;
    context.updatedAt = new Date();

    // Update scope if provided
    if (scope.length > 0) {
      context.scope = scope;
    }

    console.log(`📝 [CONTEXT TRACKER] Updated context for ${conversationId}:`);
    console.log(`   Query type: ${queryType}`);
    console.log(`   Entities: ${JSON.stringify(Object.fromEntries(context.entities))}`);
    console.log(`   Scope: ${scope.length} documents`);
  }

  /**
   * Extract entities from query and answer
   */
  extractEntities(query: string, answer: string = ''): ExtractedEntities {
    const combinedText = `${query} ${answer}`;
    const entities: ExtractedEntities = {};

    // Extract countries
    const countries = this.extractCountries(combinedText);
    if (countries.length > 0) {
      entities.country = countries[0];
      entities.countries = countries;
    }

    // Extract years
    const years = this.extractYears(combinedText);
    if (years.length > 0) {
      entities.year = years[0];
      entities.years = years;
    }

    // Extract metrics
    const metrics = this.extractMetrics(query);
    if (metrics.length > 0) {
      entities.metric = metrics[0];
      entities.metrics = metrics;
    }

    // Extract file names
    const files = this.extractFileNames(combinedText);
    if (files.length > 0) {
      entities.file = files[0];
      entities.files = files;
    }

    // Extract topics
    const topics = this.extractTopics(query);
    if (topics.length > 0) {
      entities.topic = topics[0];
      entities.topics = topics;
    }

    // Extract date ranges
    const dateRange = this.extractDateRange(query);
    if (dateRange) {
      entities.dateRange = dateRange;
    }

    return entities;
  }

  /**
   * Extract countries from text
   */
  private extractCountries(text: string): string[] {
    const countryList = [
      'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
      'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'Chile', 'China', 'Colombia',
      'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Greece',
      'Hong Kong', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
      'Israel', 'Italy', 'Japan', 'Kenya', 'Malaysia', 'Mexico', 'Morocco',
      'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Pakistan', 'Peru',
      'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia', 'Saudi Arabia',
      'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland',
      'Taiwan', 'Thailand', 'Turkey', 'UAE', 'Ukraine', 'United Kingdom', 'UK',
      'United States', 'USA', 'US', 'Vietnam'
    ];

    const countries: string[] = [];
    const lowerText = text.toLowerCase();

    for (const country of countryList) {
      const pattern = new RegExp(`\\b${country.toLowerCase()}\\b`, 'i');
      if (pattern.test(lowerText)) {
        // Normalize common abbreviations
        let normalized = country;
        if (country === 'USA' || country === 'US') normalized = 'United States';
        if (country === 'UK') normalized = 'United Kingdom';

        if (!countries.includes(normalized)) {
          countries.push(normalized);
        }
      }
    }

    return countries;
  }

  /**
   * Extract years from text
   */
  private extractYears(text: string): number[] {
    const yearPattern = /\b(19[5-9]\d|20[0-4]\d)\b/g;
    const matches = text.match(yearPattern);

    if (!matches) return [];

    const years = [...new Set(matches.map(y => parseInt(y)))];
    return years.sort((a, b) => b - a); // Most recent first
  }

  /**
   * Extract metrics from text
   */
  private extractMetrics(text: string): string[] {
    const metricPatterns: Record<string, RegExp> = {
      'gdp': /\b(gdp|gross domestic product)\b/i,
      'revenue': /\b(revenue|sales|income)\b/i,
      'profit': /\b(profit|earnings|net income)\b/i,
      'expense': /\b(expense|cost|expenditure)\b/i,
      'growth': /\b(growth|increase|rise)\b/i,
      'market_cap': /\b(market cap|market capitalization|valuation)\b/i,
      'price': /\b(price|cost|value)\b/i,
      'rate': /\b(rate|percentage|ratio)\b/i,
      'population': /\b(population|inhabitants|people)\b/i,
      'inflation': /\b(inflation|cpi|consumer price)\b/i,
      'unemployment': /\b(unemployment|jobless)\b/i,
      'debt': /\b(debt|liability|obligations)\b/i,
      'assets': /\b(assets|holdings|property)\b/i,
    };

    const metrics: string[] = [];
    for (const [metric, pattern] of Object.entries(metricPatterns)) {
      if (pattern.test(text)) {
        metrics.push(metric);
      }
    }

    return metrics;
  }

  /**
   * Extract file names from text
   */
  private extractFileNames(text: string): string[] {
    const filePatterns = [
      /\b([\w\-\.]+\.(pdf|docx?|xlsx?|pptx?|txt|csv|json))\b/gi,
      /["']([^"']+\.(pdf|docx?|xlsx?|pptx?|txt|csv|json))["']/gi,
    ];

    const files: string[] = [];
    for (const pattern of filePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const filename = match[1];
        if (!files.includes(filename)) {
          files.push(filename);
        }
      }
    }

    return files;
  }

  /**
   * Extract topics from query
   */
  private extractTopics(query: string): string[] {
    // Extract topic from "about X" or "regarding X" patterns
    const topicPatterns = [
      /(?:about|regarding|concerning|on|related to)\s+([^?.!]+)/i,
      /(?:papers?|documents?|files?)\s+(?:about|on|regarding)\s+([^?.!]+)/i,
    ];

    const topics: string[] = [];
    for (const pattern of topicPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        const topic = match[1].trim().replace(/\s+/g, ' ');
        if (topic.length > 2 && topic.length < 100) {
          topics.push(topic);
        }
      }
    }

    return topics;
  }

  /**
   * Extract date range from query
   */
  private extractDateRange(query: string): { start: string; end: string } | null {
    // Pattern: "from 2015 to 2020" or "between 2015 and 2020"
    const rangePatterns = [
      /(?:from|between)\s+(\d{4})\s+(?:to|and)\s+(\d{4})/i,
      /(\d{4})\s*[-–]\s*(\d{4})/,
    ];

    for (const pattern of rangePatterns) {
      const match = query.match(pattern);
      if (match) {
        return {
          start: match[1],
          end: match[2],
        };
      }
    }

    return null;
  }

  /**
   * Get entity value from context
   */
  getEntity(userId: string, conversationId: string, entityName: string): any {
    const context = this.getContext(userId, conversationId);
    return context.entities.get(entityName);
  }

  /**
   * Get all entities from context
   */
  getAllEntities(userId: string, conversationId: string): Record<string, any> {
    const context = this.getContext(userId, conversationId);
    return Object.fromEntries(context.entities);
  }

  /**
   * Get last query from context
   */
  getLastQuery(userId: string, conversationId: string): string {
    const context = this.getContext(userId, conversationId);
    return context.lastQuery;
  }

  /**
   * Get last answer from context
   */
  getLastAnswer(userId: string, conversationId: string): string {
    const context = this.getContext(userId, conversationId);
    return context.lastAnswer;
  }

  /**
   * Check if context has specific entity type
   */
  hasEntity(userId: string, conversationId: string, entityType: string): boolean {
    const context = this.getContext(userId, conversationId);
    return context.entities.has(entityType) && context.entities.get(entityType) !== undefined;
  }

  /**
   * Clear context (e.g., when user starts new topic)
   */
  clearContext(userId: string, conversationId: string): void {
    const key = `${userId}:${conversationId}`;
    this.contexts.delete(key);
    console.log(`🗑️ [CONTEXT TRACKER] Cleared context for ${conversationId}`);
  }

  /**
   * Build context summary for query rewriting
   */
  buildContextSummary(userId: string, conversationId: string): string | null {
    const context = this.getContext(userId, conversationId);

    if (!context.lastQuery) {
      return null;
    }

    const parts: string[] = [];

    // Add last query type
    if (context.lastQueryType) {
      parts.push(`Last query type: ${context.lastQueryType}`);
    }

    // Add tracked entities
    const entityDescriptions: string[] = [];

    if (context.entities.has('country')) {
      entityDescriptions.push(`Country: ${context.entities.get('country')}`);
    }

    if (context.entities.has('year')) {
      entityDescriptions.push(`Year: ${context.entities.get('year')}`);
    }

    if (context.entities.has('metric')) {
      entityDescriptions.push(`Metric: ${context.entities.get('metric')}`);
    }

    if (context.entities.has('file')) {
      entityDescriptions.push(`File: ${context.entities.get('file')}`);
    }

    if (context.entities.has('topic')) {
      entityDescriptions.push(`Topic: ${context.entities.get('topic')}`);
    }

    if (entityDescriptions.length > 0) {
      parts.push(`Entities: ${entityDescriptions.join(', ')}`);
    }

    // Add last query
    parts.push(`Last query: "${context.lastQuery}"`);

    // Add last answer summary (first 200 chars)
    if (context.lastAnswer) {
      const answerSummary = context.lastAnswer.substring(0, 200);
      parts.push(`Last answer: "${answerSummary}..."`);
    }

    return parts.join('\n');
  }

  /**
   * Clean up expired contexts (call periodically)
   */
  cleanupExpiredContexts(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, context] of this.contexts.entries()) {
      const age = now - context.updatedAt.getTime();
      if (age >= this.CONTEXT_TTL) {
        this.contexts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [CONTEXT TRACKER] Cleaned up ${cleaned} expired contexts`);
    }

    return cleaned;
  }
}

// Run cleanup every 10 minutes
const contextTrackerService = new ContextTrackerService();
setInterval(() => {
  contextTrackerService.cleanupExpiredContexts();
}, 10 * 60 * 1000);

export default contextTrackerService;
