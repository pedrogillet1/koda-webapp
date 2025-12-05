/**
 * Confidence Scoring Service - STUB (service moved to archived)
 */

export interface Evidence {
  document_id: string;
  document_title: string;
  relevant_passage: string;
  support_strength?: number;
}

export const scoreEvidence = (evidence: Evidence[]): number => {
  if (!evidence || evidence.length === 0) return 0;
  return evidence.length > 0 ? 0.8 : 0;
};

export const calculateConfidence = (
  supporting: Evidence[],
  conflicting: Evidence[]
): number => {
  if (!supporting || supporting.length === 0) return 0.5;
  if (conflicting && conflicting.length > 0) return 0.6;
  return 0.85;
};

export default {
  scoreEvidence,
  calculateConfidence
};
