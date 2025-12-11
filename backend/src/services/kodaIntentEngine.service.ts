/**
 * KODA INTENT ENGINE V2
 * Unified Intent Classification Service
 *
 * This is the brain of Koda's intent classification system.
 * It orchestrates:
 *   - Layer 0: Pattern-based classification (<100ms, no LLM)
 *   - Layer 1: LLM-based classification (only when patterns fail)
 *
 * Performance Target: 80%+ queries classified by patterns
 */

import {
  PrimaryIntent,
  KnowledgeSource,
  RAGMode,
  AnswerStyle,
  TargetDocumentScope,
  IntentClassification,
  ReasoningFlags,
  FallbackType,
  INTENT_REQUIRES_RAG,
  INTENT_REQUIRES_LLM,
  INTENT_KNOWLEDGE_SOURCE
} from '../types/intentV2.types';

import { kodaPatternEngine } from './kodaPatternClassification.service';
import geminiGateway from './geminiGateway.service';

// ============================================================================
// INTENT ENGINE CLASS
// ============================================================================

export class KodaIntentEngine {
  private static instance: KodaIntentEngine;

  private constructor() {}

  public static getInstance(): KodaIntentEngine {
    if (!KodaIntentEngine.instance) {
      KodaIntentEngine.instance = new KodaIntentEngine();
    }
    return KodaIntentEngine.instance;
  }

  /**
   * Main classification method
   * Tries pattern matching first, falls back to LLM if needed
   */
  public async classifyIntent(
    query: string,
    conversationContext?: {
      previousMessages?: Array<{ role: string; content: string }>;
      userId?: string;
      hasDocuments?: boolean;
    }
  ): Promise<IntentClassification> {
    const startTime = Date.now();

    // Layer 0: Try pattern-based classification first (no LLM)
    const patternResult = kodaPatternEngine.classifyByPatterns(query, conversationContext);

    if (patternResult && patternResult.confidence >= 0.7) {
      // Pattern matched with high confidence - use it
      console.log(`[IntentEngine] Pattern classification: ${patternResult.primaryIntent} (confidence: ${patternResult.confidence})`);
      return {
        ...patternResult,
        classificationTimeMs: Date.now() - startTime
      };
    }

    // Layer 1: Fall back to LLM classification
    console.log('[IntentEngine] Pattern classification failed or low confidence, using LLM');
    const llmResult = await this.classifyWithLLM(query, conversationContext);

    return {
      ...llmResult,
      classificationTimeMs: Date.now() - startTime
    };
  }

  /**
   * LLM-based classification (Layer 1)
   * Only called when pattern matching fails or has low confidence
   */
  private async classifyWithLLM(
    query: string,
    conversationContext?: {
      previousMessages?: Array<{ role: string; content: string }>;
      userId?: string;
      hasDocuments?: boolean;
    }
  ): Promise<IntentClassification> {
    const startTime = Date.now();

    try {
      const prompt = this.buildClassificationPrompt(query, conversationContext);

      const response = await geminiGateway.generateContent({
        prompt,
        config: { maxOutputTokens: 500, temperature: 0.1 } // Low temperature for consistent classification
      });

      const parsed = this.parseLLMResponse(response.text);

      return {
        primaryIntent: parsed.intent,
        confidence: parsed.confidence,
        wasClassifiedByRules: false,
        requiresLLMIntent: true,
        requiresRAG: INTENT_REQUIRES_RAG[parsed.intent],
        requiresLLM: INTENT_REQUIRES_LLM[parsed.intent],
        knowledgeSource: INTENT_KNOWLEDGE_SOURCE[parsed.intent],
        ragMode: INTENT_REQUIRES_RAG[parsed.intent] ? RAGMode.FULL_RAG : RAGMode.NO_RAG,
        targetDocumentScope: TargetDocumentScope.ALL_DOCUMENTS,
        answerStyle: this.determineAnswerStyle(parsed.intent),
        reasoningFlags: this.determineReasoningFlags(parsed.intent),
        entities: {
          keywords: parsed.keywords || []
        },
        matchedPatterns: [],
        matchedKeywords: parsed.keywords || [],
        classificationTimeMs: Date.now() - startTime
      };
    } catch (error) {
      console.error('[IntentEngine] LLM classification failed:', error);
      // Default to DOC_QA on error
      return this.buildDefaultClassification(PrimaryIntent.DOC_QA, Date.now() - startTime);
    }
  }

