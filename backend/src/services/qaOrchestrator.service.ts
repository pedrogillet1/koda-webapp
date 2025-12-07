import { verifyGrounding } from './groundingVerification.service';
import { verifyCitations } from './citationVerification.service';

export interface QAResult {
  passed: boolean;
  action: 'pass' | 'regenerate' | 'fail';
  reason?: string;
  score: {
    grounding: number;
    citations: number;
    completeness: number;
    formatting: number;
    overall: number;
  };
  issues: string[];
}

export interface QAOptions {
  enableGrounding?: boolean;
  enableCitations?: boolean;
  enableCompleteness?: boolean;
  enableFormatting?: boolean;
  strictMode?: boolean;
}

/**
 * Orchestrates all quality assurance checks for generated answers
 * @param draftAnswer - The generated answer to check
 * @param context - The chunks used to generate the answer
 * @param query - The original user query
 * @param options - QA options (defaults to all enabled)
 * @returns QA result with pass/fail decision
 */
export async function runQualityAssurance(
  draftAnswer: string,
  context: any[],
  query: string,
  options: QAOptions = {}
): Promise<QAResult> {
  const {
    enableGrounding = true,
    enableCitations = true,
    enableCompleteness = true,
    enableFormatting = true,
    strictMode = false
  } = options;

  const issues: string[] = [];
  const scores = {
    grounding: 1.0,
    citations: 1.0,
    completeness: 1.0,
    formatting: 1.0,
    overall: 1.0
  };

  try {
    // 1. Grounding Verification
    if (enableGrounding) {
      const groundingResult = await verifyGrounding(draftAnswer, context, query);
      scores.grounding = (groundingResult.score || 0) / 100; // Convert 0-100 to 0-1

      if (scores.grounding < 0.7) {
        issues.push(`Low grounding score: ${scores.grounding.toFixed(2)}`);
      }

      if (groundingResult.ungroundedSentences && groundingResult.ungroundedSentences.length > 0) {
        issues.push(`Detected ${groundingResult.ungroundedSentences.length} ungrounded sentences`);
      }
    }

    // 2. Citation Verification
    if (enableCitations) {
      const citationResult = await verifyCitations(draftAnswer, context);
      scores.citations = citationResult.confidence || 0; // Already 0-1

      if (citationResult.invalidCitations && citationResult.invalidCitations.length > 0) {
        issues.push(`Found ${citationResult.invalidCitations.length} invalid citations`);
      }
    }

    // 3. Completeness Check
    if (enableCompleteness) {
      const completenessScore = checkCompleteness(draftAnswer, query);
      scores.completeness = completenessScore;

      if (scores.completeness < 0.6) {
        issues.push(`Answer may be incomplete (score: ${scores.completeness.toFixed(2)})`);
      }
    }

    // 4. Formatting Check
    if (enableFormatting) {
      const formatIssues = checkFormatting(draftAnswer);
      scores.formatting = formatIssues.score;

      if (formatIssues.hasDuplicates) {
        issues.push('Detected duplicate content');
      }
      if (formatIssues.hasRepeatedParagraphs) {
        issues.push('Detected repeated paragraphs');
      }
      if (formatIssues.hasGenericEndings) {
        issues.push('Detected generic ending phrases');
      }
    }

    // Calculate overall score
    const weights = {
      grounding: 0.35,
      citations: 0.25,
      completeness: 0.25,
      formatting: 0.15
    };

    scores.overall =
      scores.grounding * weights.grounding +
      scores.citations * weights.citations +
      scores.completeness * weights.completeness +
      scores.formatting * weights.formatting;

    // Decide action
    const threshold = strictMode ? 0.8 : 0.7;

    if (scores.overall < threshold) {
      return {
        passed: false,
        action: 'regenerate',
        reason: `Overall quality score ${scores.overall.toFixed(2)} below threshold ${threshold}`,
        score: scores,
        issues
      };
    }

    if (scores.grounding < 0.6 || (enableCitations && scores.citations < 0.5)) {
      return {
        passed: false,
        action: 'fail',
        reason: 'Critical quality issues detected',
        score: scores,
        issues
      };
    }

    return {
      passed: true,
      action: 'pass',
      score: scores,
      issues
    };

  } catch (error) {
    console.error('[QA-ORCHESTRATOR] Error during quality assurance:', error);
    // On error, pass through (don't block user)
    return {
      passed: true,
      action: 'pass',
      reason: 'QA check failed, passing through',
      score: scores,
      issues: ['QA check error']
    };
  }
}

/**
 * Check if answer is complete relative to query
 */
function checkCompleteness(answer: string, query: string): number {
  // Remove markdown and whitespace
  const cleanAnswer = answer.replace(/[#*`\-]/g, '').trim();

  // Check minimum length
  if (cleanAnswer.length < 50) {
    return 0.3;
  }

  // Check if answer addresses query keywords
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const answerLower = cleanAnswer.toLowerCase();

  const matchedWords = queryWords.filter(word => answerLower.includes(word));
  const keywordCoverage = queryWords.length > 0 ? matchedWords.length / queryWords.length : 1;

  // Check for incomplete indicators
  const incompleteIndicators = [
    'i don\'t have',
    'i cannot find',
    'no information',
    'not mentioned',
    'unclear from'
  ];

  const hasIncompleteIndicator = incompleteIndicators.some(ind =>
    answerLower.includes(ind)
  );

  if (hasIncompleteIndicator && cleanAnswer.length < 200) {
    return 0.4;
  }

  // Combine factors
  const lengthScore = Math.min(cleanAnswer.length / 300, 1);
  const finalScore = (keywordCoverage * 0.6) + (lengthScore * 0.4);

  return Math.min(Math.max(finalScore, 0), 1);
}

/**
 * Check for formatting issues
 */
function checkFormatting(answer: string): {
  score: number;
  hasDuplicates: boolean;
  hasRepeatedParagraphs: boolean;
  hasGenericEndings: boolean;
} {
  let score = 1.0;
  let hasDuplicates = false;
  let hasRepeatedParagraphs = false;
  let hasGenericEndings = false;

  // Check for repeated paragraphs
  const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 20);
  const uniqueParagraphs = new Set(paragraphs.map(p => p.trim()));

  if (paragraphs.length > uniqueParagraphs.size) {
    hasRepeatedParagraphs = true;
    score -= 0.3;
  }

  // Check for duplicate bullets
  const bullets = answer.match(/^[\s]*[-*•]\s+(.+)$/gm) || [];
  const uniqueBullets = new Set(bullets.map(b => b.trim()));

  if (bullets.length > uniqueBullets.size) {
    hasDuplicates = true;
    score -= 0.2;
  }

  // Check for generic endings
  const genericEndings = [
    'let me know if you need',
    'feel free to ask',
    'if you have any questions',
    'hope this helps',
    'is there anything else'
  ];

  const lastParagraph = paragraphs[paragraphs.length - 1]?.toLowerCase() || '';
  if (genericEndings.some(ending => lastParagraph.includes(ending))) {
    hasGenericEndings = true;
    score -= 0.1;
  }

  return {
    score: Math.max(score, 0),
    hasDuplicates,
    hasRepeatedParagraphs,
    hasGenericEndings
  };
}

export default runQualityAssurance;
