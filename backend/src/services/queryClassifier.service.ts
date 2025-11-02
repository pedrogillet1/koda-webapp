/**
 * Query Classifier Service
 *
 * Automatically detects query type and determines appropriate response style
 * to ensure KODA provides ChatGPT-level precision
 *
 * Features:
 * - Pattern-based query type detection
 * - Response style mapping
 * - Word count guidance
 */

export enum QueryType {
  FACTUAL_EXTRACTION = 'factual_extraction',      // "What is X?"
  LIST_ENUMERATION = 'list_enumeration',          // "What documents do I have?"
  COMPARISON = 'comparison',                      // "Compare X and Y"
  SUMMARY = 'summary',                            // "What is this about?"
  ANALYSIS = 'analysis',                          // "Analyze X"
  CALCULATION = 'calculation',                    // "What is the total?"
  NAVIGATION = 'navigation',                      // "Which documents mention X?"
  EXPLANATION = 'explanation',                    // "Explain X"
  GREETING = 'greeting',                          // "Hello", "Hi"
}

export enum ResponseStyle {
  ULTRA_CONCISE = 'ultra_concise',    // Single word/number/date
  CONCISE = 'concise',                // 1-2 sentences
  MODERATE = 'moderate',              // 1 paragraph
  DETAILED = 'detailed',              // Multiple paragraphs
  STRUCTURED = 'structured',          // Numbered sections, headers
}

export interface QueryClassification {
  type: QueryType;
  style: ResponseStyle;
  confidence: number;
  reasoning?: string;
}

export class QueryClassifierService {

  /**
   * Classify a user query to determine response style
   */
  async classifyQuery(query: string): Promise<QueryClassification> {
    const queryLower = query.toLowerCase().trim();

    // Check for greetings first
    if (this.isGreeting(queryLower)) {
      return {
        type: QueryType.GREETING,
        style: ResponseStyle.CONCISE,
        confidence: 1.0,
        reasoning: 'Detected greeting pattern',
      };
    }

    // Pattern matching for query types
    const patterns = {
      factual_extraction: [
        /^what is (the|my|your)?\s*(expiration date|date|number|amount|value|price|cost|name|address|phone)/i,
        /^when (does|did|is|was)/i,
        /^how much/i,
        /^who (is|was)/i,
        /^where (is|was)/i,
        /^what (date|time)/i,
      ],
      list_enumeration: [
        /^(what|which|list) (documents|files)/i,
        /^show me all/i,
        /^list (all|the)/i,
        /^what do i have/i,
        /^what are (my|the)/i,
      ],
      comparison: [
        /^compare/i,
        /^what (are|is) the (difference|differences)/i,
        /^how (does|do) .* (differ|compare)/i,
        /^(difference|differences) between/i,
      ],
      summary: [
        /^(what is|summarize|summary of) .* about/i,
        /^give me (a|an) (summary|overview)/i,
        /^what (does|is) .* (blueprint|plan|document|file)/i,
        /tell me about/i,
      ],
      calculation: [
        /^what is the (total|sum|average|mean)/i,
        /^calculate/i,
        /^how many/i,
        /^count/i,
      ],
      navigation: [
        /^which (document|file) (contains|mentions|has)/i,
        /^find (all|the) (documents|files)/i,
        /^where (can i find|is)/i,
      ],
      explanation: [
        /^explain/i,
        /^how (does|do)/i,
        /^why/i,
        /^what does .* mean/i,
      ],
      analysis: [
        /^analyze/i,
        /^provide (a|an) analysis/i,
        /^break down/i,
      ],
    };

    // Check patterns with priority (more specific first)
    for (const [type, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        if (regex.test(query)) {
          return {
            type: type as QueryType,
            style: this.getStyleForType(type as QueryType),
            confidence: 0.9,
            reasoning: `Matched pattern for ${type}`,
          };
        }
      }
    }

    // Fallback: analyze query length and complexity
    return this.analyzeComplexity(query);
  }

  /**
   * Check if query is a greeting
   */
  private isGreeting(query: string): boolean {
    const greetings = [
      /^(hi|hello|hey|greetings|good morning|good afternoon|good evening)$/i,
      /^how are you/i,
      /^what'?s up/i,
      /^(thanks|thank you)/i,
    ];

    return greetings.some(pattern => pattern.test(query));
  }

