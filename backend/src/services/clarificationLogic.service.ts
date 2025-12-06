/**
 * Clarification Logic Service
 * Priority: P2 (MEDIUM)
 * 
 * Detects when user query is ambiguous and asks for clarification.
 * Improves answer quality by ensuring query intent is clear.
 * 
 * Key Functions:
 * - Detect ambiguous queries
 * - Generate clarification questions
 * - Suggest specific alternatives
 * - Track clarification history
 */

import geminiClient from './geminiClient.service';
import prisma from '../config/database';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ClarificationResult {
  needsClarification: boolean;
  confidence: number;
  ambiguityType: 'vague' | 'multiple_meanings' | 'missing_context' | 'none';
  clarificationQuestion: string;
  suggestions: string[];
  reasoning: string;
}

export interface ClarificationOptions {
  minConfidence?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if query needs clarification
 */
export async function checkNeedsClarification(
  query: string,
  retrievedChunks: Array<{ content: string; metadata?: any }>,
  options: ClarificationOptions = {}
): Promise<ClarificationResult> {
  const {
    minConfidence = 0.7,
    conversationHistory = [],
  } = options;

  // Quick heuristic check first
  const quickCheck = quickAmbiguityCheck(query);
  
  if (!quickCheck.isAmbiguous) {
    return {
      needsClarification: false,
      confidence: 1.0,
      ambiguityType: 'none',
      clarificationQuestion: '',
      suggestions: [],
      reasoning: 'Query is clear and specific.',
    };
  }

  // If chunks are very relevant, might not need clarification
  if (retrievedChunks.length > 0 && areChunksHighlyRelevant(query, retrievedChunks)) {
    return {
      needsClarification: false,
      confidence: 0.8,
      ambiguityType: 'none',
      clarificationQuestion: '',
      suggestions: [],
      reasoning: 'Query is somewhat ambiguous but retrieved chunks are highly relevant.',
    };
  }

  // Use LLM to detect ambiguity
  const ambiguityCheck = await detectAmbiguity(query, retrievedChunks, conversationHistory);

  if (ambiguityCheck.confidence < minConfidence) {
    // Not confident about ambiguity, proceed without clarification
    return {
      needsClarification: false,
      confidence: ambiguityCheck.confidence,
      ambiguityType: 'none',
      clarificationQuestion: '',
      suggestions: [],
      reasoning: 'Ambiguity detection confidence too low, proceeding without clarification.',
    };
  }

  return ambiguityCheck;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick heuristic check for ambiguity
 */
function quickAmbiguityCheck(query: string): { isAmbiguous: boolean; reason: string } {
  const queryLower = query.toLowerCase().trim();
  
  // Too short queries are often ambiguous
  if (queryLower.split(/\s+/).length <= 2) {
    return { isAmbiguous: true, reason: 'Query too short' };
  }

  // Pronouns without context are ambiguous
  const pronouns = ['it', 'this', 'that', 'they', 'them', 'these', 'those'];
  const startsWithPronoun = pronouns.some(p => queryLower.startsWith(p + ' '));
  if (startsWithPronoun) {
    return { isAmbiguous: true, reason: 'Starts with pronoun' };
  }

  // Very generic questions
  const genericPatterns = [
    /^what is (it|this|that)\??$/,
    /^tell me about (it|this|that)$/,
    /^explain$/,
    /^how\??$/,
    /^why\??$/,
  ];
  
  if (genericPatterns.some(pattern => pattern.test(queryLower))) {
    return { isAmbiguous: true, reason: 'Generic question' };
  }

  return { isAmbiguous: false, reason: 'Query appears specific' };
}

/**
 * Check if retrieved chunks are highly relevant
 */
function areChunksHighlyRelevant(
  query: string,
  chunks: Array<{ content: string; metadata?: any }>
): boolean {
  // Simple heuristic: check if query keywords appear in chunks
  const queryWords = query.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const chunkText = chunks.map(c => c.content.toLowerCase()).join(' ');
  
  const matchCount = queryWords.filter(word => chunkText.includes(word)).length;
  const matchRatio = matchCount / Math.max(queryWords.length, 1);
  
  return matchRatio > 0.7; // >70% of query words found in chunks
}

/**
 * Use LLM to detect ambiguity
 */
async function detectAmbiguity(
  query: string,
  chunks: Array<{ content: string; metadata?: any }>,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<ClarificationResult> {
  const prompt = buildAmbiguityDetectionPrompt(query, chunks, conversationHistory);

  try {
    const result = await geminiClient.generateContent(prompt, {
      temperature: 0.1,
      maxOutputTokens: 500,
    });

    const responseText = result.response?.text() || '';
    return parseAmbiguityResult(responseText);
  } catch (error) {
    console.error('[ClarificationLogic] Error detecting ambiguity:', error);
    
    // Fallback: assume not ambiguous
    return {
      needsClarification: false,
      confidence: 0.5,
      ambiguityType: 'none',
      clarificationQuestion: '',
      suggestions: [],
      reasoning: 'Ambiguity detection failed, proceeding without clarification.',
    };
  }
}

/**
 * Build prompt for ambiguity detection
 */
function buildAmbiguityDetectionPrompt(
  query: string,
  chunks: Array<{ content: string; metadata?: any }>,
  conversationHistory: Array<{ role: string; content: string }>
): string {
  const historyText = conversationHistory.length > 0
    ? conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')
    : 'No previous conversation';

  const chunksText = chunks.slice(0, 3).map(c => c.content.slice(0, 200)).join('\n\n');

  return `You are an ambiguity detection system. Determine if a user query is ambiguous and needs clarification.

**Conversation History:**
${historyText}

**User Query:**
${query}

**Retrieved Chunks (preview):**
${chunksText}

**Your Task:**
Determine if the query is ambiguous. A query is ambiguous if:
1. It's too vague (e.g., "tell me about it")
2. It has multiple possible meanings
3. It lacks necessary context
4. The retrieved chunks don't clearly match the intent

If ambiguous, generate a clarification question and suggestions.

**Output Format (JSON):**
{
  "needsClarification": <true/false>,
  "confidence": <0-1>,
  "ambiguityType": "vague" | "multiple_meanings" | "missing_context" | "none",
  "clarificationQuestion": "<question to ask user>",
  "suggestions": ["option 1", "option 2", ...],
  "reasoning": "<brief explanation>"
}

Respond with ONLY the JSON object, no additional text.`;
}

/**
 * Parse ambiguity detection result
 */
function parseAmbiguityResult(text: string): ClarificationResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in ambiguity result');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      needsClarification: parsed.needsClarification || false,
      confidence: parsed.confidence || 0,
      ambiguityType: parsed.ambiguityType || 'none',
      clarificationQuestion: parsed.clarificationQuestion || '',
      suggestions: parsed.suggestions || [],
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('[ClarificationLogic] Error parsing ambiguity result:', error);
    
    return {
      needsClarification: false,
      confidence: 0.5,
      ambiguityType: 'none',
      clarificationQuestion: '',
      suggestions: [],
      reasoning: 'Failed to parse ambiguity result',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  checkNeedsClarification,
};
