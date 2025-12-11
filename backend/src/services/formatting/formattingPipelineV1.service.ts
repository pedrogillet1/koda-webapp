/**
 * Formatting Pipeline V1 - Orchestrates 5 layers
 *
 * KODA FIX: Reordered pipeline - Citation engine runs FIRST
 *
 * Layer 0: kodaCitationEngineV1 - Convert [SRC:X] → {{DOC:::}} (MUST BE FIRST)
 * Layer 1: kodaOutputStructureEngineV1 - Structure & spacing (preserves {{DOC:::}})
 * Layer 2: kodaFormatEngineV1 - Markdown & legacy citation cleanup
 * Layer 3: kodaAnswerValidationEngineV1 - Quality checks (warnings only)
 * Layer 4: kodaUnifiedPostProcessorV1 - Final polish (preserves {{DOC:::}})
 */

import type { FormattingContext, FormattedOutput, SourceDocument } from '../../types/ragV1.types';

// Import all layers
import { kodaCitationEngineV1 } from './kodaCitationEngineV1.service';
import { kodaOutputStructureEngineV1 } from './kodaOutputStructureEngineV1.service';
import { kodaFormatEngineV1 } from './kodaFormatEngineV1.service';
import { kodaAnswerValidationEngineV1 } from './kodaAnswerValidationEngineV1.service';
import { kodaUnifiedPostProcessorV1 } from './kodaUnifiedPostProcessorV1.service';

// Extended context that includes source documents
export interface ExtendedFormattingContext extends FormattingContext {
  sourceDocuments?: SourceDocument[];
}

class FormattingPipelineV1 {
  async process(
    rawAnswer: string,
    context: ExtendedFormattingContext
  ): Promise<FormattedOutput> {
    let text = rawAnswer;
    const appliedRules: string[] = [];
    let citations = context.citations || [];

    // Layer 0: Citation Engine (MUST BE FIRST)
    // Convert [SRC:X] markers to {{DOC:::}} format before any other processing
    if (context.sourceDocuments && context.sourceDocuments.length > 0) {
      const citationResult = kodaCitationEngineV1.process(text, context.sourceDocuments);
      text = citationResult.text;
      citations = citationResult.citations;
      appliedRules.push('citations');

      // Also handle legacy [[DOC:id|Title]] format
      text = kodaCitationEngineV1.convertLegacyFormat(text, context.sourceDocuments);
    }

    // Layer 1: Structure (preserves {{DOC:::}} markers)
    text = await kodaOutputStructureEngineV1.process(text, context);
    appliedRules.push('structure');

    // Layer 2: Format (handles any remaining markdown cleanup)
    const formatted = await kodaFormatEngineV1.process(text, context);
    text = formatted.text;
    appliedRules.push('format');

    // Merge citations from format engine if any new ones found
    if (formatted.citations && formatted.citations.length > 0) {
      // Deduplicate by documentId
      const existingIds = new Set(citations.map(c => c.documentId));
      for (const newCitation of formatted.citations) {
        if (!existingIds.has(newCitation.documentId)) {
          citations.push(newCitation);
          existingIds.add(newCitation.documentId);
        }
      }
    }

    // Layer 3: Validate (warnings only, does not modify text)
    const validation = await kodaAnswerValidationEngineV1.validate(text, context);
    appliedRules.push('validate');

    // Log validation warnings but don't block
    if (!validation.isValid && validation.warnings.length > 0) {
      console.warn('[FormattingPipelineV1] Validation warnings:', validation.warnings);
    }

    // Layer 4: Post-process (preserves {{DOC:::}} markers)
    text = await kodaUnifiedPostProcessorV1.process(text, context);
    appliedRules.push('postprocess');

    return {
      text,
      citations,
      metadata: {
        wasValidated: validation.isValid,
        hadFallback: false,
        appliedRules,
      },
    };
  }
}

export const formattingPipelineV1 = new FormattingPipelineV1();
export default formattingPipelineV1;
