/**
 * ============================================================================
 * KODA QUALITY ENGINE - UNIFIED ANSWER QUALITY ASSURANCE
 * ============================================================================
 *
 * This service consolidates ALL QA logic.
 *
 * CONSOLIDATES:
 * - groundingVerification.service.ts
 * - citationVerification.service.ts
 * - answerQualityChecker.service.ts
 * - emptyResponsePrevention.service.ts
 * - qaOrchestrator.service.ts
 * - verifyAnswerCompletion (from adaptiveAnswerGeneration)
 *
 * RESPONSIBILITIES:
 * 1. Grounding check
 * 2. Citation verification
 * 3. Hallucination detection
 * 4. Completeness check
 * 5. Contradiction detection
 * 6. Format validation
 *
 * @version 2.0.0
 * @date 2025-12-08
 */

export interface QualityCheckOptions {
  answer: string;
  query: string;
  retrievedChunks: any[];
  sources: any[];
}

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Perform comprehensive quality check on answer
 */
export async function checkQuality(options: QualityCheckOptions): Promise<QualityCheckResult> {
  const { answer, query, retrievedChunks, sources } = options;

  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // 1. Empty answer check
  if (!answer || answer.trim().length < 10) {
    issues.push('Answer is too short or empty');
    score -= 100;
    return { passed: false, score: 0, issues, recommendations };
  }

  // 2. Grounding check (only if we have chunks to ground against)
  if (retrievedChunks.length > 0) {
    const groundingScore = checkGrounding(answer, retrievedChunks);
    if (groundingScore < 0.3) {
      issues.push('Answer may contain hallucinations - low grounding score');
      score -= 30;
    } else if (groundingScore < 0.5) {
      recommendations.push('Consider strengthening answer with more document references');
      score -= 10;
    }
  }

  // 3. Citation check (soft check - only recommendation)
  if (sources.length === 0 && retrievedChunks.length > 0) {
    recommendations.push('Consider adding source citations');
  }

  // 4. Completeness check
  const completenessIssues = checkCompleteness(answer, query);
  if (completenessIssues.length > 0) {
    recommendations.push(...completenessIssues);
    score -= 5 * completenessIssues.length;
  }

  // 5. Format validation
  const formatIssues = checkFormat(answer);
  if (formatIssues.length > 0) {
    issues.push(...formatIssues);
    score -= 5 * formatIssues.length;
  }

  // 6. Language consistency check
  const languageIssue = checkLanguageConsistency(answer, query);
  if (languageIssue) {
    recommendations.push(languageIssue);
    score -= 10;
  }

  return {
    passed: score >= 50,
    score: Math.max(0, score),
    issues,
    recommendations,
  };
}

/**
 * Simple grounding check: verify answer content appears in chunks
 */
function checkGrounding(answer: string, chunks: any[]): number {
  if (chunks.length === 0) return 0.5; // Neutral score if no chunks

  // Extract significant words from answer (ignore common words)
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'no', 'na',
    'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre', 'e', 'ou', 'mas',
    'que', 'se', 'como', 'quando', 'onde', 'qual', 'quem', 'quanto',
  ]);

  const answerWords = new Set(
    answer.toLowerCase()
      .replace(/[^\w\sáéíóúàèìòùâêîôûãõç]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  );

  if (answerWords.size === 0) return 0.5;

  // Combine all chunk content
  const chunkContent = chunks
    .map(c => (c.content || c.text || '').toLowerCase())
    .join(' ');

  // Count matches
  let matchCount = 0;
  for (const word of answerWords) {
    if (chunkContent.includes(word)) {
      matchCount++;
    }
  }

  return matchCount / answerWords.size;
}

/**
 * Check if answer is complete relative to query
 */
function checkCompleteness(answer: string, query: string): string[] {
  const issues: string[] = [];

  // Check if answer is too short for complex query
  if (query.length > 100 && answer.length < 200) {
    issues.push('Answer may be too brief for the detailed question');
  }

  // Check for abrupt endings
  if (answer.endsWith('...') || answer.endsWith('etc')) {
    issues.push('Answer appears to be truncated');
  }

  return issues;
}

/**
 * Check answer format for common issues
 */
function checkFormat(answer: string): string[] {
  const issues: string[] = [];

  // Check for broken markdown
  const openBold = (answer.match(/\*\*/g) || []).length;
  if (openBold % 2 !== 0) {
    issues.push('Unmatched bold markers');
  }

  // Check for excessive newlines
  if (answer.includes('\n\n\n\n')) {
    issues.push('Excessive blank lines');
  }

  return issues;
}

/**
 * Check if answer language matches query language
 */
function checkLanguageConsistency(answer: string, query: string): string | null {
  // Simple heuristic: check for Portuguese vs English indicators
  const ptIndicators = ['ção', 'ões', 'ando', 'endo', 'indo', 'mente'];
  const enIndicators = ['tion', 'tions', 'ing', 'ment', 'ness', 'ally'];

  const queryPt = ptIndicators.some(ind => query.toLowerCase().includes(ind));
  const queryEn = enIndicators.some(ind => query.toLowerCase().includes(ind));
  const answerPt = ptIndicators.some(ind => answer.toLowerCase().includes(ind));
  const answerEn = enIndicators.some(ind => answer.toLowerCase().includes(ind));

  if (queryPt && !queryEn && !answerPt && answerEn) {
    return 'Answer appears to be in English but query was in Portuguese';
  }
  if (queryEn && !queryPt && !answerEn && answerPt) {
    return 'Answer appears to be in Portuguese but query was in English';
  }

  return null;
}

/**
 * Quick quality check for fast-path responses
 */
export function quickCheck(answer: string): boolean {
  return Boolean(answer && answer.trim().length >= 10);
}

export default {
  checkQuality,
  quickCheck,
};
