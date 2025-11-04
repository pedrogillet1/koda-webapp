/**
 * CONFIDENCE ASSESSMENT SERVICE - KODA FIX
 *
 * PROBLEM SOLVED:
 * - Warning messages appear even when answers are perfect
 * - Low confidence scores trigger unnecessary warnings
 * - All queries treated the same (no context-aware thresholds)
 *
 * SOLUTION:
 * - Multi-factor confidence scoring (retrieval quality + answer analysis)
 * - Context-aware thresholds for different query types
 * - Smart warning generation (only when truly needed)
 * - Detect when answer has specific information vs generic responses
 */

export interface ConfidenceFactors {
  retrievalSimilarity: number; // Average similarity of top chunks
  hasSpecificInfo: boolean; // Answer contains specific data (numbers, names, dates)
  answerLength: number; // Length of generated answer
  sourceCount: number; // Number of unique sources
  queryType: 'simple' | 'complex' | 'comparison' | 'meta'; // Query complexity
}

export interface ConfidenceAssessment {
  overallScore: number; // 0-1 scale
  shouldShowWarning: boolean;
  warningMessage: string | null;
  factors: ConfidenceFactors;
  reasoning: string;
}

class ConfidenceAssessmentService {
  /**
   * Assess confidence in the answer quality
   * Returns whether to show a warning and what warning to show
   */
  assessConfidence(
    answer: string,
    sources: Array<{ similarity: number; content: string }>,
    queryType: 'simple' | 'complex' | 'comparison' | 'meta' = 'simple'
  ): ConfidenceAssessment {
    // Step 1: Calculate retrieval similarity score
    const avgSimilarity = sources.length > 0
      ? sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length
      : 0;

    const topSimilarity = sources.length > 0 ? sources[0].similarity : 0;

    // Step 2: Analyze answer content
    const hasSpecificInfo = this.hasSpecificInformation(answer);
    const hasStructuredData = this.hasStructuredData(answer);
    const answerLength = answer.trim().length;

    // Step 3: Calculate confidence factors
    const factors: ConfidenceFactors = {
      retrievalSimilarity: avgSimilarity,
      hasSpecificInfo,
      answerLength,
      sourceCount: sources.length,
      queryType,
    };

    // Step 4: Calculate overall confidence score (0-1)
    let overallScore = 0;

    // Retrieval quality (40% weight)
    const retrievalScore = Math.min(1, (topSimilarity - 0.5) / 0.3); // 0.5-0.8 range normalized
    overallScore += retrievalScore * 0.4;

    // Answer quality (35% weight)
    let answerScore = 0;
    if (hasSpecificInfo) answerScore += 0.5;
    if (hasStructuredData) answerScore += 0.3;
    if (answerLength > 100) answerScore += 0.2;
    overallScore += answerScore * 0.35;

    // Source quality (25% weight)
    const sourceScore = Math.min(1, sources.length / 5); // 5+ sources = perfect score
    overallScore += sourceScore * 0.25;

    // Step 5: Adjust thresholds based on query type
    const threshold = this.getConfidenceThreshold(queryType);

    // Step 6: Determine if warning should be shown
    const shouldShowWarning = overallScore < threshold;

    // Step 7: Generate appropriate warning message
    const warningMessage = shouldShowWarning
      ? this.generateWarningMessage(factors, overallScore)
      : null;

    // Step 8: Generate reasoning
    const reasoning = this.generateReasoning(factors, overallScore, threshold);

    console.log(`📊 [ConfidenceAssessment] Score: ${(overallScore * 100).toFixed(1)}% | Threshold: ${(threshold * 100).toFixed(0)}% | Warning: ${shouldShowWarning}`);

    return {
      overallScore,
      shouldShowWarning,
      warningMessage,
      factors,
      reasoning,
    };
  }

  /**
   * Get confidence threshold based on query type
   * Different query types have different expectations
   */
  private getConfidenceThreshold(queryType: 'simple' | 'complex' | 'comparison' | 'meta'): number {
    switch (queryType) {
      case 'simple':
        return 0.65; // Simple queries need high confidence to show warning
      case 'complex':
        return 0.55; // Complex queries are naturally harder
      case 'comparison':
        return 0.60; // Comparisons need good coverage of both documents
      case 'meta':
        return 0.50; // Meta queries about KODA itself are less strict
      default:
        return 0.60;
    }
  }

