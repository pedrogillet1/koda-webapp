/**
 * Fallback Detection Service
 *
 * Detects when and why a fallback response is needed.
 * Implements 4 fallback types (NO safety fallback - user data is always accessible):
 *
 * 1. Clarification Fallback - Query is ambiguous or incomplete
 * 2. Knowledge Fallback - Information doesn't exist in documents
 * 3. Refusal Fallback - Request is outside Koda's capabilities
 * 4. Error Recovery Fallback - Technical error occurred
 */

export type FallbackType = 'clarification' | 'knowledge' | 'refusal' | 'error_recovery' | 'none';

export interface FallbackDetectionResult {
  needsFallback: boolean;
  fallbackType: FallbackType;
  reason: string;
  confidence: number; // 0-1, how confident we are this is the right fallback
  context: {
    query: string;
    documentCount: number;
    ragResults?: any[];
    errorDetails?: string;
  };
}

export interface DetectionConfig {
  query: string;
  documentCount: number;
  ragResults?: any[];
  ragScore?: number;
  errorDetails?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

class FallbackDetectionService {
  /**
   * Main detection function - determines if fallback is needed and which type
   */
  detectFallback(config: DetectionConfig): FallbackDetectionResult {
    const { query, documentCount, ragResults, ragScore, errorDetails } = config;

    // 1. Check for Error Recovery Fallback (highest priority)
    if (errorDetails) {
      return {
        needsFallback: true,
        fallbackType: 'error_recovery',
        reason: 'Technical error occurred',
        confidence: 1.0,
        context: { query, documentCount, errorDetails }
      };
    }

    // 2. Check for Clarification Fallback (ambiguous query)
    // BUT: Skip clarification if RAG found good results
    // NOTE: RRF scores are typically 0.01-0.05, NOT 0-1 like cosine similarity
    const hasGoodRagResults = ragScore !== undefined && ragScore > 0.01 &&
                              ragResults && ragResults.length > 0;

    const clarificationCheck = this.checkClarificationNeeded(query, documentCount);
    if (clarificationCheck.needed && !hasGoodRagResults) {
      return {
        needsFallback: true,
        fallbackType: 'clarification',
        reason: clarificationCheck.reason,
        confidence: clarificationCheck.confidence,
        context: { query, documentCount, ragResults }
      };
    }

    // 3. Check for Refusal Fallback (outside capabilities)
    const refusalCheck = this.checkRefusalNeeded(query);
    if (refusalCheck.needed) {
      return {
        needsFallback: true,
        fallbackType: 'refusal',
        reason: refusalCheck.reason,
        confidence: refusalCheck.confidence,
        context: { query, documentCount }
      };
    }

    // 4. Check for Knowledge Fallback (no relevant results)
    const knowledgeCheck = this.checkKnowledgeGap(ragResults, ragScore, documentCount);
    if (knowledgeCheck.needed) {
      return {
        needsFallback: true,
        fallbackType: 'knowledge',
        reason: knowledgeCheck.reason,
        confidence: knowledgeCheck.confidence,
        context: { query, documentCount, ragResults }
      };
    }

    // No fallback needed
    return {
      needsFallback: false,
      fallbackType: 'none',
      reason: 'Sufficient information to answer',
      confidence: 1.0,
      context: { query, documentCount, ragResults }
    };
  }

