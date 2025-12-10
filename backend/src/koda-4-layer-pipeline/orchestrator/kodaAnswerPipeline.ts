/**
 * ============================================================================
 * KODA ANSWER PIPELINE - ORCHESTRATOR
 * ============================================================================
 * 
 * This is the MAIN entry point for all answer formatting in Koda.
 * 
 * It orchestrates the 4-layer pipeline:
 * 1. kodaOutputStructureEngine → shape the answer
 * 2. masterAnswerFormatter → make it pretty & consistent
 * 3. kodaAnswerValidationEngine → quality checker
 * 4. kodaUnifiedPostProcessor → final polish
 * 
 * Based on Note 6 - Complete 4-layer architecture
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

import { kodaOutputStructureEngine } from '../layer1-structure/kodaOutputStructureEngine';
import { masterAnswerFormatter } from '../layer2-formatter/masterAnswerFormatter';
import { kodaAnswerValidationEngine } from '../layer3-validator/kodaAnswerValidationEngine';
import { kodaUnifiedPostProcessor } from '../layer4-postprocessor/kodaUnifiedPostProcessor';

import {
  PipelineInput,
  PipelineOutput,
} from '../types';

export class KodaAnswerPipeline {
  
  /**
   * MAIN ENTRY POINT
   * 
   * Process a raw LLM answer through the complete 4-layer pipeline.
   * 
   * Usage:
   * ```typescript
   * const result = await kodaAnswerPipeline.processAnswer({
   *   rawAnswer: llmResponse,
   *   query: userQuery,
   *   primaryIntent: 'multi_doc_comparison',
   *   answerMode: 'structured_sections',
   *   language: 'pt',
   *   sources: retrievedDocs,
   * });
   * 
   * // Stream the final answer to frontend
   * streamToFrontend(result.finalAnswer);
   * ```
   */
  public async processAnswer(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = Date.now();
    
    console.log('[Pipeline] Starting 4-layer answer processing');
    console.log(`[Pipeline] Intent: ${input.primaryIntent}, Mode: ${input.answerMode}, Language: ${input.language}`);
    
    // ========================================================================
    // LAYER 1: STRUCTURE ENGINE
    // ========================================================================
    
    console.log('[Pipeline] Layer 1: Structure Engine');
    const structureResult = kodaOutputStructureEngine.shapeAnswer({
      rawAnswer: input.rawAnswer,
      query: input.query,
      primaryIntent: input.primaryIntent,
      answerMode: input.answerMode,
      language: input.language,
      hasDocuments: input.sources.length > 0,
      sources: input.sources,
    });
    
    console.log(`[Pipeline] Structure: hasTitle=${structureResult.hasTitle}, sections=${structureResult.sectionCount}, score=${structureResult.structureScore}`);
    
    // ========================================================================
    // LAYER 2: FORMATTER
    // ========================================================================
    
    console.log('[Pipeline] Layer 2: Formatter');
    const formatterResult = masterAnswerFormatter.formatAnswer({
      structuredText: structureResult.structuredText,
      sources: input.sources,
      language: input.language,
      answerMode: input.answerMode,
      options: {
        addDocumentsUsedSection: input.options?.addDocumentsUsedSection,
        maxLength: input.options?.maxLength,
      },
    });
    
    console.log(`[Pipeline] Formatting: encoding=${formatterResult.stats.encodingFixesApplied}, duplicates=${formatterResult.stats.duplicatesRemoved}, bolding=${formatterResult.stats.boldingsApplied}`);
    
    // ========================================================================
    // LAYER 3: VALIDATOR (OPTIONAL)
    // ========================================================================
    
    let validationResult;
    
    if (!input.options?.skipValidation) {
      console.log('[Pipeline] Layer 3: Validator');
      validationResult = kodaAnswerValidationEngine.validateAnswer({
        formattedText: formatterResult.formattedText,
        query: input.query,
        sources: input.sources,
        language: input.language,
        primaryIntent: input.primaryIntent,
      });
      
      console.log(`[Pipeline] Validation: valid=${validationResult.isValid}, score=${validationResult.score}, warnings=${validationResult.warnings.length}`);
      
      // Log warnings
      if (validationResult.warnings.length > 0) {
        console.warn('[Pipeline] Validation warnings:', validationResult.warnings);
      }
      
      // Log errors
      if (validationResult.errors.length > 0) {
        console.error('[Pipeline] Validation errors:', validationResult.errors);
      }
    } else {
      console.log('[Pipeline] Layer 3: Validator (SKIPPED)');
    }
    
    // ========================================================================
    // LAYER 4: POST-PROCESSOR
    // ========================================================================
    
    console.log('[Pipeline] Layer 4: Post-Processor');
    const postProcessResult = kodaUnifiedPostProcessor.postProcess({
      formattedText: formatterResult.formattedText,
    });
    
    console.log(`[Pipeline] Post-processing: artifacts=${postProcessResult.fixes.artifactsRemoved}, markdownFixed=${postProcessResult.fixes.markdownFixed}`);
    
    // ========================================================================
    // FINAL RESULT
    // ========================================================================
    
    const totalTimeMs = Date.now() - startTime;
    
    console.log(`[Pipeline] Complete in ${totalTimeMs}ms`);
    
    return {
      finalAnswer: postProcessResult.finalText,
      structure: structureResult,
      formatting: formatterResult,
      validation: validationResult,
      postProcessing: postProcessResult,
      totalTimeMs,
    };
  }
  
  /**
   * Quick format for streaming
   * 
   * Use this for real-time streaming where you want minimal processing.
   * Only applies essential fixes (encoding, whitespace).
   */
  public quickFormat(chunk: string): string {
    // Just normalize and fix encoding
    let text = chunk;
    
    // Fix UTF-8 encoding
    const fixes: Array<[RegExp, string]> = [
      [/Ã§/g, 'ç'],
      [/Ã£/g, 'ã'],
      [/Ã©/g, 'é'],
      [/Ã¡/g, 'á'],
      [/Ã³/g, 'ó'],
      [/Ã­/g, 'í'],
      [/Ãº/g, 'ú'],
      [/Ã /g, 'à'],
      [/Ã´/g, 'ô'],
      [/Ãª/g, 'ê'],
      [/Ã¢/g, 'â'],
    ];
    
    for (const [pattern, replacement] of fixes) {
      text = text.replace(pattern, replacement);
    }
    
    // Normalize line breaks
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    return text;
  }
}

// Export singleton instance
export const kodaAnswerPipeline = new KodaAnswerPipeline();
