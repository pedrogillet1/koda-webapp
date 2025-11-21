/**
 * Confidence Scoring Service
 * Calculates confidence scores for answers based on source quality
 */

export interface ConfidenceScore {
  level: 'high' | 'medium' | 'low';
  score: number; // 0-100
  factors: {
    sourceRelevance: number;
    sourceCount: number;
    answerLength: number;
    queryComplexity: string;
  };
  reasoning: string;
}

/**
 * Calculate confidence score for an answer
 */
export function calculateConfidence(
  sources: Array<{ score: number; documentName: string }>,
  query: string,
  answer: string
): ConfidenceScore {
  console.log(`🎯 [CONFIDENCE] Calculating confidence for ${sources.length} sources`);

  // Factor 1: Source Relevance (0-40 points)
  const avgRelevance = sources.length > 0
    ? sources.reduce((sum, s) => sum + s.score, 0) / sources.length
    : 0;
  const relevanceScore = Math.round(avgRelevance * 40);

  // Factor 2: Source Count (0-30 points)
  const sourceCountScore = Math.min(sources.length * 10, 30);

  // Factor 3: Answer Length (0-20 points)
  const wordCount = answer.split(/\s+/).length;
  const lengthScore = Math.min(Math.round(wordCount / 5), 20);

  // Factor 4: Query Complexity Match (0-10 points)
  const complexityScore = 10; // Simplified for now

  // Total Score
  const totalScore = relevanceScore + sourceCountScore + lengthScore + complexityScore;

  // Determine Level
  let level: 'high' | 'medium' | 'low';
  if (totalScore >= 75) {
    level = 'high';
  } else if (totalScore >= 50) {
    level = 'medium';
  } else {
    level = 'low';
  }

  // Generate Reasoning
  const reasoning = generateReasoning(level, sources.length, avgRelevance, wordCount);

  console.log(`🎯 [CONFIDENCE] Score: ${totalScore}/100 (${level})`);

  return {
    level,
    score: totalScore,
    factors: {
      sourceRelevance: avgRelevance,
      sourceCount: sources.length,
      answerLength: wordCount,
      queryComplexity: 'medium'
    },
    reasoning
  };
}

/**
 * Generate human-readable reasoning for confidence score
 */
function generateReasoning(
  level: string,
  sourceCount: number,
  avgRelevance: number,
  wordCount: number
): string {
  if (level === 'high') {
    return `High confidence: Found ${sourceCount} highly relevant source${sourceCount > 1 ? 's' : ''} (${(avgRelevance * 100).toFixed(0)}% relevance) with comprehensive information.`;
  } else if (level === 'medium') {
    return `Medium confidence: Found ${sourceCount} source${sourceCount > 1 ? 's' : ''} with ${(avgRelevance * 100).toFixed(0)}% relevance. Answer is based on available information but may benefit from additional context.`;
  } else {
    return `Low confidence: Limited relevant sources found (${sourceCount} source${sourceCount > 1 ? 's' : ''}, ${(avgRelevance * 100).toFixed(0)}% relevance). Consider rephrasing your question or uploading more documents.`;
  }
}

/**
 * Format confidence for user display
 */
export function formatConfidenceForUser(confidence: ConfidenceScore): string {
  const emoji = confidence.level === 'high' ? '🟢' : confidence.level === 'medium' ? '🟡' : '🔴';
  return `\n\n${emoji} **Confidence: ${confidence.level.toUpperCase()}** (${confidence.score}/100)\n${confidence.reasoning}`;
}
