/**
 * Confidence Scoring Service
 *
 * Calculates confidence scores for answers based on evidence
 */

export interface Evidence {
  document_id: string;
  document_title: string;
  relevant_passage: string;
  support_strength: number; // 0.0 to 1.0
  relevance_score: number; // 0.0 to 1.0
}

export interface AnswerWithConfidence {
  answer: string;
  confidence: number; // 0.0 to 1.0
  supporting_evidence: Evidence[];
  conflicting_evidence: Evidence[];
}

export interface ConfidenceResult {
  level: string;
  score: number;
}

/**
 * Calculate confidence score for an answer
 * @param sources - Array of sources (or supporting evidence)
 * @param query - Optional query string
 * @param response - Optional response string
 */
export function calculateConfidence(
  sources: any[],
  query?: string,
  response?: string
): ConfidenceResult {
  if (!sources || sources.length === 0) {
    return { level: 'low', score: 0 };
  }

  // Calculate based on number of sources and their scores
  let totalScore = 0;
  for (const source of sources) {
    if (source.score) {
      totalScore += source.score * 100;
    } else if (source.support_strength) {
      totalScore += source.support_strength * 100;
    } else {
      totalScore += 50; // Default medium confidence per source
    }
  }

  const avgScore = totalScore / sources.length;

  // Bonus for multiple sources
  const multiSourceBonus = Math.min(20, (sources.length - 1) * 5);
  const finalScore = Math.min(100, avgScore + multiSourceBonus);

  // Determine level
  let level: string;
  if (finalScore >= 80) {
    level = 'high';
  } else if (finalScore >= 50) {
    level = 'medium';
  } else {
    level = 'low';
  }

  console.log(`📊 [CONFIDENCE] Score: ${finalScore.toFixed(0)}/100 (${level}) based on ${sources.length} sources`);

  return { level, score: Math.round(finalScore) };
}

/**
 * Score evidence strength
 */
export function scoreEvidence(
  query: string,
  passage: string,
  relevanceScore: number
): number {
  // Factors that increase support strength:
  // 1. High relevance score
  // 2. Passage contains exact quotes
  // 3. Passage contains numbers/dates (for factual queries)

  let strength = relevanceScore;

  // Check for exact quotes
  if (passage.includes('"') || passage.includes("'")) {
    strength += 0.1;
  }

  // Check for numbers/dates (indicates factual content)
  if (/\d+/.test(passage)) {
    strength += 0.05;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, strength));
}

/**
 * Build answer with confidence
 */
export function buildAnswerWithConfidence(
  answer: string,
  evidence: Evidence[],
  contradictions: any[]
): AnswerWithConfidence {
  const supporting_evidence = evidence.filter(e => e.support_strength > 0.5);
  const conflicting_evidence = contradictions.map(c => ({
    document_id: c.claim2.document_id,
    document_title: c.claim2.source,
    relevant_passage: c.claim2.text,
    support_strength: 0,
    relevance_score: 0.5
  }));

  const confidenceResult = calculateConfidence(supporting_evidence);

  return {
    answer,
    confidence: confidenceResult.score / 100, // Convert from 0-100 to 0-1
    supporting_evidence,
    conflicting_evidence
  };
}
