/**
 * Conversation Continuity Service
 * Priority: P2 (MEDIUM)
 * 
 * Maintains conversation context across multiple turns.
 * Resolves pronouns and references to previous messages.
 * 
 * Key Functions:
 * - Track conversation history
 * - Resolve pronouns (it, this, that, etc.)
 * - Maintain topic continuity
 * - Detect topic shifts
 */

import prisma from '../config/database';
import geminiClient from './geminiClient.service';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ConversationContext {
  conversationId: string;
  currentTopic: string;
  previousQueries: string[];
  previousAnswers: string[];
  entities: Map<string, string>; // pronoun -> entity mapping
  topicShift: boolean;
}

export interface ResolvedQuery {
  originalQuery: string;
  resolvedQuery: string;
  hasPronouns: boolean;
  resolutions: Array<{ pronoun: string; resolution: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve pronouns and references in query using conversation history
 */
export async function resolveQuery(
  query: string,
  conversationId: string
): Promise<ResolvedQuery> {
  // Check if query has pronouns
  const pronouns = detectPronouns(query);
  
  if (pronouns.length === 0) {
    return {
      originalQuery: query,
      resolvedQuery: query,
      hasPronouns: false,
      resolutions: [],
    };
  }

  // Get conversation history
  const history = await getConversationHistory(conversationId, 5); // Last 5 turns
  
  if (history.length === 0) {
    // No history, can't resolve pronouns
    return {
      originalQuery: query,
      resolvedQuery: query,
      hasPronouns: true,
      resolutions: [],
    };
  }

  // Use LLM to resolve pronouns
  const resolved = await resolvePronounsWithLLM(query, history);
  
  return resolved;
}

/**
 * Get conversation context
 */
export async function getConversationContext(
  conversationId: string
): Promise<ConversationContext | null> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!conversation) {
      return null;
    }

    const messages = conversation.messages || [];
    const previousQueries = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .reverse();
    
    const previousAnswers = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .reverse();

    // Extract current topic from recent messages
    const currentTopic = await extractCurrentTopic(previousQueries, previousAnswers);

    return {
      conversationId,
      currentTopic,
      previousQueries,
      previousAnswers,
      entities: new Map(),
      topicShift: false,
    };
  } catch (error) {
    console.error('[ConversationContinuity] Error getting conversation context:', error);
    return null;
  }
}

/**
 * Detect if there's a topic shift
 */
export async function detectTopicShift(
  newQuery: string,
  conversationId: string
): Promise<boolean> {
  const context = await getConversationContext(conversationId);
  
  if (!context || context.previousQueries.length === 0) {
    return false; // No previous context, no shift
  }

  const previousQuery = context.previousQueries[context.previousQueries.length - 1];
  
  // Use simple heuristic: check if queries share keywords
  const newWords = new Set(newQuery.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const prevWords = new Set(previousQuery.toLowerCase().match(/\b\w{4,}\b/g) || []);
  
  const intersection = new Set([...newWords].filter(w => prevWords.has(w)));
  const overlap = intersection.size / Math.max(newWords.size, 1);
  
  // If <30% overlap, consider it a topic shift
  return overlap < 0.3;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect pronouns in query
 */
function detectPronouns(query: string): string[] {
  const pronounPattern = /\b(it|this|that|they|them|these|those|he|she|him|her)\b/gi;
  const matches = query.match(pronounPattern);
  return matches ? Array.from(new Set(matches.map(m => m.toLowerCase()))) : [];
}

/**
 * Get conversation history
 */
async function getConversationHistory(
  conversationId: string,
  limit: number = 5
): Promise<Array<{ role: string; content: string }>> {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Get both user and assistant messages
      select: {
        role: true,
        content: true,
      },
    });

    return messages.reverse();
  } catch (error) {
    console.error('[ConversationContinuity] Error getting conversation history:', error);
    return [];
  }
}

/**
 * Resolve pronouns using LLM
 */
async function resolvePronounsWithLLM(
  query: string,
  history: Array<{ role: string; content: string }>
): Promise<ResolvedQuery> {
  const prompt = buildPronounResolutionPrompt(query, history);

  try {
    const result = await geminiClient.generateContent(prompt, {
      temperature: 0.1,
      maxOutputTokens: 300,
    });

    const responseText = result.response?.text() || '';
    return parsePronounResolution(query, responseText);
  } catch (error) {
    console.error('[ConversationContinuity] Error resolving pronouns:', error);
    
    // Fallback: return original query
    return {
      originalQuery: query,
      resolvedQuery: query,
      hasPronouns: true,
      resolutions: [],
    };
  }
}

/**
 * Build prompt for pronoun resolution
 */
function buildPronounResolutionPrompt(
  query: string,
  history: Array<{ role: string; content: string }>
): string {
  const historyText = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');

  return `You are a pronoun resolution system. Resolve pronouns in the user's query using conversation history.

**Conversation History:**
${historyText}

**User Query:**
${query}

**Your Task:**
Replace pronouns (it, this, that, they, etc.) with their actual referents from the conversation history.

**Output Format (JSON):**
{
  "resolvedQuery": "<query with pronouns replaced>",
  "resolutions": [
    {"pronoun": "it", "resolution": "the document"},
    ...
  ]
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse pronoun resolution result
 */
function parsePronounResolution(originalQuery: string, text: string): ResolvedQuery {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in pronoun resolution result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      originalQuery,
      resolvedQuery: parsed.resolvedQuery || originalQuery,
      hasPronouns: true,
      resolutions: parsed.resolutions || [],
    };
  } catch (error) {
    console.error('[ConversationContinuity] Error parsing pronoun resolution:', error);
    
    return {
      originalQuery,
      resolvedQuery: originalQuery,
      hasPronouns: true,
      resolutions: [],
    };
  }
}

/**
 * Extract current topic from conversation
 */
async function extractCurrentTopic(
  queries: string[],
  answers: string[]
): Promise<string> {
  if (queries.length === 0) {
    return 'general';
  }

  // Simple heuristic: most common keywords in recent queries
  const recentQueries = queries.slice(-3).join(' ');
  const words = recentQueries.toLowerCase().match(/\b\w{4,}\b/g) || [];
  
  const wordCounts = new Map<string, number>();
  words.forEach(word => {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  });

  const sortedWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return sortedWords.join(', ') || 'general';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  resolveQuery,
  getConversationContext,
  detectTopicShift,
};
