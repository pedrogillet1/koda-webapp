/**
 * ============================================================================
 * KODA 4-LAYER ANSWER PIPELINE
 * ============================================================================
 * 
 * Main entry point for the complete answer formatting system.
 * 
 * @version 1.0.0
 * @date 2024-12-10
 */

// Main pipeline orchestrator
export { kodaAnswerPipeline, KodaAnswerPipeline } from './orchestrator/kodaAnswerPipeline';

// Individual layers (for advanced usage)
export { kodaOutputStructureEngine, KodaOutputStructureEngine } from './layer1-structure/kodaOutputStructureEngine';
export { masterAnswerFormatter, MasterAnswerFormatter } from './layer2-formatter/masterAnswerFormatter';
export { kodaAnswerValidationEngine, KodaAnswerValidationEngine } from './layer3-validator/kodaAnswerValidationEngine';
export { kodaUnifiedPostProcessor, KodaUnifiedPostProcessor } from './layer4-postprocessor/kodaUnifiedPostProcessor';

// Types
export * from './types';
