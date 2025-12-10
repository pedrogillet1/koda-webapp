/**
 * ============================================================================
 * ANSWER MODE TEMPLATES - ChatGPT-like Formatting Rules
 * ============================================================================
 * 
 * Based on Note 5: Defines exact formatting rules for each answer mode.
 * This ensures Koda's answers are clean, tight, and conversational.
 * 
 * Each mode has specific rules for:
 * - Sections (yes/no, which sections)
 * - Headings (## or just bold labels)
 * - Paragraph length (max chars/lines)
 * - Bullets vs plain text
 * - Bold strategy (minimal, selective, aggressive)
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import {
  AnswerMode,
  AnswerModeTemplate,
  FormattingRules,
} from '../types';

// ============================================================================
// ANSWER MODE TEMPLATES
// ============================================================================

export const ANSWER_MODE_TEMPLATES: Record<AnswerMode, AnswerModeTemplate> = {
  
  // ==========================================================================
  // META/SYSTEM MODE
  // ==========================================================================
  // For: doc counts, file types, system queries
  // Style: Ultra-short, no heavy structure
  [AnswerMode.META_SYSTEM]: {
    mode: AnswerMode.META_SYSTEM,
    rules: {
      maxParagraphLength: 200,
      maxParagraphsBeforeBreak: 2,
      useMarkdownHeadings: false,
      maxHeadingLevel: 0,
      boldStrategy: 'minimal',
      boldTargets: ['numbers', 'filenames'],
      preferBulletsOver: 3,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 0,
      blankLinesBetweenSections: 1,
      includeSections: false,
      includeTitle: false,
      includeClosing: false,
    },
    structure: {
      sections: undefined,
      maxSections: 0,
      requiresHeadings: false,
    },
    constraints: {
      maxLength: 500,
      minLength: 20,
      maxBulletPoints: 5,
    },
  },
  
  // ==========================================================================
  // SINGLE-DOC FACTUAL MODE
  // ==========================================================================
  // For: one value / short explanation from specific file
  // Style: Direct answer, optional small bullet list
  [AnswerMode.SINGLE_DOC_FACTUAL]: {
    mode: AnswerMode.SINGLE_DOC_FACTUAL,
    rules: {
      maxParagraphLength: 300,
      maxParagraphsBeforeBreak: 3,
      useMarkdownHeadings: false,
      maxHeadingLevel: 0,
      boldStrategy: 'selective',
      boldTargets: ['labels', 'numbers', 'filenames'],
      preferBulletsOver: 2,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 0,
      blankLinesBetweenSections: 1,
      includeSections: false,
      includeTitle: false,
      includeClosing: true, // Optional closing like "Se quiser, posso detalhar [X]."
    },
    structure: {
      sections: undefined,
      maxSections: 0,
      requiresHeadings: false,
    },
    constraints: {
      maxLength: 800,
      minLength: 50,
      maxBulletPoints: 5,
    },
  },
  
  // ==========================================================================
  // MULTI-DOC / ROI / COMPLEX MODE
  // ==========================================================================
  // For: compare docs, ROI, nuanced analysis
  // Style: Structured sections with ## headings
  [AnswerMode.MULTI_DOC_COMPLEX]: {
    mode: AnswerMode.MULTI_DOC_COMPLEX,
    rules: {
      maxParagraphLength: 400,
      maxParagraphsBeforeBreak: 2,
      useMarkdownHeadings: true,
      maxHeadingLevel: 2,
      boldStrategy: 'selective',
      boldTargets: ['labels', 'numbers', 'keywords'],
      preferBulletsOver: 2,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 1,
      blankLinesBetweenSections: 1,
      includeSections: true,
      includeTitle: false,
      includeClosing: true,
    },
    structure: {
      sections: ['Visão geral', 'Comparação', 'Conclusão'],
      maxSections: 4,
      requiresHeadings: true,
    },
    constraints: {
      maxLength: 2000,
      minLength: 200,
      maxBulletPoints: 8,
    },
  },
  
  // ==========================================================================
  // NAVIGATION/SECTION MODE
  // ==========================================================================
  // For: where is X in the document
  // Style: Direct answer with location
  [AnswerMode.NAVIGATION_SECTION]: {
    mode: AnswerMode.NAVIGATION_SECTION,
    rules: {
      maxParagraphLength: 250,
      maxParagraphsBeforeBreak: 2,
      useMarkdownHeadings: false,
      maxHeadingLevel: 0,
      boldStrategy: 'selective',
      boldTargets: ['labels', 'filenames'],
      preferBulletsOver: 3,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 0,
      blankLinesBetweenSections: 1,
      includeSections: false,
      includeTitle: false,
      includeClosing: false,
    },
    structure: {
      sections: undefined,
      maxSections: 0,
      requiresHeadings: false,
    },
    constraints: {
      maxLength: 600,
      minLength: 30,
      maxBulletPoints: 4,
    },
  },
  
  // ==========================================================================
  // CALCULATION/ROI MODE
  // ==========================================================================
  // For: numeric reasoning, calculations
  // Style: Short intro + bullet list of values + conclusion
  [AnswerMode.CALCULATION_ROI]: {
    mode: AnswerMode.CALCULATION_ROI,
    rules: {
      maxParagraphLength: 300,
      maxParagraphsBeforeBreak: 2,
      useMarkdownHeadings: true,
      maxHeadingLevel: 2,
      boldStrategy: 'selective',
      boldTargets: ['labels', 'numbers'],
      preferBulletsOver: 1,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 1,
      blankLinesBetweenSections: 1,
      includeSections: true,
      includeTitle: false,
      includeClosing: true,
    },
    structure: {
      sections: ['Cálculo', 'Resultado'],
      maxSections: 3,
      requiresHeadings: true,
    },
    constraints: {
      maxLength: 1200,
      minLength: 100,
      maxBulletPoints: 10,
    },
  },
  
  // ==========================================================================
  // ONBOARDING/SUPPORT MODE
  // ==========================================================================
  // For: how to use Koda, help queries
  // Style: Short intro + numbered list of steps
  [AnswerMode.ONBOARDING_SUPPORT]: {
    mode: AnswerMode.ONBOARDING_SUPPORT,
    rules: {
      maxParagraphLength: 200,
      maxParagraphsBeforeBreak: 1,
      useMarkdownHeadings: false,
      maxHeadingLevel: 0,
      boldStrategy: 'selective',
      boldTargets: ['labels', 'keywords'],
      preferBulletsOver: 1,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 0,
      blankLinesBetweenSections: 1,
      includeSections: false,
      includeTitle: false,
      includeClosing: false,
    },
    structure: {
      sections: undefined,
      maxSections: 0,
      requiresHeadings: false,
    },
    constraints: {
      maxLength: 800,
      minLength: 50,
      maxBulletPoints: 6,
    },
  },
  
  // ==========================================================================
  // NO-DATA / NOT FOUND MODE
  // ==========================================================================
  // For: doc missing, info not present
  // Style: One clear message + suggestion
  [AnswerMode.NO_DATA_NOT_FOUND]: {
    mode: AnswerMode.NO_DATA_NOT_FOUND,
    rules: {
      maxParagraphLength: 200,
      maxParagraphsBeforeBreak: 2,
      useMarkdownHeadings: false,
      maxHeadingLevel: 0,
      boldStrategy: 'minimal',
      boldTargets: ['filenames', 'keywords'],
      preferBulletsOver: 2,
      bulletStyle: '-',
      maxBlankLines: 1,
      blankLinesAfterHeading: 0,
      blankLinesBetweenSections: 1,
      includeSections: false,
      includeTitle: false,
      includeClosing: false,
    },
    structure: {
      sections: undefined,
      maxSections: 0,
      requiresHeadings: false,
    },
    constraints: {
      maxLength: 400,
      minLength: 30,
      maxBulletPoints: 3,
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get template for a specific answer mode
 */
export function getAnswerModeTemplate(mode: AnswerMode): AnswerModeTemplate {
  return ANSWER_MODE_TEMPLATES[mode];
}

/**
 * Get formatting rules for a specific answer mode
 */
export function getFormattingRules(mode: AnswerMode): FormattingRules {
  return ANSWER_MODE_TEMPLATES[mode].rules;
}

/**
 * Check if mode allows sections
 */
export function modeAllowsSections(mode: AnswerMode): boolean {
  return ANSWER_MODE_TEMPLATES[mode].rules.includeSections;
}

/**
 * Check if mode requires headings
 */
export function modeRequiresHeadings(mode: AnswerMode): boolean {
  return ANSWER_MODE_TEMPLATES[mode].structure.requiresHeadings || false;
}

/**
 * Get max length for mode
 */
export function getMaxLength(mode: AnswerMode): number {
  return ANSWER_MODE_TEMPLATES[mode].constraints.maxLength || 2000;
}

/**
 * Get max bullet points for mode
 */
export function getMaxBulletPoints(mode: AnswerMode): number {
  return ANSWER_MODE_TEMPLATES[mode].constraints.maxBulletPoints || 10;
}
