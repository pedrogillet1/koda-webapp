/**
 * Koda Answer Validation Engine - Complex Query Extension
 *
 * Extends the base validation engine with complex query validation:
 * - Multi-part answer completeness checking
 * - Sub-question coverage validation
 * - Cross-reference consistency checking
 *
 * @version 1.0.0
 * @date 2025-12-09
 */

import { QueryPlan, SubQuestion } from './kodaComplexQueryPlanner.service';
import { kodaAnswerValidationEngine } from './kodaAnswerValidationEngine.service';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ComplexValidationContext {
  query: string;
  queryPlan: QueryPlan;
  documents?: Array<{ id: string; name: string; content?: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  userId?: string;
  language?: string;
}

export interface SubQuestionCoverage {
  subQuestionId: string;
  subQuestionText: string;
  isCovered: boolean;
  coverageScore: number;        // 0-100
  coverageDetails?: string;
  suggestedAddition?: string;
}

export interface ComplexValidationResult {
  // Base validation results
  isValid: boolean;
  overallScore: number;

  // Complex-specific results
  subQuestionCoverage: SubQuestionCoverage[];
  coverageScore: number;        // 0-100, percentage of sub-questions covered
  missingParts: string[];
  redundantParts: string[];

  // Recommendations
  recommendations: string[];

  // Base validation metadata (from kodaAnswerValidationEngine)
  baseValidation: {
    hallucinationScore: number;
    citationAccuracy: number;
    completeness: number;
    toneConsistency: number;
    personaCompliance: number;
    languageConsistency: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Coverage Detection Patterns
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Patterns that indicate a sub-question has been addressed
 */
const COVERAGE_INDICATORS = {
  // Direct addressing patterns
  addressing: [
    /regarding\s+(?:your\s+question\s+about|the\s+)?([\w\s]+)/gi,
    /about\s+(?:the\s+)?([\w\s]+),/gi,
    /as\s+for\s+(?:the\s+)?([\w\s]+)/gi,
    /concerning\s+(?:the\s+)?([\w\s]+)/gi,
    /em\s+relação\s+a(?:o|os)?\s+([\w\s]+)/gi,  // PT
    /quanto\s+a(?:o|os)?\s+([\w\s]+)/gi,         // PT
    /sobre\s+(?:o|os|a|as)?\s+([\w\s]+),/gi,     // PT
    /con\s+respecto\s+a\s+([\w\s]+)/gi,          // ES
    /en\s+cuanto\s+a\s+([\w\s]+)/gi,             // ES
  ],

  // Structural markers
  structuralMarkers: [
    /(?:first|second|third|finally|additionally|moreover|furthermore)/gi,
    /(?:primeiro|segundo|terceiro|finalmente|além\s+disso|ademais)/gi,
    /(?:primero|segundo|tercero|finalmente|además|asimismo)/gi,
    /^\d+\.\s/gm,
    /^[-•]\s/gm,
  ],

  // Comparison patterns
  comparisonPatterns: [
    /compared\s+to|in\s+comparison|versus|vs\.?/gi,
    /comparado\s+(?:a|com)|em\s+comparação|versus/gi,
    /comparado\s+con|en\s+comparación|versus/gi,
    /while\s+.+?,\s*.+/gi,
    /whereas\s+.+?,\s*.+/gi,
    /on\s+the\s+other\s+hand/gi,
    /por\s+outro\s+lado/gi,
    /por\s+otra\s+parte/gi,
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Sub-Question Coverage Analysis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a specific sub-question is covered in the answer
 *
 * @param answer - The generated answer
 * @param subQuestion - The sub-question to check
 * @param language - Language of the response
 * @returns SubQuestionCoverage result
 */
function checkSubQuestionCoverage(
  answer: string,
  subQuestion: SubQuestion,
  language: string
): SubQuestionCoverage {
  const answerLower = answer.toLowerCase();
  const subQuestionLower = subQuestion.text.toLowerCase();

  // Extract key terms from sub-question (words > 3 chars, not stopwords)
  const stopWords = new Set([
    'what', 'how', 'why', 'when', 'where', 'who', 'which', 'the', 'and', 'for',
    'qual', 'como', 'por', 'que', 'quando', 'onde', 'quem', 'para',
    'qué', 'cómo', 'cuándo', 'dónde', 'quién', 'cuál',
  ]);

  const keyTerms = subQuestionLower
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 5); // Top 5 key terms

  if (keyTerms.length === 0) {
    return {
      subQuestionId: subQuestion.id,
      subQuestionText: subQuestion.text,
      isCovered: true, // Can't determine, assume covered
      coverageScore: 70,
      coverageDetails: 'Unable to extract key terms for coverage check',
    };
  }

  // Count how many key terms appear in the answer
  let matchedTerms = 0;
  for (const term of keyTerms) {
    if (answerLower.includes(term)) {
      matchedTerms++;
    }
  }

  const termCoverageScore = (matchedTerms / keyTerms.length) * 100;

  // Check for structural addressing (headers, numbered lists, etc.)
  let structuralBonus = 0;
  for (const pattern of COVERAGE_INDICATORS.structuralMarkers) {
    if (pattern.test(answer)) {
      structuralBonus = 10;
      break;
    }
  }

  // Check for comparison patterns if it's a comparison sub-question
  let comparisonBonus = 0;
  if (subQuestion.type === 'comparison') {
    for (const pattern of COVERAGE_INDICATORS.comparisonPatterns) {
      if (pattern.test(answerLower)) {
        comparisonBonus = 15;
        break;
      }
    }
  }

  // Calculate final coverage score
  const coverageScore = Math.min(100, termCoverageScore + structuralBonus + comparisonBonus);
  const isCovered = coverageScore >= 50;

  // Generate suggestion if not covered
  let suggestedAddition: string | undefined;
  if (!isCovered) {
    suggestedAddition = generateSuggestedAddition(subQuestion, language);
  }

  return {
    subQuestionId: subQuestion.id,
    subQuestionText: subQuestion.text,
    isCovered,
    coverageScore: Math.round(coverageScore),
    coverageDetails: `${matchedTerms}/${keyTerms.length} key terms found`,
    suggestedAddition,
  };
}

/**
 * Generate a suggested addition for an uncovered sub-question
 */
function generateSuggestedAddition(subQuestion: SubQuestion, language: string): string {
  const suggestions: Record<string, Record<SubQuestion['type'], string>> = {
    en: {
      factual: `Please also address: "${subQuestion.text}"`,
      analytical: `Additionally, please analyze: "${subQuestion.text}"`,
      comparison: `Please include a comparison regarding: "${subQuestion.text}"`,
      listing: `Please list the items related to: "${subQuestion.text}"`,
      summarization: `Please summarize the relevant information about: "${subQuestion.text}"`,
    },
    pt: {
      factual: `Por favor, também responda: "${subQuestion.text}"`,
      analytical: `Adicionalmente, por favor analise: "${subQuestion.text}"`,
      comparison: `Por favor, inclua uma comparação sobre: "${subQuestion.text}"`,
      listing: `Por favor, liste os itens relacionados a: "${subQuestion.text}"`,
      summarization: `Por favor, resuma as informações relevantes sobre: "${subQuestion.text}"`,
    },
    es: {
      factual: `Por favor, también responda: "${subQuestion.text}"`,
      analytical: `Adicionalmente, por favor analice: "${subQuestion.text}"`,
      comparison: `Por favor, incluya una comparación sobre: "${subQuestion.text}"`,
      listing: `Por favor, enumere los elementos relacionados con: "${subQuestion.text}"`,
      summarization: `Por favor, resuma la información relevante sobre: "${subQuestion.text}"`,
    },
  };

  const langSuggestions = suggestions[language] || suggestions.en;
  return langSuggestions[subQuestion.type] || langSuggestions.factual;
}

// ═══════════════════════════════════════════════════════════════════════════
// Answer Structure Validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if answer has appropriate structure for a complex query
 */
function checkAnswerStructure(
  answer: string,
  queryPlan: QueryPlan
): { hasGoodStructure: boolean; structureScore: number; issues: string[] } {
  const issues: string[] = [];
  let structureScore = 50; // Base score

  // Check for section headers or numbered lists
  const hasHeaders = /^#{1,3}\s+.+$/gm.test(answer);
  const hasNumberedList = /^\d+\.\s+.+$/gm.test(answer);
  const hasBulletList = /^[-•]\s+.+$/gm.test(answer);

  if (queryPlan.subQuestions.length > 1) {
    if (hasHeaders) {
      structureScore += 20;
    } else if (hasNumberedList) {
      structureScore += 15;
    } else if (hasBulletList) {
      structureScore += 10;
    } else {
      issues.push('Multi-part answer lacks clear structure (headers, numbered lists, or bullets)');
    }
  }

  // Check answer length appropriateness
  const wordCount = answer.split(/\s+/).length;
  const expectedMinWords = queryPlan.subQuestions.length * 50; // At least 50 words per sub-question

  if (wordCount < expectedMinWords * 0.5) {
    issues.push(`Answer may be too short for ${queryPlan.subQuestions.length} sub-questions`);
    structureScore -= 15;
  } else if (wordCount >= expectedMinWords) {
    structureScore += 10;
  }

  // Check for transition words between sections
  const transitionPatterns = [
    /additionally|furthermore|moreover|in addition/gi,
    /however|on the other hand|in contrast/gi,
    /first|second|third|finally/gi,
    /regarding|as for|concerning/gi,
    /além disso|ademais|no entanto|por outro lado/gi,
    /además|sin embargo|por otra parte/gi,
  ];

  let transitionCount = 0;
  for (const pattern of transitionPatterns) {
    const matches = answer.match(pattern) || [];
    transitionCount += matches.length;
  }

  if (transitionCount >= queryPlan.subQuestions.length - 1) {
    structureScore += 10;
  } else if (queryPlan.subQuestions.length > 1 && transitionCount === 0) {
    issues.push('Multi-part answer lacks transition words between sections');
  }

  return {
    hasGoodStructure: structureScore >= 60,
    structureScore: Math.min(100, structureScore),
    issues,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Complex Validation Function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an answer for a complex query
 *
 * This is the MAIN ENTRY POINT for complex query validation.
 *
 * @param answer - The generated answer
 * @param context - Validation context including query plan
 * @returns ComplexValidationResult
 */
export async function validateComplexAnswer(
  answer: string,
  context: ComplexValidationContext
): Promise<ComplexValidationResult> {
  console.log('[COMPLEX-VALIDATION] ═══════════════════════════════════════════');
  console.log(`[COMPLEX-VALIDATION] Validating answer for complex query`);
  console.log(`[COMPLEX-VALIDATION] Sub-questions: ${context.queryPlan.subQuestions.length}`);
  console.log('[COMPLEX-VALIDATION] ═══════════════════════════════════════════');

  const { queryPlan } = context;
  const language = queryPlan.language || context.language || 'en';

  // Step 1: Run base validation
  const baseValidationResult = await kodaAnswerValidationEngine.validateAnswer(answer, {
    query: context.query,
    intent: queryPlan.responseProfile,
    documents: context.documents,
    conversationHistory: context.conversationHistory,
    userId: context.userId,
    language,
  });

  // Step 2: Check coverage for each sub-question
  const subQuestionCoverage: SubQuestionCoverage[] = [];
  for (const subQuestion of queryPlan.subQuestions) {
    const coverage = checkSubQuestionCoverage(answer, subQuestion, language);
    subQuestionCoverage.push(coverage);
  }

  // Step 3: Calculate overall coverage score
  const coveredCount = subQuestionCoverage.filter(c => c.isCovered).length;
  const coverageScore = Math.round((coveredCount / queryPlan.subQuestions.length) * 100);

  // Step 4: Identify missing parts
  const missingParts = subQuestionCoverage
    .filter(c => !c.isCovered)
    .map(c => c.subQuestionText);

  // Step 5: Check answer structure
  const structureCheck = checkAnswerStructure(answer, queryPlan);

  // Step 6: Generate recommendations
  const recommendations: string[] = [];

  if (missingParts.length > 0) {
    recommendations.push(`Address ${missingParts.length} missing sub-question(s)`);
    for (const coverage of subQuestionCoverage.filter(c => !c.isCovered)) {
      if (coverage.suggestedAddition) {
        recommendations.push(coverage.suggestedAddition);
      }
    }
  }

  if (!structureCheck.hasGoodStructure) {
    recommendations.push(...structureCheck.issues);
  }

  if (baseValidationResult.metadata.languageConsistency < 70) {
    recommendations.push(`Ensure all parts of the answer are in ${language}`);
  }

  // Step 7: Calculate overall score
  // Weight: 50% base validation, 30% coverage, 20% structure
  const overallScore = Math.round(
    baseValidationResult.score * 0.5 +
    coverageScore * 0.3 +
    structureCheck.structureScore * 0.2
  );

  // Step 8: Determine validity
  // Valid if: overall score >= 60 AND at least 70% of sub-questions covered AND no critical issues
  const isValid = overallScore >= 60 &&
    coverageScore >= 70 &&
    !baseValidationResult.issues.some(i => i.severity === 'critical');

  console.log('[COMPLEX-VALIDATION] ═══════════════════════════════════════════');
  console.log('[COMPLEX-VALIDATION] Validation Complete:');
  console.log(`  • Overall Score: ${overallScore}`);
  console.log(`  • Coverage Score: ${coverageScore}% (${coveredCount}/${queryPlan.subQuestions.length})`);
  console.log(`  • Structure Score: ${structureCheck.structureScore}`);
  console.log(`  • Base Validation Score: ${baseValidationResult.score}`);
  console.log(`  • Is Valid: ${isValid}`);
  console.log('[COMPLEX-VALIDATION] ═══════════════════════════════════════════');

  return {
    isValid,
    overallScore,
    subQuestionCoverage,
    coverageScore,
    missingParts,
    redundantParts: [], // Future: detect redundant sections
    recommendations,
    baseValidation: baseValidationResult.metadata,
  };
}

/**
 * Quick check for complex answer completeness (for streaming)
 */
export function quickComplexCheck(
  partialAnswer: string,
  queryPlan: QueryPlan
): { isProgressing: boolean; coveredCount: number; totalCount: number } {
  const coveredCount = queryPlan.subQuestions.filter(sq => {
    const keyTerms = sq.text.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    return keyTerms.some(term => partialAnswer.toLowerCase().includes(term));
  }).length;

  return {
    isProgressing: coveredCount > 0 || partialAnswer.length > 100,
    coveredCount,
    totalCount: queryPlan.subQuestions.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════

export const kodaComplexAnswerValidation = {
  validateComplexAnswer,
  quickComplexCheck,
  checkSubQuestionCoverage,
};

export default kodaComplexAnswerValidation;
