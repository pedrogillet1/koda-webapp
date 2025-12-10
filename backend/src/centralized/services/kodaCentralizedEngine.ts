/**
 * ============================================================================
 * KODA CENTRALIZED ENGINE - Main Integration Service
 * ============================================================================
 * 
 * This is the main entry point for the centralized pattern and formatting system.
 * It integrates the pattern matcher and answer formatter into a single, cohesive service.
 * 
 * This service should be called from:
 * - rag.service.ts
 * - kodaAnswerEngine.service.ts
 * - Any other service that needs intent detection or answer formatting
 * 
 * Features:
 * - Unified intent detection
 * - Unified answer formatting
 * - Mode-aware processing
 * - Consistent output quality
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  LanguageCode,
  QueryIntent,
  AnswerMode,
  IntentDetectionResult,
  FormattingContext,
  FormattedOutput,
  QueryComplexity,
} from '../types';

import { centralizedPatternMatcher } from './centralizedPatternMatcher';
import { centralizedAnswerFormatter } from '../formatters/centralizedAnswerFormatter';

// ============================================================================
// KODA CENTRALIZED ENGINE
// ============================================================================

export class KodaCentralizedEngine {
  
  /**
   * Analyze query and return comprehensive analysis
   */
  async analyzeQuery(query: string, context?: {
    conversationId?: string;
    userId?: string;
    documentCount?: number;
  }): Promise<{
    intent: IntentDetectionResult | null;
    language: LanguageCode;
    answerMode: AnswerMode;
    complexity: QueryComplexity;
  }> {
    console.log(`🧠 [CENTRALIZED-ENGINE] Analyzing query: "${query.substring(0, 50)}..."`);
    
    // Step 1: Detect language
    const language = centralizedPatternMatcher.detectLanguage(query);
    console.log(`🧠 [CENTRALIZED-ENGINE] Detected language: ${language}`);
    
    // Step 2: Detect intent
    const intent = centralizedPatternMatcher.detectIntent(query, language);
    console.log(`🧠 [CENTRALIZED-ENGINE] Detected intent: ${intent?.intent || 'UNKNOWN'}`);
    
    // Step 3: Determine answer mode
    const answerMode = intent?.answerMode || AnswerMode.SINGLE_DOC_FACTUAL;
    console.log(`🧠 [CENTRALIZED-ENGINE] Answer mode: ${answerMode}`);
    
    // Step 4: Determine complexity
    const complexity = this.determineComplexity(query, intent);
    console.log(`🧠 [CENTRALIZED-ENGINE] Complexity: ${complexity}`);
    
    return {
      intent,
      language,
      answerMode,
      complexity,
    };
  }
  
  /**
   * Format answer based on query analysis
   */
  formatAnswer(
    rawAnswer: string,
    analysis: {
      intent: IntentDetectionResult | null;
      language: LanguageCode;
      answerMode: AnswerMode;
      complexity: QueryComplexity;
    },
    context?: {
      query: string;
      documentCount?: number;
      hasMultipleSources?: boolean;
      isFollowUp?: boolean;
      isError?: boolean;
    }
  ): FormattedOutput {
    console.log(`🎨 [CENTRALIZED-ENGINE] Formatting answer for mode: ${analysis.answerMode}`);
    
    // Build formatting context
    const formattingContext: FormattingContext = {
      query: context?.query || '',
      intent: analysis.intent?.intent || QueryIntent.FACTUAL_QUESTION,
      answerMode: analysis.answerMode,
      complexity: analysis.complexity,
      language: analysis.language,
      documentCount: context?.documentCount,
      hasMultipleSources: context?.hasMultipleSources,
      isFollowUp: context?.isFollowUp,
      isError: context?.isError,
    };
    
    // Format answer
    const formatted = centralizedAnswerFormatter.formatAnswer(rawAnswer, formattingContext);
    
    console.log(`🎨 [CENTRALIZED-ENGINE] Formatting complete`);
    console.log(`🎨 [CENTRALIZED-ENGINE] Stats: ${formatted.stats.paragraphCount}p, ${formatted.stats.headingCount}h, ${formatted.stats.boldCount}b`);
    
    return formatted;
  }
  
  /**
   * Complete pipeline: analyze query + format answer
   */
  async processQuery(
    query: string,
    rawAnswer: string,
    context?: {
      conversationId?: string;
      userId?: string;
      documentCount?: number;
      hasMultipleSources?: boolean;
      isFollowUp?: boolean;
      isError?: boolean;
    }
  ): Promise<{
    analysis: {
      intent: IntentDetectionResult | null;
      language: LanguageCode;
      answerMode: AnswerMode;
      complexity: QueryComplexity;
    };
    formatted: FormattedOutput;
  }> {
    console.log(`🚀 [CENTRALIZED-ENGINE] Processing query: "${query.substring(0, 50)}..."`);
    
    // Step 1: Analyze query
    const analysis = await this.analyzeQuery(query, context);
    
    // Step 2: Format answer
    const formatted = this.formatAnswer(rawAnswer, analysis, {
      query,
      documentCount: context?.documentCount,
      hasMultipleSources: context?.hasMultipleSources,
      isFollowUp: context?.isFollowUp,
      isError: context?.isError,
    });
    
    console.log(`🚀 [CENTRALIZED-ENGINE] Processing complete`);
    
    return {
      analysis,
      formatted,
    };
  }
  
  /**
   * Determine query complexity
   */
  private determineComplexity(
    query: string,
    intent: IntentDetectionResult | null
  ): QueryComplexity {
    // Ultra-simple queries
    if (intent?.intent === QueryIntent.GREETING ||
        intent?.intent === QueryIntent.COUNT_DOCUMENTS ||
        intent?.intent === QueryIntent.LIST_DOCUMENTS) {
      return QueryComplexity.TRIVIAL;
    }
    
    // Simple queries
    if (intent?.intent === QueryIntent.OPEN_DOCUMENT ||
        intent?.intent === QueryIntent.NAVIGATE_TO_SECTION ||
        intent?.intent === QueryIntent.FIND_IN_DOCUMENT) {
      return QueryComplexity.SIMPLE;
    }
    
    // Complex queries
    if (intent?.intent === QueryIntent.COMPARISON_QUESTION ||
        intent?.intent === QueryIntent.SYNTHESIS_QUESTION ||
        intent?.intent === QueryIntent.FINANCIAL_ANALYSIS) {
      return QueryComplexity.COMPLEX;
    }
    
    // Very complex queries
    if (intent?.intent === QueryIntent.ANALYTICAL_QUESTION ||
        query.length > 200 ||
        (query.match(/\band\b/gi) || []).length > 2) {
      return QueryComplexity.VERY_COMPLEX;
    }
    
    // Default: moderate
    return QueryComplexity.MODERATE;
  }
  
  /**
   * Check if query needs documents
   */
  needsDocuments(intent: IntentDetectionResult | null): boolean {
    return intent?.requiresDocuments || false;
  }
  
  /**
   * Check if query needs retrieval
   */
  needsRetrieval(intent: IntentDetectionResult | null): boolean {
    return intent?.requiresRetrieval || false;
  }
  
  /**
   * Get speed profile for query
   */
  getSpeedProfile(intent: IntentDetectionResult | null) {
    return intent?.speedProfile || 'NORMAL';
  }
  
  /**
   * Get output format for query
   */
  getOutputFormat(intent: IntentDetectionResult | null) {
    return intent?.outputFormat || 'FACT';
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const kodaCentralizedEngine = new KodaCentralizedEngine();

// ============================================================================
// CONVENIENCE FUNCTIONS FOR EASY INTEGRATION
// ============================================================================

/**
 * Quick function to analyze a query
 */
export async function analyzeQuery(query: string, context?: any) {
  return kodaCentralizedEngine.analyzeQuery(query, context);
}

/**
 * Quick function to format an answer
 */
export function formatAnswer(rawAnswer: string, analysis: any, context?: any) {
  return kodaCentralizedEngine.formatAnswer(rawAnswer, analysis, context);
}

/**
 * Quick function to process query + format answer
 */
export async function processQuery(query: string, rawAnswer: string, context?: any) {
  return kodaCentralizedEngine.processQuery(query, rawAnswer, context);
}
