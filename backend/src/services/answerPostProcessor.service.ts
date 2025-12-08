/**
 * ============================================================================
 * ANSWER POST-PROCESSOR
 * ============================================================================
 *
 * Cleans and normalizes answers after generation to ensure:
 * - Consistent identity (no "I'm an AI" mentions)
 * - No duplicate paragraphs
 * - Clean markdown formatting
 * - Minimal richness for DEEP skills
 *
 * ============================================================================
 */

import { getIdentityNormalizationRules } from '../config/kodaPersonaConfig';
import { SkillMapping } from './skillAndIntentRouter.service';
import { SkillComplexity } from './kodaSkillTaxonomyExtended';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PostProcessResult {
  cleanedAnswer: string;
  changes: string[];
  warnings: string[];
}

// ============================================================================
// 1. REMOVE DUPLICATE PARAGRAPHS
// ============================================================================

/**
 * Detect and remove repeated blocks of text
 */
function removeDuplicateParagraphs(answerText: string): { text: string; removed: number } {
  const paragraphs = answerText.split(/\n\n+/);
  const uniqueParagraphs: string[] = [];
  const seenParagraphs = new Set<string>();
  let removed = 0;

  for (const para of paragraphs) {
    const normalized = para.toLowerCase().trim().replace(/\s+/g, ' ');

    if (normalized.length === 0) {
      continue; // Skip empty paragraphs
    }

    if (seenParagraphs.has(normalized)) {
      removed++;
      console.log(`[PostProcessor] Removed duplicate paragraph: "${para.substring(0, 50)}..."`);
    } else {
      uniqueParagraphs.push(para);
      seenParagraphs.add(normalized);
    }
  }

  return {
    text: uniqueParagraphs.join('\n\n'),
    removed,
  };
}

// ============================================================================
// 2. CLEAN EMPTY BULLETS AND ARTIFACTS
// ============================================================================

/**
 * Remove bullets with no content and fix spacing
 */
