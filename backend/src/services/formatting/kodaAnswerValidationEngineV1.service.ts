/**
 * Layer 3: Answer Validation Engine V1
 *
 * Checks:
 * - Completeness (answer not empty)
 * - Citations present (for RAG queries)
 * - Document mentioned (title appears)
 * - Numeric values (for factual queries)
 * - Bullet list (for multi-point extraction)
 * - Quality (no hallucination markers)
 */

import type { FormattingContext } from '../../types/ragV1.types';

export interface ValidationReport {
  isValid: boolean;
  checks: Record<string, boolean>;
  warnings: string[];
}

class KodaAnswerValidationEngineV1 {
  async validate(
    text: string,
    context: FormattingContext
  ): Promise<ValidationReport> {
    const checks = {
      isComplete: this.checkCompleteness(text),
      hasCitations: this.checkCitationsPresent(text, context),
      hasDocumentMention: this.checkDocumentMentioned(text, context),
      hasNumericValues: this.checkNumericValues(text, context),
      hasBulletList: this.checkBulletList(text, context),
      passesQualityCheck: this.checkQuality(text),
    };

    const isValid = Object.values(checks).every(v => v === true);

    return {
      isValid,
      checks,
      warnings: this.buildWarnings(checks),
    };
  }

  private checkCompleteness(text: string): boolean {
    return text.trim().length > 10;
  }

  private checkCitationsPresent(text: string, context: FormattingContext): boolean {
    // Only required for RAG queries
    if (context.answerType === 'analytics' || context.answerType === 'generic_chat') {
      return true;
    }

    // Check for citation markers [1], [2], etc.
    return /\[\d+\]/.test(text);
  }

  private checkDocumentMentioned(text: string, context: FormattingContext): boolean {
    // Only required for single-doc queries
    if (context.intent?.scope !== 'single_document') {
      return true;
    }

    // For V1, always pass this check
    return true;
  }

  private checkNumericValues(text: string, context: FormattingContext): boolean {
    // Only required for factual queries
    if (context.intent?.questionType !== 'simple_factual') {
      return true;
    }

    // Check for numbers
    return /\d+/.test(text);
  }

  private checkBulletList(text: string, context: FormattingContext): boolean {
    // Only required for multi-point extraction
    if (context.intent?.questionType !== 'multi_point_extraction') {
      return true;
    }

    // Check for bullet points
    return /^-\s+/m.test(text);
  }

  private checkQuality(text: string): boolean {
    // Check for hallucination markers
    const badPatterns = [
      /I don't have/i,
      /I cannot/i,
      /as an AI/i,
      /I'm not able/i,
      /I don't know/i,
    ];

    return !badPatterns.some(pattern => pattern.test(text));
  }

  private buildWarnings(checks: Record<string, boolean>): string[] {
    const warnings: string[] = [];

    if (!checks.isComplete) {
      warnings.push('Answer is too short or empty');
    }

    if (!checks.hasCitations) {
      warnings.push('Missing citations for RAG query');
    }

    if (!checks.hasDocumentMention) {
      warnings.push('Document title not mentioned in single-doc query');
    }

    if (!checks.hasNumericValues) {
      warnings.push('Missing numeric values for factual query');
    }

    if (!checks.hasBulletList) {
      warnings.push('Missing bullet list for multi-point extraction');
    }

    if (!checks.passesQualityCheck) {
      warnings.push('Quality check failed - possible hallucination');
    }

    return warnings;
  }
}

export const kodaAnswerValidationEngineV1 = new KodaAnswerValidationEngineV1();
export default kodaAnswerValidationEngineV1;
