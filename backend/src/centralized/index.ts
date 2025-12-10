/**
 * ============================================================================
 * KODA CENTRALIZED SYSTEM - Main Export
 * ============================================================================
 *
 * This is the main entry point for the centralized pattern and formatting system.
 * Import everything you need from this file.
 *
 * Usage:
 *   import { kodaCentralizedEngine, centralizedPatternMatcher } from '../centralized';
 *   import { QueryIntent, AnswerMode, LanguageCode } from '../centralized';
 *
 * ============================================================================
 */

// Export all types
export * from './types';

// Export formatters
export * from './formatters/answerModeTemplates';
export * from './formatters/centralizedAnswerFormatter';

// Export services
export * from './services/centralizedPatternMatcher';
export * from './services/kodaCentralizedEngine';