  /**
   * Check if clarification is needed (ambiguous query)
   */
  private checkClarificationNeeded(query: string, documentCount: number): {
    needed: boolean;
    reason: string;
    confidence: number;
  } {
    const queryLower = query.toLowerCase().trim();

    // Pattern 1: Vague pronouns without context
    // Check for pronouns at start OR in common question patterns like "what does it say"
    const vaguePronouns = ['it', 'this', 'that', 'these', 'those', 'they', 'them'];
    const startsWithVaguePronoun = vaguePronouns.some(pronoun =>
      queryLower.startsWith(pronoun + ' ') || queryLower === pronoun
    );

    // Also check for vague pronouns in question patterns like "what does it say", "what is it about"
    const vagueInQuestionPatterns = [
      /what (does|did|do|is|are|was|were) (it|this|that|they|them)\b/i,
      /how (does|did|do|is|are|was|were) (it|this|that|they|them)\b/i,
      /where (does|did|do|is|are|was|were) (it|this|that|they|them)\b/i,
      /when (does|did|do|is|are|was|were) (it|this|that|they|them)\b/i,
      /why (does|did|do|is|are|was|were) (it|this|that|they|them)\b/i,
      /can you (explain|describe|tell me about) (it|this|that|them)\b/i,
      /tell me (about|more about) (it|this|that|them)\b/i,
    ];
    const hasVagueInQuestion = vagueInQuestionPatterns.some(pattern => pattern.test(queryLower));

    if (startsWithVaguePronoun || hasVagueInQuestion) {
      return {
        needed: true,
        reason: 'Query uses vague pronoun without clear referent',
        confidence: 0.9
      };
    }

    // Pattern 2: Generic "the document/file/report" with multiple documents
    const genericReferences = [
      'the document', 'the file', 'the report', 'the spreadsheet',
      'the pdf', 'the excel', 'the presentation'
    ];
    const hasGenericReference = genericReferences.some(ref => queryLower.includes(ref));
    if (hasGenericReference && documentCount > 1) {
      return {
        needed: true,
        reason: 'Generic document reference with multiple documents available',
        confidence: 0.85
      };
    }

    // Pattern 3: Incomplete questions
    const incompletePatterns = [
      /^what about/i,
      /^how about/i,
      /^and\s/i,
      /^also\s/i,
      /^\?+$/,
      /^tell me$/i,
      /^show me$/i
    ];
    if (incompletePatterns.some(pattern => pattern.test(queryLower))) {
      return {
        needed: true,
        reason: 'Incomplete or context-dependent question',
        confidence: 0.8
      };
    }

    // Pattern 4: Multiple possible interpretations
    const ambiguousTerms = [
      { term: 'revenue', alternatives: ['total revenue', 'monthly revenue', 'annual revenue', 'q1 revenue', 'q2 revenue', 'q3 revenue', 'q4 revenue'] },
      { term: 'cost', alternatives: ['total cost', 'operating cost', 'capital cost', 'monthly cost'] },
      { term: 'report', alternatives: ['financial report', 'status report', 'analysis report', 'quarterly report'] }
    ];

    for (const { term, alternatives } of ambiguousTerms) {
      if (queryLower.includes(term) && !alternatives.some(alt => queryLower.includes(alt))) {
        // Only flag as ambiguous if document count > 1 and query is very short
        if (documentCount > 1 && query.split(/\s+/).length < 5) {
          return {
            needed: true,
            reason: `Ambiguous term "${term}" could mean multiple things`,
            confidence: 0.7
          };
        }
      }
    }

    // Pattern 5: Very short queries (< 3 words) that aren't clear commands
    const wordCount = query.trim().split(/\s+/).length;
    const isCommand = /^(list|show|find|search|summarize|explain|what|who|when|where|why|how)/i.test(queryLower);
    if (wordCount < 3 && !isCommand) {
      return {
        needed: true,
        reason: 'Query too short to understand intent',
        confidence: 0.75
      };
    }

    return { needed: false, reason: '', confidence: 0 };
  }

  /**
   * Check if refusal is needed (outside capabilities)
   */
  private checkRefusalNeeded(query: string): {
    needed: boolean;
    reason: string;
    confidence: number;
  } {
    const queryLower = query.toLowerCase().trim();

    // Pattern 1: Real-time information requests
    const realTimePatterns = [
      /current (price|stock|weather|news)/i,
      /today'?s (price|stock|weather|news)/i,
      /latest (price|stock|news)/i,
      /right now/i,
      /at this moment/i,
      /live (data|feed|stream)/i
    ];
    if (realTimePatterns.some(pattern => pattern.test(query))) {
      return {
        needed: true,
        reason: 'Request requires real-time data not available in documents',
        confidence: 0.9
      };
    }

    // Pattern 2: External actions (sending emails, making purchases, file operations, etc.)
    const actionPatterns = [
      // Communication actions
      /send (an? )?(email|message|notification)/i,
      /call (someone|them|him|her|\w+)/i,
      /text (someone|them|him|her|\w+)/i,

      // Financial actions
      /make (a )?(payment|purchase|order|reservation)/i,
      /pay (for |the |\$|\d)/i,
      /transfer (money|\$|\d)/i,

      // Calendar/scheduling actions
      /book (a )?(flight|hotel|appointment|meeting)/i,
      /schedule (a )?(meeting|call|appointment)/i,
      /set (a )?(reminder|alarm|timer)/i,

      // File modification actions (Koda is read-only for documents)
      /^delete\b/i,
      /delete (the |this |my |a )?(\w+ )?(file|document|folder)/i,
      /^rename\b/i,
      /rename (the |this |my |a )?(\w+ )?(file|document|folder)/i,
      /modify (the |this |my )?(\w+ )?(file|document)/i,
      /edit (the |this |my )?(\w+ )?(file|document)/i,
      /move (the |this |my )?(\w+ )?(file|document|folder)/i,
      /copy (the |this |my )?(\w+ )?(file|document|folder)/i,
      /create (a |new )?(file|document|folder)/i,

      // System actions
      /open (the |my )?(app|application|program|browser)/i,
      /close (the |my )?(app|application|program|browser)/i,
      /install\b/i,
      /download\b/i,
      /upload\b/i  // Note: upload documents is handled separately
    ];
    if (actionPatterns.some(pattern => pattern.test(query))) {
      return {
        needed: true,
        reason: 'Request requires external action beyond document analysis',
        confidence: 0.95
      };
    }

    // Pattern 3: Personal opinions or subjective judgments
    const opinionPatterns = [
      /do you think/i,
      /in your opinion/i,
      /what do you believe/i,
      /do you like/i,
      /do you prefer/i,
      /what'?s your (favorite|preference)/i
    ];
    if (opinionPatterns.some(pattern => pattern.test(query))) {
      return {
        needed: true,
        reason: 'Request asks for personal opinion, not document analysis',
        confidence: 0.85
      };
    }

    // Pattern 4: Requests for predictions or speculation (without document context)
    const predictionPatterns = [
      /will (the market|stocks|prices) (go|rise|fall|crash)/i,
      /predict (the |what )/i,
      /what will happen (to|if|when)/i,
      /forecast (for |the )/i
    ];
    if (predictionPatterns.some(pattern => pattern.test(query))) {
      return {
        needed: true,
        reason: 'Request asks for prediction beyond document content',
        confidence: 0.7
      };
    }

    return { needed: false, reason: '', confidence: 0 };
  }

