/**
 * Fallback System - Barrel Export
 *
 * Exports all fallback-related services and types for easy importing.
 *
 * Usage:
 * import { fallbackDetection, fallbackResponse, psychologicalSafety } from './fallback';
 * // or
 * import fallbackDetection from './fallback/fallbackDetection.service';
 */

// Services
export { default as fallbackDetection } from './fallbackDetection.service';
export { default as fallbackResponse } from './fallbackResponse.service';
export { default as psychologicalSafety } from './psychologicalSafety.service';

// Types from detection service
export type {
  FallbackType,
  FallbackDetectionResult,
  DetectionConfig,
} from './fallbackDetection.service';

// Types from response service
export type { FallbackContext } from './fallbackResponse.service';

// Types from safety service
export type { SafetyCheckResult } from './psychologicalSafety.service';

// Test utilities (for development)
export {
  runAllTests,
  runDetectionTests,
  runResponseGenerationTests,
  runSafetyTests,
} from './fallback.test';
