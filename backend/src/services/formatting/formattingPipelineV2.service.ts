/**
 * Formatting Pipeline V2 - Orchestrates formatting layers
 *
 * Uses existing V1 layers but with V2 type compatibility.
 * Compatible with 25-category intent classification.
 */

import type { SourceDocument } from '../../types/ragV1.types';
import type {
  IntentClassificationV2,
  RagStatus,
  Citation,
  AnswerType,
} from '../../types/ragV2.types';

// Import V1 layers (they work fine for V2)
import { kodaCitationEngineV1 } from './kodaCitationEngineV1.service';
import { kodaOutputStructureEngineV1 } from './kodaOutputStructureEngineV1.service';
import { kodaFormatEngineV1 } from './kodaFormatEngineV1.service';
import { kodaAnswerValidationEngineV1 } from './kodaAnswerValidationEngineV1.service';
import { kodaUnifiedPostProcessorV1 } from './kodaUnifiedPostProcessorV1.service';

// V2 Formatting Context
export interface FormattingContextV2 {
  intent: IntentClassificationV2;
  ragStatus: RagStatus;
  citations: Citation[];
  answerType: AnswerType;
  sourceDocuments?: SourceDocument[];
}

// V2 Formatted Output
export interface FormattedOutputV2 {
  text: string;
  citations: Citation[];
  metadata: {
    wasValidated: boolean;
    hadFallback: boolean;
    appliedRules: string[];
  };
}

class FormattingPipelineV2 {
  async process(
    rawAnswer: string,
    context: FormattingContextV2
  ): Promise<FormattedOutputV2> {
    let text = rawAnswer;
    const appliedRules: string[] = [];
    let citations = context.citations || [];

    // Convert V2 context to V1 format for layer compatibility
    const v1Context = {
      intent: {
        domain: context.intent.domain as any,
        questionType: context.intent.questionType as any,
        scope: context.intent.scope,
        confidence: context.intent.confidence,
      },
      ragStatus: context.ragStatus as any,
      citations: context.citations as any,
      answerType: context.answerType as any,
    };

    try {
      // Layer 0: Citation Engine (MUST BE FIRST)
      if (context.sourceDocuments && context.sourceDocuments.length > 0) {
        const citationResult = kodaCitationEngineV1.process(text, context.sourceDocuments);
        text = citationResult.text;
        citations = citationResult.citations;
        appliedRules.push('citations');

        // Also handle legacy [[DOC:id|Title]] format
        text = kodaCitationEngineV1.convertLegacyFormat(text, context.sourceDocuments);
      }

      // Layer 1: Structure
      text = await kodaOutputStructureEngineV1.process(text, v1Context);
      appliedRules.push('structure');

      // Layer 2: Format
      const formatted = await kodaFormatEngineV1.process(text, v1Context);
      text = formatted.text;
      appliedRules.push('format');

      // Merge citations from format engine if any new ones found
      if (formatted.citations && formatted.citations.length > 0) {
        const existingIds = new Set(citations.map(c => c.documentId));
        for (const newCitation of formatted.citations) {
          if (!existingIds.has(newCitation.documentId)) {
            citations.push(newCitation);
            existingIds.add(newCitation.documentId);
          }
        }
      }

      // Layer 3: Validate
      const validation = await kodaAnswerValidationEngineV1.validate(text, v1Context);
      appliedRules.push('validate');

      // Log validation warnings but don't block
      if (!validation.isValid && validation.warnings.length > 0) {
        console.warn('[FormattingPipelineV2] Validation warnings:', validation.warnings);
      }

      // Layer 4: Post-process
      text = await kodaUnifiedPostProcessorV1.process(text, v1Context);
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

    } catch (error) {
      console.error('[FormattingPipelineV2] Error:', error);

      // Return raw answer on error
      return {
        text: rawAnswer,
        citations,
        metadata: {
          wasValidated: false,
          hadFallback: true,
          appliedRules,
        },
      };
    }
  }
}

export const formattingPipelineV2 = new FormattingPipelineV2();
export default formattingPipelineV2;
