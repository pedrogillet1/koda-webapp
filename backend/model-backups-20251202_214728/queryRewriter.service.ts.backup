/**
 * Query Rewriter Service
 *
 * REASON: Rewrite follow-up queries to be self-contained
 * WHY: Users ask "What about 2019?" which doesn't make sense without context
 * HOW: Detect follow-up patterns, use context to rewrite query
 * IMPACT: Enables natural multi-turn conversations
 *
 * EXAMPLES:
 * - "What about 2019?" → "What's the GDP of Argentina in 2019?"
 * - "And Australia?" → "What's the GDP of Australia in 2020?"
 * - "Show me that file" → "Show me budget.pdf"
 */

import contextTrackerService from './contextTracker.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Follow-up query patterns
const FOLLOW_UP_PATTERNS = [
  // Temporal references
  /^(?:what about|how about|and)\s+(19\d{2}|20\d{2})\??$/i,
  /^(?:in|for)\s+(19\d{2}|20\d{2})\??$/i,
  /^(?:and|what about)\s+(?:last|this|next|previous)\s+year\??$/i,
  /^(?:the same)\s+(?:for|in)\s+(19\d{2}|20\d{2})\??$/i,

  // Entity references
  /^(?:what about|how about|and)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\??$/i,
  /^(?:and|what about)\s+(?:for\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\??$/i,

  // Pronoun references
  /^(?:what|how)\s+(?:about|is)\s+(?:that|it|this)\??$/i,
  /^(?:show|open|display)\s+(?:me\s+)?(?:that|it|this)(?:\s+(?:file|document))?\??$/i,
  /^(?:the same)\s+(?:for|question|thing)/i,

  // Comparative follow-ups
  /^(?:compared to|versus|vs\.?)\s+(?:that|it|the previous)/i,
  /^(?:what's the|what is the)\s+(?:difference|comparison)/i,

  // Implicit references (query starts with connector)
  /^(?:and|also|but|or)\s+/i,
  /^(?:what about|how about)\s+/i,

  // Short queries that likely need context
  /^(?:why|how|when|where)\??$/i,
  /^(?:more|details|explain)\??$/i,
];

// Patterns that indicate query is already self-contained
const SELF_CONTAINED_PATTERNS = [
  /^(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|does|do|did|can|could|would|should)\s+.{10,}/i,
  /^(?:show me|list|find|search|display)\s+(?:all\s+)?(?:the\s+)?(?:documents?|files?|papers?)\s+.{5,}/i,
  /^(?:tell me about|explain|describe)\s+.{10,}/i,
];

class QueryRewriterService {

  /**
   * Check if query needs rewriting
   */
  needsRewriting(query: string): boolean {
    const trimmedQuery = query.trim();

    // Very short queries (< 20 chars) often need context
    if (trimmedQuery.length < 20) {
      // Check if it matches follow-up patterns
      for (const pattern of FOLLOW_UP_PATTERNS) {
        if (pattern.test(trimmedQuery)) {
          return true;
        }
      }
    }

    // Check if query is already self-contained
    for (const pattern of SELF_CONTAINED_PATTERNS) {
      if (pattern.test(trimmedQuery)) {
        return false;
      }
    }

    // Check for follow-up patterns
    for (const pattern of FOLLOW_UP_PATTERNS) {
      if (pattern.test(trimmedQuery)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Rewrite follow-up query to be self-contained
   */
  async rewriteQuery(
    query: string,
    userId: string,
    conversationId: string
  ): Promise<{ rewritten: string; wasRewritten: boolean }> {

    // Check if query needs rewriting
    if (!this.needsRewriting(query)) {
      console.log(`✅ [QUERY REWRITER] Query is self-contained: "${query}"`);
      return { rewritten: query, wasRewritten: false };
    }

    // Get conversation context
    const contextSummary = contextTrackerService.buildContextSummary(userId, conversationId);

    if (!contextSummary) {
      console.log(`⚠️ [QUERY REWRITER] No context available, returning original query`);
      return { rewritten: query, wasRewritten: false };
    }

    // Try simple pattern-based rewriting first (faster, no LLM call)
    const simpleRewrite = this.simpleRewrite(query, userId, conversationId);
    if (simpleRewrite) {
      console.log(`🔄 [QUERY REWRITER] Simple rewrite:`);
      console.log(`   Original: "${query}"`);
      console.log(`   Rewritten: "${simpleRewrite}"`);
      return { rewritten: simpleRewrite, wasRewritten: true };
    }

    // Fall back to LLM-based rewriting for complex cases
    const llmRewrite = await this.rewriteWithLLM(query, contextSummary);

    console.log(`🔄 [QUERY REWRITER] LLM rewrite:`);
    console.log(`   Original: "${query}"`);
    console.log(`   Rewritten: "${llmRewrite}"`);

    return { rewritten: llmRewrite, wasRewritten: true };
  }

  /**
   * Simple pattern-based rewriting (no LLM call)
   */
  private simpleRewrite(
    query: string,
    userId: string,
    conversationId: string
  ): string | null {

    const trimmedQuery = query.trim().toLowerCase();
    const entities = contextTrackerService.getAllEntities(userId, conversationId);
    const lastQuery = contextTrackerService.getLastQuery(userId, conversationId);

    // Pattern: "What about [year]?" → Replace year in last query
    const yearMatch = trimmedQuery.match(/^(?:what about|how about|and|in|for)\s+(19\d{2}|20\d{2})\??$/i);
    if (yearMatch && lastQuery) {
      const newYear = yearMatch[1];
      const oldYear = entities.year;

      if (oldYear) {
        // Replace old year with new year in last query
        const rewritten = lastQuery.replace(new RegExp(`\\b${oldYear}\\b`, 'g'), newYear);
        if (rewritten !== lastQuery) {
          return rewritten;
        }
      }

      // If no year in last query, append the new year
      return `${lastQuery} in ${newYear}`;
    }

    // Pattern: "What about [country]?" → Replace country in last query
    const countryMatch = trimmedQuery.match(/^(?:what about|how about|and)\s+([a-z]+(?:\s+[a-z]+)?)\??$/i);
    if (countryMatch && lastQuery) {
      const newCountry = countryMatch[1];
      const oldCountry = entities.country;

      // Check if it's actually a country (basic validation)
      const commonCountries = ['argentina', 'australia', 'brazil', 'canada', 'china', 'france',
        'germany', 'india', 'japan', 'mexico', 'russia', 'spain', 'uk', 'usa', 'united states',
        'united kingdom'];

      if (commonCountries.includes(newCountry.toLowerCase())) {
        if (oldCountry) {
          // Replace old country with new country
          const rewritten = lastQuery.replace(
            new RegExp(`\\b${oldCountry}\\b`, 'gi'),
            this.capitalizeWords(newCountry)
          );
          if (rewritten !== lastQuery) {
            return rewritten;
          }
        }

        // Append country if not found in last query
        return `${lastQuery} for ${this.capitalizeWords(newCountry)}`;
      }
    }

    // Pattern: "Show me that file" → Use file from context
    if (/^(?:show|open|display)\s+(?:me\s+)?(?:that|it|this)(?:\s+(?:file|document))?\??$/i.test(trimmedQuery)) {
      const file = entities.file;
      if (file) {
        return `Show me ${file}`;
      }
    }

    // Pattern: "More details" or "Explain" → Expand last query
    if (/^(?:more|details|explain|elaborate)\??$/i.test(trimmedQuery)) {
      if (lastQuery) {
        return `Give me more details about: ${lastQuery}`;
      }
    }

    return null;
  }

  /**
   * Use LLM to rewrite query with context
   */
  private async rewriteWithLLM(query: string, contextSummary: string): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 150,
        },
      });

      const prompt = `You are a query rewriter. Rewrite follow-up queries to be self-contained by incorporating context from the conversation.

RULES:
1. Resolve all references (it, that, the same, etc.) to explicit entities
2. Add missing entities from context (country, year, metric, file, topic)
3. Keep the query concise and natural
4. If the query is already self-contained, return it unchanged
5. Return ONLY the rewritten query, no explanation

CONTEXT:
${contextSummary}

EXAMPLES:
- Context: Country: Argentina, Year: 2020, Metric: GDP
  Query: "What about 2019?"
  Rewritten: "What's the GDP of Argentina in 2019?"

- Context: Country: Argentina, Year: 2020, Metric: GDP
  Query: "And Australia?"
  Rewritten: "What's the GDP of Australia in 2020?"

- Context: File: budget.pdf
  Query: "Show me that file"
  Rewritten: "Show me budget.pdf"

- Context: Topic: reinforcement learning
  Query: "More details"
  Rewritten: "Give me more details about reinforcement learning"

NOW REWRITE THIS QUERY:
Query: "${query}"
Rewritten:`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Clean up response (remove quotes if present)
      let rewritten = responseText
        .replace(/^["']|["']$/g, '')
        .replace(/^Rewritten:\s*/i, '')
        .trim();

      // Validate response
      if (rewritten.length < 3 || rewritten.length > 500) {
        console.warn(`⚠️ [QUERY REWRITER] Invalid LLM response, using original query`);
        return query;
      }

      return rewritten;

    } catch (error) {
      console.error('❌ [QUERY REWRITER] LLM error:', error);
      return query; // Fallback to original query
    }
  }

  /**
   * Capitalize first letter of each word
   */
  private capitalizeWords(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Detect the type of follow-up query
   */
  detectFollowUpType(query: string): 'year' | 'entity' | 'file' | 'pronoun' | 'elaboration' | 'none' {
    const trimmedQuery = query.trim().toLowerCase();

    if (/^(?:what about|how about|and|in|for)\s+(19\d{2}|20\d{2})\??$/i.test(trimmedQuery)) {
      return 'year';
    }

    if (/^(?:what about|how about|and)\s+([a-z]+(?:\s+[a-z]+)?)\??$/i.test(trimmedQuery)) {
      return 'entity';
    }

    if (/(?:that|it|this)\s*(?:file|document)?/i.test(trimmedQuery)) {
      return 'file';
    }

    if (/^(?:that|it|this|they|them)\??$/i.test(trimmedQuery)) {
      return 'pronoun';
    }

    if (/^(?:more|details|explain|elaborate|why|how)\??$/i.test(trimmedQuery)) {
      return 'elaboration';
    }

    return 'none';
  }
}

export default new QueryRewriterService();