  /**
   * Check if knowledge gap exists (no relevant results)
   */
  private checkKnowledgeGap(
    ragResults: any[] | undefined,
    ragScore: number | undefined,
    documentCount: number
  ): {
    needed: boolean;
    reason: string;
    confidence: number;
  } {
    // No documents at all
    if (documentCount === 0) {
      return {
        needed: true,
        reason: 'No documents uploaded',
        confidence: 1.0
      };
    }

    // No RAG results returned
    if (!ragResults || ragResults.length === 0) {
      return {
        needed: true,
        reason: 'No relevant information found in documents',
        confidence: 0.9
      };
    }

    // RAG score too low (results not relevant)
    // NOTE: RRF scores are typically 0.01-0.05, NOT 0-1 like cosine similarity
    if (ragScore !== undefined && ragScore < 0.005) {
      return {
        needed: true,
        reason: 'Retrieved information not relevant to query',
        confidence: 0.85
      };
    }

    // Very few results with low scores
    // NOTE: RRF scores are typically 0.01-0.05, NOT 0-1 like cosine similarity
    if (ragResults.length < 2 && ragScore !== undefined && ragScore < 0.003) {
      return {
        needed: true,
        reason: 'Limited relevant information available',
        confidence: 0.75
      };
    }

    return { needed: false, reason: '', confidence: 0 };
  }

  /**
   * Detect if query is a metadata request (not content search)
   */
  isMetadataQuery(query: string): boolean {
    const metadataPatterns = [
      // File listing
      /what (documents|files) do i have/i,
      /list (my|all) (documents|files)/i,
      /show me (my|all) (documents|files)/i,
      /what have i uploaded/i,

      // File count
      /how many (documents|files)/i,
      /count (documents|files)/i,

      // File types
      /what types of (documents|files)/i,
      /what formats/i,

      // File names
      /what are the (names|titles)/i,
      /list (document|file) names/i,

      // Folder structure
      /what folders/i,
      /folder structure/i,
      /directory/i,
      /my uploads/i
    ];

    return metadataPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Detect if query requires synthesis across all documents
   */
  isSynthesisQuery(query: string): boolean {
    const synthesisPatterns = [
      /summarize (all|everything|my documents)/i,
      /overview of (all|everything|my documents)/i,
      /what do (all|my documents) have in common/i,
      /compare all/i,
      /across all (documents|files)/i,
      /main themes/i,
      /key insights from all/i,
      /overall (summary|conclusion|analysis)/i,
      /everything (together|combined)/i
    ];

    return synthesisPatterns.some(pattern => pattern.test(query));
  }

  /**
   * Get fallback type description for logging/analytics
   */
  getFallbackDescription(type: FallbackType): string {
    const descriptions: Record<FallbackType, string> = {
      clarification: 'Query was ambiguous or incomplete - asked for clarification',
      knowledge: 'Information not found in uploaded documents',
      refusal: 'Request was outside Koda\'s document analysis capabilities',
      error_recovery: 'Technical error occurred during processing',
      none: 'No fallback needed - normal response generated'
    };
    return descriptions[type];
  }
}

export default new FallbackDetectionService();
