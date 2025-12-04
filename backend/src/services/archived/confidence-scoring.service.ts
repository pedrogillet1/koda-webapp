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

/**
 * Calculate confidence score for an answer
 */
export function calculateConfidence(
  supporting_evidence: Evidence[],
  conflicting_evidence: Evidence[]
): number {
  if (supporting_evidence.length === 0) {
    return 0.0;
  }

  // Calculate average support strength
  const avgSupport = supporting_evidence.reduce((sum, e) => sum + e.support_strength, 0) / supporting_evidence.length;

  // Calculate average relevance
  const avgRelevance = supporting_evidence.reduce((sum, e) => sum + e.relevance_score, 0) / supporting_evidence.length;

  // Penalize for conflicting evidence
  const conflictPenalty = conflicting_evidence.length > 0
    ? Math.min(0.3, conflicting_evidence.length * 0.1)
    : 0;

  // Bonus for multiple supporting documents
  const multiDocBonus = supporting_evidence.length > 1
    ? Math.min(0.2, (supporting_evidence.length - 1) * 0.05)
    : 0;

  // Final confidence score
  let confidence = (avgSupport * 0.5 + avgRelevance * 0.5) + multiDocBonus - conflictPenalty;

  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  console.log(`📊 [CONFIDENCE] Score: ${confidence.toFixed(2)} (support: ${avgSupport.toFixed(2)}, relevance: ${avgRelevance.toFixed(2)}, docs: ${supporting_evidence.length}, conflicts: ${conflicting_evidence.length})`);

  return confidence;
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

  const confidence = calculateConfidence(supporting_evidence, conflicting_evidence);

  return {
    answer,
    confidence,
    supporting_evidence,
    conflicting_evidence
  };
}
