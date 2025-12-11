/**
 * Koda Answer Validation Engine
 * 
 * Professional-grade validation system for Koda's RAG answers
 * Similar to OpenAI's internal output verification
 * 
 * PURPOSE:
 * - Detect formatting errors before sending to frontend
 * - Enforce citation rules
 * - Validate bold formatting
 * - Check document existence
 * - Detect hallucinations
 * - Prevent persona leaks
 * 
 * ARCHITECTURE:
 * Input: Formatted answer from kodaFormatEngine
 * Process: Run 50+ validation rules
 * Output: ValidationReport with errors/warnings/fixes
 * 
 * INTEGRATION:
 * Lives between kodaFormatEngine and kodaUnifiedPostProcessor
 */

import {
  ValidationReport,
  ValidationRule,
  ValidationResult,
  ValidationSeverity,
  AnswerComponents,
  ValidatorConfig,
} from '../types/validation.types';

// Import all validators
import { validateInlineCitations } from '../validators/citationValidators';
import { validateCitationFormat } from '../validators/citationValidators';
import { validateBoldFormatting } from '../validators/boldValidators';
import { validateStructure } from '../validators/structureValidators';
import { validateParagraphs } from '../validators/paragraphValidators';
import { validateDocumentExistence } from '../validators/documentValidators';
import { validatePersonaLeaks } from '../validators/personaValidators';
import { validateFallbackIntegrity } from '../validators/fallbackValidators';
import { validateSpacing } from '../validators/spacingValidators';
import { validateDuplicates } from '../validators/duplicateValidators';
import { validateContextRelevance } from '../validators/relevanceValidators';
import { validateNumberFormatting } from '../validators/numberValidators';
import { validateListFormatting } from '../validators/listValidators';
import { validateHeadings } from '../validators/headingValidators';
import { validateMarkdownSyntax } from '../validators/markdownValidators';

/**
 * Main validation engine class
 */
class KodaAnswerValidationEngine {
  private validators: ValidationRule[];
  private config: ValidatorConfig;

  constructor(config?: Partial<ValidatorConfig>) {
    this.config = {
      strictMode: config?.strictMode ?? true,
      autoFix: config?.autoFix ?? false,
      logWarnings: config?.logWarnings ?? true,
      failOnCritical: config?.failOnCritical ?? true,
      ...config,
    };

    // Initialize all validators
    this.validators = this.initializeValidators();
  }

  /**
   * Initialize all validation rules
   */
  private initializeValidators(): ValidationRule[] {
    return [
      // CATEGORY 1: Citation Validators (Critical)
      {
        id: 'inline_citations',
        name: 'Inline Citations Validator',
        category: 'citations',
        severity: 'critical',
        validator: validateInlineCitations,
        enabled: true,
      },
      {
        id: 'citation_format',
        name: 'Citation Format Validator',
        category: 'citations',
        severity: 'critical',
        validator: validateCitationFormat,
        enabled: true,
      },
      {
        id: 'document_existence',
        name: 'Document Existence Validator',
        category: 'citations',
        severity: 'critical',
        validator: validateDocumentExistence,
        enabled: true,
      },

      // CATEGORY 2: Bold Formatting Validators (Fixable)
      {
        id: 'bold_formatting',
        name: 'Bold Formatting Validator',
        category: 'formatting',
        severity: 'fixable',
        validator: validateBoldFormatting,
        enabled: true,
      },
      {
        id: 'number_formatting',
        name: 'Number Formatting Validator',
        category: 'formatting',
        severity: 'fixable',
        validator: validateNumberFormatting,
        enabled: true,
      },

      // CATEGORY 3: Structure Validators (Fixable)
      {
        id: 'structure',
        name: 'Structure Validator',
        category: 'structure',
        severity: 'fixable',
        validator: validateStructure,
        enabled: true,
      },
      {
        id: 'headings',
        name: 'Headings Validator',
        category: 'structure',
        severity: 'fixable',
        validator: validateHeadings,
        enabled: true,
      },
      {
        id: 'paragraphs',
        name: 'Paragraph Validator',
        category: 'structure',
        severity: 'fixable',
        validator: validateParagraphs,
        enabled: true,
      },
      {
        id: 'spacing',
        name: 'Spacing Validator',
        category: 'structure',
        severity: 'fixable',
        validator: validateSpacing,
        enabled: true,
      },
      {
        id: 'list_formatting',
        name: 'List Formatting Validator',
        category: 'structure',
        severity: 'fixable',
        validator: validateListFormatting,
        enabled: true,
      },

      // CATEGORY 4: Content Validators (Critical)
      {
        id: 'context_relevance',
        name: 'Context Relevance Validator',
        category: 'content',
        severity: 'critical',
        validator: validateContextRelevance,
        enabled: true,
      },
      {
        id: 'persona_leaks',
        name: 'Persona Leak Validator',
        category: 'content',
        severity: 'critical',
        validator: validatePersonaLeaks,
        enabled: true,
      },
      {
        id: 'fallback_integrity',
        name: 'Fallback Integrity Validator',
        category: 'content',
        severity: 'critical',
        validator: validateFallbackIntegrity,
        enabled: true,
      },

      // CATEGORY 5: Quality Validators (Warning)
      {
        id: 'duplicates',
        name: 'Duplicate Content Validator',
        category: 'quality',
        severity: 'warning',
        validator: validateDuplicates,
        enabled: true,
      },
      {
        id: 'markdown_syntax',
        name: 'Markdown Syntax Validator',
        category: 'quality',
        severity: 'warning',
        validator: validateMarkdownSyntax,
        enabled: true,
      },
    ];
  }

