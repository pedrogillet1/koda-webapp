/**
 * ============================================================================
 * KODA FIX #2: RESPONSE VALIDATION SERVICE
 * ============================================================================
 *
 * PURPOSE: Prevent empty or invalid responses from being saved to database
 *
 * This service validates responses before they are saved to ensure:
 * 1. Response is not empty
 * 2. Response has minimum length
 * 3. Response contains actual content (not just whitespace)
 * 4. Response quality meets minimum standards
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export interface ValidationOptions {
  minLength?: number;
  maxLength?: number;
  requireAlphanumeric?: boolean;
  checkQuality?: boolean;
  allowShortResponses?: boolean;
}

/**
 * Validate a response before saving to database
 */
export function validateResponse(
  response: string,
  options: ValidationOptions = {}
): ValidationResult {
  const {
    minLength = 10,
    maxLength = 50000,
    requireAlphanumeric = true,
    checkQuality = true,
    allowShortResponses = false
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // ============================================================================
  // CRITICAL CHECKS (must pass)
  // ============================================================================

  // Check 1: Not null or undefined
  if (response === null || response === undefined) {
    errors.push('Response is null or undefined');
    score = 0;
    return { isValid: false, errors, warnings, score };
  }

  // Check 2: Not empty string
  if (response.length === 0) {
    errors.push('Response is empty string');
    score = 0;
    return { isValid: false, errors, warnings, score };
  }

  // Check 3: Not just whitespace
  if (response.trim().length === 0) {
    errors.push('Response contains only whitespace');
    score = 0;
    return { isValid: false, errors, warnings, score };
  }

  // Check 4: Minimum length (unless short responses are allowed)
  if (!allowShortResponses && response.trim().length < minLength) {
    errors.push(`Response too short: ${response.trim().length} chars (minimum: ${minLength})`);
    score -= 50;
  }

  // Check 5: Maximum length (prevent extremely long responses)
  if (response.length > maxLength) {
    errors.push(`Response too long: ${response.length} chars (maximum: ${maxLength})`);
    score -= 30;
  }

  // Check 6: Contains alphanumeric characters
  if (requireAlphanumeric && !/[a-zA-Z0-9]/.test(response)) {
    errors.push('Response contains no alphanumeric characters');
    score -= 40;
  }

  // ============================================================================
  // QUALITY CHECKS (warnings only)
  // ============================================================================

  if (checkQuality) {
    // Warning 1: Very short response (but not empty)
    if (response.trim().length < 20) {
      warnings.push(`Very short response: ${response.trim().length} chars`);
      score -= 10;
    }

    // Warning 2: Generic "I don't know" responses
    const genericPatterns = [
      /^I don't know\.?$/i,
      /^I'm not sure\.?$/i,
      /^I cannot answer\.?$/i,
      /^I can't help with that\.?$/i,
      /^Sorry, I don't have that information\.?$/i
    ];

    if (genericPatterns.some(pattern => pattern.test(response.trim()))) {
      warnings.push('Response appears to be generic refusal');
      score -= 20;
    }

    // Warning 3: Repetitive content
    if (hasRepetitiveContent(response)) {
      warnings.push('Response contains repetitive content');
      score -= 15;
    }

    // Warning 4: Incomplete sentences
    if (hasIncompleteSentences(response)) {
      warnings.push('Response may contain incomplete sentences');
      score -= 10;
    }

    // Warning 5: Excessive special characters
    const specialCharRatio = (response.match(/[^a-zA-Z0-9\s]/g) || []).length / response.length;
    if (specialCharRatio > 0.3) {
      warnings.push(`High special character ratio: ${(specialCharRatio * 100).toFixed(1)}%`);
      score -= 10;
    }
  }

  // ============================================================================
  // FINAL VALIDATION
  // ============================================================================

  const isValid = errors.length === 0;
  score = Math.max(0, Math.min(100, score));

  return {
    isValid,
    errors,
    warnings,
    score
  };
}

/**
 * Check if response has repetitive content
 */
function hasRepetitiveContent(response: string): boolean {
  // Split into sentences
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (sentences.length < 3) return false;

  // Check for duplicate sentences
  const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
  const duplicateRatio = 1 - (uniqueSentences.size / sentences.length);

  return duplicateRatio > 0.3; // More than 30% duplicates
}

/**
 * Check if response has incomplete sentences
 */
function hasIncompleteSentences(response: string): boolean {
  // Check if response ends mid-sentence (no punctuation at end)
  const trimmed = response.trim();
  if (trimmed.length === 0) return false;

  const lastChar = trimmed[trimmed.length - 1];

  if (!['.', '!', '?', '"', "'", ')', ']', '}', ':'].includes(lastChar)) {
    return true;
  }

  // Check for sentences that are too short (< 3 words)
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const shortSentences = sentences.filter(s => s.trim().split(/\s+/).length < 3);

  return shortSentences.length > sentences.length * 0.3; // More than 30% short sentences
}

/**
 * Validate response and throw error if invalid
 * Use this in controllers before saving to database
 */
export function validateResponseOrThrow(
  response: string,
  options: ValidationOptions = {}
): void {
  const result = validateResponse(response, options);

  if (!result.isValid) {
    const errorMessage = [
      'Response validation failed:',
      ...result.errors.map(e => `  - ${e}`),
      result.warnings.length > 0 ? '\nWarnings:' : '',
      ...result.warnings.map(w => `  - ${w}`),
      `\nQuality score: ${result.score}/100`
    ].filter(Boolean).join('\n');

    throw new Error(errorMessage);
  }

  // Log warnings even if valid
  if (result.warnings.length > 0) {
    console.warn('⚠️ [RESPONSE VALIDATION] Warnings detected:');
    result.warnings.forEach(w => console.warn(`   - ${w}`));
    console.warn(`   Quality score: ${result.score}/100`);
  } else {
    console.log(`✅ [RESPONSE VALIDATION] Passed (score: ${result.score}/100)`);
  }
}

/**
 * Get a user-friendly error message for failed validation
 */
export function getValidationErrorMessage(result: ValidationResult, language: string = 'en'): string {
  if (result.isValid) {
    return '';
  }

  // Localized error messages
  const messages: Record<string, Record<string, string>> = {
    en: {
      empty: 'I encountered an issue generating a response. Please try again.',
      short: 'The response was too brief. Please try rephrasing your question.',
      quality: 'I had trouble formulating a complete response. Could you rephrase your question?',
      generic: 'Something went wrong while generating the response. Please try again.'
    },
    pt: {
      empty: 'Encontrei um problema ao gerar uma resposta. Por favor, tente novamente.',
      short: 'A resposta foi muito breve. Por favor, reformule sua pergunta.',
      quality: 'Tive problemas ao formular uma resposta completa. Você poderia reformular sua pergunta?',
      generic: 'Algo deu errado ao gerar a resposta. Por favor, tente novamente.'
    },
    es: {
      empty: 'Encontré un problema al generar una respuesta. Por favor, inténtalo de nuevo.',
      short: 'La respuesta fue demasiado breve. Por favor, reformula tu pregunta.',
      quality: 'Tuve problemas para formular una respuesta completa. ¿Podrías reformular tu pregunta?',
      generic: 'Algo salió mal al generar la respuesta. Por favor, inténtalo de nuevo.'
    }
  };

  const lang = messages[language] || messages.en;

  // Determine error type
  if (result.errors.some(e => e.includes('empty') || e.includes('whitespace'))) {
    return lang.empty;
  }
  if (result.errors.some(e => e.includes('short'))) {
    return lang.short;
  }
  if (result.warnings.length > 0) {
    return lang.quality;
  }

  return lang.generic;
}

export default {
  validateResponse,
  validateResponseOrThrow,
  getValidationErrorMessage
};