function cleanEmptyBulletsAndArtifacts(answerText: string): string {
  let cleaned = answerText;

  // Remove empty bullets (•, -, *, with no text)
  cleaned = cleaned.replace(/^[\s]*[•\-\*]\s*$/gm, '');

  // Remove multiple consecutive blank lines (max 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Normalize spacing around headings
  cleaned = cleaned.replace(/\n(#{1,6}\s+.+)\n/g, '\n\n$1\n\n');

  // Remove trailing whitespace
  cleaned = cleaned.replace(/\s+$/gm, '');

  // Trim overall
  cleaned = cleaned.trim();

  return cleaned;
}

// ============================================================================
// 3. NORMALIZE IDENTITY
// ============================================================================

/**
 * Replace or strip phrases that break Koda's identity
 */
function normalizeIdentity(answerText: string): { text: string; replacements: number } {
  let normalized = answerText;
  let replacements = 0;

  const rules = getIdentityNormalizationRules();

  for (const rule of rules) {
    const matches = normalized.match(rule.pattern);
    if (matches) {
      replacements += matches.length;
      normalized = normalized.replace(rule.pattern, rule.replacement);
      console.log(
        `[PostProcessor] Replaced identity phrase: "${matches[0]}" → "${rule.replacement}"`
      );
    }
  }

  return {
    text: normalized,
    replacements,
  };
}

// ============================================================================
// 4. CHECK MINIMAL RICHNESS
// ============================================================================

/**
 * For DEEP skills, check if answer is too short or lacks structure
 */
function checkMinimalRichness(
  skillMapping: SkillMapping,
  answerText: string
): { isWeak: boolean; reason?: string } {
  // Only check for DEEP complexity
  if (skillMapping.complexity !== SkillComplexity.DEEP) {
    return { isWeak: false };
  }

  const charCount = answerText.length;
  const headingCount = (answerText.match(/^#{1,6}\s+.+$/gm) || []).length;
  const bulletCount = (answerText.match(/^[\s]*[•\-\*]\s+.+$/gm) || []).length;

  // Thresholds for DEEP skills
  const MIN_CHARS = 500;
  const MIN_HEADINGS = 2;

  if (charCount < MIN_CHARS) {
    return {
      isWeak: true,
      reason: `Answer too short for DEEP skill (${charCount} chars, expected ${MIN_CHARS}+)`,
    };
  }

  if (headingCount < MIN_HEADINGS) {
    return {
      isWeak: true,
      reason: `Answer lacks structure for DEEP skill (${headingCount} headings, expected ${MIN_HEADINGS}+)`,
    };
  }

  return { isWeak: false };
}

// ============================================================================
// 5. BASIC MARKDOWN SANITY
// ============================================================================

/**
 * Fix obvious markdown formatting issues
 */
function basicMarkdownSanity(answerText: string): string {
  let fixed = answerText;

  // Ensure headings are separated by blank lines
  fixed = fixed.replace(/([^\n])\n(#{1,6}\s+.+)/g, '$1\n\n$2');
  fixed = fixed.replace(/(#{1,6}\s+.+)\n([^\n#])/g, '$1\n\n$2');

  // Fix repeated bold markers
  fixed = fixed.replace(/\*{3,}/g, '**');

  // Fix broken lists (ensure space after bullet)
  fixed = fixed.replace(/^([•\-\*])([^\s])/gm, '$1 $2');

  // Normalize bold + italic combinations
  fixed = fixed.replace(/\*\*\*(.*?)\*\*\*/g, '**$1**'); // Prefer bold over italic

  return fixed;
}

// ============================================================================
// 6. REMOVE EXCESSIVE GREETINGS
// ============================================================================

/**
 * Remove excessive or repeated greetings at the start of answers
 */
function removeExcessiveGreetings(answerText: string): string {
  // Remove greetings that appear at the very start
  let cleaned = answerText;

  // Remove patterns like "Olá!", "Oi!", "Olá! Claro," etc. at the start
  cleaned = cleaned.replace(
    /^(Olá!?\s*|Oi!?\s*|Hey!?\s*|Hi!?\s*)(Claro[,!]?\s*)?/i,
    ''
  );

  // Remove "Claro!" or "Com certeza!" at the very start
  cleaned = cleaned.replace(/^(Claro!?\s*|Com certeza!?\s*|Certamente!?\s*)/i, '');

  return cleaned.trim();
}

// ============================================================================
// MAIN POST-PROCESSOR
// ============================================================================

/**
 * Post-process answer after generation
 *
 * @param answerText - Raw answer from LLM
 * @param skillMapping - Skill mapping used for generation
 * @returns Cleaned answer with change log
 */
export function postProcessAnswer(
  answerText: string,
  skillMapping: SkillMapping
): PostProcessResult {
  const changes: string[] = [];
  const warnings: string[] = [];

  console.log('[PostProcessor] Starting post-processing...');

  // Step 0: Handle empty or null input
  if (!answerText || answerText.trim().length === 0) {
    return {
      cleanedAnswer: '',
      changes: ['Input was empty'],
      warnings: ['Empty answer received'],
    };
  }

  // Step 1: Remove excessive greetings
  const withoutGreetings = removeExcessiveGreetings(answerText);
  if (withoutGreetings !== answerText) {
    changes.push('Removed excessive greetings');
  }

  // Step 2: Remove duplicate paragraphs
  const { text: dedupedText, removed: duplicatesRemoved } =
    removeDuplicateParagraphs(withoutGreetings);
  if (duplicatesRemoved > 0) {
    changes.push(`Removed ${duplicatesRemoved} duplicate paragraph(s)`);
  }

  // Step 3: Clean empty bullets and artifacts
  const cleanedText = cleanEmptyBulletsAndArtifacts(dedupedText);
  changes.push('Cleaned empty bullets and normalized spacing');

  // Step 4: Normalize identity
  const { text: normalizedText, replacements } = normalizeIdentity(cleanedText);
  if (replacements > 0) {
    changes.push(`Normalized ${replacements} identity phrase(s)`);
  }

  // Step 5: Check minimal richness (for DEEP skills)
  const richnessCheck = checkMinimalRichness(skillMapping, normalizedText);
  if (richnessCheck.isWeak) {
    warnings.push(richnessCheck.reason || 'Answer may be too weak for DEEP skill');
  }

  // Step 6: Basic markdown sanity
  const finalText = basicMarkdownSanity(normalizedText);
  changes.push('Applied markdown sanity fixes');

  console.log(`[PostProcessor] Complete. Changes: ${changes.length}, Warnings: ${warnings.length}`);

  return {
    cleanedAnswer: finalText,
    changes,
    warnings,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const answerPostProcessor = {
  postProcessAnswer,
  removeDuplicateParagraphs,
  cleanEmptyBulletsAndArtifacts,
  normalizeIdentity,
  checkMinimalRichness,
  basicMarkdownSanity,
  removeExcessiveGreetings,
};

export default answerPostProcessor;