  /**
   * Main validation method
   * 
   * @param answerText - Formatted answer text
   * @param metadata - Answer metadata (citations, documents, etc.)
   * @returns ValidationReport with all results
   */
  async validate(
    answerText: string,
    metadata: {
      citations?: any[];
      documents?: any[];
      retrievedChunks?: any[];
      intent?: string;
      ragMode?: string;
    }
  ): Promise<ValidationReport> {
    const startTime = Date.now();

    // STEP 1: Parse answer into components
    const components = this.parseAnswer(answerText);

    // STEP 2: Run all validators
    const results: ValidationResult[] = [];
    
    for (const rule of this.validators) {
      if (!rule.enabled) continue;

      try {
        const result = await rule.validator(components, metadata, this.config);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          ...result,
        });
      } catch (error) {
        console.error(`[ValidationEngine] Error in validator ${rule.id}:`, error);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: 'critical',
          passed: false,
          message: `Validator crashed: ${error.message}`,
          fixable: false,
        });
      }
    }

    // STEP 3: Aggregate results
    const report = this.aggregateResults(results, answerText, components);
    report.validationTimeMs = Date.now() - startTime;

    // STEP 4: Log if needed
    if (this.config.logWarnings && report.warnings.length > 0) {
      console.warn('[ValidationEngine] Warnings:', report.warnings);
    }

    return report;
  }

  /**
   * Parse answer into structured components
   */
  private parseAnswer(answerText: string): AnswerComponents {
    const lines = answerText.split('\n');
    
    // Extract title (first heading)
    const titleMatch = answerText.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : null;

    // Extract all headings
    const headings = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(answerText)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2],
        position: match.index,
      });
    }

    // Extract paragraphs (non-empty lines that aren't headings or lists)
    const paragraphs = [];
    let currentParagraph = '';
    for (const line of lines) {
      if (line.trim() === '') {
        if (currentParagraph) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
      } else if (!line.match(/^#{1,6}\s/) && !line.match(/^[-*]\s/)) {
        currentParagraph += (currentParagraph ? ' ' : '') + line;
      }
    }
    if (currentParagraph) {
      paragraphs.push(currentParagraph.trim());
    }

    // Extract inline citations (bold + underlined document names)
    const inlineCitations = [];
    const citationRegex = /\*\*<u>([^<]+)<\/u>\*\*/g;
    while ((match = citationRegex.exec(answerText)) !== null) {
      inlineCitations.push({
        text: match[1],
        position: match.index,
        fullMatch: match[0],
      });
    }

    // Extract list citations (numbered list at end)
    const listCitations = [];
    const listRegex = /^\d+\.\s+\*\*(.+?)\*\*/gm;
    while ((match = listRegex.exec(answerText)) !== null) {
      listCitations.push({
        text: match[1],
        position: match.index,
        fullMatch: match[0],
      });
    }

    // Extract bold elements
    const boldElements = [];
    const boldRegex = /\*\*([^*]+)\*\*/g;
    while ((match = boldRegex.exec(answerText)) !== null) {
      boldElements.push({
        text: match[1],
        position: match.index,
        fullMatch: match[0],
      });
    }

    // Extract lists
    const lists = [];
    const listItemRegex = /^[-*]\s+(.+)$/gm;
    while ((match = listItemRegex.exec(answerText)) !== null) {
      lists.push({
        text: match[1],
        position: match.index,
        fullMatch: match[0],
      });
    }

    return {
      title,
      headings,
      paragraphs,
      inlineCitations,
      listCitations,
      boldElements,
      lists,
      rawText: answerText,
      lineCount: lines.length,
      characterCount: answerText.length,
    };
  }

  /**
   * Aggregate validation results into final report
   */
  private aggregateResults(
    results: ValidationResult[],
    answerText: string,
    components: AnswerComponents
  ): ValidationReport {
    const errors = results.filter(r => !r.passed && r.severity === 'critical');
    const fixable = results.filter(r => !r.passed && r.severity === 'fixable');
    const warnings = results.filter(r => !r.passed && r.severity === 'warning');
    const passed = results.filter(r => r.passed);

    const hasCriticalErrors = errors.length > 0;
    const needsReformatting = fixable.length > 0;
    const needsRegeneration = hasCriticalErrors && !this.config.autoFix;

    // Calculate overall quality score (0-100)
    const totalRules = results.length;
    const passedRules = passed.length;
    const qualityScore = Math.round((passedRules / totalRules) * 100);

    // Determine action
    let recommendedAction: 'pass' | 'reformat' | 'regenerate' | 'fallback';
    if (hasCriticalErrors) {
      recommendedAction = needsRegeneration ? 'regenerate' : 'fallback';
    } else if (needsReformatting) {
      recommendedAction = 'reformat';
    } else {
      recommendedAction = 'pass';
    }

    return {
      passed: !hasCriticalErrors && !needsReformatting,
      qualityScore,
      errors,
      fixable,
      warnings,
      totalChecks: totalRules,
      passedChecks: passedRules,
      failedChecks: totalRules - passedRules,
      recommendedAction,
      validationTimeMs: 0, // Will be set by caller
      components,
      summary: this.generateSummary(errors, fixable, warnings),
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    errors: ValidationResult[],
    fixable: ValidationResult[],
    warnings: ValidationResult[]
  ): string {
    if (errors.length === 0 && fixable.length === 0 && warnings.length === 0) {
      return 'All validation checks passed. Answer is ready for delivery.';
    }

    const parts = [];
    if (errors.length > 0) {
      parts.push(`${errors.length} critical error(s)`);
    }
    if (fixable.length > 0) {
      parts.push(`${fixable.length} fixable issue(s)`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning(s)`);
    }

    return `Found ${parts.join(', ')}. Review required.`;
  }

  /**
   * Get validation statistics
   */
  getStatistics(report: ValidationReport) {
    return {
      qualityScore: report.qualityScore,
      totalChecks: report.totalChecks,
      passedChecks: report.passedChecks,
      failedChecks: report.failedChecks,
      criticalErrors: report.errors.length,
      fixableIssues: report.fixable.length,
      warnings: report.warnings.length,
      recommendedAction: report.recommendedAction,
      validationTime: report.validationTimeMs,
    };
  }
}

// Export singleton instance
export const kodaAnswerValidationEngine = new KodaAnswerValidationEngine({
  strictMode: true,
  autoFix: false,
  logWarnings: true,
  failOnCritical: true,
});

export default kodaAnswerValidationEngine;