  /**
   * Build the prompt for LLM classification
   */
  private buildClassificationPrompt(
    query: string,
    context?: {
      previousMessages?: Array<{ role: string; content: string }>;
      hasDocuments?: boolean;
    }
  ): string {
    const intents = Object.values(PrimaryIntent).join(', ');

    let contextInfo = '';
    if (context?.previousMessages && context.previousMessages.length > 0) {
      const lastMessages = context.previousMessages.slice(-3);
      contextInfo = `\nConversation context:\n${lastMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;
    }

    return `Classify the following user query into ONE of these intent categories:
${intents}

Intent descriptions:
- DOC_QA: Questions about document content (e.g., "What does the contract say about...")
- DOC_ANALYTICS: Counts, lists, statistics about documents (e.g., "How many documents do I have?")
- DOC_MANAGEMENT: File actions like delete, rename, move, tag (e.g., "Delete the old report")
- PREFERENCE_UPDATE: User settings/preferences (e.g., "Remember that I prefer English")
- ANSWER_REWRITE: Modify previous answer (e.g., "Make that shorter", "Explain in more detail")
- FEEDBACK_POSITIVE: Positive feedback (e.g., "Thanks!", "Perfect!")
- FEEDBACK_NEGATIVE: Negative feedback (e.g., "That's wrong", "Not helpful")
- PRODUCT_HELP: How to use Koda (e.g., "How do I upload a document?")
- ONBOARDING_HELP: Getting started (e.g., "How do I get started?")
- GENERIC_KNOWLEDGE: World facts not from documents (e.g., "Who is the president of France?")
- REASONING_TASK: Math, logic, calculations (e.g., "Calculate 15% of 200")
- TEXT_TRANSFORM: Rewrite, translate text (e.g., "Translate this to Spanish")
- CHITCHAT: Greetings, small talk (e.g., "Hi!", "How are you?")
- META_AI: Questions about the AI (e.g., "What are you?", "Who created you?")
- OUT_OF_SCOPE: Harmful, illegal, inappropriate requests
- AMBIGUOUS: Query is too vague to classify
${contextInfo}

User query: "${query}"

Respond ONLY with a JSON object:
{"intent": "INTENT_NAME", "confidence": 0.0-1.0, "keywords": ["matched", "keywords"]}`;
  }

  /**
   * Parse LLM response into classification result
   */
  private parseLLMResponse(response: string): {
    intent: PrimaryIntent;
    confidence: number;
    keywords: string[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate intent
      const intent = parsed.intent as PrimaryIntent;
      if (!Object.values(PrimaryIntent).includes(intent)) {
        throw new Error(`Invalid intent: ${parsed.intent}`);
      }

      return {
        intent,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        keywords: parsed.keywords || []
      };
    } catch (error) {
      console.error('[IntentEngine] Failed to parse LLM response:', error);
      // Default to DOC_QA
      return {
        intent: PrimaryIntent.DOC_QA,
        confidence: 0.5,
        keywords: []
      };
    }
  }

  /**
   * Build default classification
   */
  private buildDefaultClassification(
    intent: PrimaryIntent,
    timeMs: number
  ): IntentClassification {
    return {
      primaryIntent: intent,
      confidence: 0.5,
      wasClassifiedByRules: false,
      requiresLLMIntent: true,
      requiresRAG: INTENT_REQUIRES_RAG[intent],
      requiresLLM: INTENT_REQUIRES_LLM[intent],
      knowledgeSource: INTENT_KNOWLEDGE_SOURCE[intent],
      ragMode: INTENT_REQUIRES_RAG[intent] ? RAGMode.FULL_RAG : RAGMode.NO_RAG,
      targetDocumentScope: TargetDocumentScope.ALL_DOCUMENTS,
      answerStyle: this.determineAnswerStyle(intent),
      reasoningFlags: this.determineReasoningFlags(intent),
      entities: {},
      matchedPatterns: [],
      matchedKeywords: [],
      classificationTimeMs: timeMs
    };
  }

  /**
   * Determine answer style based on intent
   */
  private determineAnswerStyle(intent: PrimaryIntent): AnswerStyle {
    switch (intent) {
      case PrimaryIntent.DOC_QA:
        return AnswerStyle.FACTUAL_SHORT;
      case PrimaryIntent.DOC_ANALYTICS:
        return AnswerStyle.STRUCTURED_LIST;
      case PrimaryIntent.PRODUCT_HELP:
      case PrimaryIntent.ONBOARDING_HELP:
        return AnswerStyle.INSTRUCTIONAL_STEPS;
      case PrimaryIntent.CHITCHAT:
        return AnswerStyle.DIALOGUE_CHITCHAT;
      case PrimaryIntent.GENERIC_KNOWLEDGE:
      case PrimaryIntent.REASONING_TASK:
        return AnswerStyle.EXPLANATORY_PARAGRAPH;
      default:
        return AnswerStyle.EXPLANATORY_PARAGRAPH;
    }
  }

  /**
   * Determine reasoning flags based on intent
   */
  private determineReasoningFlags(intent: PrimaryIntent): ReasoningFlags {
    return {
      requiresNumericReasoning: intent === PrimaryIntent.REASONING_TASK || intent === PrimaryIntent.DOC_ANALYTICS,
      requiresComparison: false,
      requiresTimeline: false,
      requiresExtraction: intent === PrimaryIntent.DOC_QA,
      requiresMemoryWrite: intent === PrimaryIntent.PREFERENCE_UPDATE
    };
  }
}

// Export singleton instance
export const kodaIntentEngine = KodaIntentEngine.getInstance();
