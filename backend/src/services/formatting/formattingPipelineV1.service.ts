/**
 * Formatting Pipeline V1 - Orchestrates 4 layers
 *
 * Layer 1: kodaOutputStructureEngineV1 - Structure & spacing
 * Layer 2: kodaFormatEngineV1 - Markdown & citations
 * Layer 3: kodaAnswerValidationEngineV1 - Quality checks
 * Layer 4: kodaUnifiedPostProcessorV1 - Final polish
 */

import type { FormattingContext, FormattedOutput } from '../../types/ragV1.types';

// Import all 4 layers
import { kodaOutputStructureEngineV1 } from './kodaOutputStructureEngineV1.service';
import { kodaFormatEngineV1 } from './kodaFormatEngineV1.service';
import { kodaAnswerValidationEngineV1 } from './kodaAnswerValidationEngineV1.service';
import { kodaUnifiedPostProcessorV1 } from './kodaUnifiedPostProcessorV1.service';

class FormattingPipelineV1 {
  async process(
    rawAnswer: string,
    context: FormattingContext
  ): Promise<FormattedOutput> {
    let text = rawAnswer;
    const appliedRules: string[] = [];

    // Layer 1: Structure
    text = await kodaOutputStructureEngineV1.process(text, context);
    appliedRules.push('structure');

    // Layer 2: Format
    const formatted = await kodaFormatEngineV1.process(text, context);
    text = formatted.text;
    appliedRules.push('format');

    // Layer 3: Validate
    const validation = await kodaAnswerValidationEngineV1.validate(text, context);
    appliedRules.push('validate');

    // Layer 4: Post-process
    text = await kodaUnifiedPostProcessorV1.process(text, context);
    appliedRules.push('postprocess');

    return {
      text,
      citations: formatted.citations || [],
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
