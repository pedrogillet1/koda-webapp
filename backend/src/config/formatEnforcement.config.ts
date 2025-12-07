/**
 * Format Enforcement Configuration
 *
 * Central configuration file for all format enforcement rules.
 * Import this config to customize FormatEnforcementService behavior.
 *
 * Usage:
 *   import { formatEnforcementConfig } from './config/formatEnforcement.config';
 *   const service = new FormatEnforcementService(formatEnforcementConfig);
 *
 * Or override at runtime:
 *   service.enforceFormat(text, { maxItemsPerLine: 5 });
 */

import { FormatEnforcementConfig } from '../services/formatEnforcement.service';

/**
 * Default configuration for KODA document AI responses
 */
export const formatEnforcementConfig: FormatEnforcementConfig = {
  // ═══════════════════════════════════════════════════════════════════════════
  // BULLET FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Maximum items per bullet line before splitting (default: 3) */
  maxItemsPerLine: 3,

  /** Maximum intro lines before bullets (default: 2) */
  maxIntroLines: 2,

  /** Normalize different bullet styles (-, *, •, etc.) to standard bullet (default: true) */
  normalizeBulletStyles: true,

  /** Standard bullet character to use (default: '•') */
  standardBulletChar: '•',

  /** Remove empty bullet points (default: true) */
  removeEmptyBullets: true,

  /** Remove trailing periods from short bullets (default: true) */
  removeTrailingPeriods: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  /** Remove all emojis from responses (default: true) */
  removeEmojis: true,

  /** Remove citation patterns like "According to page X" (default: true) */
  removeCitations: true,

  /** Auto-bold key values: monetary ($), percentages (%), dates, filenames (default: true) */
  autoBoldValues: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Format "Next actions:" section (normalize headers, convert to bullets) (default: true) */
  formatNextActions: true,

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════════════════════════════════════════

  /** Enable logging (default: true) */
  enableLogging: true,

  /** Log verbosity: 'silent' | 'minimal' | 'verbose' (default: 'minimal') */
  logVerbosity: 'minimal'
};

/**
 * Strict configuration - maximum formatting enforcement
 * Use for production responses that need perfect formatting
 */
export const strictConfig: Partial<FormatEnforcementConfig> = {
  maxItemsPerLine: 2,
  maxIntroLines: 2,
  removeEmojis: true,
  removeCitations: true,
  autoBoldValues: true,
  removeEmptyBullets: true,
  removeTrailingPeriods: true,
  normalizeBulletStyles: true,
  formatNextActions: true,
  enableLogging: false,
  logVerbosity: 'silent'
};

/**
 * Relaxed configuration - minimal formatting changes
 * Use when you want to preserve more of the original formatting
 */
export const relaxedConfig: Partial<FormatEnforcementConfig> = {
  maxItemsPerLine: 5,
  maxIntroLines: 3,
  removeEmojis: true,  // Still remove emojis per user requirement
  removeCitations: false,
  autoBoldValues: false,
  removeEmptyBullets: true,
  removeTrailingPeriods: false,
  normalizeBulletStyles: false,
  formatNextActions: false,
  enableLogging: true,
  logVerbosity: 'verbose'
};

/**
 * Debug configuration - verbose logging enabled
 * Use during development to trace format enforcement
 */
export const debugConfig: Partial<FormatEnforcementConfig> = {
  ...formatEnforcementConfig,
  enableLogging: true,
  logVerbosity: 'verbose'
};

/**
 * Environment-based configuration factory
 *
 * Returns appropriate configuration based on NODE_ENV:
 * - 'production': strictConfig
 * - 'development': debugConfig
 * - 'test': default config with silent logging
 */
export function getConfigForEnvironment(): FormatEnforcementConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return { ...formatEnforcementConfig, ...strictConfig };
    case 'test':
      return { ...formatEnforcementConfig, enableLogging: false, logVerbosity: 'silent' };
    case 'development':
    default:
      return { ...formatEnforcementConfig, ...debugConfig };
  }
}

export default formatEnforcementConfig;