  /**
   * Analyze query complexity for fallback classification
   */
  private analyzeComplexity(query: string): QueryClassification {
    const words = query.split(/\s+/).length;

    // Short questions (1-5 words) - likely factual
    if (words <= 5) {
      return {
        type: QueryType.FACTUAL_EXTRACTION,
        style: ResponseStyle.CONCISE,
        confidence: 0.6,
        reasoning: 'Short query - assuming factual',
      };
    }

    // Medium questions (6-15 words) - moderate response
    if (words <= 15) {
      return {
        type: QueryType.EXPLANATION,
        style: ResponseStyle.MODERATE,
        confidence: 0.5,
        reasoning: 'Medium-length query - moderate response',
      };
    }

    // Long questions - detailed response
    return {
      type: QueryType.ANALYSIS,
      style: ResponseStyle.DETAILED,
      confidence: 0.5,
      reasoning: 'Long query - detailed response',
    };
  }

  /**
   * Map query type to response style
   */
  private getStyleForType(type: QueryType): ResponseStyle {
    const styleMap: Record<QueryType, ResponseStyle> = {
      [QueryType.FACTUAL_EXTRACTION]: ResponseStyle.ULTRA_CONCISE,
      [QueryType.LIST_ENUMERATION]: ResponseStyle.CONCISE,
      [QueryType.COMPARISON]: ResponseStyle.STRUCTURED,
      [QueryType.SUMMARY]: ResponseStyle.DETAILED,
      [QueryType.ANALYSIS]: ResponseStyle.DETAILED,
      [QueryType.CALCULATION]: ResponseStyle.ULTRA_CONCISE,
      [QueryType.NAVIGATION]: ResponseStyle.CONCISE,
      [QueryType.EXPLANATION]: ResponseStyle.MODERATE,
      [QueryType.GREETING]: ResponseStyle.CONCISE,
    };

    return styleMap[type];
  }

  /**
   * Get word count guidance for response style
   * UPDATED: All answers must be in bullet format with max 2-line intro
   */
  getWordCountGuidance(style: ResponseStyle): string {
    const guidance: Record<ResponseStyle, string> = {
      [ResponseStyle.ULTRA_CONCISE]: 'Use bullets. Brief intro (max 2 lines) + 2-4 bullets with key info.',
      [ResponseStyle.CONCISE]: 'Use bullets. Brief intro (max 2 lines) + 3-6 bullets with details.',
      [ResponseStyle.MODERATE]: 'Use bullets. Brief intro (max 2 lines) + comprehensive bullet list.',
      [ResponseStyle.DETAILED]: 'Use bullets. Brief intro (max 2 lines) + detailed bullet list with all info.',
      [ResponseStyle.STRUCTURED]: 'Use bullets or tables. Brief intro (max 2 lines) + structured bullet sections.',
    };

    return guidance[style];
  }

  /**
   * Get max tokens for response style
   * UPDATED: Increased limits to allow bullet-point formatting (all answers must be bullets)
   */
  getMaxTokens(style: ResponseStyle): number {
    const tokenLimits: Record<ResponseStyle, number> = {
      [ResponseStyle.ULTRA_CONCISE]: 800,     // Allow bullets for short answers
      [ResponseStyle.CONCISE]: 1500,          // Allow bullets for concise answers
      [ResponseStyle.MODERATE]: 3000,         // Comprehensive bullet answers
      [ResponseStyle.DETAILED]: 4000,         // Long detailed bullet answers
      [ResponseStyle.STRUCTURED]: 4000,       // Full structured responses with tables
    };

    return tokenLimits[style];
  }

  /**
   * Get temperature for query type (factual = low, creative = high)
   */
  getTemperature(type: QueryType): number {
    const temperatureMap: Record<QueryType, number> = {
      [QueryType.FACTUAL_EXTRACTION]: 0.1,  // Very precise
      [QueryType.CALCULATION]: 0.1,
      [QueryType.LIST_ENUMERATION]: 0.2,
      [QueryType.NAVIGATION]: 0.2,
      [QueryType.COMPARISON]: 0.3,
      [QueryType.SUMMARY]: 0.4,
      [QueryType.EXPLANATION]: 0.4,
      [QueryType.ANALYSIS]: 0.5,
      [QueryType.GREETING]: 0.7,
    };

    return temperatureMap[type];
  }
}

export default new QueryClassifierService();
