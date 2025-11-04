/**
 * INTENT CLASSIFICATION SERVICE - KODA PHASE 3
 *
 * FEATURE IMPLEMENTED:
 * - GPT-4/Gemini based intent classification
 * - Smart query routing
 * - Better understanding of user goals
 *
 * CAPABILITIES:
 * - Classify queries into specific intent categories
 * - Route queries to appropriate handlers
 * - Improve overall system intelligence
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export type QueryIntent =
  | 'meta_query' // About KODA itself
  | 'comparison' // Compare multiple documents
  | 'factual' // Extract specific facts
  | 'summary' // Summarize content
  | 'analysis' // Deep analysis
  | 'file_operation' // File management
  | 'clarification' // Unclear query
  | 'conversational'; // Small talk

export interface IntentResult {
  intent: QueryIntent;
  confidence: number;
  reasoning: string;
  suggestedAction?: string;
}

class IntentClassificationService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Use the same model as the main RAG system
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }
  }

  /**
   * Classify the intent of a user query using AI
   */
  async classifyIntent(query: string): Promise<IntentResult> {
    // Fallback to rule-based classification if AI is unavailable
    if (!this.model) {
      return this.ruleBasedClassification(query);
    }

    try {
      const prompt = `You are an intent classifier for a document analysis AI assistant called KODA.

Analyze this user query and classify it into ONE of these categories:

1. **meta_query**: User is asking about KODA itself (what can you do, how do you work, etc.)
2. **comparison**: User wants to compare information from multiple documents
3. **factual**: User wants specific facts or data points from documents
4. **summary**: User wants a summary or overview of document content
5. **analysis**: User wants deep analysis, insights, or interpretation
6. **file_operation**: User wants to manage files (create, delete, rename, move folders/files)
7. **clarification**: Query is unclear or ambiguous
8. **conversational**: Small talk, greetings, or non-task queries

User Query: "${query}"

Respond in this EXACT JSON format (no extra text):
{
  "intent": "one_of_the_categories_above",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this intent was chosen",
  "suggestedAction": "Optional suggestion for handling this query"
}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent as QueryIntent,
          confidence: parsed.confidence || 0.8,
          reasoning: parsed.reasoning || 'AI classified intent',
          suggestedAction: parsed.suggestedAction,
        };
      }

      // Fallback if parsing fails
      return this.ruleBasedClassification(query);
    } catch (error) {
      console.error('❌ [IntentClassification] AI classification failed:', error);
      return this.ruleBasedClassification(query);
    }
  }

  /**
   * Rule-based classification as fallback
   */
  private ruleBasedClassification(query: string): IntentResult {
    const queryLower = query.toLowerCase().trim();

    // Meta-query detection
    const metaKeywords = ['what can you do', 'what are you', 'who are you', 'how do you work', 'your capabilities'];
    if (metaKeywords.some(kw => queryLower.includes(kw))) {
      return {
        intent: 'meta_query',
        confidence: 0.95,
        reasoning: 'Query is asking about KODA capabilities',
        suggestedAction: 'Return built-in capabilities description',
      };
    }

    // Comparison detection
    const comparisonKeywords = ['compare', 'difference', 'versus', 'vs.', 'vs', 'contrast', 'similar'];
    if (comparisonKeywords.some(kw => queryLower.includes(kw))) {
      return {
        intent: 'comparison',
        confidence: 0.9,
        reasoning: 'Query contains comparison keywords',
        suggestedAction: 'Use multi-document retrieval',
      };
    }

    // File operation detection
    const fileOpKeywords = ['create folder', 'delete file', 'rename', 'move file', 'undo', 'redo'];
    if (fileOpKeywords.some(kw => queryLower.includes(kw))) {
      return {
        intent: 'file_operation',
        confidence: 0.92,
        reasoning: 'Query is requesting file management',
        suggestedAction: 'Route to file operations service',
      };
    }

    // Summary detection
    const summaryKeywords = ['summarize', 'summary', 'overview', 'brief', 'key points', 'main ideas'];
    if (summaryKeywords.some(kw => queryLower.includes(kw))) {
      return {
        intent: 'summary',
        confidence: 0.88,
        reasoning: 'Query is requesting a summary',
        suggestedAction: 'Retrieve broad context and generate concise summary',
      };
    }

    // Factual detection
    const factualKeywords = ['what is', 'how much', 'how many', 'when', 'where', 'who', 'which'];
    if (factualKeywords.some(kw => queryLower.startsWith(kw))) {
      return {
        intent: 'factual',
        confidence: 0.85,
        reasoning: 'Query is asking for specific facts',
        suggestedAction: 'Retrieve precise information',
      };
    }

    // Analysis detection
    const analysisKeywords = ['analyze', 'analysis', 'why', 'explain', 'interpret', 'insight', 'trend'];
    if (analysisKeywords.some(kw => queryLower.includes(kw))) {
      return {
        intent: 'analysis',
        confidence: 0.87,
        reasoning: 'Query requires deep analysis',
        suggestedAction: 'Retrieve comprehensive context and provide detailed analysis',
      };
    }

    // Conversational detection
    const conversationalKeywords = ['hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'goodbye'];
    if (conversationalKeywords.some(kw => queryLower === kw || queryLower.startsWith(kw + ' '))) {
      return {
        intent: 'conversational',
        confidence: 0.9,
        reasoning: 'Query is conversational/greeting',
        suggestedAction: 'Respond politely without document retrieval',
      };
    }

    // Default: factual query
    return {
      intent: 'factual',
      confidence: 0.6,
      reasoning: 'Default classification - query appears to be factual',
      suggestedAction: 'Perform standard document retrieval',
    };
  }

  /**
   * Get recommended chunk count based on intent
   */
  getRecommendedChunkCount(intent: QueryIntent): number {
    const chunkMap: Record<QueryIntent, number> = {
      meta_query: 0, // No retrieval needed
      comparison: 20, // Need more chunks for comparison
      factual: 10, // Moderate chunks for facts
      summary: 15, // More chunks for comprehensive summary
      analysis: 20, // Maximum chunks for deep analysis
      file_operation: 0, // No retrieval needed
      clarification: 5, // Few chunks to understand context
      conversational: 0, // No retrieval needed
    };

    return chunkMap[intent] || 10;
  }

  /**
   * Check if intent requires document retrieval
   */
  requiresRetrieval(intent: QueryIntent): boolean {
    const noRetrievalIntents: QueryIntent[] = ['meta_query', 'file_operation', 'conversational'];
    return !noRetrievalIntents.includes(intent);
  }

  /**
   * Get prompt enhancement based on intent
   */
  getPromptEnhancement(intent: QueryIntent): string {
    const enhancements: Record<QueryIntent, string> = {
      meta_query: 'Describe KODA capabilities clearly and comprehensively.',
      comparison: 'Compare the information systematically. Highlight similarities and differences. Use a comparison table if appropriate.',
      factual: 'Extract the specific facts requested. Be precise and cite sources.',
      summary: 'Provide a comprehensive yet concise summary. Include key points in bullet format.',
      analysis: 'Provide deep analysis with insights. Explain patterns, trends, and implications.',
      file_operation: 'Confirm the file operation and its result clearly.',
      clarification: 'Ask for clarification about what specific information is needed.',
      conversational: 'Respond naturally and helpfully.',
    };

    return enhancements[intent] || 'Answer the query accurately based on the retrieved information.';
  }
}

export const intentClassificationService = new IntentClassificationService();
export default intentClassificationService;
