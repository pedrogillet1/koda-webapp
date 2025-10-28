/**
 * Confidence Calibration Service
 * TASK #9: Add confidence calibration and transparency statements for low-confidence answers
 *
 * Analyzes RAG retrieval quality and answer confidence to:
 * - Calculate overall confidence score (0-100%)
 * - Detect low-confidence scenarios (poor retrieval, uncertain answers)
 * - Generate transparency statements for user awareness
 * - Provide actionable suggestions when confidence is low
 */

interface ConfidenceFactors {
  // Retrieval Quality (60% weight)
  topRelevanceScore: number;        // 0-100: Highest relevance score from retrieval
  averageRelevanceScore: number;    // 0-100: Average relevance across top chunks
  sourceCount: number;              // Number of unique source documents
  totalChunksRetrieved: number;     // Total chunks retrieved

  // Answer Quality (30% weight)
  answerLength: number;             // Length of generated answer in characters
  sourceUsageRate: number;          // 0-1: Fraction of retrieved sources actually used
  hasExactQuotes: boolean;          // Whether exact quotes were extracted

  // Context Quality (10% weight)
  isFollowUp: boolean;              // Whether this is a follow-up question
  hasConversationContext: boolean;  // Whether conversation context is available
}

interface ConfidenceResult {
  confidenceScore: number;           // 0-100: Overall confidence
  confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';
  transparencyStatement?: string;    // Statement to append to answer (low confidence only)
  shouldShowWarning: boolean;        // Whether to show warning to user
  factors: ConfidenceFactors;        // Detailed factor breakdown
  reasoning: string;                 // Human-readable explanation
  suggestions: string[];             // Actionable suggestions for user
}

