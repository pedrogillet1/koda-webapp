/**
 * Language Detection Service - Minimal Stub
 * Detects language and creates instructions
 */

export function detectLanguage(text: string): string {
  // Default to English for now
  // Could add simple keyword-based detection later
  return 'en';
}

export function createLanguageInstruction(language: string): string {
  if (language === 'es') {
    return 'Please respond in Spanish.';
  }
  if (language === 'fr') {
    return 'Please respond in French.';
  }
  // Default to English
  return 'Please respond in English.';
}
