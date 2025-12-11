/**
 * ============================================================================
 * FORMATTING PIPELINE SERVICE
 * ============================================================================
 *
 * Runs the 4-layer formatting pipeline:
 * 1. kodaOutputStructureEngine - Structure & clean
 * 2. kodaFormatEngine - Markdown formatting
 * 3. kodaAnswerValidationEngine - Quality check
 * 4. kodaUnifiedPostProcessor - Final polish & fallback
 *
 * @version 2.0.0
 * @date 2024-12-10
 */

import type {
  FormattingConfig,
  CitationSource,
  FinalAnswer,
} from '../types/orchestrator.types';

// Import the 4 formatting layers
import kodaOutputStructureEngine from './kodaOutputStructureEngine.service';
import kodaFormatEngine from './kodaFormatEngine.service';
import kodaAnswerValidationEngine from './kodaAnswerValidationEngine.service';
import kodaUnifiedPostProcessor from './kodaUnifiedPostProcessor.service';

// =============================================================================
// FORMATTING PIPELINE
// =============================================================================

class FormattingPipelineService {
  /**
   * Run complete 4-layer formatting pipeline
   */
  async run(
    rawText: string,
    config: FormattingConfig
  ): Promise<{
    text: string;
    citations: CitationSource[];
    isValid: boolean;
    validationIssues?: string[];
    shouldRetry?: boolean;
  }> {
    const startTime = Date.now();

    console.log(`[FORMATTING_PIPELINE] Starting 4-layer pipeline for ${config.questionType}`);

    try {
      // ======================================================================
      // LAYER 1: STRUCTURE & CLEAN
      // ======================================================================

      const layer1Start = Date.now();

      let structured;
      try {
        structured = await kodaOutputStructureEngine.process(rawText, {
          language: config.language,
          questionType: config.questionType,
          citations: config.citations,
        });
        console.log(`[FORMATTING_PIPELINE] Layer 1 complete in ${Date.now() - layer1Start}ms`);
      } catch (err) {
        console.warn(`[FORMATTING_PIPELINE] Layer 1 error, using raw text:`, err);
        structured = {
          text: rawText,
          docMarkers: [],
          boldSpans: 0,
          stats: { paragraphs: 1, sentences: 1, duplicatesRemoved: 0 },
        };
      }

      // ======================================================================
      // LAYER 2: MARKDOWN FORMATTING
      // ======================================================================

      const layer2Start = Date.now();

      let formatted;
      try {
        formatted = await kodaFormatEngine.format(structured, {
          questionType: config.questionType,
          language: config.language,
          isMultiDoc: config.citations.length > 1,
        });
        console.log(`[FORMATTING_PIPELINE] Layer 2 complete in ${Date.now() - layer2Start}ms`);
      } catch (err) {
        console.warn(`[FORMATTING_PIPELINE] Layer 2 error, using structured text:`, err);
        formatted = {
          markdown: structured.text,
          structure: { hasTitle: false, hasSections: false, hasBullets: false, hasTable: false },
        };
      }

      // ======================================================================
      // LAYER 3: VALIDATION
      // ======================================================================

      const layer3Start = Date.now();

      let validation;
      try {
        validation = await kodaAnswerValidationEngine.validate(
          formatted.markdown,
          {
            questionType: config.questionType,
            domain: config.ragStatus === 'success' ? 'doc_content' : 'generic',
            citations: config.citations,
            ragStatus: config.ragStatus,
          }
        );
        console.log(`[FORMATTING_PIPELINE] Layer 3 complete in ${Date.now() - layer3Start}ms: ${validation.isValid ? 'valid' : 'invalid'}`);
      } catch (err) {
        console.warn(`[FORMATTING_PIPELINE] Layer 3 error, assuming valid:`, err);
        validation = {
          isValid: true,
          issues: [],
          severity: 'info' as const,
          shouldRetry: false,
          shouldFallback: false,
        };
      }

      // ======================================================================
      // LAYER 4: POST-PROCESSING & FALLBACK
      // ======================================================================

      const layer4Start = Date.now();

      let final;
      try {
        final = await kodaUnifiedPostProcessor.process(
          formatted.markdown,
          {
            citations: config.citations,
            validationResult: validation,
            fallbackType: config.fallbackType,
            questionType: config.questionType,
            language: config.language,
          }
        );
        console.log(`[FORMATTING_PIPELINE] Layer 4 complete in ${Date.now() - layer4Start}ms`);
      } catch (err) {
        console.warn(`[FORMATTING_PIPELINE] Layer 4 error, using formatted text:`, err);
        final = {
          text: formatted.markdown,
          citations: config.citations,
          answerType: 'normal' as const,
          docsUsed: config.citations.map(c => c.id),
          metadata: {
            questionType: config.questionType,
            domain: 'doc_content' as const,
            processingTime: Date.now() - startTime,
            modelUsed: 'gemini-2.5-flash',
          },
        };
      }

      // ======================================================================
      // RETURN RESULT
      // ======================================================================

      const totalTime = Date.now() - startTime;
      console.log(`[FORMATTING_PIPELINE] Complete pipeline in ${totalTime}ms`);

      return {
        text: final.text,
        citations: final.citations,
        isValid: validation.isValid,
        validationIssues: validation.issues,
        shouldRetry: validation.shouldRetry,
      };

    } catch (error) {
      console.error('[FORMATTING_PIPELINE] Error:', error);

      // Return raw text on error
      return {
        text: rawText,
        citations: config.citations,
        isValid: false,
        validationIssues: ['Formatting pipeline error'],
        shouldRetry: false,
      };
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

const formattingPipelineService = new FormattingPipelineService();
export default formattingPipelineService;
export { FormattingPipelineService };