class ConfidenceCalibrationService {
  /**
   * Calculate confidence score and generate transparency statement
   */
  calculateConfidence(
    sources: any[],
    answer: string,
    relevantChunks: any[],
    options: {
      isFollowUp?: boolean;
      hasConversationContext?: boolean;
    } = {}
  ): ConfidenceResult {
    const { isFollowUp = false, hasConversationContext = false } = options;

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: EXTRACT CONFIDENCE FACTORS
    // ═══════════════════════════════════════════════════════════════

    // Retrieval Quality Factors
    const topRelevanceScore = relevantChunks.length > 0
      ? (relevantChunks[0]?.relevanceScore || 0)
      : 0;

    const averageRelevanceScore = relevantChunks.length > 0
      ? relevantChunks.reduce((sum, chunk) => sum + (chunk.relevanceScore || 0), 0) / relevantChunks.length
      : 0;

    const sourceCount = sources.length;
    const totalChunksRetrieved = relevantChunks.length;

    // Answer Quality Factors
    const answerLength = answer.length;
    const sourceUsageRate = relevantChunks.length > 0
      ? sources.length / Math.min(10, relevantChunks.length) // Compare to top 10 chunks
      : 0;

    const hasExactQuotes = sources.some(s => s.exactQuotes && s.exactQuotes.length > 0);

    const factors: ConfidenceFactors = {
      topRelevanceScore,
      averageRelevanceScore,
      sourceCount,
      totalChunksRetrieved,
      answerLength,
      sourceUsageRate,
      hasExactQuotes,
      isFollowUp,
      hasConversationContext
    };

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: CALCULATE WEIGHTED CONFIDENCE SCORE
    // ═══════════════════════════════════════════════════════════════

    // Retrieval Quality Score (60% weight)
    const retrievalScore = this.calculateRetrievalScore(factors);

    // Answer Quality Score (30% weight)
    const answerScore = this.calculateAnswerScore(factors);

    // Context Quality Score (10% weight)
    const contextScore = this.calculateContextScore(factors);

    // Weighted total
    const confidenceScore = Math.round(
      (retrievalScore * 0.60) +
      (answerScore * 0.30) +
      (contextScore * 0.10)
    );

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: DETERMINE CONFIDENCE LEVEL
    // ═══════════════════════════════════════════════════════════════

    let confidenceLevel: 'high' | 'medium' | 'low' | 'very_low';
    let shouldShowWarning: boolean;

    // Adjusted thresholds for better balance
    if (confidenceScore >= 70) {
      confidenceLevel = 'high';
      shouldShowWarning = false;
    } else if (confidenceScore >= 50) {
      confidenceLevel = 'medium';
      shouldShowWarning = false;
    } else if (confidenceScore >= 30) {
      confidenceLevel = 'low';
      shouldShowWarning = true;
    } else {
      confidenceLevel = 'very_low';
      shouldShowWarning = true;
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: GENERATE TRANSPARENCY STATEMENT AND SUGGESTIONS
    // ═══════════════════════════════════════════════════════════════

    const transparencyStatement = this.generateTransparencyStatement(
      confidenceLevel,
      factors,
      confidenceScore
    );

    const suggestions = this.generateSuggestions(confidenceLevel, factors);

    const reasoning = this.generateReasoning(
      confidenceLevel,
      retrievalScore,
      answerScore,
      contextScore,
      factors
    );

    console.log(`\n📊 [Confidence Calibration]`);
    console.log(`   Overall Confidence: ${confidenceScore}% (${confidenceLevel.toUpperCase()})`);
    console.log(`   Retrieval Score: ${retrievalScore.toFixed(1)}% (60% weight)`);
    console.log(`   Answer Score: ${answerScore.toFixed(1)}% (30% weight)`);
    console.log(`   Context Score: ${contextScore.toFixed(1)}% (10% weight)`);
    console.log(`   Show Warning: ${shouldShowWarning ? 'YES' : 'NO'}`);
    if (shouldShowWarning && transparencyStatement) {
      console.log(`   Transparency: "${transparencyStatement.substring(0, 80)}..."`);
    }

    return {
      confidenceScore,
      confidenceLevel,
      transparencyStatement: shouldShowWarning ? transparencyStatement : undefined,
      shouldShowWarning,
      factors,
      reasoning,
      suggestions
    };
  }

  /**
   * Calculate Retrieval Quality Score (0-100)
   */
  private calculateRetrievalScore(factors: ConfidenceFactors): number {
    let score = 0;

    // Factor 1: Top Relevance Score (40% of retrieval score)
    // More nuanced scoring with exponential curve
    let topRelevanceScore = 0;
    if (factors.topRelevanceScore >= 80) {
      topRelevanceScore = 100; // Excellent
    } else if (factors.topRelevanceScore >= 60) {
      topRelevanceScore = 70 + ((factors.topRelevanceScore - 60) / 20) * 30; // 70-100
    } else if (factors.topRelevanceScore >= 40) {
      topRelevanceScore = 40 + ((factors.topRelevanceScore - 40) / 20) * 30; // 40-70
    } else if (factors.topRelevanceScore >= 20) {
      topRelevanceScore = 15 + ((factors.topRelevanceScore - 20) / 20) * 25; // 15-40
    } else {
      topRelevanceScore = (factors.topRelevanceScore / 20) * 15; // 0-15
    }
    score += (topRelevanceScore / 100) * 40;

    // Factor 2: Average Relevance Score (25% of retrieval score)
    const avgRelevanceContribution = (factors.averageRelevanceScore / 100) * 25;
    score += avgRelevanceContribution;

    // Factor 3: Relevance Consistency (15% of retrieval score)
    // Measures how consistent relevance scores are (gap between top and average)
    const relevanceGap = factors.topRelevanceScore - factors.averageRelevanceScore;
    let consistencyScore = 100;
    if (relevanceGap > 40) {
      consistencyScore = 50; // Large gap = inconsistent results
    } else if (relevanceGap > 25) {
      consistencyScore = 70; // Moderate gap
    } else {
      consistencyScore = 100; // Small gap = consistent quality
    }
    score += (consistencyScore / 100) * 15;

    // Factor 4: Source Count (10% of retrieval score)
    // Ideal: 2-3 sources (100%), 1 source (60%), 0 sources (0%), 4+ sources (85%)
    let sourceCountScore = 0;
    if (factors.sourceCount === 0) {
      sourceCountScore = 0;
    } else if (factors.sourceCount === 1) {
      sourceCountScore = 60; // Increased from 50
    } else if (factors.sourceCount >= 2 && factors.sourceCount <= 3) {
      sourceCountScore = 100;
    } else {
      sourceCountScore = 85; // Many sources = still good but less focused
    }
    score += (sourceCountScore / 100) * 10;

    // Factor 5: Total Chunks Retrieved (10% of retrieval score)
    // More chunks = better coverage, but with diminishing returns
    let chunkScore = 0;
    if (factors.totalChunksRetrieved >= 15) {
      chunkScore = 100; // Excellent coverage
    } else if (factors.totalChunksRetrieved >= 8) {
      chunkScore = 70 + ((factors.totalChunksRetrieved - 8) / 7) * 30; // 70-100
    } else if (factors.totalChunksRetrieved >= 3) {
      chunkScore = 40 + ((factors.totalChunksRetrieved - 3) / 5) * 30; // 40-70
    } else {
      chunkScore = (factors.totalChunksRetrieved / 3) * 40; // 0-40
    }
    score += (chunkScore / 100) * 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate Answer Quality Score (0-100)
   */
  private calculateAnswerScore(factors: ConfidenceFactors): number {
    let score = 0;

    // Factor 1: Answer Length (35% of answer score)
    // Improved scoring with better boundaries
    let lengthScore = 0;
    if (factors.answerLength < 50) {
      lengthScore = 20; // Very short = likely insufficient
    } else if (factors.answerLength < 150) {
      lengthScore = 40 + ((factors.answerLength - 50) / 100) * 30; // 40-70
    } else if (factors.answerLength >= 150 && factors.answerLength <= 1500) {
      lengthScore = 100; // Ideal length range
    } else if (factors.answerLength <= 3000) {
      lengthScore = 100 - ((factors.answerLength - 1500) / 1500) * 20; // 100-80
    } else {
      lengthScore = 70; // Very long but still acceptable
    }
    score += (lengthScore / 100) * 35;

    // Factor 2: Source Usage Rate (40% of answer score)
    // Higher usage rate = better grounding, with non-linear scaling
    let usageScore = 0;
    if (factors.sourceUsageRate >= 0.8) {
      usageScore = 100; // Excellent source usage
    } else if (factors.sourceUsageRate >= 0.5) {
      usageScore = 70 + ((factors.sourceUsageRate - 0.5) / 0.3) * 30; // 70-100
    } else if (factors.sourceUsageRate >= 0.3) {
      usageScore = 45 + ((factors.sourceUsageRate - 0.3) / 0.2) * 25; // 45-70
    } else {
      usageScore = (factors.sourceUsageRate / 0.3) * 45; // 0-45
    }
    score += (usageScore / 100) * 40;

    // Factor 3: Has Exact Quotes (25% of answer score)
    // Exact quotes = strong evidence, but nuanced
    const quoteScore = factors.hasExactQuotes ? 100 : 40; // Increased base from 30 to 40
    score += (quoteScore / 100) * 25;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate Context Quality Score (0-100)
   */
  private calculateContextScore(factors: ConfidenceFactors): number {
    let score = 50; // Neutral base score

    // Factor 1: Follow-up with Context (50% weight)
    if (factors.isFollowUp && factors.hasConversationContext) {
      score = 100; // Best case: follow-up with context
    } else if (factors.isFollowUp && !factors.hasConversationContext) {
      score = 60; // Follow-up without context = slightly risky
    } else if (!factors.isFollowUp && factors.hasConversationContext) {
      score = 80; // New question with context
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate transparency statement for low-confidence answers
   */
  private generateTransparencyStatement(
    confidenceLevel: 'high' | 'medium' | 'low' | 'very_low',
    factors: ConfidenceFactors,
    confidenceScore: number
  ): string | undefined {
    if (confidenceLevel === 'high' || confidenceLevel === 'medium') {
      return undefined; // No statement needed for high/medium confidence
    }

    // Identify primary weakness
    const weaknesses: string[] = [];

    if (factors.topRelevanceScore < 50) {
      weaknesses.push('limited relevant information in your documents');
    }

    if (factors.sourceCount === 0) {
      weaknesses.push('no matching documents found');
    } else if (factors.sourceCount === 1) {
      weaknesses.push('only one source document available');
    }

    if (factors.sourceUsageRate < 0.3) {
      weaknesses.push('low source utilization');
    }

    if (!factors.hasExactQuotes) {
      weaknesses.push('no exact quotes extracted');
    }

    // Build statement based on confidence level and weaknesses
    let statement = '';

    if (confidenceLevel === 'very_low') {
      statement = `⚠️ **Low Confidence Response** (${confidenceScore}%)\n\n`;
      statement += `I found ${weaknesses.join(' and ')}, which may affect the accuracy of this answer. `;
      statement += `Please verify the information independently or try rephrasing your question.`;
    } else {
      // confidenceLevel === 'low'
      statement = `ℹ️ **Note:** This answer has moderate confidence (${confidenceScore}%) `;
      statement += `due to ${weaknesses[0] || 'limited information'}. `;
      statement += `Consider reviewing the sources carefully.`;
    }

    return statement;
  }

  /**
   * Generate actionable suggestions based on confidence level
   */
  private generateSuggestions(
    confidenceLevel: 'high' | 'medium' | 'low' | 'very_low',
    factors: ConfidenceFactors
  ): string[] {
    const suggestions: string[] = [];

    if (confidenceLevel === 'high' || confidenceLevel === 'medium') {
      return suggestions; // No suggestions needed
    }

    // Suggest based on specific weaknesses
    if (factors.sourceCount === 0) {
      suggestions.push('Upload documents related to this topic');
      suggestions.push('Try a different search query with different keywords');
    } else if (factors.topRelevanceScore < 40) {
      suggestions.push('Rephrase your question to be more specific');
      suggestions.push('Try asking about a specific document or category');
    } else if (factors.sourceCount === 1) {
      suggestions.push('Upload additional documents for better coverage');
    }

    if (!factors.hasExactQuotes) {
      suggestions.push('Ask for specific facts or data points');
    }

    if (factors.answerLength < 100) {
      suggestions.push('Ask a more detailed question');
    }

    return suggestions;
  }

  /**
   * Generate human-readable reasoning for confidence score
   */
  private generateReasoning(
    confidenceLevel: 'high' | 'medium' | 'low' | 'very_low',
    retrievalScore: number,
    answerScore: number,
    contextScore: number,
    factors: ConfidenceFactors
  ): string {
    const parts: string[] = [];

    // Overall assessment
    parts.push(`Confidence Level: ${confidenceLevel.toUpperCase()}`);

    // Retrieval quality
    if (retrievalScore >= 75) {
      parts.push(`Strong retrieval: ${factors.sourceCount} sources with ${factors.topRelevanceScore.toFixed(0)}% top relevance`);
    } else if (retrievalScore >= 50) {
      parts.push(`Moderate retrieval: ${factors.sourceCount} sources with ${factors.topRelevanceScore.toFixed(0)}% top relevance`);
    } else {
      parts.push(`Weak retrieval: ${factors.sourceCount} sources with ${factors.topRelevanceScore.toFixed(0)}% top relevance`);
    }

    // Answer quality
    if (answerScore >= 75) {
      parts.push(`Good answer quality: ${factors.answerLength} chars, ${factors.hasExactQuotes ? 'with' : 'without'} exact quotes`);
    } else if (answerScore >= 50) {
      parts.push(`Fair answer quality: ${factors.answerLength} chars, ${factors.hasExactQuotes ? 'with' : 'without'} exact quotes`);
    } else {
      parts.push(`Poor answer quality: ${factors.answerLength} chars, ${factors.hasExactQuotes ? 'with' : 'without'} exact quotes`);
    }

    // Context quality
    if (factors.isFollowUp && factors.hasConversationContext) {
      parts.push(`Follow-up question with conversation context`);
    } else if (factors.isFollowUp) {
      parts.push(`Follow-up question without context`);
    } else {
      parts.push(`New question`);
    }

    return parts.join('. ');
  }
}

export default new ConfidenceCalibrationService();
export { ConfidenceCalibrationService, ConfidenceResult, ConfidenceFactors };
