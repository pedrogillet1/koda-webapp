/**
 * Answer Quality Checker Service
 * Priority: P1 (HIGH)
 * 
 * Comprehensive quality check before sending answer to user.
 * Combines grounding verification, citation verification, and format validation.
 * 
 * Key Functions:
 * - Run all quality checks (grounding, citations, format)
 * - Calculate overall quality score
 * - Decide: accept, regenerate, or use fallback
 * - Provide detailed quality report
 */

import { verifyGrounding, type GroundingVerificationResult } from './groundingVerification.service';
import { verifyCitations, type CitationVerificationResult } from './citationVerification.service';
import { postProcessAnswer, type PostProcessingResult } from './outputPostProcessor.service';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface QualityCheckResult {
  passed: boolean;
  overallScore: number;
  grounding: GroundingVerificationResult;
  citations: CitationVerificationResult;
  postProcessing: PostProcessingResult;
  finalAnswer: string;
  decision: 'accept' | 'regenerate' | 'fallback';
  reasoning: string;
}

export interface QualityCheckOptions {
  minOverallScore?: number;
  requireGrounding?: boolean;
  requireCitations?: boolean;
  allowPartialAnswers?: boolean;
  maxRegenerationAttempts?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Perform comprehensive quality check on RAG answer
 */
export async function checkAnswerQuality(
  query: string,
  answer: string,
  retrievedChunks: Array<{ content: string; metadata?: any }>,
  options: QualityCheckOptions = {}
): Promise<QualityCheckResult> {
  const {
    minOverallScore = 0.7,
    requireGrounding = true,
    requireCitations = true,
    allowPartialAnswers = false,
  } = options;

  // Step 1: Post-process answer (clean up formatting)
  const postProcessing = await postProcessAnswer(answer);
  const cleanedAnswer = postProcessing.cleanedAnswer;

  // Step 2: Verify grounding
  const grounding = await verifyGrounding(query, cleanedAnswer, retrievedChunks, {
    minConfidence: 0.7,
    requireCompleteness: !allowPartialAnswers,
    allowPartialAnswers,
  });

  // Step 3: Verify citations
  const citations = await verifyCitations(cleanedAnswer, retrievedChunks, {
    requireAllCited: requireCitations,
    minAccuracy: 0.9,
  });

  // Step 4: Calculate overall quality score
  const overallScore = calculateOverallScore(grounding, citations, postProcessing);

  // Step 5: Make decision
  const decision = makeQualityDecision(
    overallScore,
    grounding,
    citations,
    minOverallScore,
    requireGrounding,
    requireCitations
  );

  // Step 6: Generate reasoning
  const reasoning = generateReasoning(decision, grounding, citations, overallScore);

  return {
    passed: decision === 'accept',
    overallScore,
    grounding,
    citations,
    postProcessing,
    finalAnswer: cleanedAnswer,
    decision,
    reasoning,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall quality score (0-1)
 */
function calculateOverallScore(
  grounding: GroundingVerificationResult,
  citations: CitationVerificationResult,
  postProcessing: PostProcessingResult
): number {
  // Weighted average:
  // - Grounding: 50%
  // - Citations: 30%
  // - Post-processing: 20%
  
  const groundingScore = grounding.confidence;
  const citationScore = citations.confidence;
  const postProcessingScore = postProcessing.sourcesRemoved ? 1.0 : 0.8;

  return (
    groundingScore * 0.5 +
    citationScore * 0.3 +
    postProcessingScore * 0.2
  );
}

/**
 * Make quality decision based on checks
 */
function makeQualityDecision(
  overallScore: number,
  grounding: GroundingVerificationResult,
  citations: CitationVerificationResult,
  minOverallScore: number,
  requireGrounding: boolean,
  requireCitations: boolean
): 'accept' | 'regenerate' | 'fallback' {
  // If overall score is too low, regenerate
  if (overallScore < minOverallScore) {
    return 'regenerate';
  }

  // If grounding is required and failed, regenerate
  if (requireGrounding && !grounding.isWellGrounded) {
    if (grounding.confidence < 0.3) {
      return 'fallback'; // Very poor grounding, use fallback
    }
    return 'regenerate';
  }

  // If citations are required and failed, regenerate
  if (requireCitations && !citations.isAccurate) {
    return 'regenerate';
  }

  // Otherwise, accept
  return 'accept';
}

/**
 * Generate reasoning for quality decision
 */
function generateReasoning(
  decision: 'accept' | 'regenerate' | 'fallback',
  grounding: GroundingVerificationResult,
  citations: CitationVerificationResult,
  overallScore: number
): string {
  if (decision === 'accept') {
    return `Answer passed quality checks (score: ${(overallScore * 100).toFixed(1)}%). ` +
           `Grounding: ${(grounding.confidence * 100).toFixed(1)}%, ` +
           `Citations: ${(citations.confidence * 100).toFixed(1)}%.`;
  }

  if (decision === 'fallback') {
    return `Answer quality too low (score: ${(overallScore * 100).toFixed(1)}%). ` +
           `Using fallback response. ` +
           `Grounding issues: ${grounding.reasoning}`;
  }

  // decision === 'regenerate'
  const issues: string[] = [];
  
  if (grounding.confidence < 0.7) {
    issues.push(`poor grounding (${(grounding.confidence * 100).toFixed(1)}%)`);
  }
  
  if (citations.confidence < 0.9) {
    issues.push(`citation issues (${citations.inaccurateCitations.length} inaccurate)`);
  }
  
  if (grounding.unsupportedClaims.length > 0) {
    issues.push(`${grounding.unsupportedClaims.length} unsupported claims`);
  }

  return `Answer needs regeneration due to: ${issues.join(', ')}.`;
}

/**
 * Quick quality check (faster, less thorough)
 */
export async function quickQualityCheck(
  answer: string,
  retrievedChunks: Array<{ content: string }>
): Promise<boolean> {
  // Simple heuristics:
  // 1. Answer is not too short (>100 chars)
  // 2. Answer contains content from chunks
  // 3. Answer has citations
  
  if (answer.length < 100) {
    return false;
  }

  const hasContent = retrievedChunks.some(chunk => 
    answer.toLowerCase().includes(chunk.content.toLowerCase().slice(0, 50))
  );

  const hasCitations = /\[\d+\]/.test(answer);

  return hasContent && hasCitations;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  checkAnswerQuality,
  quickQualityCheck,
};
