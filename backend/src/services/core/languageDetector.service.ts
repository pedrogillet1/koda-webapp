/**
 * Language Detector Service
 *
 * Wrapper service that provides the interface expected by KodaIntentEngine.
 * Uses the existing languageEngine.service.ts for actual detection.
 */

import languageEngine, {
  SupportedLanguage as EngineLanguage,
  detectLanguage as engineDetectLanguage
} from '../languageEngine.service';

export type SupportedLanguage = 'en' | 'pt' | 'es';

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
}

/**
 * Convert engine language format to simple format
 */
function normalizeLanguage(lang: EngineLanguage | string): SupportedLanguage {
  if (lang === 'pt-BR' || lang === 'pt') return 'pt';
  if (lang === 'es') return 'es';
  return 'en';
}

class LanguageDetectorService {
  /**
   * Detect language from text with confidence score.
   *
   * @param text - Text to analyze
   * @param hint - Optional language hint from user preferences
   * @returns Language detection result with confidence
   */
  public detect(text: string, hint?: SupportedLanguage): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        language: hint || 'en',
        confidence: hint ? 0.8 : 0.5,
      };
    }

    // Use the existing engine detection
    const result = engineDetectLanguage(text, hint === 'pt' ? 'pt-BR' : hint || 'pt-BR');

    return {
      language: normalizeLanguage(result.language),
      confidence: result.confidence,
    };
  }

  /**
   * Simple language detection returning just the language code.
   */
  public detectSimple(text: string, hint?: SupportedLanguage): SupportedLanguage {
    return this.detect(text, hint).language;
  }

  /**
   * Check if a text is a greeting in any supported language.
   */
  public isGreeting(text: string): boolean {
    return languageEngine.isGreeting(text);
  }

  /**
   * Get system instruction suffix for LLM prompts.
   */
  public getSystemInstructionSuffix(language: SupportedLanguage): string {
    const engineLang = language === 'pt' ? 'pt-BR' : language;
    return languageEngine.getSystemInstructionSuffix(engineLang as EngineLanguage);
  }

  /**
   * Create a language instruction string for LLM prompts.
   * Used by gemini.service and openai.service.
   *
   * @param language - Language code
   * @returns Language instruction string
   */
  public createLanguageInstruction(language: SupportedLanguage | string): string {
    const lang = (language || 'en').toLowerCase();

    switch (lang) {
      case 'pt':
      case 'pt-br':
      case 'portuguese':
        return '\n\nIMPORTANT: Please respond in Portuguese (Português).';
      case 'es':
      case 'spanish':
        return '\n\nIMPORTANT: Please respond in Spanish (Español).';
      case 'en':
      case 'english':
      default:
        return '\n\nIMPORTANT: Please respond in English.';
    }
  }
}

export const languageDetectorService = new LanguageDetectorService();
export default languageDetectorService;