  /**
   * Check if answer contains specific information
   * Specific info = numbers, proper nouns, dates, technical terms
   */
  private hasSpecificInformation(answer: string): boolean {
    const specificPatterns = [
      /\b\d+(\.\d+)?%?\b/, // Numbers (including percentages)
      /\b\d{4}\b/, // Years
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i, // Months
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/, // Proper nouns (capitalized phrases)
      /\$\d+/, // Money amounts
      /\b(?:https?:\/\/|www\.)\S+\b/, // URLs
      /\b[A-Z]{2,}\b/, // Acronyms
    ];

    return specificPatterns.some(pattern => pattern.test(answer));
  }

  /**
   * Check if answer has structured data (lists, tables, formatted content)
   */
  private hasStructuredData(answer: string): boolean {
    const structuredPatterns = [
      /^\s*[-*•]\s+/m, // Bullet points
      /^\s*\d+\.\s+/m, // Numbered lists
      /\|.*\|/m, // Tables (markdown)
      /```[\s\S]*```/, // Code blocks
      /^#{1,6}\s+/m, // Headers
    ];

    return structuredPatterns.some(pattern => pattern.test(answer));
  }

  /**
   * Generate appropriate warning message based on confidence factors
   */
  private generateWarningMessage(factors: ConfidenceFactors, score: number): string {
    // Very low retrieval similarity
    if (factors.retrievalSimilarity < 0.5) {
      return "I couldn't find highly relevant information in your documents for this query. The answer may be incomplete or based on loosely related content.";
    }

    // Low source count
    if (factors.sourceCount < 2) {
      return "This answer is based on limited sources from your documents. Consider uploading more related documents for comprehensive answers.";
    }

    // Short answer without specific info
    if (factors.answerLength < 50 && !factors.hasSpecificInfo) {
      return "I found some related information, but it may not fully answer your question. Try rephrasing or asking for specific details.";
    }

    // Generic low confidence
    if (score < 0.4) {
      return "I have low confidence in this answer. The available information may not directly address your question.";
    }

    // Moderate low confidence
    return "This answer may be incomplete. Consider asking for clarification or uploading more relevant documents.";
  }

  /**
   * Generate reasoning for the confidence score (for debugging)
   */
  private generateReasoning(
    factors: ConfidenceFactors,
    score: number,
    threshold: number
  ): string {
    const reasons: string[] = [];

    if (factors.retrievalSimilarity > 0.7) {
      reasons.push('High retrieval similarity');
    } else if (factors.retrievalSimilarity < 0.5) {
      reasons.push('Low retrieval similarity');
    }

    if (factors.hasSpecificInfo) {
      reasons.push('Contains specific information');
    } else {
      reasons.push('Generic answer');
    }

    if (factors.sourceCount >= 5) {
      reasons.push('Multiple sources');
    } else if (factors.sourceCount < 2) {
      reasons.push('Limited sources');
    }

    if (factors.answerLength > 200) {
      reasons.push('Detailed answer');
    } else if (factors.answerLength < 50) {
      reasons.push('Brief answer');
    }

    const verdict = score >= threshold ? 'Above threshold' : 'Below threshold';
    return `${reasons.join(', ')} → ${verdict}`;
  }

  /**
   * Classify query type for confidence assessment
   * This helps set appropriate thresholds
   */
  classifyQueryType(query: string): 'simple' | 'complex' | 'comparison' | 'meta' {
    const queryLower = query.toLowerCase();

    // Meta queries about KODA
    if (
      queryLower.includes('what can you') ||
      queryLower.includes('what are you') ||
      queryLower.includes('how do you') ||
      queryLower.includes('tell me about yourself')
    ) {
      return 'meta';
    }

    // Comparison queries
    if (
      queryLower.includes('compare') ||
      queryLower.includes('difference') ||
      queryLower.includes(' vs ') ||
      queryLower.includes('versus')
    ) {
      return 'comparison';
    }

    // Complex queries (multiple questions, analytical)
    const complexIndicators = [
      'why',
      'how',
      'explain',
      'analyze',
      'evaluate',
      'describe',
      'summarize',
      'what are the implications',
      'what is the relationship',
    ];

    if (complexIndicators.some(indicator => queryLower.includes(indicator))) {
      return 'complex';
    }

    // Simple queries (factual, short)
    return 'simple';
  }
}

export const confidenceAssessmentService = new ConfidenceAssessmentService();
export default confidenceAssessmentService;
