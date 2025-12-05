/**
 * Language Detection Service
 *
 * Detects document language (English, Portuguese, Spanish)
 * Uses franc library for accurate detection
 *
 * Supported languages:
 * - english: PostgreSQL 'english' text search config
 * - spanish: PostgreSQL 'spanish' text search config
 * - portuguese: PostgreSQL 'portuguese' text search config
 */

import { franc } from 'franc';

export type SupportedLanguage = 'english' | 'spanish' | 'portuguese';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
  rawCode: string;
}

// Map ISO 639-3 codes to PostgreSQL text search configurations
const LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  'eng': 'english',
  'spa': 'spanish',
  'por': 'portuguese',
};

// Minimum text length for accurate detection
const MIN_TEXT_LENGTH = 50;

/**
 * Detect language from text content
 * Supports: English, Spanish, Portuguese
 *
 * @param text - Text to analyze (minimum 50 characters recommended)
 * @returns Detected language and confidence
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) {
    console.warn(`[Lang] Text too short (${text?.length || 0} chars), defaulting to English`);
    return {
      language: 'english',
      confidence: 0.5,
      rawCode: 'eng'
    };
  }

  // Use franc to detect language
  // franc returns ISO 639-3 codes (e.g., 'eng', 'spa', 'por')
  const detectedCode = franc(text, { minLength: MIN_TEXT_LENGTH });

  const language = LANGUAGE_MAP[detectedCode] || 'english';

  // Calculate confidence based on text length
  // Longer text = higher confidence
  const confidence = Math.min(text.length / 1000, 1.0);

  console.log(`[Lang] Detected: ${language} (code: ${detectedCode}, confidence: ${confidence.toFixed(2)})`);

  return {
    language,
    confidence,
    rawCode: detectedCode
  };
}

/**
 * Detect language from multiple text samples
 * Uses majority voting for more accurate detection
 *
 * @param samples - Array of text samples from the document
 * @returns Detected language with confidence
 */
export function detectLanguageFromSamples(samples: string[]): LanguageDetectionResult {
  if (!samples || samples.length === 0) {
    return {
      language: 'english',
      confidence: 0.5,
      rawCode: 'eng'
    };
  }

  // Filter samples with substantial text
  const validSamples = samples.filter(s => s && s.trim().length >= MIN_TEXT_LENGTH);

  if (validSamples.length === 0) {
    return {
      language: 'english',
      confidence: 0.5,
      rawCode: 'eng'
    };
  }

  // Detect language for each sample
  const detections = validSamples.map(sample => detectLanguage(sample));

  // Count votes for each language
  const votes: Record<SupportedLanguage, number> = {
    english: 0,
    spanish: 0,
    portuguese: 0
  };

  detections.forEach(detection => {
    votes[detection.language]++;
  });

  // Find language with most votes
  const winner = (Object.entries(votes) as [SupportedLanguage, number][])
    .reduce((a, b) => b[1] > a[1] ? b : a)[0];

  const confidence = votes[winner] / validSamples.length;

  console.log(`[Lang] Multi-sample detection: ${winner} (${votes[winner]}/${validSamples.length} votes, confidence: ${confidence.toFixed(2)})`);

  return {
    language: winner,
    confidence,
    rawCode: winner === 'english' ? 'eng' : winner === 'spanish' ? 'spa' : 'por'
  };
}

/**
 * Get PostgreSQL text search configuration name for a language
 *
 * @param language - Supported language
 * @returns PostgreSQL regconfig name
 */
export function getPostgresLanguageConfig(language: SupportedLanguage): string {
  return language; // PostgreSQL uses same names: 'english', 'spanish', 'portuguese'
}

/**
 * Validate if a language is supported
 *
 * @param language - Language to validate
 * @returns True if supported
 */
export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return ['english', 'spanish', 'portuguese'].includes(language);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return ['english', 'spanish', 'portuguese'];
}

export const languageDetectionService = {
  detectLanguage,
  detectLanguageFromSamples,
  getPostgresLanguageConfig,
  isSupportedLanguage,
  getSupportedLanguages,
};

export default languageDetectionService;
